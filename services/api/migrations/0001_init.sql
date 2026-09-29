CREATE TABLE ai_calls (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  task TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  uid TEXT,
  cached INTEGER NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL,
  env TEXT NOT NULL
);

CREATE INDEX ai_calls_task ON ai_calls(task);

CREATE TABLE rate_limits (
  uid TEXT,
  window_start TEXT,
  count INTEGER,
  PRIMARY KEY (uid, window_start)
);

CREATE TABLE budget_snapshots (
  ts TEXT PRIMARY KEY,
  provider_balance_usd REAL,
  note TEXT
);
