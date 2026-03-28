-- ================================================================
-- Smart Airport Operations – PostgreSQL Schema
-- Run: psql -U postgres -d smart_airport -f schema.sql
-- ================================================================
-- ── Types / Enums ──────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE flight_status AS ENUM (
    'scheduled',
    'on_time',
    'delayed',
    'cancelled',
    'landed'
);
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('passenger', 'admin', 'super_admin');
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN CREATE TYPE right_type_enum AS ENUM (
    'refreshment',
    'meal',
    'hotel',
    'transport',
    'compensation',
    'refund',
    'reboard'
);
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;
-- ── Airports ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS airports (
    id SERIAL PRIMARY KEY,
    iata_code CHAR(3) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    region VARCHAR(30) NOT NULL,
    timezone VARCHAR(50) NOT NULL,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    created_at TIMESTAMP DEFAULT NOW()
);
-- ── Airlines ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS airlines (
    id SERIAL PRIMARY KEY,
    iata_code CHAR(2) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    reliability_score NUMERIC(3, 2) NOT NULL DEFAULT 0.80,
    created_at TIMESTAMP DEFAULT NOW()
);
-- ── Flights ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flights (
    id SERIAL PRIMARY KEY,
    flight_number VARCHAR(10) NOT NULL,
    airline_id INTEGER NOT NULL REFERENCES airlines(id),
    origin_airport_id INTEGER NOT NULL REFERENCES airports(id),
    dest_airport_id INTEGER NOT NULL REFERENCES airports(id),
    scheduled_departure TIMESTAMP NOT NULL,
    scheduled_arrival TIMESTAMP NOT NULL,
    actual_departure TIMESTAMP,
    actual_arrival TIMESTAMP,
    status flight_status NOT NULL DEFAULT 'scheduled',
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    distance_km INTEGER NOT NULL DEFAULT 0,
    aircraft_type VARCHAR(30),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_flights_number ON flights(flight_number);
CREATE INDEX IF NOT EXISTS idx_flights_dep ON flights(scheduled_departure);
CREATE INDEX IF NOT EXISTS idx_flights_status ON flights(status);
-- ── Weather Conditions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weather_conditions (
    id SERIAL PRIMARY KEY,
    airport_id INTEGER NOT NULL REFERENCES airports(id),
    recorded_at TIMESTAMP NOT NULL,
    temperature_c NUMERIC(5, 2),
    wind_speed_kmh NUMERIC(6, 2),
    wind_direction INTEGER,
    visibility_km NUMERIC(5, 2),
    precipitation_mm NUMERIC(5, 2) DEFAULT 0,
    weather_code VARCHAR(30),
    humidity_pct INTEGER,
    pressure_hpa NUMERIC(6, 1),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_airport_time ON weather_conditions(airport_id, recorded_at);
-- ── Flight Features (ML) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS flight_features (
    id SERIAL PRIMARY KEY,
    flight_id INTEGER UNIQUE NOT NULL REFERENCES flights(id),
    weather_severity NUMERIC(4, 3) NOT NULL DEFAULT 0.000,
    origin_weather_severity NUMERIC(4, 3) NOT NULL DEFAULT 0.000,
    dest_weather_severity NUMERIC(4, 3) NOT NULL DEFAULT 0.000,
    hour_of_day INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    month INTEGER NOT NULL,
    is_weekend SMALLINT NOT NULL DEFAULT 0,
    is_holiday SMALLINT NOT NULL DEFAULT 0,
    congestion_level NUMERIC(4, 3) NOT NULL DEFAULT 0.000,
    origin_congestion NUMERIC(4, 3) NOT NULL DEFAULT 0.000,
    dest_congestion NUMERIC(4, 3) NOT NULL DEFAULT 0.000,
    airline_reliability NUMERIC(3, 2) NOT NULL DEFAULT 0.80,
    distance_km INTEGER NOT NULL DEFAULT 0,
    historical_delay_rate NUMERIC(4, 3) NOT NULL DEFAULT 0.000,
    is_delayed SMALLINT NOT NULL DEFAULT 0,
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
-- ── Predictions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    flight_id INTEGER NOT NULL REFERENCES flights(id),
    risk_score NUMERIC(5, 2) NOT NULL,
    predicted_delay_min INTEGER NOT NULL DEFAULT 0,
    confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.000,
    shap_explanation JSONB,
    model_version VARCHAR(30),
    predicted_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk ON predictions(risk_score);
CREATE INDEX IF NOT EXISTS idx_pred_flt ON predictions(flight_id);
-- ── Users ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                   SERIAL PRIMARY KEY,
    email                VARCHAR(255) UNIQUE NOT NULL,
    password_hash        VARCHAR(255) NOT NULL,
    full_name            VARCHAR(120) NOT NULL,
    role                 user_role NOT NULL DEFAULT 'passenger',
    airport_iata         VARCHAR(3),
    is_active            SMALLINT NOT NULL DEFAULT 1,
    must_change_password SMALLINT NOT NULL DEFAULT 0,
    last_login           TIMESTAMP,
    created_at           TIMESTAMP DEFAULT NOW(),
    updated_at           TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
-- ── Passenger Rights ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS passenger_rights (
    id SERIAL PRIMARY KEY,
    region VARCHAR(30) NOT NULL,
    regulation_name VARCHAR(120) NOT NULL,
    delay_threshold_min INTEGER NOT NULL,
    distance_min_km INTEGER,
    distance_max_km INTEGER,
    right_type right_type_enum NOT NULL,
    description_en TEXT NOT NULL,
    description_fr TEXT,
    compensation_amount VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_region_delay ON passenger_rights(region, delay_threshold_min);
-- ── Seed Data ──────────────────────────────────────────────────
-- Tunisian airports
INSERT INTO airports (
        iata_code,
        name,
        city,
        country,
        region,
        timezone,
        latitude,
        longitude
    )
VALUES (
        'TUN',
        'Tunis-Carthage International Airport',
        'Tunis',
        'Tunisia',
        'Africa',
        'Africa/Tunis',
        36.851000,
        10.227200
    ),
    (
        'DJE',
        'Djerba–Zarzis International Airport',
        'Djerba',
        'Tunisia',
        'Africa',
        'Africa/Tunis',
        33.875000,
        10.775500
    ),
    (
        'NBE',
        'Enfidha–Hammamet International Airport',
        'Enfidha',
        'Tunisia',
        'Africa',
        'Africa/Tunis',
        36.075800,
        10.438600
    ),
    (
        'MIR',
        'Monastir Habib Bourguiba Airport',
        'Monastir',
        'Tunisia',
        'Africa',
        'Africa/Tunis',
        35.758600,
        10.754600
    ),
    (
        'SFA',
        'Sfax–Thyna International Airport',
        'Sfax',
        'Tunisia',
        'Africa',
        'Africa/Tunis',
        34.717900,
        10.690000
    ),
    (
        'TOE',
        'Tozeur–Nefta International Airport',
        'Tozeur',
        'Tunisia',
        'Africa',
        'Africa/Tunis',
        33.939500,
        8.110560
    ),
    (
        'TBJ',
        'Tabarka–Aïn Draham International',
        'Tabarka',
        'Tunisia',
        'Africa',
        'Africa/Tunis',
        36.979800,
        8.876930
    ),
    (
        'GAF',
        'Gafsa–Ksar International Airport',
        'Gafsa',
        'Tunisia',
        'Africa',
        'Africa/Tunis',
        34.422000,
        8.822250
    ) ON CONFLICT (iata_code) DO NOTHING;
-- Major airlines
INSERT INTO airlines (iata_code, name, reliability_score)
VALUES ('TU', 'Tunisair', 0.82),
    ('AF', 'Air France', 0.91),
    ('LH', 'Lufthansa', 0.93),
    ('TK', 'Turkish Airlines', 0.89),
    ('BA', 'British Airways', 0.90),
    ('U2', 'easyJet', 0.84),
    ('FR', 'Ryanair', 0.82),
    ('QR', 'Qatar Airways', 0.94),
    ('EK', 'Emirates', 0.93),
    ('MS', 'Egyptair', 0.87),
    ('AT', 'Royal Air Maroc', 0.86),
    ('AH', 'Air Algérie', 0.83),
    ('IB', 'Iberia', 0.88),
    ('VY', 'Vueling', 0.83),
    ('UX', 'Air Europa', 0.86) ON CONFLICT (iata_code) DO NOTHING;
-- Default super_admin account (password: Admin@2024)
INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES (
        'superadmin@smartairport.tn',
        '$2b$12$LQv3c1yqBwEHFX4tsAJIFuCrCL7l/3x3czxT7aME87XdIuLN7KBXW',
        'Super Admin',
        'super_admin',
        1
    ) ON CONFLICT (email) DO NOTHING;
-- Passenger rights (EU Regulation 261/2004)
INSERT INTO passenger_rights (
        region,
        regulation_name,
        delay_threshold_min,
        distance_max_km,
        right_type,
        description_en,
        description_fr,
        compensation_amount
    )
VALUES (
        'EU',
        'EC 261/2004',
        120,
        NULL,
        'refreshment',
        'Right to meals and refreshments',
        'Repas et rafraîchissements',
        NULL
    ),
    (
        'EU',
        'EC 261/2004',
        120,
        NULL,
        'hotel',
        'Right to hotel accommodation if overnight delay',
        'Hébergement si retard nocturne',
        NULL
    ),
    (
        'EU',
        'EC 261/2004',
        180,
        1500,
        'compensation',
        'Cash compensation for delays over 3 hours (<1500 km)',
        'Indemnisation pour vol < 1500 km',
        '€250'
    ),
    (
        'EU',
        'EC 261/2004',
        180,
        3500,
        'compensation',
        'Cash compensation for delays over 3 hours (1500-3500 km)',
        'Indemnisation pour vol 1500-3500 km',
        '€400'
    ),
    (
        'EU',
        'EC 261/2004',
        240,
        NULL,
        'compensation',
        'Cash compensation for delays over 4 hours (>3500 km)',
        'Indemnisation pour vol > 3500 km',
        '€600'
    ),
    (
        'EU',
        'EC 261/2004',
        300,
        NULL,
        'refund',
        'Right to full ticket refund for extreme delays',
        'Remboursement intégral du billet',
        NULL
    ) ON CONFLICT DO NOTHING;
\ echo '✅ Schema and seed data applied successfully!'
-- ── Messages (internal admin ↔ super admin communication) ──────────────
DO $$ BEGIN CREATE TYPE msg_direction AS ENUM ('to_super', 'to_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE msg_category AS ENUM ('technical', 'operational', 'request', 'general');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE msg_status AS ENUM ('open', 'in_progress', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS messages (
    id           SERIAL PRIMARY KEY,
    direction    msg_direction NOT NULL,
    from_user_id INTEGER NOT NULL REFERENCES users(id),
    to_user_id   INTEGER REFERENCES users(id),
    category     msg_category NOT NULL DEFAULT 'general',
    subject      VARCHAR(200) NOT NULL,
    body         TEXT NOT NULL,
    status       msg_status NOT NULL DEFAULT 'open',
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_msg_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_msg_status    ON messages(status);

CREATE TABLE IF NOT EXISTS message_replies (
    id         SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id),
    author_id  INTEGER NOT NULL REFERENCES users(id),
    body       TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reply_message ON message_replies(message_id);

-- Note: airport_iata, must_change_password, last_login are already in the CREATE TABLE above
