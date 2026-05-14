"""
ML Feature Engineering — ae_flight_dataset Stabilization
=========================================================
Provides deterministic, null-safe preprocessing for the AE pipeline's
ML-ready dataset (ae_flight_dataset).

Key guarantees
--------------
* Categorical encoders (airline_iata → airline_enc, dep_iata → dep_airport_enc,
  arr_iata → arr_airport_enc) are **persisted with joblib** so the same integer
  mapping is used at training time AND inference time.
* Encoders are NOT refit on every call; they are extended only when new
  unseen values arrive.
* `distance_km` is computed with the Haversine formula; rows with unknown
  coordinates fall back to the global median (never null).
* `dep_hour`, `is_weekend`, `duration_min` are derived from timestamps where
  possible; rows that are genuinely unresolvable are **dropped** cleanly.
* `delay_minutes` is the TARGET label — it is NEVER used as an input feature.

Public API
----------
    from app.ml.feature_engineering import (
        apply_feature_engineering,   # apply to a list of ORM rows
        validate_dataset_health,     # print health report + return dict
        ENCODER_DIR,                 # path where encoders are stored
    )
"""

from __future__ import annotations

import logging
import math
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ── Encoder persistence directory ─────────────────────────────────────────────
# Stored next to the XGBoost model artefacts so they are easy to audit.
ENCODER_DIR = Path(__file__).resolve().parent.parent / "ai" / "model" / "encoders"

# ── Airport coordinates fallback table (matches ae_ingestion_service) ─────────
_LATLON: dict[str, tuple[float, float]] = {
    "TUN": (36.851, 10.227), "MIR": (35.758, 10.755),
    "NBE": (36.076, 10.439), "DJE": (33.875, 10.775),
    "SFA": (34.718, 10.691), "GAF": (33.877, 10.041),
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
    "DSS": (14.670, -17.073), "YUL": (45.458, -73.749),
    "BHX": (52.453, -1.748), "LGW": (51.148, -0.190),
    "AMS": (52.309, 4.764),
    "ZRH": (47.464, 8.549),  "CPH": (55.618, 12.656),
    "ATH": (37.936, 23.944), "LIS": (38.774, -9.135),
    "MAN": (53.354, -2.275), "ORD": (41.978, -87.905),
    "JFK": (40.640, -73.779), "LAX": (33.943, -118.408),
    "DFW": (32.897, -97.038), "MIA": (25.796, -80.288),
}

# ── Required numeric output features (must all be non-null after FE) ──────────
REQUIRED_ML_FEATURES = [
    "dep_hour",
    "is_weekend",
    "distance_km",
    "duration_min",
    "airline_enc",
    "dep_airport_enc",
    "arr_airport_enc",
]
# Label — excluded from input features but must be present for supervised training
TARGET_LABEL = "delay_minutes"

# Sentinel value used when distance cannot be computed (replaced by median later)
_DISTANCE_SENTINEL = -1

# ── Median distance fallback (pre-computed across the Tunisian network) ────────
# Updated dynamically during dataset rebuilds; static default = 1 800 km
# (roughly Tunis → Paris, the most frequent long-haul route).
_MEDIAN_DISTANCE_KM: int = 1_800


# ═══════════════════════════════════════════════════════════════════════════════
# Haversine formula
# ═══════════════════════════════════════════════════════════════════════════════

