-- ============================================================
-- ClaimsHub — Supabase Schema
-- Paste this entire file into your Supabase SQL Editor and run.
-- ============================================================

-- Claims
CREATE TABLE IF NOT EXISTS claims (
  id                    BIGSERIAL PRIMARY KEY,
  claimant_name         TEXT NOT NULL,
  claimant_email        TEXT NOT NULL,
  claimant_phone        TEXT,
  policy_number         TEXT NOT NULL,
  claim_type            TEXT NOT NULL,
  amount                NUMERIC(14,2) NOT NULL,
  incident_date         TEXT NOT NULL,
  incident_description  TEXT NOT NULL,
  location              TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  decision_reason       TEXT,
  decided_by            TEXT,
  approved_amount       NUMERIC(14,2),
  excess                NUMERIC(14,2) DEFAULT 0,
  net_payout            NUMERIC(14,2),
  payment_status        TEXT,
  paid_at               TIMESTAMPTZ,
  paid_by               TEXT,
  fraud_score           TEXT,
  fraud_flags           JSONB DEFAULT '[]'::jsonb,
  fraud_confidence      NUMERIC(6,2),
  fraud_summary         TEXT,
  fraud_reasoning       JSONB DEFAULT '[]'::jsonb,
  fraud_behavioral      JSONB DEFAULT '[]'::jsonb,
  fraud_financial       JSONB DEFAULT '[]'::jsonb,
  triage                JSONB,
  priority              TEXT DEFAULT 'medium',
  sla_due               TIMESTAMPTZ,
  workflow_stage        INTEGER DEFAULT 1,
  ai_analysis_status    TEXT,
  ai_analysis_started   TIMESTAMPTZ,
  ai_analysis_completed TIMESTAMPTZ,
  ai_analysis_error     TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Notes — messages between roles on a claim
CREATE TABLE IF NOT EXISTS notes (
  id           BIGSERIAL PRIMARY KEY,
  claim_id     BIGINT REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  author       TEXT NOT NULL,
  author_role  TEXT DEFAULT 'adjudicator',
  content      TEXT NOT NULL,
  is_doc_request BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Documents — metadata only; files live in Supabase Storage
CREATE TABLE IF NOT EXISTS documents (
  id            BIGSERIAL PRIMARY KEY,
  claim_id      BIGINT REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  storage_path  TEXT NOT NULL,
  public_url    TEXT NOT NULL,
  original_name TEXT NOT NULL,
  label         TEXT,
  mimetype      TEXT,
  size          BIGINT,
  uploaded_by   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id        BIGSERIAL PRIMARY KEY,
  claim_id  BIGINT REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  action    TEXT NOT NULL,
  actor     TEXT,
  detail    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chatbot conversation history (30-day rolling window per session)
CREATE TABLE IF NOT EXISTS chat_history (
  id          BIGSERIAL PRIMARY KEY,
  session_id  TEXT NOT NULL,
  user_email  TEXT,
  user_role   TEXT DEFAULT 'guest',
  claim_id    BIGINT REFERENCES claims(id) ON DELETE SET NULL,
  role        TEXT NOT NULL,    -- 'user' | 'assistant'
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_claims_email   ON claims(claimant_email);
CREATE INDEX IF NOT EXISTS idx_claims_status  ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_created ON claims(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_claim    ON notes(claim_id, created_at);
CREATE INDEX IF NOT EXISTS idx_docs_claim     ON documents(claim_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_claim    ON audit_logs(claim_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_session   ON chat_history(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_user      ON chat_history(user_email, created_at DESC);

-- Auto-update updated_at on claims
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_claims_updated_at ON claims;
CREATE TRIGGER set_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS (all access is server-side via service role key)
ALTER TABLE claims       DISABLE ROW LEVEL SECURITY;
ALTER TABLE notes        DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents    DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs   DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history DISABLE ROW LEVEL SECURITY;
