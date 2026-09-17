CREATE TABLE facilities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE facility_aliases (
  id SERIAL PRIMARY KEY,
  facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  UNIQUE (facility_id, normalized_alias)
);

CREATE INDEX idx_facility_aliases_normalized
  ON facility_aliases(normalized_alias);

-- Hawkbot keeps only the current published schedule. Uploads are held in
-- memory during extraction and are never stored in Postgres.
CREATE TABLE facility_schedules (
  id SERIAL PRIMARY KEY,
  facility_id INTEGER NOT NULL UNIQUE REFERENCES facilities(id) ON DELETE CASCADE,
  coverage_start DATE NOT NULL,
  coverage_end DATE NOT NULL,
  source_label TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (coverage_start <= coverage_end)
);

CREATE TABLE weekly_hours (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES facility_schedules(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'unverified')),
  UNIQUE (schedule_id, weekday)
);

CREATE TABLE weekly_intervals (
  id SERIAL PRIMARY KEY,
  weekly_hours_id INTEGER NOT NULL REFERENCES weekly_hours(id) ON DELETE CASCADE,
  opens_at TIME NOT NULL,
  closes_at TIME NOT NULL,
  closes_next_day BOOLEAN NOT NULL DEFAULT FALSE,
  position SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (weekly_hours_id, position)
);

CREATE TABLE special_periods (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES facility_schedules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  CHECK (start_date <= end_date)
);

CREATE TABLE special_period_days (
  id SERIAL PRIMARY KEY,
  special_period_id INTEGER NOT NULL REFERENCES special_periods(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'unverified')),
  UNIQUE (special_period_id, weekday)
);

CREATE TABLE special_period_intervals (
  id SERIAL PRIMARY KEY,
  special_period_day_id INTEGER NOT NULL REFERENCES special_period_days(id) ON DELETE CASCADE,
  opens_at TIME NOT NULL,
  closes_at TIME NOT NULL,
  closes_next_day BOOLEAN NOT NULL DEFAULT FALSE,
  position SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (special_period_day_id, position)
);

CREATE TABLE date_exceptions (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES facility_schedules(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'unverified')),
  UNIQUE (schedule_id, exception_date)
);

CREATE TABLE date_exception_intervals (
  id SERIAL PRIMARY KEY,
  date_exception_id INTEGER NOT NULL REFERENCES date_exceptions(id) ON DELETE CASCADE,
  opens_at TIME NOT NULL,
  closes_at TIME NOT NULL,
  closes_next_day BOOLEAN NOT NULL DEFAULT FALSE,
  position SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (date_exception_id, position)
);

-- Aggregate counters only: no chat text or user identity is retained.
CREATE TABLE hours_usage_daily (
  usage_date DATE PRIMARY KEY,
  structured_hits INTEGER NOT NULL DEFAULT 0,
  unverified_answers INTEGER NOT NULL DEFAULT 0,
  ambiguous_fallbacks INTEGER NOT NULL DEFAULT 0,
  rag_fallbacks INTEGER NOT NULL DEFAULT 0,
  embedding_calls_avoided INTEGER NOT NULL DEFAULT 0,
  llm_calls_avoided INTEGER NOT NULL DEFAULT 0
);
