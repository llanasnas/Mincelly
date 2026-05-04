-- Migration 003: add estimated_cost column to recipes
-- Stores the LLM-estimated total ingredient cost in euros.
-- Also backfills existing rows from the JSONB data column.
-- Run with: pnpm db:migrate

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10, 2);

-- Backfill from existing JSONB data
UPDATE recipes
SET estimated_cost = (data->>'estimatedCost')::NUMERIC
WHERE data->>'estimatedCost' IS NOT NULL
  AND estimated_cost IS NULL;

CREATE INDEX IF NOT EXISTS recipes_estimated_cost_idx ON recipes (estimated_cost);
