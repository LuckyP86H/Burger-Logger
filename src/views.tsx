import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import type { Burger, Stats } from "./domain";
import { dateLocale, type Lang, type MessageKey, t } from "./i18n";
import { TAG_LABELS } from "./taste/tags";
import type { TasteProfile, TodayCard } from "./today";

const shortDate = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(dateLocale(lang), {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));

// htmx settings: swap every response (so a 422 shows its message), never inject inline <style>
// or eval (the CSP forbids both), and animate swaps with the browser's View Transitions.
const HTMX_CONFIG = JSON.stringify({
  responseHandling: [{ code: ".*", swap: true }],
  includeIndicatorStyles: false,
  allowEval: false,
  globalViewTransitions: true,
});

export function Layout({ lang, children }: { lang: Lang; children: Child }) {
  const T = (key: MessageKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={lang === "zh" ? "zh-CN" : "en"}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <meta name="htmx-config" content={HTMX_CONFIG} />
          <title>{T("app.title")}</title>
          <meta name="description" content={T("app.description")} />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="stylesheet" href="/style.css" />
          <script src="/htmx.min.js" defer />
        </head>
        <body hx-boost="true">
          <div class="page">
            <nav class="lang" aria-label={T("lang.label")}>
              <a
                href={lang === "zh" ? "/lang/en" : "/lang/zh"}
                hreflang={lang === "zh" ? "en" : "zh-CN"}
              >
                {T("lang.switch")}
              </a>
            </nav>
            {children}
          </div>
        </body>
      </html>
    </>
  );
}

function Patties({ rating, lang }: { rating: number; lang: Lang }) {
  return (
    <span class="patties" role="img" aria-label={t(lang, "item.patties", { rating })}>
      {"🍔".repeat(rating)}
      <span class="patties-off">{"🍔".repeat(5 - rating)}</span>
    </span>
  );
}

