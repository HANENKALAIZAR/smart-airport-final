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
#   - AVIATIONSTACK_KEY (from https://aviationstack.com)
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

### 5. Train the AI model (first time only)

The trained model files are included in `app/ai/model/`. If you need to retrain:

```bash
python -m app.ai.train_model
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
│   │   ├── aviationstack.py # Real-time flight data from AviationStack
│   │   └── opensky.py       # Live radar from OpenSky Network
│   ├── services/
│   │   ├── prediction_service.py  # XGBoost + SHAP inference
│   │   ├── email_service.py       # Gmail SMTP welcome emails
│   │   ├── passenger_rights.py    # EC 261/2004 rights logic
│   │   └── live_feature_builder.py
│   └── ai/
│       ├── train_model.py         # Training script
│       └── model/                 # Trained model artifacts
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
