"""
FlightAware Tunisian Airport Coverage Validation
==================================================
Standalone script to validate FlightAware AeroAPI Personal coverage
for all 4 Tunisian airports: TUN, MIR, NBE, DJE.

Tests:
  - Scheduled flights
  - In-air flights (if any active)
  - Already-landed flights (should be filtered by should_enrich)
  - BJ/LBT alias resolution (Nouvelair)
  - TU/TAR alias resolution (Tunisair)
  - Multiple airport/airline combinations

Output:
  - Per-flight coverage table
  - Summary by airport and airline
  - Documentation of weak coverage areas

Run from /backend directory:
    python validate_flightaware_coverage.py

Requirements:
  - FLIGHTAWARE_API_KEY must be set in .env
  - Backend DB must be running (used to pull today's AE snapshots)
"""

import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass


async def main():
    from app.config import settings
    from app.api_clients.flightaware_client import (
        fetch_flight_by_ident, get_ident_candidates, is_enabled
    )
    from app.services.flight_reconciliation_service import should_enrich
    from app.database import SessionLocal
    from app.models.ae_models import AEFlightSnapshot
    from datetime import date

    print("\n" + "=" * 70)
    print("FlightAware AeroAPI — Tunisian Airport Coverage Validation")
    print("=" * 70)

    if not is_enabled():
        print("\n[FATAL] FlightAware is disabled or FLIGHTAWARE_API_KEY is not set.")
        print("Set FLIGHTAWARE_API_KEY in .env and ensure FLIGHTAWARE_ENABLED=true")
        return

    print(f"\nAPI Key:    {'*' * 6}{settings.FLIGHTAWARE_API_KEY[-4:]}")
    print(f"Base URL:   {settings.FLIGHTAWARE_BASE_URL}")
    print(f"Timeout:    {settings.FLIGHTAWARE_TIMEOUT_SECONDS}s")

    airports = ["TUN", "MIR", "NBE", "DJE"]
    today = date.today()
    now = datetime.now(timezone.utc)

    db = SessionLocal()
    try:
        snapshots = (
            db.query(AEFlightSnapshot)
            .filter(AEFlightSnapshot.snapshot_date == today)
            .order_by(AEFlightSnapshot.airport_iata, AEFlightSnapshot.dep_scheduled)
            .all()
        )
    finally:
        db.close()

    if not snapshots:
        print(f"\n[WARNING] No AEFlightSnapshot rows found for {today}.")
        print("Run the backend (AE ingestion must have run at least once today).")
        return

    print(f"\nFound {len(snapshots)} snapshots for today ({today})")
    print("Running FlightAware lookup for each flight...\n")

    # ── Results collection ─────────────────────────────────────────────────────
    results = []
    hit_count = 0
    miss_count = 0
    skip_count = 0
    error_count = 0

    airline_hits: dict[str, int] = {}
    airline_total: dict[str, int] = {}
    airport_hits: dict[str, int] = {}
    airport_total: dict[str, int] = {}

    for snap in snapshots:
        airport = snap.airport_iata
        airline = snap.airline_iata or "??"
        fn = snap.flight_number
        status = snap.status or "unknown"

        airport_total[airport] = airport_total.get(airport, 0) + 1
        airline_total[airline] = airline_total.get(airline, 0) + 1

        # Check if this flight should be enriched at all
        enrichable = should_enrich(snap, now_utc=now)

        if not enrichable:
            skip_count += 1
            results.append({
                "airport": airport, "airline": airline, "flight": fn,
                "ae_status": status, "fa_status": "—", "result": "⏭ SKIP",
                "note": "Not in enrich window (landed/cancelled/far future)",
            })
            continue

        # Try ident candidates
        idents = get_ident_candidates(fn, snap.airline_iata, snap.airline_icao)
        fa_result = None
        used_ident = None

        for ident in idents:
            try:
                fa_result = await fetch_flight_by_ident(ident)
                if fa_result is not None:
                    used_ident = ident
                    break
            except Exception as exc:
                error_count += 1
                results.append({
                    "airport": airport, "airline": airline, "flight": fn,
                    "ae_status": status, "fa_status": "ERROR", "result": "❌ ERROR",
                    "note": str(exc)[:80],
                })
                break

        if fa_result is not None:
            hit_count += 1
            airport_hits[airport] = airport_hits.get(airport, 0) + 1
            airline_hits[airline] = airline_hits.get(airline, 0) + 1
            enriched_status = fa_result["status"]
            status_match = "✅ MATCH" if enriched_status == status else f"🔄 DIFF ({status}→{enriched_status})"
            results.append({
                "airport": airport, "airline": airline, "flight": fn,
                "ae_status": status, "fa_status": enriched_status,
                "result": f"✅ HIT via {used_ident}", "note": status_match,
            })
        elif fa_result is None and not any(r["flight"] == fn and r["result"] == "❌ ERROR" for r in results):
            miss_count += 1
            results.append({
                "airport": airport, "airline": airline, "flight": fn,
                "ae_status": status, "fa_status": "—",
                "result": "❌ MISS", "note": f"Tried: {', '.join(idents)}",
            })

    # ── Print per-flight table ─────────────────────────────────────────────────
    print(f"{'Airport':<8} {'Airline':<8} {'Flight':<10} {'AE Status':<12} "
          f"{'FA Status':<12} {'Result':<22} {'Notes'}")
    print("-" * 90)

    for r in results:
        print(
            f"{r['airport']:<8} {r['airline']:<8} {r['flight']:<10} "
            f"{r['ae_status']:<12} {r['fa_status']:<12} {r['result']:<22} {r['note']}"
        )

    # ── Summary ────────────────────────────────────────────────────────────────
    total_checked = hit_count + miss_count + error_count
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total snapshots:  {len(snapshots)}")
    print(f"Checked:          {total_checked}")
    print(f"Skipped:          {skip_count} (not in enrich window)")
    print(f"  FA Hits:        {hit_count}")
    print(f"  FA Misses:      {miss_count}")
    print(f"  Errors:         {error_count}")
    if total_checked > 0:
        coverage_pct = round(hit_count / total_checked * 100, 1)
        print(f"  Coverage:       {coverage_pct}%")

    print("\n── Per-Airport Coverage ──")
    for airport in sorted(airports):
        total = airport_total.get(airport, 0)
        hits  = airport_hits.get(airport, 0)
        pct   = round(hits / total * 100, 1) if total else 0
        bar   = "█" * int(pct / 10) + "░" * (10 - int(pct / 10))
        print(f"  {airport}: {bar} {hits}/{total} ({pct}%)")

    print("\n── Per-Airline Coverage (top 10) ──")
    sorted_airlines = sorted(
        airline_total.keys(),
        key=lambda a: airline_total[a],
        reverse=True
    )[:10]
    for airline in sorted_airlines:
        total = airline_total.get(airline, 0)
        hits  = airline_hits.get(airline, 0)
        pct   = round(hits / total * 100, 1) if total else 0
        flag  = "✅" if pct >= 80 else ("⚠️" if pct >= 50 else "❌")
        print(f"  {flag} {airline:<6} {hits}/{total} ({pct}%)")

    # ── Coverage guidance ──────────────────────────────────────────────────────
    print("\n── Coverage Documentation ──")
    print("""
Known FlightAware AeroAPI Personal coverage patterns for Tunisian network:

  ✅ Tunisair (TU/TAR)       — Usually tracked. Use TAR+number (e.g. TAR312).
  ✅ Nouvelair (BJ/LBT)      — Well tracked. Use LBT+number (e.g. LBT640).
  ✅ Ryanair (FR/RYR)        — Large operator, consistently tracked.
  ✅ easyJet (U2/EZY)        — Large operator, consistently tracked.
  ✅ Turkish Airlines (TK/THY)— Well tracked.
  ✅ Air France (AF/AFR)      — Well tracked.
  ⚠️  Tunisair Express (UG/HFY)— Variable. Some regional routes missing.
  ⚠️  Air Arabia (G9/ABY)     — Moderate coverage.
  ❌ Charter / seasonal      — High miss rate (e.g. seasonal TUI, Condor).
  ❌ Private / cargo          — Not available on Personal plan.

  NBE (Enfidha) and DJE (Djerba) have fewer scheduled flights and may show
  higher miss rates due to their charter-heavy traffic mix.
""")
    print("=" * 70)
    print("Validation complete.")


if __name__ == "__main__":
    asyncio.run(main())
