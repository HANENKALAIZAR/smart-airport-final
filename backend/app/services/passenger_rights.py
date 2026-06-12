"""
Passenger Rights Service
========================
Global air passenger rights based on flight origin region and delay.
Supports: EU (EC 261/2004), UK (UK 261), US (DOT), Canada (APPR), OTHER.
Fetches all compensation amounts from the database (passenger_rights + compensation_limits).
"""

from datetime import datetime, timezone, date
from sqlalchemy.orm import Session
from app.models.models import Flight, Airport, PassengerRight, CompensationLimit
from app.schemas.schemas import PassengerRightOut, CompensationLimitOut, CompensationConfigOut


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _today() -> date:
    return _now_utc().date()


def get_applicable_rights(
    db: Session,
    flight: Flight,
) -> list[PassengerRightOut]:
    """
    Determine which passenger rights apply to a flight based on:
    - Origin region (departure airport country determines the category)
    - Destination region (may trigger additional rights for EU/UK)
    - Current delay in minutes
    - Route distance in km
    - Active regulation check (is_active + valid date range)
    """
    if flight.delay_minutes <= 0 and flight.status not in ("delayed", "cancelled"):
        return []

    delay = flight.delay_minutes
    distance = flight.distance_km

    origin = db.query(Airport).filter(Airport.id == flight.origin_airport_id).first()
    dest = db.query(Airport).filter(Airport.id == flight.dest_airport_id).first()

    if not origin or not dest:
        return []

    regions = set()

    if origin.region == "EU" or dest.region == "EU":
        regions.add("EU")

    if origin.region == "UK" or dest.region == "UK":
        regions.add("UK")

    if origin.region == "US" or dest.region == "US":
        regions.add("US")

    if origin.region == "CA" or dest.region == "CA":
        regions.add("CA")

    if not regions:
        regions.add("OTHER")

    today = _today()
    all_rights = (
        db.query(PassengerRight)
        .filter(
            PassengerRight.region.in_(regions),
            PassengerRight.delay_threshold_min <= delay,
            PassengerRight.is_active == True,
            (PassengerRight.valid_from == None) | (PassengerRight.valid_from <= today),
            (PassengerRight.valid_to == None) | (PassengerRight.valid_to >= today),
        )
        .order_by(PassengerRight.delay_threshold_min)
        .all()
    )

    applicable = []
    for right in all_rights:
        if right.distance_min_km is not None and distance < right.distance_min_km:
            continue
        if right.distance_max_km is not None and distance > right.distance_max_km:
            continue
        applicable.append(PassengerRightOut.model_validate(right))

    return applicable


def get_compensation_config(db: Session) -> CompensationConfigOut:
    """
    Build the complete compensation configuration for frontend / AI consumption.
    Returns all active regulations and limits from the database.
    """
    today = _today()
    regulations = (
        db.query(PassengerRight)
        .filter(
            PassengerRight.is_active == True,
            (PassengerRight.valid_from == None) | (PassengerRight.valid_from <= today),
            (PassengerRight.valid_to == None) | (PassengerRight.valid_to >= today),
        )
        .order_by(PassengerRight.region, PassengerRight.delay_threshold_min)
        .all()
    )
    limits = (
        db.query(CompensationLimit)
        .filter(
            CompensationLimit.is_active == True,
            (CompensationLimit.valid_from == None) | (CompensationLimit.valid_from <= today),
            (CompensationLimit.valid_to == None) | (CompensationLimit.valid_to >= today),
        )
        .order_by(CompensationLimit.region, CompensationLimit.category)
        .all()
    )
    return CompensationConfigOut(
        regulations=[PassengerRightOut.model_validate(r) for r in regulations],
        limits=[CompensationLimitOut.model_validate(l) for l in limits],
        generated_at=_now_utc(),
    )


def resolve_region_from_airport_iata(iata: str) -> str | None:
    """
    Map an airport IATA code to its passenger-rights region.
    Returns region code: EU, UK, US, CA, or None (falls to OTHER).
    """
    EU_IATAS = {"CDG", "ORY", "FRA", "FCO", "MAD", "BCN", "AMS", "BRU", "VIE", "MUC", "GVA", "LYS", "NCE", "MRS", "MLA", "TLS", "BOD", "LIS", "OPO", "DUB", "CPH", "ARN", "OSL", "HEL", "ZRH", "WAW", "PRG", "BUD", "ATH", "IST"}
    UK_IATAS = {"LHR", "LGW", "STN", "LTN", "SEN", "LCY", "MAN", "EDI", "GLA", "BHX", "BRS", "LPL", "NCL", "EMA", "ABZ", "BFS", "CWL", "SOU", "EXT", "NQY"}
    US_IATAS = {"JFK", "EWR", "LGA", "ORD", "DFW", "LAX", "SFO", "MIA", "ATL", "BOS", "SEA", "PHX", "DEN", "IAH", "MCO", "CLT", "PHL", "DCA", "BWI", "SLC", "SAN", "TPA", "STL", "PDX"}
    CA_IATAS = {"YYZ", "YVR", "YUL", "YYC", "YOW", "YHZ", "YEG", "YWG", "YQB", "YXE", "YYJ", "YTZ"}

    if iata in EU_IATAS:
        return "EU"
    if iata in UK_IATAS:
        return "UK"
    if iata in US_IATAS:
        return "US"
    if iata in CA_IATAS:
        return "CA"
    return None
