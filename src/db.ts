import { type Burger, MAX_BURGERS, type Stats } from "./domain";

const COLUMNS = "id, name, place, status, rating, note, created_at, devoured_at";
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export async function listBurgers(db: D1Database, journal: string): Promise<Burger[]> {
  const { results } = await db
    .prepare(`SELECT ${COLUMNS} FROM burgers WHERE journal_id = ?1 ORDER BY id DESC`)
    .bind(journal)
    .all<Burger>();
  return results;
}

/**
 * Adds a craving unless the journal is full. The limit is checked inside the INSERT, so two
 * simultaneous requests cannot both slip past it. Null means the journal is full.
 */
export async function addBurger(
  db: D1Database,
  journal: string,
  burger: { name: string; place?: string | undefined },
): Promise<Burger | null> {
  return db
    .prepare(
      `INSERT INTO burgers (journal_id, name, place)
       SELECT ?1, ?2, ?3
       WHERE (SELECT COUNT(*) FROM burgers WHERE journal_id = ?1) < ?4
       RETURNING ${COLUMNS}`,
    )
    .bind(journal, burger.name, burger.place || null, MAX_BURGERS)
    .first<Burger>();
}

/** Moves a craving to the devoured column. Null if it isn't a craving in this journal. */
export async function devourBurger(
  db: D1Database,
  journal: string,
  id: number,
  verdict: { rating: number; note?: string | undefined },
): Promise<Burger | null> {
  return db
    .prepare(
      `UPDATE burgers SET status = 'devoured', rating = ?3, note = ?4, devoured_at = ${NOW}
       WHERE id = ?1 AND journal_id = ?2 AND status = 'craving'
       RETURNING ${COLUMNS}`,
    )
    .bind(id, journal, verdict.rating, verdict.note || null)
    .first<Burger>();
}

/** Puts a devoured burger back on the craving list, forgetting its verdict. */
export async function undoDevour(
  db: D1Database,
  journal: string,
  id: number,
): Promise<Burger | null> {
  return db
    .prepare(
      `UPDATE burgers SET status = 'craving', rating = NULL, note = NULL, devoured_at = NULL
       WHERE id = ?1 AND journal_id = ?2 AND status = 'devoured'
       RETURNING ${COLUMNS}`,
    )
    .bind(id, journal)
    .first<Burger>();
}

export async function deleteBurger(db: D1Database, journal: string, id: number): Promise<boolean> {
  const row = await db
    .prepare("DELETE FROM burgers WHERE id = ?1 AND journal_id = ?2 RETURNING id")
    .bind(id, journal)
    .first();
  return row !== null;
}

export async function readStats(db: D1Database, journal: string): Promise<Stats> {
  const [counts, best] = await db.batch<
    { status: string; n: number; average: number | null } | { name: string; rating: number }
  >([
    db
      .prepare(
        "SELECT status, COUNT(*) AS n, AVG(rating) AS average FROM burgers WHERE journal_id = ?1 GROUP BY status",
      )
      .bind(journal),
    db
      .prepare(
        `SELECT name, rating FROM burgers WHERE journal_id = ?1 AND status = 'devoured'
         ORDER BY rating DESC, devoured_at DESC LIMIT 1`,
      )
      .bind(journal),
  ]);
  const rows = (counts?.results ?? []) as { status: string; n: number; average: number | null }[];
  const devoured = rows.find((row) => row.status === "devoured");
  return {
    cravings: rows.find((row) => row.status === "craving")?.n ?? 0,
    devoured: devoured?.n ?? 0,
    averageRating: devoured?.average == null ? null : Math.round(devoured.average * 10) / 10,
    best: (best?.results[0] as { name: string; rating: number } | undefined) ?? null,
  };
}
