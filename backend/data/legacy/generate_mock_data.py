"""
Smart Airport Operations – Mock Data Generator
================================================
Generates statistically realistic synthetic flight + weather data
using a probabilistic multi-factor delay model.

Factors influencing delay probability:
  • Weather severity (origin & destination)
  • Time-of-day congestion
  • Airline reliability score
  • Route historical delay rate
  • Random noise

Outputs:
  • flights_dataset.csv  (~5 000 records for ML training)
  • seed_data.sql        (INSERT statements for MySQL)
"""

import csv
import json
import math
import os
import random
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

# ── reproducibility ──────────────────────────────────────────
SEED = 42
random.seed(SEED)
np.random.seed(SEED)

NUM_FLIGHTS = 5_000
OUTPUT_DIR = Path(__file__).resolve().parent

# ── reference data ───────────────────────────────────────────

AIRPORTS = [
    {"iata": "CDG", "name": "Charles de Gaulle",        "city": "Paris",     "country": "France",       "region": "EU",    "tz": "Europe/Paris",        "lat": 49.0097, "lon": 2.5479},
    {"iata": "ORY", "name": "Paris-Orly",               "city": "Paris",     "country": "France",       "region": "EU",    "tz": "Europe/Paris",        "lat": 48.7262, "lon": 2.3652},
    {"iata": "JFK", "name": "John F. Kennedy",          "city": "New York",  "country": "United States","region": "US",    "tz": "America/New_York",    "lat": 40.6413, "lon": -73.7781},
    {"iata": "LHR", "name": "London Heathrow",          "city": "London",    "country": "United Kingdom","region": "EU",   "tz": "Europe/London",       "lat": 51.4700, "lon": -0.4543},
    {"iata": "DXB", "name": "Dubai International",      "city": "Dubai",     "country": "UAE",          "region": "GCC",   "tz": "Asia/Dubai",          "lat": 25.2532, "lon": 55.3657},
    {"iata": "FCO", "name": "Leonardo da Vinci–Fiumicino","city": "Rome",    "country": "Italy",        "region": "EU",    "tz": "Europe/Rome",         "lat": 41.8003, "lon": 12.2389},
    {"iata": "BCN", "name": "Josep Tarradellas Barcelona-El Prat","city": "Barcelona","country": "Spain","region": "EU",  "tz": "Europe/Madrid",       "lat": 41.2974, "lon": 2.0833},
]

AIRLINES = [
    {"iata": "AF", "name": "Air France",        "reliability": 0.78},
    {"iata": "BA", "name": "British Airways",    "reliability": 0.82},
    {"iata": "EK", "name": "Emirates",           "reliability": 0.88},
    {"iata": "DL", "name": "Delta Air Lines",    "reliability": 0.83},
    {"iata": "LH", "name": "Lufthansa",          "reliability": 0.80},
    {"iata": "IB", "name": "Iberia",             "reliability": 0.76},
    {"iata": "AZ", "name": "ITA Airways",        "reliability": 0.74},
    {"iata": "VY", "name": "Vueling",            "reliability": 0.70},
    {"iata": "U2", "name": "easyJet",            "reliability": 0.72},
    {"iata": "FR", "name": "Ryanair",            "reliability": 0.68},
    {"iata": "AA", "name": "American Airlines",  "reliability": 0.81},
    {"iata": "TK", "name": "Turkish Airlines",   "reliability": 0.77},
]

AIRCRAFT_TYPES = [
    "A320", "A321", "A330", "A350", "A380",
    "B737", "B747", "B777", "B787",
    "E190",
]

WEATHER_PROFILES = {
    "clear":     {"temp_range": (15, 35), "wind": (0, 15),  "vis": (10, 20), "precip": (0, 0),   "severity": 0.05},
    "cloudy":    {"temp_range": (5, 28),  "wind": (5, 25),  "vis": (6, 15),  "precip": (0, 0.5), "severity": 0.15},
    "rain":      {"temp_range": (3, 22),  "wind": (10, 40), "vis": (3, 10),  "precip": (1, 15),  "severity": 0.40},
    "snow":      {"temp_range": (-15, 2), "wind": (5, 35),  "vis": (1, 6),   "precip": (2, 20),  "severity": 0.60},
    "fog":       {"temp_range": (0, 18),  "wind": (0, 10),  "vis": (0.1, 2), "precip": (0, 1),   "severity": 0.55},
    "storm":     {"temp_range": (8, 30),  "wind": (30, 80), "vis": (1, 5),   "precip": (5, 40),  "severity": 0.85},
}

