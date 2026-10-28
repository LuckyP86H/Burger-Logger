import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import type { Burger, Stats } from "./domain";
import { TAG_LABELS } from "./taste/tags";
import type { TasteProfile, TodayCard } from "./today";

const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const shortDate = (iso: string) => dateFormat.format(new Date(iso));

// htmx settings: swap every response (so a 422 shows its message), never inject inline <style>
// or eval (the CSP forbids both), and animate swaps with the browser's View Transitions.
const HTMX_CONFIG = JSON.stringify({
  responseHandling: [{ code: ".*", swap: true }],
  includeIndicatorStyles: false,
  allowEval: false,
  globalViewTransitions: true,
});

export function Layout({ children }: { children: Child }) {
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <meta name="htmx-config" content={HTMX_CONFIG} />
          <title>Burger Logger</title>
          <meta name="description" content="A craving list and tasting journal for burgers." />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="stylesheet" href="/style.css" />
          <script src="/htmx.min.js" defer />
        </head>
        <body hx-boost="true">
          <div class="page">{children}</div>
        </body>
      </html>
    </>
  );
}

function Patties({ rating }: { rating: number }) {
  return (
    <span class="patties" role="img" aria-label={`${rating} out of 5`}>
      {"🍔".repeat(rating)}
      <span class="patties-off">{"🍔".repeat(5 - rating)}</span>
    </span>
  );
}

function CravingItem({ burger }: { burger: Burger }) {
  return (
    <li class="item" data-testid="craving" id={`burger-${burger.id}`}>
      <div class="item-head">
        <div>
          <strong>{burger.name}</strong>
          {burger.place ? <span class="muted"> at {burger.place}</span> : null}
        </div>
        <form method="post" action={`/burgers/${burger.id}/delete`}>
          <button class="quiet" type="submit" aria-label={`Delete ${burger.name}`}>
            Delete
          </button>
        </form>
      </div>
      <details class="devour">
        <summary>Devour it!</summary>
        <form method="post" action={`/burgers/${burger.id}/devour`} class="stack">
          <fieldset class="rating">
            <legend>How was it?</legend>
            {[1, 2, 3, 4, 5].map((n) => (
              <label>
                <input type="radio" name="rating" value={String(n)} required />
                <span aria-hidden="true">{n}</span>
                <span class="sr-only">{n} out of 5</span>
              </label>
            ))}
          </fieldset>
          <label class="field">
            <span>
              Note <span class="muted">(optional)</span>
            </span>
            <input name="note" maxlength={200} placeholder="Juicy, great bun, too much sauce…" />
          </label>
          <button type="submit">Log it</button>
        </form>
      </details>
    </li>
  );
}

function DevouredItem({ burger }: { burger: Burger }) {
  return (
    <li class="item" data-testid="devoured" id={`burger-${burger.id}`}>
      <div class="item-head">
        <div>
          <strong>{burger.name}</strong>
          {burger.place ? <span class="muted"> at {burger.place}</span> : null}
        </div>
        <Patties rating={burger.rating ?? 0} />
      </div>
      {burger.note ? <p class="note">{burger.note}</p> : null}
      <div class="item-foot">
        <span class="muted">{burger.devoured_at ? shortDate(burger.devoured_at) : ""}</span>
        <span class="actions">
          <form method="post" action={`/burgers/${burger.id}/undo`}>
            <button class="quiet" type="submit" aria-label={`Move ${burger.name} back to cravings`}>
              Back to cravings
            </button>
          </form>
          <form method="post" action={`/burgers/${burger.id}/delete`}>
            <button class="quiet" type="submit" aria-label={`Delete ${burger.name}`}>
              Delete
            </button>
          </form>
        </span>
      </div>
    </li>
  );
}

function Today({ card }: { card: TodayCard }) {
  return (
    <section class="today" aria-labelledby="today-title" data-testid="today">
      <p class="today-kicker">
        Today's burger · <span lang="zh">今日汉堡</span> · {shortDate(`${card.day}T12:00:00Z`)}
      </p>
      <div class="today-head">
        <div>
          <h2 id="today-title">{card.en}</h2>
          {card.zh ? (
            <p class="today-zh" lang="zh">
              {card.zh}
            </p>
          ) : null}
        </div>
        <p class="match" data-testid="match">
          <strong>{card.match}%</strong>
          <span class="match-label">match</span>
        </p>
      </div>
      <p class="teaser" data-testid="teaser">
        {card.teaser}
      </p>
      <ul class="why" aria-label="Why this pick">
        {card.memory ? (
          <li data-testid="memory">
            <span aria-hidden="true">💭</span> You gave <strong>{card.memory.name}</strong>{" "}
            {card.memory.rating}/5
            {card.memory.note ? <q>{card.memory.note}</q> : null}. This one {card.memory.because}.
          </li>
        ) : null}
        {card.discovery ? (
          <li data-testid="discovery">
            <span aria-hidden="true">✨</span> {card.discovery}.
          </li>
        ) : null}
        {card.reassurance ? (
          <li data-testid="reassurance">
            <span aria-hidden="true">👌</span> {card.reassurance}
          </li>
        ) : null}
        {card.cravingId !== null ? (
          <li>
            <span aria-hidden="true">📌</span> It's already on your craving list.
          </li>
        ) : null}
        {card.learnedFrom < 3 ? (
          <li>
            <span aria-hidden="true">🌱</span> Rate {3 - card.learnedFrom} more burger
            {3 - card.learnedFrom === 1 ? "" : "s"} and this gets personal.
          </li>
        ) : null}
      </ul>
      <div class="today-foot">
        {card.cravingId !== null ? (
          <a class="button" href={`#burger-${card.cravingId}`}>
            It's on your list: devour it today
          </a>
        ) : (
          <form method="post" action="/today/add">
            <button type="submit">Add today's pick to cravings</button>
          </form>
        )}
        <span class="muted small-print">
          {card.teaserBy === "template" ? "Preview from a template" : `Preview by ${card.teaserBy}`}{" "}
          · learned from {card.learnedFrom} rating{card.learnedFrom === 1 ? "" : "s"}
        </span>
      </div>
    </section>
  );
}