function CravingItem({ burger, lang }: { burger: Burger; lang: Lang }) {
  const T = (key: MessageKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  return (
    <li class="item" data-testid="craving" id={`burger-${burger.id}`}>
      <div class="item-head">
        <div>
          <strong>{burger.name}</strong>
          {burger.place ? (
            <span class="muted">
              {T("item.at")}
              {burger.place}
            </span>
          ) : null}
        </div>
        <form method="post" action={`/burgers/${burger.id}/delete`}>
          <button
            class="quiet"
            type="submit"
            aria-label={T("item.deleteNamed", { name: burger.name })}
          >
            {T("item.delete")}
          </button>
        </form>
      </div>
      <details class="devour">
        <summary>{T("item.devour")}</summary>
        <form method="post" action={`/burgers/${burger.id}/devour`} class="stack">
          <fieldset class="rating">
            <legend>{T("item.howWasIt")}</legend>
            {[1, 2, 3, 4, 5].map((n) => (
              <label>
                <input type="radio" name="rating" value={String(n)} required />
                <span aria-hidden="true">{n}</span>
                <span class="sr-only">{T("item.outOf5", { n })}</span>
              </label>
            ))}
          </fieldset>
          <label class="field">
            <span>
              {T("item.note")} <span class="muted">{T("item.optional")}</span>
            </span>
            <input name="note" maxlength={200} placeholder={T("item.notePlaceholder")} />
          </label>
          <button type="submit">{T("item.logIt")}</button>
        </form>
      </details>
    </li>
  );
}

function DevouredItem({ burger, lang }: { burger: Burger; lang: Lang }) {
  const T = (key: MessageKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  return (
    <li class="item" data-testid="devoured" id={`burger-${burger.id}`}>
      <div class="item-head">
        <div>
          <strong>{burger.name}</strong>
          {burger.place ? (
            <span class="muted">
              {T("item.at")}
              {burger.place}
            </span>
          ) : null}
        </div>
        <Patties rating={burger.rating ?? 0} lang={lang} />
      </div>
      {burger.note ? <p class="note">{burger.note}</p> : null}
      <div class="item-foot">
        <span class="muted">{burger.devoured_at ? shortDate(burger.devoured_at, lang) : ""}</span>
        <span class="actions">
          <form method="post" action={`/burgers/${burger.id}/undo`}>
            <button
              class="quiet"
              type="submit"
              aria-label={T("item.backNamed", { name: burger.name })}
            >
              {T("item.back")}
            </button>
          </form>
          <form method="post" action={`/burgers/${burger.id}/delete`}>
            <button
              class="quiet"
              type="submit"
              aria-label={T("item.deleteNamed", { name: burger.name })}
            >
              {T("item.delete")}
            </button>
          </form>
        </span>
      </div>
    </li>
  );
}

function Today({ card, lang }: { card: TodayCard; lang: Lang }) {
  const T = (key: MessageKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  const learnedLeft = 3 - card.learnedFrom;
  return (
    <section class="today" aria-labelledby="today-title" data-testid="today">
      <p class="today-kicker">
        {T("today.kicker", { date: shortDate(`${card.day}T12:00:00Z`, lang) })}
      </p>
      <div class="today-head">
        <div>
          <h2 id="today-title">{card.name[lang]}</h2>
        </div>
        <p class="match" data-testid="match">
          <strong>{card.match}%</strong>
          <span class="match-label">{T("today.match")}</span>
        </p>
      </div>
      <p class="teaser" data-testid="teaser">
        {card.teaser[lang]}
      </p>
      <ul class="why" aria-label={T("today.why")}>
        {card.memory ? (
          <li data-testid="memory">
            <span aria-hidden="true">💭</span>{" "}
            {T("today.memory", {
              name: card.memory.name,
              rating: card.memory.rating,
              quote: card.memory.note ? T("today.memoryQuote", { note: card.memory.note }) : "",
              because: card.memory.because[lang],
            })}
          </li>
        ) : null}
        {card.discovery ? (
          <li data-testid="discovery">
            <span aria-hidden="true">✨</span> {card.discovery[lang]}.
          </li>
        ) : null}
        {card.reassurance ? (
          <li data-testid="reassurance">
            <span aria-hidden="true">👌</span> {card.reassurance[lang]}
          </li>
        ) : null}
        {card.cravingId !== null ? (
          <li>
            <span aria-hidden="true">📌</span> {T("today.onList")}
          </li>
        ) : null}
        {learnedLeft > 0 ? (
          <li>
            <span aria-hidden="true">🌱</span>{" "}
            {learnedLeft === 1 ? T("today.rateOne") : T("today.rateMany", { n: learnedLeft })}
          </li>
        ) : null}
      </ul>
      <div class="today-foot">
        {card.cravingId !== null ? (
          <a class="button" href={`#burger-${card.cravingId}`}>
            {T("today.onListAction")}
          </a>
        ) : (
          <form method="post" action="/today/add">
            <button type="submit">{T("today.addAction")}</button>
          </form>
        )}
        <span class="muted small-print">
          {card.teaserBy === "template"
            ? T("today.previewTemplate")
            : T("today.previewBy", { by: card.teaserBy })}{" "}
          ·{" "}
          {card.learnedFrom === 1
            ? T("today.learnedOne")
            : T("today.learned", { n: card.learnedFrom })}
        </span>
      </div>
    </section>
  );
}

function Taste({ taste, lang }: { taste: TasteProfile; lang: Lang }) {
  if (!taste.liked.length && !taste.disliked.length) return null;
  return (
    <p class="taste" data-testid="taste">
      <span class="muted">{t(lang, "taste.label")}</span>
      {taste.liked.map((tag) => (
        <span class="chip like">+ {TAG_LABELS[tag][lang]}</span>
      ))}
      {taste.disliked.map((tag) => (
        <span class="chip dislike">− {TAG_LABELS[tag][lang]}</span>
      ))}
    </p>
  );
}

export function Home(props: {
  lang: Lang;
  burgers: Burger[];
  stats: Stats;
  today: TodayCard;
  taste: TasteProfile;
  mcpUrl: string;
  error?: string | undefined;
}) {
  const { lang } = props;
  const T = (key: MessageKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  const cravings = props.burgers.filter((burger) => burger.status === "craving");
  const devoured = props.burgers
    .filter((burger) => burger.status === "devoured")
    .sort((a, b) => (b.devoured_at ?? "").localeCompare(a.devoured_at ?? ""));
  const { stats } = props;

  return (
    <Layout lang={lang}>
      <header>
        <h1>{T("app.heading")}</h1>
        <p class="muted">{T("app.tagline")}</p>
      </header>

      <main>
        {props.error ? (
          <p class="error" role="alert">
            {props.error}
          </p>
        ) : null}

        <Today card={props.today} lang={lang} />

        <dl class="stats" aria-label={T("stats.journal")}>
          <div>
            <dt>{T("stats.cravings")}</dt>
            <dd data-testid="stat-cravings">{stats.cravings}</dd>
          </div>
          <div>
            <dt>{T("stats.devoured")}</dt>
            <dd data-testid="stat-devoured">{stats.devoured}</dd>
          </div>
          <div>
            <dt>{T("stats.average")}</dt>
            <dd data-testid="stat-average">{stats.averageRating ?? "–"}</dd>
          </div>
          <div>
            <dt>{T("stats.best")}</dt>
            <dd data-testid="stat-best" class="small">
              {stats.best ? stats.best.name : "–"}
            </dd>
          </div>
        </dl>
        <Taste taste={props.taste} lang={lang} />

        <form method="post" action="/burgers" class="add">
          <label class="field">
            {T("form.burger")}
            <input
              name="name"
              required
              maxlength={80}
              placeholder={T("form.burgerPlaceholder")}
              autocomplete="off"
            />
          </label>
          <label class="field">
            <span>
              {T("form.where")} <span class="muted">{T("item.optional")}</span>
            </span>
            <input
              name="place"
              maxlength={60}
              placeholder={T("form.placePlaceholder")}
              autocomplete="off"
            />
          </label>
          <button type="submit">{T("form.add")}</button>
        </form>

        <div class="columns">
          <section aria-labelledby="cravings-title">
            <h2 id="cravings-title">{T("list.cravings")}</h2>
            {cravings.length === 0 ? (
              <p class="empty">{T("list.emptyCravings")}</p>
            ) : (
              <ol class="list">
                {cravings.map((burger) => (
                  <CravingItem burger={burger} lang={lang} />
                ))}
              </ol>
            )}
          </section>
          <section aria-labelledby="devoured-title">
            <h2 id="devoured-title">{T("list.devoured")}</h2>
            {devoured.length === 0 ? (
              <p class="empty">{T("list.emptyDevoured")}</p>
            ) : (
              <ol class="list">
                {devoured.map((burger) => (
                  <DevouredItem burger={burger} lang={lang} />
                ))}
              </ol>
            )}
          </section>
        </div>
      </main>

      <footer>
        <details class="agent">
          <summary>{T("agent.summary")}</summary>
          <p>{T("agent.body")}</p>
          <input
            readonly
            value={props.mcpUrl}
            aria-label={T("agent.urlLabel")}
            data-testid="mcp-url"
          />
          <p class="muted">
            {T("agent.tools")} <code>add_burger</code>, <code>devour_burger</code>,{" "}
            <code>list_burgers</code>, <code>delete_burger</code>, <code>journal_stats</code>,{" "}
            <code>todays_burger</code>, <code>taste_profile</code>.
          </p>
        </details>
        <p class="muted">
          {T("app.footer.private")} <a href="/journal.json">{T("app.footer.download")}</a>. ·{" "}
          {T("app.footer.rebuilt")} ·{" "}
          <a href="https://github.com/LuckyP86H/Burger-Logger">{T("app.footer.source")}</a>
        </p>
      </footer>
    </Layout>
  );
}
