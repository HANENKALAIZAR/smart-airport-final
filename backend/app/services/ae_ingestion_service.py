"""
Aviation Edge Ingestion Service
================================
Fetches live + timetable data from Aviation Edge, persists every record
as a snapshot (upsert), then rebuilds the ML-ready dataset row.

Public API:
  ingest_airport(airport_iata, direction, db) -> SyncStats
  run_full_ingestion(db)                       -> dict
"""

import logging
import math
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.api_clients.aviation_edge_client import fetch_all_flights
from app.models.ae_models import AEFlightSnapshot, AEFlightDataset, AESyncLog

logger = logging.getLogger(__name__)

# ── Airport coordinates for distance calculation ──────────────────────────────
_LATLON: dict[str, tuple[float, float]] = {
    "TUN": (36.851, 10.227), "MIR": (35.758, 10.755),
    "NBE": (36.076, 10.439), "DJE": (33.875, 10.775),
    "TOE": (33.939, 8.110),
    "CDG": (49.009, 2.548),  "ORY": (48.725, 2.360),
    "LHR": (51.477, -0.461), "FRA": (50.033, 8.571),
    "FCO": (41.800, 12.239), "MXP": (45.630, 8.728),
    "MAD": (40.494, -3.567), "BCN": (41.297, 2.078),
    "IST": (40.977, 28.815), "SAW": (40.898, 29.309),
    "DOH": (25.273, 51.608), "DXB": (25.253, 55.366),
    "AMM": (31.723, 35.993), "CAI": (30.122, 31.406),
    "JED": (21.679, 39.157), "CMN": (33.368, -7.590),
    "ALG": (36.691, 3.215),  "GVA": (46.238, 6.109),
    "BRU": (50.901, 4.484),  "VIE": (48.110, 16.570),
    "MUC": (48.354, 11.786), "DUS": (51.289, 6.767),
    "LYS": (45.726, 5.091),  "NCE": (43.658, 7.217),
    "MRS": (43.436, 5.215),  "MLA": (35.857, 14.477),
    "DSS": (14.670, -17.073),"YUL": (45.458, -73.749),
    "BHX": (52.453, -1.748), "LGW": (51.148, -0.190),
    "AMS": (52.309, 4.764),  "FCO": (41.800, 12.239),
    "ZRH": (47.464, 8.549),  "CPH": (55.618, 12.656),
    "ATH": (37.936, 23.944), "LIS": (38.774, -9.135),
    "MAN": (53.354, -2.275), "ORD": (41.978, -87.905),
    "JFK": (40.640, -73.779),"LAX": (33.943, -118.408),
    "DFW": (32.897, -97.038),"MIA": (25.796, -80.288),
}


# Median great-circle distance for the Tunisian route network (km).
# Used as a non-null fallback when both airport IATA codes are unknown.
_FALLBACK_DISTANCE_KM = 1_800


def _haversine_km(iata1: Optional[str], iata2: Optional[str]) -> int:
    """Return Haversine distance in km. Falls back to _FALLBACK_DISTANCE_KM if
    either airport is not in _LATLON, ensuring distance_km is never NULL."""
    c1 = _LATLON.get(iata1 or "")
    c2 = _LATLON.get(iata2 or "")
    if not c1 or not c2:
        return _FALLBACK_DISTANCE_KM
    R = 6371
    lat1, lon1 = map(math.radians, c1)
    lat2, lon2 = map(math.radians, c2)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def _parse_dt(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt)
        except (ValueError, TypeError):
            continue
    return None


