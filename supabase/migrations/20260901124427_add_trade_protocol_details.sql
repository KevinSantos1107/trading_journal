/*
# Add TradeLog protocol details

1. Modified Tables
- `trades.details`: JSON document for the optional protocol checklist, direction, execution times, emotional state, technical reading, and other form details from the operation record.

2. Compatibility
- Existing trades remain intact and receive an empty JSON object.
- The existing calculated fields remain the source of truth for dashboard totals.

3. Security
- Existing row-level policies continue to protect the shared no-login workspace.
*/

ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;