# Smart Airport Operations — Backend

FastAPI backend with PostgreSQL, XGBoost AI prediction, JWT authentication, and real-time flight data.

---

## Quick Start

### 1. Requirements
- Python 3.12+
- PostgreSQL 14+
- Node.js 20+ (for the frontend)

### 2. Set up environment

```bash
cd backend
cp .env.example .env
# Edit .env with your actual values:
#   - DB_PASS, SECRET_KEY (generate with: python -c "import secrets; print(secrets.token_hex(32))")
#   - AVIATION_EDGE_KEY (from https://aviation-edge.com)
#   - SMTP_USER, SMTP_PASSWORD (Gmail App Password)
```

### 3. Set up the database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE smart_airport;"

# Apply schema (creates all tables + seed data including the super_admin account)
psql -U postgres -d smart_airport -f database/schema.sql
```

**Default super_admin credentials** (seeded by schema.sql):
- Email: `superadmin@smartairport.tn`
- Password: `Admin@2024`
- ⚠️ Change this immediately after first login.

### 4. Install dependencies and run

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 5. ML Model — Production Training

> ⚠️ **Do not use `data/legacy/` files for training.** Those files contain synthetic mock data
> and are archived for historical reference only.

The production ML model is trained automatically every 6 hours by the APScheduler job.
Training source: **`ae_flight_dataset` PostgreSQL table** (populated by Aviation Edge API ingestion).
Training pipeline: **`app/ai/train_v2.py`** — multi-model (XGBoost / LightGBM / CatBoost / RandomForest),
15-feature set with rolling historical statistics, 5-fold time-series cross-validation.

To manually trigger a training run via CLI (development only):

```bash
python -m app.ai.train_v2
```

To check the active model version and live metrics:

```bash
curl http://localhost:8000/api/ml/dashboard
```

---

## Docker

```bash
# From the project root
cp backend/.env.example backend/.env
# Edit backend/.env

docker-compose up --build
```

---

## Database Migrations (Alembic)

```bash
# After changing models.py, create a migration:
alembic revision --autogenerate -m "describe your change"

# Apply pending migrations:
alembic upgrade head

# Roll back one migration:
alembic downgrade -1
```

---

## Running Tests

```bash
# No PostgreSQL needed — tests use SQLite in memory
pytest tests/ -v

# Run a specific test file
pytest tests/test_auth.py -v

# With coverage report
pip install pytest-cov
pytest tests/ --cov=app --cov-report=term-missing
```

---

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app entry point (rate limiting, logging, CORS)
│   ├── config.py            # Settings from .env
│   ├── database.py          # SQLAlchemy engine and session
│   ├── dependencies.py      # JWT auth dependencies (get_current_user, require_admin, require_super_admin)
│   ├── models/
│   │   └── models.py        # All ORM models (Airport, Flight, User, Message, etc.)
│   ├── schemas/
│   │   └── schemas.py       # Pydantic request/response schemas
│   ├── routers/
│   │   ├── auth.py          # Login, change-password, /me (rate-limited)
│   │   ├── users.py         # Admin user management (super_admin only)
│   │   ├── messages.py      # Internal messaging (admin ↔ super_admin)
│   │   ├── flights.py       # Flight CRUD
│   │   ├── predictions.py   # AI predictions
│   │   ├── dashboard.py     # Analytics and KPIs
│   │   ├── airports.py      # Airport/airline reference data
│   │   ├── aviation_edge.py # Real-time flight data from Aviation Edge
│   ├── services/
│   │   ├── prediction_service.py  # XGBoost + SHAP inference
│   │   ├── email_service.py       # Gmail SMTP welcome emails
│   │   ├── passenger_rights.py    # EC 261/2004 rights logic
│   │   └── live_feature_builder.py
│   └── ai/
│       ├── train_v2.py           # PRODUCTION training pipeline (15 features, multi-model)
│       ├── train_ae_dataset.py   # Legacy V1 pipeline (7 features) — kept for reference
│       ├── mlops_controller.py   # Champion/challenger promotion, drift detection
│       ├── future_predictions.py # Batch inference (auto-detects V1 vs V2 features)
│       └── model/                # Trained model artifacts (.pkl, evaluation report)
├── migrations/              # Alembic migrations
├── tests/                   # Pytest test suite
├── database/
│   └── schema.sql           # Full PostgreSQL schema + seed data
├── requirements.txt
├── Dockerfile
└── .env.example
```

---

## Security Notes