def _safe_int(v) -> Optional[int]:
    try:
        return int(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _safe_float(v) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


# ── Status normalisation ─────────────────────────────────────────────────────
_STATUS_ENC = {
    "scheduled": 0,
    "on_time":   1,
    "boarding":  2,
    "delayed":   3,
    "in_air":    4,
    "landed":    5,
    "cancelled": 6,
    "stale_unresolved": 7,
}

_PEAK_HOURS = {7, 8, 9, 17, 18, 19, 20}

_STATUS_PROGRESS = {
    "scheduled": 0,
    "boarding": 1,
    "taxiing": 2,
    "in_air": 3,
    "landed": 4,
}

def resolve_next_status(existing_status: Optional[str], incoming_status: str, is_telemetry_stale: bool = False) -> str:
    """
    Resolve next status using transition rules:
    - Normal progress flow: scheduled (0) -> boarding (1) -> taxiing (2) -> in_air (3) -> landed (4)
    - Reversions to earlier progress states are blocked (e.g. in_air cannot go back to taxiing or scheduled).
    - Landed and cancelled are terminal: once landed or cancelled, they can never revert or change.
    - Delayed can be entered from any non-terminal state, and transitioned out of to progress states.
    - If telemetry is stale, we do not force in_air (if the incoming is in_air), and preserve the last valid status instead.
    """
    if not existing_status:
        return incoming_status if incoming_status else "scheduled"

    existing_status = existing_status.lower()
    incoming_status = incoming_status.lower() if incoming_status else "scheduled"

    # Terminal state guards
    if existing_status == "landed":
        return "landed"
    if existing_status == "cancelled":
        return "cancelled"

    # Stale telemetry handling: if incoming is in_air but we determined telemetry is stale,
    # we don't force 'in_air'. We preserve the existing state or fall back.
    if incoming_status == "in_air" and is_telemetry_stale:
        logger.warning(f"[AE Status Guard] Telemetry stale: blocking transition to in_air. Keeping existing status: '{existing_status}'")
        return existing_status

    # Progress rankings
    prog_existing = _STATUS_PROGRESS.get(existing_status)
    prog_incoming = _STATUS_PROGRESS.get(incoming_status)

    if incoming_status == "cancelled":
        return "cancelled"

    if incoming_status == "delayed":
        return "delayed"
    
    if existing_status == "delayed":
        return incoming_status

    # Check progress regression
    if prog_existing is not None and prog_incoming is not None:
        if prog_incoming < prog_existing:
            logger.warning(f"[AE Status Guard] Blocked status regression: '{existing_status}' -> '{incoming_status}'")
            return existing_status

    return incoming_status



def _encode_categorical(encoder_name: str, value: Optional[str]) -> int:
    """
    Encode a raw string value using the persistent PersistentLabelEncoder
    from feature_engineering.py.

    Returns 0 (UNKNOWN code) on any error so the ingestion pipeline never
    crashes due to encoder unavailability.
    """
    try:
        from app.ml.feature_engineering import _get_encoders
        enc_airline, enc_dep, enc_arr = _get_encoders()
        mapping = {
            "airline":     enc_airline,
            "dep_airport": enc_dep,
            "arr_airport": enc_arr,
        }
        encoder = mapping.get(encoder_name)
        if encoder is None:
            return 0
        # Extend with this new value before transforming
        if value is not None:
            encoder.fit_extend([value])
        return encoder.transform(value)
    except Exception as e:
        logger.debug(f"[AE Ingest] _encode_categorical({encoder_name}, {value}): {e}")
        return 0


# ── Snapshot building ─────────────────────────────────────────────────────────

def _build_snapshot(
    flight: dict,
    airport_iata: str,
    today: date,
    status: str,
    departed_at: Optional[datetime],
    airborne_at: Optional[datetime],
    landed_at: Optional[datetime],
    last_status_change: Optional[datetime],
    last_position_update: Optional[datetime]
) -> dict:
    live = flight.get("live") or {}
    return {
        "flight_number":  flight.get("flight_number", ""),
        "flight_date":    _parse_dt(flight.get("dep_scheduled") or flight.get("arr_scheduled")),
        "snapshot_date":  today,
        "collected_at":   datetime.now(timezone.utc),
        "airport_iata":   airport_iata,
        "direction":      flight.get("direction", "departure"),
        "source":         "aviation_edge",

        "airline_name":   flight.get("airline_name"),
        "airline_iata":   flight.get("airline_iata"),
        "airline_icao":   flight.get("airline_icao"),

        "dep_iata":       flight.get("dep_iata"),
        "dep_airport":    flight.get("dep_airport"),
        "dep_terminal":   flight.get("dep_terminal"),
        "dep_gate":       flight.get("dep_gate"),
        "dep_scheduled":  _parse_dt(flight.get("dep_scheduled")),
        "dep_estimated":  _parse_dt(flight.get("dep_estimated")),
        "dep_actual":     _parse_dt(flight.get("dep_actual")),
        "dep_delay_min":  _safe_int(flight.get("dep_delay")),

        "arr_iata":       flight.get("arr_iata"),
        "arr_airport":    flight.get("arr_airport"),
        "arr_terminal":   flight.get("arr_terminal"),
        "arr_gate":       flight.get("arr_gate"),
        "arr_scheduled":  _parse_dt(flight.get("arr_scheduled")),
        "arr_estimated":  _parse_dt(flight.get("arr_estimated")),
        "arr_actual":     _parse_dt(flight.get("arr_actual")),
        "arr_delay_min":  _safe_int(flight.get("arr_delay")),

        "status":         status,
        "raw_status":     flight.get("status"),
        "delay_minutes":  _safe_int(flight.get("delay_minutes")),

        "departed_at":    departed_at,
        "airborne_at":    airborne_at,
        "landed_at":      landed_at,
        "last_status_change": last_status_change,
        "last_position_update": last_position_update,

        "aircraft_type":  flight.get("aircraft_type") or None,
        "aircraft_reg":   flight.get("aircraft_reg") or None,

        "latitude":       _safe_float(live.get("latitude")),
        "longitude":      _safe_float(live.get("longitude")),
        "altitude_ft":    _safe_float(live.get("altitude")),
        "speed_kmh":      _safe_float(live.get("speed")),
        "heading_deg":    _safe_float(live.get("direction")),
        "is_ground":      bool(live.get("is_ground")) if live.get("is_ground") is not None else None,
    }



# ── Dataset row building ──────────────────────────────────────────────────────

def _build_dataset_row(snap: dict) -> dict:
    dep_dt: Optional[datetime] = snap.get("dep_scheduled")
    arr_dt: Optional[datetime] = snap.get("arr_scheduled")
    flight_date_val: Optional[date] = dep_dt.date() if dep_dt else (arr_dt.date() if arr_dt else snap["snapshot_date"])

    delay = snap.get("delay_minutes") or 0
    dep_delay = snap.get("dep_delay_min") or 0
    arr_delay = snap.get("arr_delay_min") or 0
    is_delayed = 1 if delay > 15 or dep_delay > 15 or arr_delay > 15 else 0

    dep_hour = dep_dt.hour if dep_dt else None
    dep_dow  = dep_dt.weekday() if dep_dt else None   # 0=Mon
    dep_month = dep_dt.month if dep_dt else None
    dep_week  = dep_dt.isocalendar()[1] if dep_dt else None
    is_weekend = 1 if dep_dow in (5, 6) else 0 if dep_dow is not None else 0
    is_peak = 1 if dep_hour in _PEAK_HOURS else 0

    dist = _haversine_km(snap.get("dep_iata"), snap.get("arr_iata"))
    dur = None
    if dep_dt and arr_dt:
        diff = (arr_dt - dep_dt).total_seconds() / 60
        if 0 < diff < 1440:
            dur = round(diff)

    # Simple completeness score: fraction of key columns that are non-null
    key_cols = [
        snap.get("dep_iata"), snap.get("arr_iata"), snap.get("airline_iata"),
        snap.get("dep_scheduled"), snap.get("arr_scheduled"),
        snap.get("status"),
    ]
    completeness = sum(1 for v in key_cols if v is not None) / len(key_cols)
    usable = completeness >= 0.5 and snap.get("flight_number", "") not in ("—", "", None)

    return {
        "flight_number":   snap["flight_number"],
        "flight_date":     flight_date_val,
        "airport_iata":    snap["airport_iata"],
        "direction":       snap["direction"],
        "airline_iata":    snap.get("airline_iata"),
        "dep_iata":        snap.get("dep_iata"),
        "arr_iata":        snap.get("arr_iata"),

        "is_delayed":      is_delayed,
        "delay_minutes":   delay,
        "final_status":    snap.get("status"),

        "departed_at":     snap.get("departed_at"),
        "airborne_at":     snap.get("airborne_at"),
        "landed_at":       snap.get("landed_at"),
        "last_status_change": snap.get("last_status_change"),
        "last_position_update": snap.get("last_position_update"),

        "dep_hour":        dep_hour,
        "dep_day_of_week": dep_dow,
        "dep_month":       dep_month,
        "dep_week":        dep_week,
        "is_weekend":      is_weekend,
        "is_peak_hour":    is_peak,

        "distance_km":     dist,
        "duration_min":    dur,
        "dep_delay_min":   dep_delay or None,
        "arr_delay_min":   arr_delay or None,

        # Categorical encodings — populated via persistent LabelEncoders.
        # We call the encoder singletons here so that newly ingested rows
        # already have valid integer codes without needing a separate rebuild.
        "airline_enc":     _encode_categorical("airline",     snap.get("airline_iata")),
        "dep_airport_enc": _encode_categorical("dep_airport", snap.get("dep_iata")),
        "arr_airport_enc": _encode_categorical("arr_airport", snap.get("arr_iata")),
        "status_enc":      _STATUS_ENC.get(snap.get("status", ""), 0),

        "latitude":        snap.get("latitude"),
        "longitude":       snap.get("longitude"),
        "altitude_ft":     snap.get("altitude_ft"),
        "speed_kmh":       snap.get("speed_kmh"),

        "completeness":    round(completeness, 3),
        "usable_for_ml":   usable,
    }


# ── Core ingestion function ───────────────────────────────────────────────────

class SyncStats:
    __slots__ = ("fetched", "snapshots_upserted", "dataset_upserted", "errors")
    def __init__(self):
        self.fetched = 0
        self.snapshots_upserted = 0
        self.dataset_upserted = 0
        self.errors = 0


async def ingest_airport(airport_iata: str, direction: str, db: Session) -> SyncStats:
    """
    Main ingestion entry point for one airport/direction.
    1. Fetch live+timetable from Aviation Edge
    2. Upsert each flight into ae_flight_snapshots
    3. Build and upsert ML row in ae_flight_dataset
    4. Write ae_sync_log entry
    """
    stats = SyncStats()
    today = datetime.now(timezone.utc).date()
    started = datetime.now(timezone.utc)

    # --- Create sync log entry (running) ---
    log = AESyncLog(
        started_at=started,
        airport_iata=airport_iata,
        direction=direction,
        status="running",
    )
    db.add(log)
    db.flush()

    try:
        flights = await fetch_all_flights(airport_iata, direction)
        stats.fetched = len(flights)

        for flight in flights:
            fnum = flight.get("flight_number", "")
            if not fnum or fnum == "—":
                continue

            try:
                # 1. Query existing snapshot to feed the state machine
                existing_snap = (
                    db.query(AEFlightSnapshot)
                    .filter(
                        AEFlightSnapshot.flight_number == fnum,
                        AEFlightSnapshot.snapshot_date == today,
                        AEFlightSnapshot.airport_iata == airport_iata,
                        AEFlightSnapshot.direction == direction
                    )
                    .first()
                )

                existing_status = existing_snap.status if existing_snap else None
                existing_departed_at = existing_snap.departed_at if existing_snap else None
                existing_airborne_at = existing_snap.airborne_at if existing_snap else None
                existing_landed_at = existing_snap.landed_at if existing_snap else None
                existing_last_status_change = existing_snap.last_status_change if existing_snap else None
                existing_last_position_update = existing_snap.last_position_update if existing_snap else None

                # Determine if incoming flight has live telemetry update
                incoming_has_gps = False
                live_gps = flight.get("live") or {}
                if live_gps.get("latitude") is not None and live_gps.get("longitude") is not None:
                    incoming_has_gps = True

                now_dt = datetime.now(timezone.utc)

                # Resolve telemetry staleness (15 minute threshold)
                is_telemetry_stale = False
                if existing_last_position_update:
                    elpu = existing_last_position_update
                    if elpu.tzinfo is None:
                        elpu = elpu.replace(tzinfo=timezone.utc)
                    if (now_dt - elpu).total_seconds() > 900:  # 15 minutes
                        is_telemetry_stale = True

                # Secondary stale check if stuck in 'in_air' status without any GPS update
                if existing_status == "in_air" and existing_last_status_change and not incoming_has_gps:
                    elsc = existing_last_status_change
                    if elsc.tzinfo is None:
                        elsc = elsc.replace(tzinfo=timezone.utc)
                    if (now_dt - elsc).total_seconds() > 900:
                        is_telemetry_stale = True

                # Resolve next status via state machine
                raw_incoming_status = flight.get("status", "scheduled")
                resolved_status = resolve_next_status(existing_status, raw_incoming_status, is_telemetry_stale)

                # Maintain lifecycle timestamps
                last_position_update = now_dt if incoming_has_gps else existing_last_position_update

                if existing_status != resolved_status:
                    last_status_change = now_dt
                    logger.info(f"[AE Ingestion Status Change] Flight {fnum}: {existing_status} -> {resolved_status}")
                else:
                    last_status_change = existing_last_status_change or now_dt

                # departed_at
                departed_at = existing_departed_at
                if resolved_status in ("taxiing", "in_air") and not departed_at:
                    dep_actual_parsed = _parse_dt(flight.get("dep_actual"))
                    departed_at = dep_actual_parsed or now_dt

                # airborne_at
                airborne_at = existing_airborne_at
                if resolved_status == "in_air" and not airborne_at:
                    airborne_at = now_dt

                # landed_at
                landed_at = existing_landed_at
                if resolved_status == "landed" and not landed_at:
                    arr_actual_parsed = _parse_dt(flight.get("arr_actual"))
                    landed_at = arr_actual_parsed or now_dt

                snap = _build_snapshot(
                    flight=flight,
                    airport_iata=airport_iata,
                    today=today,
                    status=resolved_status,
                    departed_at=departed_at,
                    airborne_at=airborne_at,
                    landed_at=landed_at,
                    last_status_change=last_status_change,
                    last_position_update=last_position_update
                )

                # UPSERT snapshot (PostgreSQL ON CONFLICT DO UPDATE)
                stmt = (
                    pg_insert(AEFlightSnapshot)
                    .values(**snap)
                    .on_conflict_do_update(
                        index_elements=["flight_number", "snapshot_date", "airport_iata", "direction"],
                        set_={
                            "collected_at":     snap["collected_at"],
                            "status":           snap["status"],
                            "raw_status":       snap["raw_status"],
                            "delay_minutes":    snap["delay_minutes"],
                            "dep_actual":       snap["dep_actual"],
                            "arr_actual":       snap["arr_actual"],
                            "dep_estimated":    snap["dep_estimated"],
                            "arr_estimated":    snap["arr_estimated"],
                            "dep_gate":         snap["dep_gate"],
                            "arr_gate":         snap["arr_gate"],
                            "dep_terminal":     snap["dep_terminal"],
                            "arr_terminal":     snap["arr_terminal"],
                            "dep_delay_min":    snap["dep_delay_min"],
                            "arr_delay_min":    snap["arr_delay_min"],
                            "latitude":         snap["latitude"],
                            "longitude":        snap["longitude"],
                            "altitude_ft":      snap["altitude_ft"],
                            "speed_kmh":        snap["speed_kmh"],
                            "heading_deg":      snap["heading_deg"],
                            "is_ground":        snap["is_ground"],
                            "aircraft_type":    snap["aircraft_type"],
                            "aircraft_reg":     snap["aircraft_reg"],
                            # Lifecycle columns
                            "departed_at":      snap["departed_at"],
                            "airborne_at":      snap["airborne_at"],
                            "landed_at":        snap["landed_at"],
                            "last_status_change": snap["last_status_change"],
                            "last_position_update": snap["last_position_update"],
                        },
                    )
                )
                db.execute(stmt)
                stats.snapshots_upserted += 1

                # ── FA Verification Flag: detect gaps in AE data ──────────────
                # After upsert, flag this snapshot if AE data has a known gap
                # that FlightAware can fill. We use a targeted UPDATE to avoid
                # disturbing FA-enriched fields already on the row.
                now_dt_check = datetime.now(timezone.utc)
                dep_sched_parsed = _parse_dt(flight.get("dep_scheduled"))
                arr_sched_parsed = _parse_dt(flight.get("arr_scheduled"))

                needs_verify = False
                verify_reason_parts = []

                # Gap 1: gate and terminal both missing
                if not snap.get("dep_gate") and not snap.get("arr_gate"):
                    if dep_sched_parsed:
                        gate_horizon_secs = 4 * 3600  # 4 hours
                        secs_until_dep = (dep_sched_parsed - now_dt_check).total_seconds()
                        if abs(secs_until_dep) < gate_horizon_secs:
                            needs_verify = True
                            verify_reason_parts.append("no_gate")

                # Gap 2: dep_actual missing and flight was >20 min ago
                if not snap.get("dep_actual") and dep_sched_parsed:
                    if dep_sched_parsed.tzinfo is None:
                        dep_sched_check = dep_sched_parsed.replace(tzinfo=timezone.utc)
                    else:
                        dep_sched_check = dep_sched_parsed
                    if (now_dt_check - dep_sched_check).total_seconds() > 20 * 60:
                        needs_verify = True
                        verify_reason_parts.append("no_dep_actual")

                # Gap 3: arr_actual missing and arr was >30 min ago (non-scheduled)
                if resolved_status not in ("scheduled", "delayed"):
                    if not snap.get("arr_actual") and arr_sched_parsed:
                        if arr_sched_parsed.tzinfo is None:
                            arr_sched_check = arr_sched_parsed.replace(tzinfo=timezone.utc)
                        else:
                            arr_sched_check = arr_sched_parsed
                        if (now_dt_check - arr_sched_check).total_seconds() > 30 * 60:
                            needs_verify = True
                            verify_reason_parts.append("no_arr_actual")

                if needs_verify:
                    verify_reason = ",".join(verify_reason_parts)
                    try:
                        from sqlalchemy import update as sa_update
                        db.execute(
                            sa_update(AEFlightSnapshot)
                            .where(
                                AEFlightSnapshot.flight_number == fnum,
                                AEFlightSnapshot.snapshot_date == today,
                                AEFlightSnapshot.airport_iata == airport_iata,
                                AEFlightSnapshot.direction == direction,
                            )
                            .values(needs_fa_verification=True, fa_call_reason=verify_reason)
                        )
                        logger.debug(
                            f"[AE Ingest] {fnum} flagged for FA verification: {verify_reason}"
                        )
                    except Exception as flag_err:
                        logger.debug(f"[AE Ingest] Could not set FA flag for {fnum}: {flag_err}")

                # Build ML dataset row
                ds_row = _build_dataset_row(snap)
                ds_stmt = (
                    pg_insert(AEFlightDataset)
                    .values(**ds_row)
                    .on_conflict_do_update(
                        index_elements=["flight_number", "flight_date", "airport_iata", "direction"],
                        set_={k: v for k, v in ds_row.items()
                              if k not in ("flight_number", "flight_date", "airport_iata", "direction")},
                    )
                )
                db.execute(ds_stmt)
                stats.dataset_upserted += 1

            except Exception as e:
                logger.warning(f"[AE Ingest] Error saving flight {fnum}: {e}")
                stats.errors += 1
                continue

        db.commit()

        # Finalize sync log
        log.finished_at = datetime.now(timezone.utc)
        log.flights_fetched = stats.fetched
        log.snapshots_upserted = stats.snapshots_upserted
        log.dataset_upserted = stats.dataset_upserted
        log.errors = stats.errors
        log.status = "ok" if stats.errors == 0 else "partial"
        db.commit()

        logger.info(
            f"[AE Ingest] {airport_iata}/{direction}: "
            f"fetched={stats.fetched} snapshots={stats.snapshots_upserted} "
            f"dataset={stats.dataset_upserted} errors={stats.errors}"
        )

    except Exception as e:
        db.rollback()
        log.status = "error"
        log.error_detail = str(e)
        log.finished_at = datetime.now(timezone.utc)
        try:
            db.commit()
        except Exception:
            pass
        logger.error(f"[AE Ingest] Fatal error for {airport_iata}/{direction}: {e}")
        raise

    return stats


async def run_full_ingestion(db: Session) -> dict:
    """
    Run ingestion for all Tunisian airports × both directions.
    Called by the scheduler job.
    """
    airports = ["TUN", "MIR", "NBE", "DJE"]  # Supported Tunisian airports
    directions = ["departure", "arrival"]
    totals = {
        "fetched": 0,
        "snapshots_upserted": 0,
        "dataset_upserted": 0,
        "errors": 0,
        "airports_processed": 0,
    }

    for iata in airports:
        for direction in directions:
            try:
                stats = await ingest_airport(iata, direction, db)
                totals["fetched"] += stats.fetched
                totals["snapshots_upserted"] += stats.snapshots_upserted
                totals["dataset_upserted"] += stats.dataset_upserted
                totals["errors"] += stats.errors
            except Exception as e:
                logger.error(f"[AE Full Ingest] Skipped {iata}/{direction}: {e}")
                totals["errors"] += 1
        totals["airports_processed"] += 1

    logger.info(f"[AE Full Ingest] Complete: {totals}")
    return totals
