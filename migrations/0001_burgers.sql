-- A journal is one browser's private list. journal_id is the SHA-256 of a random secret key that
-- only the owner's cookie (and their MCP link) holds, so a database leak exposes no usable keys.
CREATE TABLE burgers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_id  TEXT    NOT NULL,
  name        TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  place       TEXT    CHECK (place IS NULL OR length(place) BETWEEN 1 AND 60),
  status      TEXT    NOT NULL DEFAULT 'craving' CHECK (status IN ('craving', 'devoured')),
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
  note        TEXT    CHECK (note IS NULL OR length(note) BETWEEN 1 AND 200),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  devoured_at TEXT,
  -- The state machine lives in the schema: a craving has no verdict, a devoured burger always does.
  CHECK (
    (status = 'craving'  AND rating IS NULL AND note IS NULL AND devoured_at IS NULL) OR
    (status = 'devoured' AND rating IS NOT NULL AND devoured_at IS NOT NULL)
  )
) STRICT;

CREATE INDEX burgers_by_journal ON burgers (journal_id, status, id DESC);
