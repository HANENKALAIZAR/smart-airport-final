import pytest
from datetime import date, datetime, timezone
from app.models.ae_models import AEFlightSnapshot, AEFlightDataset
from app.utils.flight_number import get_flight_alias_filter, normalize_flight_query
from app.routers.passenger import _lookup_flight_snapshot
from app.scheduler import _job_passenger_alerts
from app.models.models import PassengerAlertSubscription

def test_normalize_flight_query():
    # 1. Standard IATA/ICAO
    assert normalize_flight_query("BJ640") == ("BJ", "640")
    assert normalize_flight_query("LBT640") == ("LBT", "640")
    
    # 2. Spaces and Casing
    assert normalize_flight_query("bj 640") == ("BJ", "640")
    assert normalize_flight_query("lbt 640") == ("LBT", "640")
    
    # 3. Numeric-only
    assert normalize_flight_query("640") == (None, "640")
    
    # 4. Carrier-only
    assert normalize_flight_query("BJ") == ("BJ", None)


def test_flight_alias_matching(db):
    today = date(2026, 5, 26)
    
    # Insert flight BJ640 (IATA preferred, with ICAO LBT)
    # We specify id=1001 because in-memory SQLite testing engine requires explicit primary key ids for BigInteger columns
    snap = AEFlightSnapshot(
        id=1001,
        flight_number="BJ640",
        snapshot_date=today,
        collected_at=datetime.now(timezone.utc),
        airport_iata="TUN",
        direction="departure",
        airline_iata="BJ",
        airline_icao="LBT",
        dep_iata="TUN",
        arr_iata="CDG",
        status="scheduled"
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)

    # Scenarios to test with the shared query utility
    test_queries = ["BJ640", "LBT640", "bj 640", "640"]
    
    for q in test_queries:
        alias_filter = get_flight_alias_filter(AEFlightSnapshot, q)
        row = (
            db.query(AEFlightSnapshot)
            .filter(
                AEFlightSnapshot.snapshot_date == today,
                alias_filter
            )
            .first()
        )
        assert row is not None, f"Query '{q}' failed to match flight BJ640"
        assert row.flight_number == "BJ640"


@pytest.mark.asyncio
async def test_passenger_lookup_resolves_aliases(db):
    today = datetime.now(timezone.utc).date()
    
    # Seed snap BJ640 in DB
    snap = AEFlightSnapshot(
        id=1002,
        flight_number="BJ640",
        snapshot_date=today,
        collected_at=datetime.now(timezone.utc),
        airport_iata="TUN",
        direction="departure",
        airline_iata="BJ",
        airline_icao="LBT",
        dep_iata="TUN",
        arr_iata="CDG",
        status="scheduled"
    )
    db.add(snap)
    db.commit()

    # Search for LBT640 via _lookup_flight_snapshot
    row = await _lookup_flight_snapshot("LBT640", db)
    assert row is not None
    assert row.flight_number == "BJ640"
    
    # Search for bj 640
    row2 = await _lookup_flight_snapshot("bj 640", db)
    assert row2 is not None
    assert row2.flight_number == "BJ640"
    
    # Search for 640
    row3 = await _lookup_flight_snapshot("640", db)
    assert row3 is not None
    assert row3.flight_number == "BJ640"


def test_date_filter_does_not_exclude_flight(db):
    target_date = date(2026, 5, 26)
    
    snap = AEFlightSnapshot(
        id=1003,
        flight_number="BJ640",
        snapshot_date=target_date,
        collected_at=datetime.now(timezone.utc),
        airport_iata="TUN",
        direction="departure",
        airline_iata="BJ",
        airline_icao="LBT",
        dep_iata="TUN",
        arr_iata="CDG",
        status="scheduled"
    )
    db.add(snap)
    db.commit()
    
    row = (
        db.query(AEFlightSnapshot)
        .filter(
            AEFlightSnapshot.snapshot_date == date(2026, 5, 26),
            AEFlightSnapshot.flight_number == "BJ640"
        )
        .first()
    )
    assert row is not None
    assert row.snapshot_date == target_date