- **Never commit `.env`** — it is in `.gitignore`
- The `SECRET_KEY` must be a long random string. Generate one:
  ```bash
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
- Login is rate-limited to **10 attempts per minute** per IP
- All user management endpoints require a valid **super_admin JWT token**
- Passwords are hashed with **bcrypt**
- New admins receive a temporary password and **must change it on first login**

---

## Flight Data Provider Architecture

This backend uses a **dual-provider strategy** for flight data. Aviation Edge is the primary source and FlightAware is a secondary enrichment layer only.

```
Aviation Edge (PRIMARY)                 FlightAware AeroAPI (SECONDARY)
──────────────────────────              ─────────────────────────────────
✅ Airport timetables                   ✅ Live status enrichment
✅ Departure / arrival lists            ✅ Actual departure/arrival times
✅ Bulk ingestion (scheduled job)       ✅ GPS position when AE is stale
✅ ML training dataset                  ❌ NOT used for schedules
✅ Passenger alert subscriptions        ❌ NOT used for ML training
✅ Historical data                      ❌ NOT used for historical data
```

### Enabling FlightAware

Add your [AeroAPI Personal key](https://flightaware.com/commercial/aeroapi/) to `.env`:

```env
FLIGHTAWARE_API_KEY=your_key_here
FLIGHTAWARE_ENABLED=true
```

Leave `FLIGHTAWARE_API_KEY` empty (default) to fully disable FA enrichment — Aviation Edge continues working normally.

### Safety Controls

| Control | Value |
|---------|-------|
| Max flights enriched per cycle | 50 (hard LIMIT) |
| Enrichment window | ±2h past to +12h future |
| Per-ident cache TTL | 180 seconds |
| HTTP timeout | 5 seconds |
| Scheduler interval | 15 minutes |
| Circuit breaker — failure threshold | 5 consecutive failures |
| Circuit breaker — timeout threshold | 3 consecutive timeouts |
| Circuit breaker cooldown | 30 minutes |
| Auth failure self-disable | Permanent (until restart) |

### Structured Log Tags

```
[FA DISABLED]        key missing, flag false, or auth failed (401/403)
[FA HIT]             successful FlightAware response
[FA MISS]            ident not found (404) or no flights in response
[FA ENRICHED]        at least one field was updated on the snapshot
[FA RATE LIMITED]    HTTP 429 received
[FA TIMEOUT]         HTTP timeout exceeded
[FA ERROR]           unexpected exception
[FA CIRCUIT OPEN]    circuit tripped — enrichment suspended 30 min
[FA CIRCUIT CLOSED]  cooldown elapsed — enrichment resuming
```

### Provider Health Monitoring

```
GET /api/aviation-edge/provider-health
```

Returns real-time circuit breaker state, counters, and last-call timestamps for both providers. No authentication required. No secrets exposed.

### Running the Coverage Validation Script

After filling in `FLIGHTAWARE_API_KEY`, run this to measure coverage across all 4 Tunisian airports:

```bash
python validate_flightaware_coverage.py
```

Produces a per-flight table, per-airport bar chart, and per-airline hit rates.

### Known FlightAware Coverage — Tunisian Network

| Airline | IATA | ICAO used by FA | Coverage | Notes |
|---------|------|-----------------|----------|-------|
| Tunisair | TU | TAR | ✅ Good | Use `TAR` ident (e.g. `TAR312`) |
| Nouvelair | BJ | LBT | ✅ Good | Use `LBT` ident (e.g. `LBT640`) |
| Tunisair Express | UG | HFY | ⚠️ Variable | Some regional routes missing |
| Ryanair | FR | RYR | ✅ Good | Large operator, consistently tracked |
| easyJet | U2 | EZY | ✅ Good | Large operator, consistently tracked |
| Turkish Airlines | TK | THY | ✅ Good | Major hub traffic |
| Air France | AF | AFR | ✅ Good | Well tracked |
| Air Arabia Maroc | 3O | MRO | ⚠️ Variable | Moderate coverage |
| Charter / seasonal | varies | varies | ❌ Weak | High miss rate |

> **Note**: NBE (Enfidha) and DJE (Djerba) have charter-heavy traffic and typically show higher FA miss rates than TUN or MIR.

### Database Migration

When deploying for the first time (or upgrading an existing instance), run:

```bash
python migrate_v19.py
```

This adds 4 nullable columns to `ae_flight_snapshots` for FA enrichment metadata and creates a partial index for faster enrichment window queries.

