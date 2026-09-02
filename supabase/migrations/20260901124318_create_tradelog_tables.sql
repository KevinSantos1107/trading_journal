/*
# Create TradeLog persistence tables

1. New Tables
- `trades`: shared trading journal operations, including financial inputs, calculated result, stop loss, additions, and any number of partial exits stored as JSON.
- `notes`: shared process-learning notes displayed in the Learning screen.

2. Important Columns
- Both tables use the browser-generated numeric record id so existing local records can be saved without changing the app's model.
- `trades.partials` stores an array of `{ points, contracts }` entries.
- `trades.created_at` preserves registration order independently from the trading date.

3. Security
- Row Level Security is enabled on both tables.
- This app has no sign-in screen and intentionally uses one shared workspace, so anon and authenticated clients receive separate CRUD policies for the shared journal.
*/

CREATE TABLE IF NOT EXISTS public.trades (
  id bigint PRIMARY KEY,
  date text NOT NULL,
  asset text NOT NULL,
  strategy text NOT NULL,
  contracts numeric NOT NULL DEFAULT 0,
  points numeric NOT NULL DEFAULT 0,
  result numeric NOT NULL DEFAULT 0,
  stop_loss numeric,
  partials jsonb NOT NULL DEFAULT '[]'::jsonb,
  had_addition boolean NOT NULL DEFAULT false,
  addition_points numeric,
  addition_contracts numeric,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (
  id bigint PRIMARY KEY,
  date text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_trades_select_anon" ON public.trades;
CREATE POLICY "shared_trades_select_anon" ON public.trades FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "shared_trades_insert_anon" ON public.trades;
CREATE POLICY "shared_trades_insert_anon" ON public.trades FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "shared_trades_update_anon" ON public.trades;
CREATE POLICY "shared_trades_update_anon" ON public.trades FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "shared_trades_delete_anon" ON public.trades;
CREATE POLICY "shared_trades_delete_anon" ON public.trades FOR DELETE TO anon USING (true);
DROP POLICY IF EXISTS "shared_trades_select_authenticated" ON public.trades;
CREATE POLICY "shared_trades_select_authenticated" ON public.trades FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "shared_trades_insert_authenticated" ON public.trades;
CREATE POLICY "shared_trades_insert_authenticated" ON public.trades FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "shared_trades_update_authenticated" ON public.trades;
CREATE POLICY "shared_trades_update_authenticated" ON public.trades FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "shared_trades_delete_authenticated" ON public.trades;
CREATE POLICY "shared_trades_delete_authenticated" ON public.trades FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "shared_notes_select_anon" ON public.notes;
CREATE POLICY "shared_notes_select_anon" ON public.notes FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "shared_notes_insert_anon" ON public.notes;
CREATE POLICY "shared_notes_insert_anon" ON public.notes FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "shared_notes_update_anon" ON public.notes;
CREATE POLICY "shared_notes_update_anon" ON public.notes FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "shared_notes_delete_anon" ON public.notes;
CREATE POLICY "shared_notes_delete_anon" ON public.notes FOR DELETE TO anon USING (true);
DROP POLICY IF EXISTS "shared_notes_select_authenticated" ON public.notes;
CREATE POLICY "shared_notes_select_authenticated" ON public.notes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "shared_notes_insert_authenticated" ON public.notes;
CREATE POLICY "shared_notes_insert_authenticated" ON public.notes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "shared_notes_update_authenticated" ON public.notes;
CREATE POLICY "shared_notes_update_authenticated" ON public.notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "shared_notes_delete_authenticated" ON public.notes;
CREATE POLICY "shared_notes_delete_authenticated" ON public.notes FOR DELETE TO authenticated USING (true);