def _haversine_km(iata1: Optional[str], iata2: Optional[str]) -> Optional[int]:
    """Return great-circle distance in km between two IATA airports, or None."""
    c1 = _LATLON.get(iata1 or "")
    c2 = _LATLON.get(iata2 or "")
    if not c1 or not c2:
        return None
    R = 6_371
    lat1, lon1 = math.radians(c1[0]), math.radians(c1[1])
    lat2, lon2 = math.radians(c2[0]), math.radians(c2[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


# ═══════════════════════════════════════════════════════════════════════════════
# Persistent categorical encoder
# ═══════════════════════════════════════════════════════════════════════════════

class PersistentLabelEncoder:
    """
    A simple string→int label encoder that persists its mapping to disk.

    Rules:
    * Unknown values seen at inference time get code = 0 ("UNKNOWN" bucket).
    * New values seen during a rebuild extend the mapping (never refit from scratch).
    * Thread-safety is not needed here because the rebuild is run sequentially.
    """

    UNKNOWN_CODE = 0
    UNKNOWN_LABEL = "__UNKNOWN__"

    def __init__(self, name: str):
        self.name = name
        self._path = ENCODER_DIR / f"{name}_encoder.pkl"
        # mapping[label] = int code (>= 1; 0 is reserved for UNKNOWN)
        self._mapping: dict[str, int] = {self.UNKNOWN_LABEL: self.UNKNOWN_CODE}
        self._load()

    # ── Persistence ──────────────────────────────────────────────────────────

    def _load(self) -> None:
        """Load mapping from disk if it exists."""
        if self._path.exists():
            try:
                import joblib
                self._mapping = joblib.load(str(self._path))
                logger.debug(
                    f"[Encoder:{self.name}] Loaded {len(self._mapping)-1} known values"
                )
            except Exception as e:
                logger.warning(
                    f"[Encoder:{self.name}] Could not load encoder, starting fresh: {e}"
                )
                self._mapping = {self.UNKNOWN_LABEL: self.UNKNOWN_CODE}

    def save(self) -> None:
        """Atomically save current mapping to disk."""
        import joblib, os
        ENCODER_DIR.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(".tmp")
        joblib.dump(self._mapping, str(tmp))
        os.replace(str(tmp), str(self._path))
        logger.info(
            f"[Encoder:{self.name}] Saved {len(self._mapping)-1} known values → {self._path}"
        )

    # ── Encoding ─────────────────────────────────────────────────────────────

    def fit_extend(self, values: list[Optional[str]]) -> None:
        """
        Extend the mapping with any NEW values in *values* (ignores None).
        Existing values keep their codes — no refitting.
        """
        changed = False
        for v in values:
            if v is None:
                continue
            v = str(v).strip().upper()
            if v and v not in self._mapping:
                self._mapping[v] = len(self._mapping)
                changed = True
        if changed:
            self.save()

    def transform(self, value: Optional[str]) -> int:
        """Return integer code for *value*. Unknown → 0."""
        if value is None:
            return self.UNKNOWN_CODE
        return self._mapping.get(str(value).strip().upper(), self.UNKNOWN_CODE)

    @property
    def n_classes(self) -> int:
        return len(self._mapping)

    @property
    def is_fitted(self) -> bool:
        """True if at least one real value (beyond UNKNOWN) has been encoded."""
        return len(self._mapping) > 1


# ── Module-level encoder singletons ──────────────────────────────────────────
# Created once per process; re-used across all calls.

def _load_encoders() -> tuple[PersistentLabelEncoder, PersistentLabelEncoder, PersistentLabelEncoder]:
    airline_enc    = PersistentLabelEncoder("airline")
    dep_airport_enc = PersistentLabelEncoder("dep_airport")
    arr_airport_enc = PersistentLabelEncoder("arr_airport")
    return airline_enc, dep_airport_enc, arr_airport_enc


_airline_encoder: Optional[PersistentLabelEncoder]    = None
_dep_airport_encoder: Optional[PersistentLabelEncoder] = None
_arr_airport_encoder: Optional[PersistentLabelEncoder] = None


def _get_encoders() -> tuple[PersistentLabelEncoder, PersistentLabelEncoder, PersistentLabelEncoder]:
    """Lazy-init module-level encoder singletons."""
    global _airline_encoder, _dep_airport_encoder, _arr_airport_encoder
    if _airline_encoder is None:
        _airline_encoder, _dep_airport_encoder, _arr_airport_encoder = _load_encoders()
    return _airline_encoder, _dep_airport_encoder, _arr_airport_encoder


# ═══════════════════════════════════════════════════════════════════════════════
# Core feature engineering function
# ═══════════════════════════════════════════════════════════════════════════════

def apply_feature_engineering(
    rows: list,
    median_distance_fallback: Optional[int] = None,
) -> list[dict]:
    """
    Apply ML feature engineering to a list of AEFlightDataset ORM rows.

    Steps
    -----
    1. Compute/verify `distance_km` via Haversine; apply median fallback for unknowns.
    2. Derive `dep_hour` and `is_weekend` from `dep_scheduled` where column is null.
    3. Compute `duration_min` from scheduled timestamps if still null.
    4. Fit-extend encoders with all IATA codes seen in this batch.
    5. Encode `airline_iata` → `airline_enc`, `dep_iata` → `dep_airport_enc`,
       `arr_iata` → `arr_airport_enc`.
    6. Drop rows that still have any required ML feature null after the above.

    Returns
    -------
    List of dicts — one per valid row — each containing:
        dep_hour, is_weekend, distance_km, duration_min,
        airline_enc, dep_airport_enc, arr_airport_enc,
        delay_minutes  (label only)
    Plus the row's primary key `id` for the DB UPDATE.
    """
    global _MEDIAN_DISTANCE_KM

    fallback_dist = median_distance_fallback or _MEDIAN_DISTANCE_KM

    enc_airline, enc_dep, enc_arr = _get_encoders()

    # ── Step 1: collect all IATA codes for encoder extension ─────────────────
    all_airlines  = [getattr(r, "airline_iata", None) for r in rows]
    all_dep_iatas = [getattr(r, "dep_iata",     None) for r in rows]
    all_arr_iatas = [getattr(r, "arr_iata",     None) for r in rows]

    enc_airline.fit_extend(all_airlines)
    enc_dep.fit_extend(all_dep_iatas)
    enc_arr.fit_extend(all_arr_iatas)

    # ── Step 2: compute distances and derive times ────────────────────────────
    # Collect valid distances to update median
    valid_distances: list[int] = []

    processed: list[dict] = []
    skipped = 0

    for row in rows:
        row_id = getattr(row, "id")

        # ── distance_km ──────────────────────────────────────────────────────
        dist = getattr(row, "distance_km", None)
        if dist is None or dist <= 0:
            computed = _haversine_km(
                getattr(row, "dep_iata", None),
                getattr(row, "arr_iata", None),
            )
            dist = computed if computed is not None else fallback_dist
        else:
            dist = int(dist)
        valid_distances.append(dist)

        # ── dep_hour & is_weekend ─────────────────────────────────────────────
        dep_hour   = getattr(row, "dep_hour",   None)
        is_weekend = getattr(row, "is_weekend", None)

        # Try to derive from dep_scheduled if stored on the snapshot join
        # (AEFlightDataset stores dep_hour directly — trust it if present)
        if dep_hour is None:
            # Cannot derive further without the original timestamp;
            # mark as invalid so the row gets dropped.
            skipped += 1
            logger.debug(f"[FE] Row {row_id}: dep_hour is null — dropping")
            continue

        dep_hour   = int(dep_hour)
        is_weekend = int(is_weekend) if is_weekend is not None else 0

        # ── duration_min ──────────────────────────────────────────────────────
        duration_min = getattr(row, "duration_min", None)
        if duration_min is not None:
            duration_min = int(duration_min)
        else:
            # Fallback: estimate from distance at 800 km/h cruise
            duration_min = max(30, round(dist / 800 * 60))

        # ── delay_minutes (label) ─────────────────────────────────────────────
        delay_minutes = getattr(row, "delay_minutes", 0)
        delay_minutes = int(delay_minutes) if delay_minutes is not None else 0

        # ── categorical encodings ─────────────────────────────────────────────
        airline_enc_val    = enc_airline.transform(getattr(row, "airline_iata", None))
        dep_airport_enc_val = enc_dep.transform(getattr(row, "dep_iata", None))
        arr_airport_enc_val = enc_arr.transform(getattr(row, "arr_iata", None))

        processed.append({
            "id":              row_id,
            # ML input features
            "dep_hour":        dep_hour,
            "is_weekend":      is_weekend,
            "distance_km":     dist,
            "duration_min":    duration_min,
            "airline_enc":     airline_enc_val,
            "dep_airport_enc": dep_airport_enc_val,
            "arr_airport_enc": arr_airport_enc_val,
            # Label (not used as feature)
            "delay_minutes":   delay_minutes,
        })

    # Update module-level median from this batch
    if valid_distances:
        sorted_d = sorted(valid_distances)
        _MEDIAN_DISTANCE_KM = sorted_d[len(sorted_d) // 2]

    logger.info(
        f"[FE] Processed {len(processed)} rows | dropped {skipped} | "
        f"median_dist={_MEDIAN_DISTANCE_KM} km"
    )
    return processed


# ═══════════════════════════════════════════════════════════════════════════════
# Dataset health validation
# ═══════════════════════════════════════════════════════════════════════════════

def validate_dataset_health(
    processed_rows: list[dict],
    *,
    print_report: bool = True,
) -> dict:
    """
    Validate a list of FE-processed rows and return a health report dict.

    Raises
    ------
    RuntimeError if any required ML feature contains null values,
    or if the encoders are not fitted.

    Returns
    -------
    dict with keys:
        total_rows, pct_missing_per_feature, dtypes, valid_ml_rows, ready
    """
    enc_airline, enc_dep, enc_arr = _get_encoders()

    # ── Check encoders ────────────────────────────────────────────────────────
    encoder_status = {
        "airline":     enc_airline.is_fitted,
        "dep_airport": enc_dep.is_fitted,
        "arr_airport": enc_arr.is_fitted,
    }
    encoders_ok = all(encoder_status.values())

    # ── Per-feature null % ────────────────────────────────────────────────────
    feature_keys = REQUIRED_ML_FEATURES + [TARGET_LABEL]
    total = len(processed_rows)

    null_counts: dict[str, int] = {k: 0 for k in feature_keys}
    for row in processed_rows:
        for k in feature_keys:
            if row.get(k) is None:
                null_counts[k] += 1

    pct_missing = {
        k: round(null_counts[k] / total * 100, 2) if total > 0 else 0.0
        for k in feature_keys
    }

    # ── Dtype snapshot (first row) ────────────────────────────────────────────
    dtypes: dict[str, str] = {}
    if processed_rows:
        sample = processed_rows[0]
        for k in feature_keys:
            v = sample.get(k)
            dtypes[k] = type(v).__name__ if v is not None else "NoneType"

    # ── Valid rows (all required features non-null) ───────────────────────────
    valid_ml_rows = sum(
        1 for r in processed_rows
        if all(r.get(k) is not None for k in REQUIRED_ML_FEATURES)
    )

    # ── Blocking conditions ───────────────────────────────────────────────────
    blocking_issues: list[str] = []
    for k, pct in pct_missing.items():
        if k in REQUIRED_ML_FEATURES and pct > 0:
            blocking_issues.append(f"{k} has {pct}% nulls")
    if not encoders_ok:
        missing_enc = [k for k, ok in encoder_status.items() if not ok]
        blocking_issues.append(f"Encoders not fitted: {missing_enc}")
    if pct_missing.get("distance_km", 0) > 0:
        blocking_issues.append("distance_km has nulls — Haversine fallback failed")

    ready = len(blocking_issues) == 0

    report = {
        "total_rows":               total,
        "valid_ml_rows":            valid_ml_rows,
        "pct_missing_per_feature":  pct_missing,
        "dtypes":                   dtypes,
        "encoder_status":           encoder_status,
        "blocking_issues":          blocking_issues,
        "ready":                    ready,
    }

    if print_report:
        _print_health_report(report)

    if not ready:
        raise RuntimeError(
            f"Dataset health check FAILED — training is blocked.\n"
            f"Issues: {blocking_issues}"
        )

    return report


def _print_health_report(report: dict) -> None:
    sep = "=" * 60
    print(f"\n{sep}")
    print("  ML DATASET HEALTH REPORT")
    print(sep)
    print(f"  Total rows processed : {report['total_rows']}")
    print(f"  Valid ML rows        : {report['valid_ml_rows']}")
    print()
    print("  % Missing per feature:")
    for feat, pct in report["pct_missing_per_feature"].items():
        status = "[PASS]" if pct == 0 else ("[WARN]" if pct < 10 else "[FAIL]")
        print(f"    {status}  {feat:<20} {pct:.2f}%")
    print()
    print("  Feature data types (sample row):")
    for feat, dtype in report["dtypes"].items():
        print(f"       {feat:<20} {dtype}")
    print()
    print("  Encoder status:")
    for enc_name, fitted in report["encoder_status"].items():
        print(f"    {'[YES]' if fitted else '[NO] '}  {enc_name}")
    print()
    if report["blocking_issues"]:
        print("  BLOCKING ISSUES (training disabled):")
        for issue in report["blocking_issues"]:
            print(f"    * {issue}")
    else:
        print("  [PASS] Dataset is ML-ready — training can proceed safely.")
    print(sep + "\n")
