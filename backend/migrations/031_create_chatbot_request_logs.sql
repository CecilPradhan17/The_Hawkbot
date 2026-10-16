CREATE TABLE chatbot_request_logs (
  request_id UUID PRIMARY KEY,
  query_category TEXT NOT NULL,
  route TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('answered', 'partial', 'fallback', 'error')),
  deterministic_matcher TEXT,
  tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  token_usage JSONB NOT NULL DEFAULT '[]'::jsonb,
  web_search_calls INTEGER NOT NULL DEFAULT 0 CHECK (web_search_calls >= 0),
  estimated_cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  pricing_version DATE NOT NULL,
  cost_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_latency_ms NUMERIC(12, 2) NOT NULL CHECK (total_latency_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX chatbot_request_logs_created_at_idx
  ON chatbot_request_logs (created_at DESC);

CREATE INDEX chatbot_request_logs_category_created_at_idx
  ON chatbot_request_logs (query_category, created_at DESC);

COMMENT ON TABLE chatbot_request_logs IS
  'Privacy-safe HawkBot operational telemetry. Raw questions and user identifiers must never be stored here.';
