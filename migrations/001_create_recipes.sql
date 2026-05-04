-- Migration 001: create recipes table
-- Run with: npm run db:migrate

CREATE TABLE IF NOT EXISTS recipes (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  data        JSONB NOT NULL,
  confidence  TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recipes_created_at_idx ON recipes (created_at DESC);