def test_reconcile_stale_flight_landed(db):
    from app.services.flight_reconciliation_service import reconcile_stale_flight_status
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    
    # Create an active flight with arr_actual in the past
    snap = AEFlightSnapshot(
        id=2001,
        flight_number="TU712",
        snapshot_date=now.date(),
        collected_at=now - timedelta(minutes=10),
        airport_iata="TUN",
        direction="departure",
        dep_scheduled=now - timedelta(hours=3),
        arr_actual=now - timedelta(minutes=30),
        status="in_air"
    )
    db.add(snap)
    db.commit()
    
    changed = reconcile_stale_flight_status(snap, db)
    assert changed is True
    assert snap.status == "landed"
    assert snap.provider_sources["reconciliation"]["old_status"] == "in_air"
    assert "Confirmed arrival" in snap.provider_sources["reconciliation"]["reason"]


def test_reconcile_stale_flight_timeout_24h(db):
    from app.services.flight_reconciliation_service import reconcile_stale_flight_status
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    
    # Create an active flight departed >24 hours ago with stale updates
    snap = AEFlightSnapshot(
        id=2002,
        flight_number="TU800",
        snapshot_date=now.date() - timedelta(days=1),
        collected_at=now - timedelta(hours=4), # stale update >3h
        airport_iata="TUN",
        direction="departure",
        dep_scheduled=now - timedelta(hours=26),
        status="active"
    )
    db.add(snap)
    db.commit()
    
    changed = reconcile_stale_flight_status(snap, db)
    assert changed is True
    assert snap.status == "stale_unresolved"
    assert snap.provider_sources["reconciliation"]["old_status"] == "active"
    assert "Operational timeout" in snap.provider_sources["reconciliation"]["reason"]


def test_reconcile_stale_flight_in_air_timeout_18h(db):
    from app.services.flight_reconciliation_service import reconcile_stale_flight_status
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    
    # Create an in_air flight departed >18 hours ago with stale updates
    snap = AEFlightSnapshot(
        id=2003,
        flight_number="TU900",
        snapshot_date=now.date() - timedelta(days=1),
        collected_at=now - timedelta(hours=4), # stale update >3h
        airport_iata="TUN",
        direction="departure",
        dep_scheduled=now - timedelta(hours=19),
        status="in_air"
    )
    db.add(snap)
    db.commit()
    
    changed = reconcile_stale_flight_status(snap, db)
    assert changed is True
    assert snap.status == "stale_unresolved"
    assert snap.provider_sources["reconciliation"]["old_status"] == "in_air"


def test_reconcile_does_not_affect_recent_flights(db):
    from app.services.flight_reconciliation_service import reconcile_stale_flight_status
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    
    # Create a recently departed flight with fresh updates
    snap = AEFlightSnapshot(
        id=2004,
        flight_number="TU100",
        snapshot_date=now.date(),
        collected_at=now - timedelta(minutes=5), # fresh update
        airport_iata="TUN",
        direction="departure",
        dep_scheduled=now - timedelta(hours=2),
        status="in_air"
    )
    db.add(snap)
    db.commit()
    
    changed = reconcile_stale_flight_status(snap, db)
    assert changed is False
    assert snap.status == "in_air"


def test_reconcile_cooldown_protection(db):
    from app.services.flight_reconciliation_service import reconcile_stale_flight_status
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    
    # Already stale unresolved flight
    snap = AEFlightSnapshot(
        id=2005,
        flight_number="TU200",
        snapshot_date=now.date() - timedelta(days=1),
        collected_at=now - timedelta(hours=10),
        airport_iata="TUN",
        direction="departure",
        dep_scheduled=now - timedelta(hours=30),
        status="stale_unresolved"
    )
    db.add(snap)
    db.commit()
    
    changed = reconcile_stale_flight_status(snap, db)
    assert changed is False
    assert snap.status == "stale_unresolved"

