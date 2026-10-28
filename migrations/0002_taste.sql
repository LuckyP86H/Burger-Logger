-- Tags turn free text into features the taste model can learn from. polarity is +1 when a note
-- praises that aspect ("great bun"), -1 when it complains ("a bit salty"), 0 when it just names it.
CREATE TABLE burger_tags (
  burger_id INTEGER NOT NULL REFERENCES burgers (id) ON DELETE CASCADE,
  tag       TEXT    NOT NULL CHECK (length(tag) BETWEEN 1 AND 24),
  polarity  INTEGER NOT NULL CHECK (polarity IN (-1, 0, 1)),
  source    TEXT    NOT NULL CHECK (source IN ('keywords', 'model')),
  PRIMARY KEY (burger_id, tag)
) STRICT, WITHOUT ROWID;

-- One pick per journal per day, so the card is a daily ritual and the model is called at most once.
CREATE TABLE daily_picks (
  journal_id TEXT NOT NULL,
  day        TEXT NOT NULL,
  pick       TEXT NOT NULL CHECK (json_valid(pick)),
  PRIMARY KEY (journal_id, day)
) STRICT, WITHOUT ROWID;
