"""
Tests — FlightAware Provider Integration
==========================================
13 tests covering:
  - Disabled/missing-key mode (no real HTTP calls)
  - Response normalization
  - Timeout handling
  - Rate-limit / circuit breaker
  - Reconciliation safety guards
  - IATA/ICAO alias resolution
  - should_enrich window filter
  - Enriched fields in snapshot API dict
  - Provider health endpoint

All HTTP calls are mocked. No real FA API key required.
"""

import asyncio
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from app.api_clients.flightaware_client import (
    normalize_fa_flight,
    get_ident_candidates,
)
from app.services.flight_reconciliation_service import should_enrich
from app.services.provider_health import ProviderHealthRegistry, CIRCUIT_FAILURE_THRESHOLD, CIRCUIT_TIMEOUT_THRESHOLD
from app.services.flight_cache_service import _snapshot_to_api_dict


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_snapshot(**kwargs):
    """Build a minimal AEFlightSnapshot-like object for tests."""
    now = datetime.now(timezone.utc)
    defaults = {
        "id": 9001,
        "flight_number": "BJ640",
        "snapshot_date": now.date(),
        "collected_at": now,
        "airport_iata": "TUN",
        "direction": "departure",
        "airline_iata": "BJ",
        "airline_icao": "LBT",
        "dep_iata": "TUN",
        "arr_iata": "CDG",
        "status": "scheduled",
        "dep_scheduled": now + timedelta(hours=2),
        "arr_scheduled": now + timedelta(hours=4),
        "dep_actual": None,
        "arr_actual": None,
        "dep_estimated": None,
        "arr_estimated": None,
        "latitude": None,
        "longitude": None,
        "altitude_ft": None,
        "speed_kmh": None,
        "heading_deg": None,
        "is_ground": None,
        "dep_delay_min": None,
        "arr_delay_min": None,
        "delay_minutes": None,
        "dep_terminal": None,
        "arr_terminal": None,
        "dep_gate": None,
        "arr_gate": None,
        "dep_airport": "Tunis-Carthage",
        "arr_airport": "Charles de Gaulle",
        "airline_name": "Nouvelair",
        "aircraft_type": None,
        "aircraft_reg": None,
        "dep_actual": None,
        "arr_actual": None,
        "departed_at": None,
        "airborne_at": None,
        "landed_at": None,
        "last_status_change": None,
        "last_position_update": None,
        "flight_date": now.date(),
        # FlightAware enrichment columns
        "last_verified_by": None,
        "last_verified_at": None,
        "provider_sources": None,
        "raw_flightaware_payload": None,
    }
    defaults.update(kwargs)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _make_fa_response(ident="LBT640", status="En Route", has_position=True) -> dict:
    """Build a minimal FA normalized response dict."""
    now = datetime.now(timezone.utc)
    pos = {"latitude": 44.5, "longitude": 5.3, "altitude": 35000, "groundspeed": 450} if has_position else {}
    return {
        "ident": ident,
        "origin": {"code_iata": "TUN"},
        "destination": {"code_iata": "CDG"},
        "status": status,
        "scheduled_out": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "estimated_out": (now + timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "actual_out": None,
        "scheduled_in": (now + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "estimated_in": None,
        "actual_in": None,
        "last_position": pos,
    }


# ── 1. UNIT: Disabled mode ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fa_disabled_returns_none_when_flag_false():
    """FLIGHTAWARE_ENABLED=False → fetch_flight_by_ident returns None, no HTTP calls."""
    with patch("app.api_clients.flightaware_client.settings") as mock_settings:
        mock_settings.FLIGHTAWARE_ENABLED = False
        mock_settings.FLIGHTAWARE_API_KEY = "some-key"
        mock_settings.FLIGHTAWARE_CACHE_TTL_SECONDS = 1
        mock_settings.FLIGHTAWARE_TIMEOUT_SECONDS = 5.0
        mock_settings.FLIGHTAWARE_BASE_URL = "https://aeroapi.flightaware.com/aeroapi"

        # Clear module-level cache
        import app.api_clients.flightaware_client as fa_mod
        fa_mod._ident_cache.clear()
        fa_mod._AUTH_FAILED = False

        with patch("httpx.AsyncClient") as mock_client:
            from app.api_clients.flightaware_client import fetch_flight_by_ident
            result = await fetch_flight_by_ident("LBT640")

        assert result is None
        mock_client.assert_not_called()


@pytest.mark.asyncio
async def test_fa_missing_key_returns_none():
    """Empty FLIGHTAWARE_API_KEY → returns None gracefully, no HTTP calls."""
    with patch("app.api_clients.flightaware_client.settings") as mock_settings:
        mock_settings.FLIGHTAWARE_ENABLED = True
        mock_settings.FLIGHTAWARE_API_KEY = ""
        mock_settings.FLIGHTAWARE_CACHE_TTL_SECONDS = 1
        mock_settings.FLIGHTAWARE_TIMEOUT_SECONDS = 5.0
        mock_settings.FLIGHTAWARE_BASE_URL = "https://aeroapi.flightaware.com/aeroapi"

        import app.api_clients.flightaware_client as fa_mod
        fa_mod._ident_cache.clear()
        fa_mod._AUTH_FAILED = False

        with patch("httpx.AsyncClient") as mock_client:
            from app.api_clients.flightaware_client import fetch_flight_by_ident
            result = await fetch_flight_by_ident("LBT640")

        assert result is None
        mock_client.assert_not_called()


# ── 2. UNIT: Normalization ────────────────────────────────────────────────────

def test_fa_normalize_full_response():
    """normalize_fa_flight correctly maps all expected FA fields."""
    raw = _make_fa_response(ident="LBT640", status="En Route", has_position=True)
    result = normalize_fa_flight(raw)

    assert result["flight_number"] == "LBT640"
    assert result["dep_iata"] == "TUN"
    assert result["arr_iata"] == "CDG"
    assert result["status"] == "in_air"
    assert result["fa_status_raw"] == "En Route"
    assert result["latitude"] == 44.5
    assert result["longitude"] == 5.3
    assert result["altitude_ft"] == 35000.0
    assert result["speed_kmh"] is not None and result["speed_kmh"] > 0  # knots→km/h converted
    assert result["dep_scheduled"] is not None
    assert result["dep_estimated"] is not None


def test_fa_normalize_cancelled_status():
    """Cancelled FA status maps to 'cancelled'."""
    raw = _make_fa_response(status="Cancelled", has_position=False)
    result = normalize_fa_flight(raw)
    assert result["status"] == "cancelled"


def test_fa_normalize_unknown_status_defaults():
    """Unknown FA status strings map to 'scheduled'."""
    raw = _make_fa_response(status="SomeFutureStatus", has_position=False)
    result = normalize_fa_flight(raw)
    assert result["status"] == "scheduled"


# ── 3. UNIT: Timeout ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fa_timeout_returns_none():
    """TimeoutException → returns None, no exception propagated, health updated."""
    import app.api_clients.flightaware_client as fa_mod
    fa_mod._ident_cache.clear()
    fa_mod._AUTH_FAILED = False

    registry = ProviderHealthRegistry()

    # health_registry is now a module-level attribute in flightaware_client
    with patch("app.api_clients.flightaware_client.settings") as mock_settings, \
         patch("app.api_clients.flightaware_client.health_registry", registry), \
         patch("httpx.AsyncClient") as mock_http:
        mock_settings.FLIGHTAWARE_ENABLED = True
        mock_settings.FLIGHTAWARE_API_KEY = "test-key"
        mock_settings.FLIGHTAWARE_CACHE_TTL_SECONDS = 1
        mock_settings.FLIGHTAWARE_TIMEOUT_SECONDS = 5.0
        mock_settings.FLIGHTAWARE_BASE_URL = "https://example.com"

        async_cm = AsyncMock()
        async_cm.__aenter__.return_value.get = AsyncMock(
            side_effect=httpx.TimeoutException("timed out")
        )
        mock_http.return_value = async_cm

        from app.api_clients.flightaware_client import fetch_flight_by_ident
        result = await fetch_flight_by_ident("LBT640TIMEOUT")

    assert result is None
    stats = await registry.get_stats("flightaware")
    assert stats["total_timeouts"] == 1


# ── 4. UNIT: Rate limit + health counter ─────────────────────────────────────

@pytest.mark.asyncio
async def test_fa_rate_limit_records_health():
    """HTTP 429 → total_rate_limits incremented, None returned, no retry."""
    import app.api_clients.flightaware_client as fa_mod
    fa_mod._ident_cache.clear()
    fa_mod._AUTH_FAILED = False

    registry = ProviderHealthRegistry()
    mock_resp = MagicMock()
    mock_resp.status_code = 429

    # health_registry is now a module-level attribute in flightaware_client
    with patch("app.api_clients.flightaware_client.settings") as mock_settings, \
         patch("app.api_clients.flightaware_client.health_registry", registry), \
         patch("httpx.AsyncClient") as mock_http:
        mock_settings.FLIGHTAWARE_ENABLED = True
        mock_settings.FLIGHTAWARE_API_KEY = "test-key"
        mock_settings.FLIGHTAWARE_CACHE_TTL_SECONDS = 1
        mock_settings.FLIGHTAWARE_TIMEOUT_SECONDS = 5.0
        mock_settings.FLIGHTAWARE_BASE_URL = "https://example.com"

        async_cm = AsyncMock()
        async_cm.__aenter__.return_value.get = AsyncMock(return_value=mock_resp)
        mock_http.return_value = async_cm

        from app.api_clients.flightaware_client import fetch_flight_by_ident
        result = await fetch_flight_by_ident("LBT640RATELIMITED")

    assert result is None
    stats = await registry.get_stats("flightaware")
    assert stats["total_rate_limits"] == 1


# ── 5. UNIT: Circuit breaker ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_circuit_opens_after_consecutive_failures():
    """Circuit opens after CIRCUIT_FAILURE_THRESHOLD consecutive failures."""
    registry = ProviderHealthRegistry()
    for _ in range(CIRCUIT_FAILURE_THRESHOLD):
        assert not await registry.is_circuit_open("flightaware")
        await registry.record_failure("flightaware")

    is_open = await registry.is_circuit_open("flightaware")
    assert is_open, "Circuit should be OPEN after threshold failures"

    stats = await registry.get_stats("flightaware")
    assert stats["circuit_state"] == "OPEN"
    assert stats["circuit_closes_at"] is not None


@pytest.mark.asyncio
async def test_circuit_opens_after_consecutive_timeouts():
    """Circuit opens after CIRCUIT_TIMEOUT_THRESHOLD consecutive timeouts."""
    registry = ProviderHealthRegistry()
    for _ in range(CIRCUIT_TIMEOUT_THRESHOLD):
        assert not await registry.is_circuit_open("flightaware")
        await registry.record_timeout("flightaware")

    is_open = await registry.is_circuit_open("flightaware")
    assert is_open, "Circuit should be OPEN after threshold timeouts"


@pytest.mark.asyncio
async def test_circuit_auto_closes_after_cooldown():
    """Circuit auto-closes after the cooldown period elapses."""
    from datetime import timedelta
    registry = ProviderHealthRegistry()

    # Manually trip the circuit
    for _ in range(CIRCUIT_FAILURE_THRESHOLD):
        await registry.record_failure("flightaware")

    assert await registry.is_circuit_open("flightaware")

    # Wind the clock forward past cooldown
    async with registry._lock:
        registry._stats["flightaware"]["circuit_closes_at"] = (
            datetime.now(timezone.utc) - timedelta(seconds=1)
        )

    is_open = await registry.is_circuit_open("flightaware")
    assert not is_open, "Circuit should auto-close after cooldown"
    stats = await registry.get_stats("flightaware")
    assert stats["circuit_state"] == "CLOSED"
    assert stats["consecutive_failures"] == 0


@pytest.mark.asyncio
async def test_success_resets_circuit_counters():
    """A successful call resets consecutive_failures and consecutive_timeouts."""
    registry = ProviderHealthRegistry()
    await registry.record_failure("flightaware")
    await registry.record_timeout("flightaware")
    await registry.record_success("flightaware")

    stats = await registry.get_stats("flightaware")
    assert stats["consecutive_failures"] == 0
    assert stats["consecutive_timeouts"] == 0


# ── 6. UNIT: Reconciliation guards ───────────────────────────────────────────

def test_reconcile_never_overwrites_scheduled_times():
    """dep_scheduled and arr_scheduled are never touched by reconcile_snapshot."""
    from app.services.flight_reconciliation_service import reconcile_snapshot

    now = datetime.now(timezone.utc)
    original_dep = now + timedelta(hours=2)
    original_arr = now + timedelta(hours=4)

    snap = _make_snapshot(
        dep_scheduled=original_dep,
        arr_scheduled=original_arr,
        status="scheduled",
    )
    # FA sends different scheduled times — they should be ignored
    fa_data = normalize_fa_flight({
        "ident": "LBT640",
        "origin": {"code_iata": "TUN"},
        "destination": {"code_iata": "CDG"},
        "status": "En Route",
        "scheduled_out": (now + timedelta(hours=99)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "scheduled_in": (now + timedelta(hours=101)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "estimated_out": None, "actual_out": None,
        "estimated_in": None, "actual_in": None,
        "last_position": {},
    })
    fa_data["fetched_at"] = now

    db = MagicMock()
    reconcile_snapshot(snap, fa_data, db)

    assert snap.dep_scheduled == original_dep, "dep_scheduled must never change"
    assert snap.arr_scheduled == original_arr, "arr_scheduled must never change"


def test_reconcile_status_upgrade_scheduled_to_inair():
    """scheduled → in_air accepted when FA is fresher and progress rank is higher."""
    from app.services.flight_reconciliation_service import reconcile_snapshot

    now = datetime.now(timezone.utc)
    snap = _make_snapshot(status="scheduled")
    fa_data = normalize_fa_flight(_make_fa_response(status="En Route"))
    fa_data["fetched_at"] = now

    db = MagicMock()
    result = reconcile_snapshot(snap, fa_data, db)

    assert snap.status == "in_air"
    assert "status" in result["changed_fields"]


def test_reconcile_no_status_downgrade():
    """in_air → scheduled is blocked (no backward status transitions)."""
    from app.services.flight_reconciliation_service import reconcile_snapshot

    now = datetime.now(timezone.utc)
    snap = _make_snapshot(status="in_air")
    fa_data = normalize_fa_flight(_make_fa_response(status="Scheduled"))
    fa_data["fetched_at"] = now

    db = MagicMock()
    reconcile_snapshot(snap, fa_data, db)

    assert snap.status == "in_air", "Status must not be downgraded"


def test_reconcile_dep_actual_only_when_null():
    """dep_actual is only enriched from FA when AE value is currently NULL."""
    from app.services.flight_reconciliation_service import reconcile_snapshot

    now = datetime.now(timezone.utc)
    existing_actual = now - timedelta(hours=1)
    snap = _make_snapshot(dep_actual=existing_actual)

    fa_data = normalize_fa_flight(_make_fa_response(status="En Route"))
    fa_data["dep_actual"] = now - timedelta(minutes=30)  # FA has a different value
    fa_data["fetched_at"] = now

    db = MagicMock()
    reconcile_snapshot(snap, fa_data, db)

    assert snap.dep_actual == existing_actual, "dep_actual must not be overwritten when AE has a value"


# ── 7. UNIT: Ident candidate resolution ──────────────────────────────────────

def test_ident_candidates_icao_preferred():
    """BJ640 snap with airline_icao=LBT → first candidate is LBT640."""
    candidates = get_ident_candidates("BJ640", airline_iata="BJ", airline_icao="LBT")
    assert candidates[0] == "LBT640", "ICAO ident should be first"
    assert "BJ640" in candidates, "IATA ident should be fallback"


def test_ident_candidates_tunisair():
    """TU312 snap with airline_icao=TAR → first candidate is TAR312."""
    candidates = get_ident_candidates("TU312", airline_iata="TU", airline_icao="TAR")
    assert candidates[0] == "TAR312"
    assert "TU312" in candidates


def test_ident_candidates_no_duplicates():
    """No ident appears twice in the candidate list."""
    candidates = get_ident_candidates("LBT640", airline_iata="BJ", airline_icao="LBT")
    assert len(candidates) == len(set(candidates)), "Candidates must be unique"


# ── 8. UNIT: should_enrich window filter ─────────────────────────────────────

def test_should_enrich_upcoming_flight_is_true():
    """Flight departing in 3 hours is a valid enrichment candidate."""
    now = datetime.now(timezone.utc)
    snap = _make_snapshot(status="scheduled", dep_scheduled=now + timedelta(hours=3))
    assert should_enrich(snap, now_utc=now) is True


def test_should_enrich_landed_is_false():
    """Already-landed flights are excluded from enrichment."""
    now = datetime.now(timezone.utc)
    snap = _make_snapshot(status="landed", dep_scheduled=now - timedelta(hours=1))
    assert should_enrich(snap, now_utc=now) is False


def test_should_enrich_cancelled_is_false():
    """Cancelled flights are excluded."""
    now = datetime.now(timezone.utc)
    snap = _make_snapshot(status="cancelled", dep_scheduled=now + timedelta(hours=2))
    assert should_enrich(snap, now_utc=now) is False


def test_should_enrich_too_far_future_is_false():
    """Flights more than WINDOW_FUTURE_HOURS away are excluded."""
    from app.config import settings
    now = datetime.now(timezone.utc)
    snap = _make_snapshot(
        status="scheduled",
        dep_scheduled=now + timedelta(hours=settings.FLIGHTAWARE_WINDOW_FUTURE_HOURS + 1),
        arr_scheduled=now + timedelta(hours=settings.FLIGHTAWARE_WINDOW_FUTURE_HOURS + 3),
    )
    assert should_enrich(snap, now_utc=now) is False


def test_should_enrich_past_window_flight_is_true():
    """Flight departing within past window (e.g. 1h ago, unknown status) → eligible."""
    now = datetime.now(timezone.utc)
    snap = _make_snapshot(status="delayed", dep_scheduled=now - timedelta(hours=1))
    assert should_enrich(snap, now_utc=now) is True


# ── 9. INTEGRATION: Enriched fields visible in snapshot API dict ──────────────

def test_enriched_fields_visible_in_api_dict():
    """After enrichment, _snapshot_to_api_dict includes FA metadata fields."""
    now = datetime.now(timezone.utc)
    snap = _make_snapshot(
        last_verified_by="flightaware",
        last_verified_at=now,
        provider_sources={"flightaware": {"ident_used": "LBT640", "changed_fields": ["status"]}},
    )
    result = _snapshot_to_api_dict(snap)

    assert result["last_verified_by"] == "flightaware"
    assert result["last_verified_at"] is not None
    assert "flightaware" in result["provider_sources"]


def test_unenriched_snapshot_has_empty_provider_sources():
    """Snapshot with no FA enrichment returns empty provider_sources dict."""
    snap = _make_snapshot(
        last_verified_by=None,
        last_verified_at=None,
        provider_sources=None,
    )
    result = _snapshot_to_api_dict(snap)
    assert result["provider_sources"] == {}
    assert result["last_verified_by"] is None


# ── 10. INTEGRATION: Provider health endpoint ─────────────────────────────────

def test_provider_health_endpoint(client):
    """GET /api/aviation-edge/provider-health returns 200 with expected schema."""
    resp = client.get("/api/aviation-edge/provider-health")
    assert resp.status_code == 200
    data = resp.json()

    assert "flightaware" in data
    fa = data["flightaware"]
    assert "enabled" in fa
    assert "circuit_state" in fa
    assert "total_enrichments" in fa
    assert "total_failures" in fa
    assert "total_rate_limits" in fa
    assert "total_timeouts" in fa
    assert "aviation_edge" in data
