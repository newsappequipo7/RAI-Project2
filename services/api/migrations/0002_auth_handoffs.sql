-- One-time slots that carry a Google ID token from the web bridge to the mobile app,
-- so mobile login does not depend on the browser reopening the app via a deep link.
CREATE TABLE auth_handoffs (
  code TEXT PRIMARY KEY,
  id_token TEXT,
  expires_at INTEGER NOT NULL
);
