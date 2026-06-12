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

-- Governance columns for passenger_rights (must match after migration)
ALTER TABLE passenger_rights ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE passenger_rights ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT '2020-01-01';
ALTER TABLE passenger_rights ADD COLUMN IF NOT EXISTS valid_to DATE;
ALTER TABLE passenger_rights ADD COLUMN IF NOT EXISTS regulation_version VARCHAR(50) DEFAULT '1.0';
ALTER TABLE passenger_rights ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP DEFAULT NOW();

-- ── Compensation Limits ─────────────────────────────────────────
-- Stores non-per-delay-threshold compensation caps:
--   baggage liability limits, denied boarding caps,
--   Montreal Convention limits, etc.
CREATE TABLE IF NOT EXISTS compensation_limits (
    id SERIAL PRIMARY KEY,
    region VARCHAR(30) NOT NULL,
    category VARCHAR(60) NOT NULL,
    label_en VARCHAR(300) NOT NULL,
    label_fr VARCHAR(300),
    label_ar VARCHAR(300),
    amount_eur DECIMAL(12,2),
    amount_usd DECIMAL(12,2),
    amount_cad DECIMAL(12,2),
    amount_gbp DECIMAL(12,2),
    source_sdr DECIMAL(12,2),
    is_active BOOLEAN DEFAULT TRUE,
    valid_from DATE DEFAULT '2020-01-01',
    valid_to DATE,
    regulation_version VARCHAR(50) DEFAULT '1.0',
    regulation_source VARCHAR(200),
    last_updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comp_limits_region ON compensation_limits(region, category);

-- Seed compensation_limits
INSERT INTO compensation_limits (region, category, label_en, label_fr, label_ar, amount_eur, amount_usd, amount_cad, amount_gbp, source_sdr, regulation_version, regulation_source)
VALUES
-- US DOT
('US', 'baggage_liability', 'Up to $3,800 per passenger for domestic checked baggage', 'Jusqu''à 3 800 $ par passager pour bagages enregistrés', 'حتى 3,800 دولار لكل راكب للأمتعة المسجلة المحلية', 3500, 3800, NULL, NULL, NULL, '2024-01-01', 'DOT 14 CFR Part 254'),
('US', 'denied_boarding_200', '200% of one-way fare (max $1,075) for short delays', '200% du tarif aller simple (max 1 075 $) pour retards courts', '200% من سعر التذكرة (بحد أقصى 1,075 دولار) للتأخير القصير', 1000, 1075, NULL, NULL, NULL, '2024-01-01', 'DOT 14 CFR Part 250'),
('US', 'denied_boarding_400', '400% of one-way fare (max $2,150) for longer delays', '400% du tarif aller simple (max 2 150 $) pour retards longs', '400% من سعر التذكرة (بحد أقصى 2,150 دولار) للتأخير الطويل', 2000, 2150, NULL, NULL, NULL, '2024-01-01', 'DOT 14 CFR Part 250'),
('US', 'bumped_detail', 'Up to $1,550 for involuntary denied boarding', 'Jusqu''à 1 550 $ pour refus d''embarquement involontaire', 'حتى 1,550 دولار لرفض الصعود غير الطوعي', 1430, 1550, NULL, NULL, NULL, '2024-01-01', 'DOT 14 CFR Part 250'),
-- Canada APPR
('CA', 'baggage_liability', 'Up to ~CA$2,350 per passenger under Montreal Convention', 'Jusqu''à ~2 350 CA$ par passager selon la Convention de Montréal', 'ما يصل إلى ~2,350 دولار كندي لكل راكب بموجب اتفاقية مونتريال', 1550, 1700, 2350, NULL, 1288, '2024-01-01', 'Montreal Convention Art. 22'),
('CA', 'denied_boarding', 'Up to CA$2,400 for involuntary denied boarding (9h+ delay)', 'Jusqu''à 2 400 CA$ pour refus d''embarquement involontaire (retard 9h+)', 'حتى 2,400 دولار كندي لرفض الصعود غير الطوعي (تأخير 9+ ساعات)', 1600, 1760, 2400, NULL, NULL, '2024-01-01', 'APPR — CTA'),
('CA', 'large_carrier_3_6', 'CA$400 for 3–6h delay (large carriers)', '400 $CA pour retard 3–6h (grands transporteurs)', '400 دولار كندي لتأخير 3-6 ساعات (ناقلات كبيرة)', 270, 300, 400, NULL, NULL, '2024-01-01', 'APPR — CTA'),
('CA', 'large_carrier_6_9', 'CA$700 for 6–9h delay (large carriers)', '700 $CA pour retard 6–9h (grands transporteurs)', '700 دولار كندي لتأخير 6-9 ساعات (ناقلات كبيرة)', 470, 520, 700, NULL, NULL, '2024-01-01', 'APPR — CTA'),
('CA', 'large_carrier_9plus', 'CA$1,000 for 9h+ delay (large carriers)', '1 000 $CA pour retard 9h+ (grands transporteurs)', '1,000 دولار كندي لتأخير 9+ ساعات (ناقلات كبيرة)', 670, 740, 1000, NULL, NULL, '2024-01-01', 'APPR — CTA'),
('CA', 'small_carrier_3_6', 'CA$125 for 3–6h delay (small carriers)', '125 $CA pour retard 3–6h (petits transporteurs)', '125 دولار كندي لتأخير 3-6 ساعات (ناقلات صغيرة)', 84, 92, 125, NULL, NULL, '2024-01-01', 'APPR — CTA'),
('CA', 'small_carrier_6_9', 'CA$250 for 6–9h delay (small carriers)', '250 $CA pour retard 6–9h (petits transporteurs)', '250 دولار كندي لتأخير 6-9 ساعات (ناقلات صغيرة)', 168, 185, 250, NULL, NULL, '2024-01-01', 'APPR — CTA'),
('CA', 'small_carrier_9plus', 'CA$500 for 9h+ delay (small carriers)', '500 $CA pour retard 9h+ (petits transporteurs)', '500 دولار كندي لتأخير 9+ ساعات (ناقلات صغيرة)', 335, 370, 500, NULL, NULL, '2024-01-01', 'APPR — CTA'),
('CA', 'cancellation_comp', 'Up to CA$1,000 for large carriers when cause is within carrier control', 'Indemnisation jusqu''à 1 000 $CA pour grands transporteurs si cause imputable', 'تعويض يصل إلى 1,000 دولار كندي للناقلات الكبيرة عند السبب تحت سيطرة الشركة', 670, 740, 1000, NULL, NULL, '2024-01-01', 'APPR — CTA'),
-- Montreal Convention
('MONTREAL', 'baggage_liability', 'Up to ~€1,820 / ~$2,000 for delayed, lost or damaged baggage', 'Jusqu''à ~1 820 € / ~$2 000 pour bagages', 'حتى ~1,820 يورو / ~$2,000 للأمتعة', 1820, 2000, NULL, NULL, 1519, '1999-05-28', 'Montreal Convention Art. 22(2)'),
('MONTREAL', 'damages_delay', 'Airlines liable for proven damages up to ~€6,400 / ~$7,100 for delay', 'Responsabilité des compagnies jusqu''à ~6 400 € / ~$7 100 pour retard', 'مسؤولية شركات الطيران عن الأضرار المثبتة حتى ~6,400 يورو / ~$7,100', 6400, 7100, NULL, NULL, 5346, '1999-05-28', 'Montreal Convention Art. 22(1)'),
('MONTREAL', 'liability_strict', 'Two-tier liability: strict up to ~€154,600 / ~$170,000, fault-based above', 'Responsabilité à deux niveaux : stricte jusqu''à ~154 600 € / ~$170 000', 'مسؤولية على مستويين: صارمة حتى ~154,600 يورو / ~$170,000', 154600, 170000, NULL, NULL, 128821, '1999-05-28', 'Montreal Convention Art. 21'),
-- US baggage detail for i18n
('US', 'baggage_detail', 'Up to $3,800 per passenger for domestic checked baggage liability.', 'Jusqu''à 3 800 $ par passager pour la responsabilité des bagages enregistrés sur les vols intérieurs.', 'ما يصل إلى 3,800 دولار لكل راكب كمسؤولية عن أمتعة السفر المحلية.', 3500, 3800, NULL, NULL, NULL, '2024-01-01', 'DOT 14 CFR Part 254')
ON CONFLICT DO NOTHING;

-- Update passenger_rights seed data with governance values
UPDATE passenger_rights SET regulation_version = '1.0', last_updated_at = NOW(), valid_from = '2020-01-01' WHERE regulation_version IS NULL;

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
        distance_min_km,
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
         NULL,
         1500,
        'compensation',
        'Cash compensation for delays over 3 hours (≤1500 km)',
        'Indemnisation pour vol ≤ 1500 km',
        '€250'
    ),
    (
        'EU',
        'EC 261/2004',
         180,
         1500,
         3500,
        'compensation',
        'Cash compensation for delays over 3 hours (1500–3500 km)',
        'Indemnisation pour vol 1500–3500 km',
        '€400'
    ),
    (
        'EU',
        'EC 261/2004',
         180,
         3500,
         NULL,
        'compensation',
        'Cash compensation for delays over 3 hours (>3500 km)',
        'Indemnisation pour vol > 3500 km',
        '€600'
    ),
    (
        'EU',
        'EC 261/2004',
         300,
         NULL,
         NULL,
        'refund',
        'Right to full ticket refund for extreme delays',
        'Remboursement intégral du billet',
        NULL
    ),
    -- UK 261 – identical structure, GBP amounts
    (
        'UK',
        'UK 261',
         120,
         NULL,
         NULL,
        'refreshment',
        'Right to meals and refreshments',
        'Repas et rafraîchissements',
        NULL
    ),
    (
        'UK',
        'UK 261',
         120,
         NULL,
         NULL,
        'hotel',
        'Right to hotel accommodation if overnight delay',
        'Hébergement si retard nocturne',
        NULL
    ),
    (
        'UK',
        'UK 261',
         180,
         NULL,
         1500,
        'compensation',
        'Cash compensation for delays over 3 hours (≤1500 km)',
        'Indemnisation pour vol ≤ 1500 km',
        '£220'
    ),
    (
        'UK',
        'UK 261',
         180,
         1500,
         3500,
        'compensation',
        'Cash compensation for delays over 3 hours (1500–3500 km)',
        'Indemnisation pour vol 1500–3500 km',
        '£350'
    ),
    (
        'UK',
        'UK 261',
         180,
         3500,
         NULL,
        'compensation',
        'Cash compensation for delays over 3 hours (>3500 km)',
        'Indemnisation pour vol > 3500 km',
        '£520'
    ),
    (
        'UK',
        'UK 261',
         300,
         NULL,
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
