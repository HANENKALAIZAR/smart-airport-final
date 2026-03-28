"""
Passenger Rights Service
========================
Global air passenger rights based on flight region and delay.
Supports: EU (EC 261/2004), US (DOT), Canada (APPR), GCC.
"""

from sqlalchemy.orm import Session
from app.models.models import Flight, Airport, PassengerRight
from app.schemas.schemas import PassengerRightOut


def get_applicable_rights(
    db: Session,
    flight: Flight,
) -> list[PassengerRightOut]:
    """
    Determine which passenger rights apply to a flight based on:
    - Origin/destination region
    - Current delay in minutes
    - Route distance in km
    """
    if flight.delay_minutes <= 0 and flight.status not in ("delayed", "cancelled"):
        return []

    delay = flight.delay_minutes
    distance = flight.distance_km

    # Determine applicable regions from origin and destination
    origin = db.query(Airport).filter(Airport.id == flight.origin_airport_id).first()
    dest = db.query(Airport).filter(Airport.id == flight.dest_airport_id).first()

    if not origin or not dest:
        return []

    # Collect applicable regions (both origin and destination matter)
    regions = set()

    # EU regulation applies if either origin or destination is EU
    if origin.region == "EU" or dest.region == "EU":
        regions.add("EU")

    # US DOT applies for US origin/destination
    if origin.region == "US" or dest.region == "US":
        regions.add("US")

    # Canadian APPR applies for CA flights
    if origin.region == "CA" or dest.region == "CA":
        regions.add("CA")

    # GCC general duty of care
    if origin.region == "GCC" or dest.region == "GCC":
        regions.add("GCC")

    if not regions:
        regions.add("OTHER")

    # Query applicable rights
    all_rights = (
        db.query(PassengerRight)
        .filter(
            PassengerRight.region.in_(regions),
            PassengerRight.delay_threshold_min <= delay,
        )
        .order_by(PassengerRight.delay_threshold_min)
        .all()
    )

    # Filter by distance ranges
    applicable = []
    for right in all_rights:
        if right.distance_min_km is not None and distance < right.distance_min_km:
            continue
        if right.distance_max_km is not None and distance > right.distance_max_km:
            continue
        applicable.append(PassengerRightOut.model_validate(right))

    return applicable