function Taste({ taste }: { taste: TasteProfile }) {
  if (!taste.liked.length && !taste.disliked.length) return null;
  return (
    <p class="taste" data-testid="taste">
      <span class="muted">Your taste:</span>
      {taste.liked.map((tag) => (
        <span class="chip like">+ {TAG_LABELS[tag].en}</span>
      ))}
      {taste.disliked.map((tag) => (
        <span class="chip dislike">− {TAG_LABELS[tag].en}</span>
      ))}
    </p>
  );
}

export function Home(props: {
  burgers: Burger[];
  stats: Stats;
  today: TodayCard;
  taste: TasteProfile;
  mcpUrl: string;
  error?: string | undefined;
}) {
  const cravings = props.burgers.filter((burger) => burger.status === "craving");
  const devoured = props.burgers
    .filter((burger) => burger.status === "devoured")
    .sort((a, b) => (b.devoured_at ?? "").localeCompare(a.devoured_at ?? ""));
  const { stats } = props;

  return (
    <Layout>
      <header>
        <h1>🍔 Burger Logger</h1>
        <p class="muted">Write down the burgers you want. Rate the ones you ate.</p>
      </header>

      <main>
        {props.error ? (
          <p class="error" role="alert">
            {props.error}
          </p>
        ) : null}

        <Today card={props.today} />

        <dl class="stats" aria-label="Your journal">
          <div>
            <dt>Cravings</dt>
            <dd data-testid="stat-cravings">{stats.cravings}</dd>
          </div>
          <div>
            <dt>Devoured</dt>
            <dd data-testid="stat-devoured">{stats.devoured}</dd>
          </div>
          <div>
            <dt>Average</dt>
            <dd data-testid="stat-average">{stats.averageRating ?? "–"}</dd>
          </div>
          <div>
            <dt>Best so far</dt>
            <dd data-testid="stat-best" class="small">
              {stats.best ? stats.best.name : "–"}
            </dd>
          </div>
        </dl>
        <Taste taste={props.taste} />

        <form method="post" action="/burgers" class="add">
          <label class="field">
            Burger
            <input
              name="name"
              required
              maxlength={80}
              placeholder="Double smash"
              autocomplete="off"
            />
          </label>
          <label class="field">
            <span>
              Where <span class="muted">(optional)</span>
            </span>
            <input name="place" maxlength={60} placeholder="Shake Shack" autocomplete="off" />
          </label>
          <button type="submit">Add to cravings</button>
        </form>

        <div class="columns">
          <section aria-labelledby="cravings-title">
            <h2 id="cravings-title">Cravings</h2>
            {cravings.length === 0 ? (
              <p class="empty">Nothing queued. What are you in the mood for?</p>
            ) : (
              <ol class="list">
                {cravings.map((burger) => (
                  <CravingItem burger={burger} />
                ))}
              </ol>
            )}
          </section>
          <section aria-labelledby="devoured-title">
            <h2 id="devoured-title">Devoured</h2>
            {devoured.length === 0 ? (
              <p class="empty">Nothing eaten yet. Devour one!</p>
            ) : (
              <ol class="list">
                {devoured.map((burger) => (
                  <DevouredItem burger={burger} />
                ))}
              </ol>
            )}
          </section>
        </div>
      </main>

      <footer>
        <details class="agent">
          <summary>Connect an AI agent</summary>
          <p>
            This journal speaks MCP, so an agent can log burgers for you. Add this URL as a remote
            MCP server (Streamable HTTP). It contains your private key: don't share it.
          </p>
          <input
            readonly
            value={props.mcpUrl}
            aria-label="Your private MCP URL"
            data-testid="mcp-url"
          />
          <p class="muted">
            Tools: <code>add_burger</code>, <code>devour_burger</code>, <code>list_burgers</code>,{" "}
            <code>delete_burger</code>, <code>journal_stats</code>, <code>todays_burger</code>,{" "}
            <code>taste_profile</code>.
          </p>
        </details>
        <p class="muted">
          Your journal belongs to this browser (no account). <a href="/journal.json">Download it</a>
          . Rebuilt in 2026 from a 2019 bootcamp project ·{" "}
          <a href="https://github.com/LuckyP86H/Burger-Logger">Source</a>
        </p>
      </footer>
    </Layout>
  );
}