# Route historical delay rates (route_key → base rate)
# Will be generated dynamically during data creation.

# ── helpers ──────────────────────────────────────────────────

def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance between two points."""
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def pick_weather(month: int, airport: dict) -> dict:
    """Pick weather conditions influenced by month and location."""
    # Seasonal weights — more storms/snow in winter for Northern Hemisphere
    if airport["lat"] > 30:  # Northern hemisphere
        if month in (12, 1, 2):
            weights = {"clear": 0.15, "cloudy": 0.25, "rain": 0.20, "snow": 0.20, "fog": 0.10, "storm": 0.10}
        elif month in (6, 7, 8):
            weights = {"clear": 0.45, "cloudy": 0.25, "rain": 0.10, "snow": 0.00, "fog": 0.05, "storm": 0.15}
        else:
            weights = {"clear": 0.30, "cloudy": 0.30, "rain": 0.20, "snow": 0.05, "fog": 0.10, "storm": 0.05}
    else:  # Dubai etc.
        weights = {"clear": 0.55, "cloudy": 0.20, "rain": 0.10, "snow": 0.00, "fog": 0.05, "storm": 0.10}

    codes = list(weights.keys())
    probs = list(weights.values())
    total = sum(probs)
    probs = [p / total for p in probs]

    code = np.random.choice(codes, p=probs)
    profile = WEATHER_PROFILES[code]

    temp = round(random.uniform(*profile["temp_range"]), 1)
    wind = round(random.uniform(*profile["wind"]), 1)
    vis = round(random.uniform(*profile["vis"]), 1)
    precip = round(random.uniform(*profile["precip"]), 1)
    humidity = random.randint(30, 95)
    pressure = round(random.uniform(990, 1035), 1)
    wind_dir = random.randint(0, 360)

    # Compute severity as a composite score (not purely based on weather_code)
    severity_base = profile["severity"]
    # Add some noise so severity isn't deterministic per weather code
    severity = np.clip(severity_base + np.random.normal(0, 0.10), 0.0, 1.0)
    severity = round(float(severity), 3)

    return {
        "weather_code": code,
        "temperature_c": temp,
        "wind_speed_kmh": wind,
        "visibility_km": vis,
        "precipitation_mm": precip,
        "humidity_pct": humidity,
        "pressure_hpa": pressure,
        "wind_direction": wind_dir,
        "severity": severity,
    }


def congestion_factor(hour: int) -> float:
    """
    Airport congestion based on hour of day.
    Peaks at 08-10 and 17-19, low at 00-05.
    """
    if 0 <= hour <= 5:
        base = 0.10
    elif 6 <= hour <= 7:
        base = 0.35
    elif 8 <= hour <= 10:
        base = 0.75
    elif 11 <= hour <= 13:
        base = 0.55
    elif 14 <= hour <= 16:
        base = 0.50
    elif 17 <= hour <= 19:
        base = 0.80
    elif 20 <= hour <= 21:
        base = 0.45
    else:
        base = 0.25

    # Add noise
    return float(np.clip(base + np.random.normal(0, 0.10), 0.0, 1.0))


def compute_delay(
    weather_sev_origin: float,
    weather_sev_dest: float,
    congestion_origin: float,
    congestion_dest: float,
    airline_reliability: float,
    hist_delay_rate: float,
) -> tuple[bool, int]:
    """
    Probabilistic delay model.

    delay_prob = base
               + weather_factor          (max of origin/dest severity * weight)
               + congestion_factor       (average of origin/dest congestion * weight)
               + airline_factor          ((1 - reliability) * weight)
               + route_factor            (hist_delay_rate * weight)
               + random_noise

    Returns (is_delayed, delay_minutes).
    """
    base_rate = 0.03

    weather_factor   = max(weather_sev_origin, weather_sev_dest) * 0.28
    cong_factor      = ((congestion_origin + congestion_dest) / 2) * 0.15
    airline_factor   = (1.0 - airline_reliability) * 0.18
    route_factor     = hist_delay_rate * 0.10
    noise            = np.random.normal(0, 0.06)

    delay_prob = base_rate + weather_factor + cong_factor + airline_factor + route_factor + noise
    delay_prob = float(np.clip(delay_prob, 0.02, 0.95))  # keep realistic bounds

    is_delayed = random.random() < delay_prob

    if is_delayed:
        # Delay magnitude correlated with severity
        severity_mix = (max(weather_sev_origin, weather_sev_dest) * 0.5
                        + ((congestion_origin + congestion_dest) / 2) * 0.3
                        + (1 - airline_reliability) * 0.2)
        mean_delay = 15 + severity_mix * 120  # 15 to 135 min center
        std_delay = 10 + severity_mix * 40
        delay_min = max(5, int(np.random.normal(mean_delay, std_delay)))
        delay_min = min(delay_min, 360)  # cap at 6 hours
    else:
        delay_min = 0

    return is_delayed, delay_min


# ── main generation ──────────────────────────────────────────

def generate() -> list[dict]:
    """Generate NUM_FLIGHTS flight records with weather and features."""

    # Pre-compute route delay rates (random baseline per pair)
    route_rates: dict[str, float] = {}

    # Date range: last 12 months
    end_date = datetime(2026, 2, 1)
    start_date = end_date - timedelta(days=365)

    records: list[dict] = []

    for i in range(NUM_FLIGHTS):
        # ---- pick route ----
        origin_ap = random.choice(AIRPORTS)
        dest_ap = random.choice([a for a in AIRPORTS if a["iata"] != origin_ap["iata"]])
        airline = random.choice(AIRLINES)

        route_key = f"{origin_ap['iata']}-{dest_ap['iata']}"
        if route_key not in route_rates:
            route_rates[route_key] = round(random.uniform(0.05, 0.25), 3)

        # ---- pick datetime ----
        days_offset = random.randint(0, 364)
        flight_date = start_date + timedelta(days=days_offset)
        hour = random.choices(range(24), weights=[
            1, 1, 1, 1, 1, 2,  # 00-05
            5, 7, 9, 9, 8, 7,  # 06-11
            7, 7, 7, 8, 8, 9,  # 12-17
            8, 7, 5, 4, 3, 2,  # 18-23
        ])[0]
        minute = random.choice([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
        sched_dep = flight_date.replace(hour=hour, minute=minute, second=0, microsecond=0)

        distance = int(haversine_km(origin_ap["lat"], origin_ap["lon"], dest_ap["lat"], dest_ap["lon"]))
        flight_hours = distance / 800  # average ~800 km/h
        sched_arr = sched_dep + timedelta(hours=flight_hours)

        # ---- weather snapshots ----
        month = sched_dep.month
        wx_origin = pick_weather(month, origin_ap)
        wx_dest = pick_weather(month, dest_ap)

        # ---- congestion ----
        cong_origin = round(congestion_factor(hour), 3)
        cong_dest = round(congestion_factor((hour + int(flight_hours)) % 24), 3)

        # ---- delay decision ----
        is_delayed, delay_min = compute_delay(
            wx_origin["severity"],
            wx_dest["severity"],
            cong_origin,
            cong_dest,
            airline["reliability"],
            route_rates[route_key],
        )

        if is_delayed:
            status = "delayed"
            actual_dep = sched_dep + timedelta(minutes=delay_min)
            actual_arr = sched_arr + timedelta(minutes=delay_min)
        else:
            status = "on_time"
            # slight variance (±5 min) even for on-time flights
            tiny = random.randint(-5, 5)
            actual_dep = sched_dep + timedelta(minutes=tiny)
            actual_arr = sched_arr + timedelta(minutes=tiny)
            delay_min = 0

        flight_number = f"{airline['iata']}{random.randint(100, 9999)}"
        aircraft = random.choice(AIRCRAFT_TYPES)

        # ---- combined feature row ----
        weekend = 1 if sched_dep.weekday() >= 5 else 0
        weather_sev = round(max(wx_origin["severity"], wx_dest["severity"]), 3)

        record = {
            # Flight info
            "flight_number": flight_number,
            "airline_iata": airline["iata"],
            "airline_name": airline["name"],
            "origin_iata": origin_ap["iata"],
            "origin_city": origin_ap["city"],
            "dest_iata": dest_ap["iata"],
            "dest_city": dest_ap["city"],
            "scheduled_departure": sched_dep.strftime("%Y-%m-%d %H:%M:%S"),
            "scheduled_arrival": sched_arr.strftime("%Y-%m-%d %H:%M:%S"),
            "actual_departure": actual_dep.strftime("%Y-%m-%d %H:%M:%S"),
            "actual_arrival": actual_arr.strftime("%Y-%m-%d %H:%M:%S"),
            "status": status,
            "delay_minutes": delay_min,
            "distance_km": distance,
            "aircraft_type": aircraft,

            # Weather – origin
            "origin_weather_code": wx_origin["weather_code"],
            "origin_temp_c": wx_origin["temperature_c"],
            "origin_wind_kmh": wx_origin["wind_speed_kmh"],
            "origin_visibility_km": wx_origin["visibility_km"],
            "origin_precip_mm": wx_origin["precipitation_mm"],
            "origin_humidity": wx_origin["humidity_pct"],

            # Weather – dest
            "dest_weather_code": wx_dest["weather_code"],
            "dest_temp_c": wx_dest["temperature_c"],
            "dest_wind_kmh": wx_dest["wind_speed_kmh"],
            "dest_visibility_km": wx_dest["visibility_km"],
            "dest_precip_mm": wx_dest["precipitation_mm"],
            "dest_humidity": wx_dest["humidity_pct"],

            # Computed features (for ML)
            "weather_severity": weather_sev,
            "origin_weather_severity": wx_origin["severity"],
            "dest_weather_severity": wx_dest["severity"],
            "hour_of_day": hour,
            "day_of_week": sched_dep.weekday(),
            "month": month,
            "is_weekend": weekend,
            "is_holiday": 0,  # simplified; could add holiday calendar
            "congestion_level": round((cong_origin + cong_dest) / 2, 3),
            "origin_congestion": cong_origin,
            "dest_congestion": cong_dest,
            "airline_reliability": airline["reliability"],
            "historical_delay_rate": route_rates[route_key],
            "is_delayed": 1 if is_delayed else 0,
        }
        records.append(record)

    return records


def write_csv(records: list[dict], path: Path):
    """Write records to CSV."""
    fieldnames = list(records[0].keys())
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)
    print(f"✅ CSV written: {path}  ({len(records)} records)")


def write_seed_sql(records: list[dict], path: Path):
    """
    Write SQL INSERT statements for airports, airlines, flights,
    weather_conditions, and flight_features tables.
    """
    lines: list[str] = []
    lines.append("-- Auto-generated seed data")
    lines.append("USE smart_airport;\n")

    # ── Airports ──
    lines.append("-- Airports")
    for ap in AIRPORTS:
        lines.append(
            f"INSERT INTO airports (iata_code, name, city, country, region, timezone, latitude, longitude) "
            f"VALUES ('{ap['iata']}', '{ap['name']}', '{ap['city']}', '{ap['country']}', "
            f"'{ap['region']}', '{ap['tz']}', {ap['lat']}, {ap['lon']}) "
            f"ON DUPLICATE KEY UPDATE name=name;"
        )
    lines.append("")

    # ── Airlines ──
    lines.append("-- Airlines")
    for al in AIRLINES:
        lines.append(
            f"INSERT INTO airlines (iata_code, name, reliability_score) "
            f"VALUES ('{al['iata']}', '{al['name']}', {al['reliability']}) "
            f"ON DUPLICATE KEY UPDATE name=name;"
        )
    lines.append("")

    # ── Passenger Rights (global) ──
    lines.append("-- Passenger Rights")
    rights = [
        # EU 261/2004
        ("EU", "EC 261/2004", 120, None, 1500,   "refreshment", "Free refreshments and 2 phone calls", "Rafraîchissements gratuits et 2 appels", None),
        ("EU", "EC 261/2004", 180, None, 1500,    "compensation", "€250 compensation for flights ≤1500 km", "Indemnisation de 250€ pour vols ≤1500 km", "€250"),
        ("EU", "EC 261/2004", 180, 1500, 3500,    "compensation", "€400 compensation for flights 1500-3500 km", "Indemnisation de 400€ pour vols 1500-3500 km", "€400"),
        ("EU", "EC 261/2004", 240, 3500, None,    "compensation", "€600 compensation for flights >3500 km", "Indemnisation de 600€ pour vols >3500 km", "€600"),
        ("EU", "EC 261/2004", 300, None, None,    "hotel", "Hotel accommodation + transport if overnight", "Hébergement + transport si nuit", None),
        # US DOT
        ("US", "DOT Regulations", 180, None, None, "reboard", "Right to deplane after 3h tarmac delay", None, None),
        ("US", "DOT Regulations", 0,   None, None, "refund", "Full refund for significant delays/cancellations", None, None),
        # Canada APPR
        ("CA", "APPR", 180, None, None,           "compensation", "CAD $400 compensation for delays 3-6 hours", None, "CAD $400"),
        ("CA", "APPR", 360, None, None,           "compensation", "CAD $700 compensation for delays 6-9 hours", None, "CAD $700"),
        ("CA", "APPR", 540, None, None,           "compensation", "CAD $1,000 compensation for delays ≥9 hours", None, "CAD $1,000"),
        # GCC
        ("GCC", "General Duty of Care", 180, None, None, "meal",  "Airline must provide meals and refreshments", None, None),
        ("GCC", "General Duty of Care", 480, None, None, "hotel", "Airline must provide hotel if overnight delay", None, None),
    ]
    for r in rights:
        dist_min_sql = str(r[3]) if r[3] is not None else "NULL"
        dist_max_sql = str(r[4]) if r[4] is not None else "NULL"
        desc_fr_sql  = f"'{r[7]}'" if r[7] is not None else "NULL"
        comp_sql     = f"'{r[8]}'" if r[8] is not None else "NULL"
        lines.append(
            f"INSERT INTO passenger_rights (region, regulation_name, delay_threshold_min, distance_min_km, distance_max_km, right_type, description_en, description_fr, compensation_amount) "
            f"VALUES ('{r[0]}', '{r[1]}', {r[2]}, {dist_min_sql}, {dist_max_sql}, '{r[5]}', '{r[6]}', {desc_fr_sql}, {comp_sql});"
        )
    lines.append("")

    # ── Flights + Weather + Features  (first 200 for seed) ──
    lines.append("-- Sample flights, weather, and features (first 200)")
    lines.append("-- Full dataset is in flights_dataset.csv\n")
    for idx, rec in enumerate(records[:200]):
        fid = idx + 1

        # Flight
        lines.append(
            f"INSERT INTO flights (id, flight_number, airline_id, origin_airport_id, dest_airport_id, "
            f"scheduled_departure, scheduled_arrival, actual_departure, actual_arrival, status, delay_minutes, distance_km, aircraft_type) "
            f"VALUES ({fid}, '{rec['flight_number']}', "
            f"(SELECT id FROM airlines WHERE iata_code='{rec['airline_iata']}'), "
            f"(SELECT id FROM airports WHERE iata_code='{rec['origin_iata']}'), "
            f"(SELECT id FROM airports WHERE iata_code='{rec['dest_iata']}'), "
            f"'{rec['scheduled_departure']}', '{rec['scheduled_arrival']}', "
            f"'{rec['actual_departure']}', '{rec['actual_arrival']}', "
            f"'{rec['status']}', {rec['delay_minutes']}, {rec['distance_km']}, '{rec['aircraft_type']}');"
        )

        # Weather – origin
        lines.append(
            f"INSERT INTO weather_conditions (airport_id, recorded_at, temperature_c, wind_speed_kmh, "
            f"wind_direction, visibility_km, precipitation_mm, weather_code, humidity_pct) "
            f"VALUES ((SELECT id FROM airports WHERE iata_code='{rec['origin_iata']}'), "
            f"'{rec['scheduled_departure']}', {rec['origin_temp_c']}, {rec['origin_wind_kmh']}, "
            f"{random.randint(0,360)}, {rec['origin_visibility_km']}, {rec['origin_precip_mm']}, "
            f"'{rec['origin_weather_code']}', {rec['origin_humidity']});"
        )

        # Weather – dest
        lines.append(
            f"INSERT INTO weather_conditions (airport_id, recorded_at, temperature_c, wind_speed_kmh, "
            f"wind_direction, visibility_km, precipitation_mm, weather_code, humidity_pct) "
            f"VALUES ((SELECT id FROM airports WHERE iata_code='{rec['dest_iata']}'), "
            f"'{rec['scheduled_departure']}', {rec['dest_temp_c']}, {rec['dest_wind_kmh']}, "
            f"{random.randint(0,360)}, {rec['dest_visibility_km']}, {rec['dest_precip_mm']}, "
            f"'{rec['dest_weather_code']}', {rec['dest_humidity']});"
        )

        # Flight features
        lines.append(
            f"INSERT INTO flight_features (flight_id, weather_severity, origin_weather_severity, dest_weather_severity, "
            f"hour_of_day, day_of_week, month, is_weekend, is_holiday, "
            f"congestion_level, origin_congestion, dest_congestion, "
            f"airline_reliability, distance_km, historical_delay_rate, is_delayed, delay_minutes) "
            f"VALUES ({fid}, {rec['weather_severity']}, {rec['origin_weather_severity']}, {rec['dest_weather_severity']}, "
            f"{rec['hour_of_day']}, {rec['day_of_week']}, {rec['month']}, {rec['is_weekend']}, {rec['is_holiday']}, "
            f"{rec['congestion_level']}, {rec['origin_congestion']}, {rec['dest_congestion']}, "
            f"{rec['airline_reliability']}, {rec['distance_km']}, {rec['historical_delay_rate']}, "
            f"{rec['is_delayed']}, {rec['delay_minutes']});"
        )
        lines.append("")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"✅ Seed SQL written: {path}  (airports + airlines + rights + {min(len(records), 200)} flights)")


def print_stats(records: list[dict]):
    """Print summary statistics about the generated data."""
    total = len(records)
    delayed = sum(1 for r in records if r["is_delayed"] == 1)
    on_time = total - delayed

    delays = [r["delay_minutes"] for r in records if r["is_delayed"] == 1]

    print("\n" + "=" * 50)
    print("  DATASET STATISTICS")
    print("=" * 50)
    print(f"  Total flights:    {total:,}")
    print(f"  On time:          {on_time:,} ({on_time/total*100:.1f}%)")
    print(f"  Delayed:          {delayed:,} ({delayed/total*100:.1f}%)")
    print(f"  Avg delay:        {np.mean(delays):.0f} min  (among delayed)")
    print(f"  Median delay:     {np.median(delays):.0f} min")
    print(f"  Max delay:        {max(delays)} min")
    print(f"  Unique routes:    {len(set(r['origin_iata']+'-'+r['dest_iata'] for r in records))}")
    print(f"  Airlines:         {len(set(r['airline_iata'] for r in records))}")
    print("=" * 50)

    # Per-weather-code delay rate
    print("\n  Delay rate by weather (origin):")
    from collections import Counter, defaultdict
    weather_delays = defaultdict(lambda: [0, 0])
    for r in records:
        weather_delays[r["origin_weather_code"]][0] += 1
        weather_delays[r["origin_weather_code"]][1] += r["is_delayed"]
    for code in sorted(weather_delays.keys()):
        total_w, delayed_w = weather_delays[code]
        print(f"    {code:8s}  {delayed_w}/{total_w}  ({delayed_w/total_w*100:.1f}%)")

    print()


# ── entry point ──────────────────────────────────────────────

if __name__ == "__main__":
    print("🛫 Generating Smart Airport mock data...")
    records = generate()

    csv_path = OUTPUT_DIR / "flights_dataset.csv"
    sql_path = OUTPUT_DIR / "seed_data.sql"

    write_csv(records, csv_path)
    write_seed_sql(records, sql_path)
    print_stats(records)

    print("\n✅ Phase C complete!")
    print(f"   CSV:  {csv_path}")
    print(f"   SQL:  {sql_path}")
