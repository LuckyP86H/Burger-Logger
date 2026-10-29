import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { z } from "zod";
import { addBurger, deleteBurger, devourBurger, listBurgers, readStats, undoDevour } from "./db";
import {
  addSchema,
  blankToUndefined,
  devourSchema,
  isKey,
  journalIdOf,
  MAX_BURGERS,
  newKey,
} from "./domain";
import { isLang, LANG_COOKIE, type Lang, pickLang, t } from "./i18n";
import { handleMcp } from "./mcp";
import { linkPickToCraving, tagBurger, tasteProfile, todaysCard } from "./today";
import { Home } from "./views";

const COOKIE = "journal";
const ONE_YEAR = 60 * 60 * 24 * 365;

type Variables = { key: string; journal: string; lang: Lang };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
    },
  }),
);

// Browsers can only be tricked into a cross-site form POST; this rejects any whose Origin differs.
// (The /mcp route takes JSON from agents, which the check ignores.)
app.use(csrf());

app.get("/api/health", (c) => c.json({ ok: true }));

// Whoever holds the key owns the journal. The cookie holds it for the browser, and the page
// shows the same key inside the private MCP link.
app.use("*", async (c, next) => {
  if (c.req.path.startsWith("/mcp/") || c.req.path.startsWith("/api/")) return next();
  let key = getCookie(c, COOKIE);
  if (!isKey(key)) {
    key = newKey();
    setCookie(c, COOKIE, key, {
      httpOnly: true,
      sameSite: "Lax",
      secure: c.req.url.startsWith("https:"),
      maxAge: ONE_YEAR,
      path: "/",
    });
  }
  c.set("key", key);
  c.set("journal", await journalIdOf(key));
  c.set(
    "lang",
    pickLang(
      new URL(c.req.url),
      getCookie(c, LANG_COOKIE),
      c.req.header("accept-language") ?? null,
    ),
  );
  return next();
});

// Language is a cookie, so the forms' redirects keep it. The link works without JavaScript too.
app.get("/lang/:lang", (c) => {
  const lang = c.req.param("lang");
  if (!isLang(lang)) return c.notFound();
  setCookie(c, LANG_COOKIE, lang, {
    httpOnly: true,
    sameSite: "Lax",
    secure: c.req.url.startsWith("https:"),
    maxAge: ONE_YEAR,
    path: "/",
  });
  return c.redirect("/", 303);
});

async function home(
  c: import("hono").Context<{ Bindings: Env; Variables: Variables }>,
  error?: string,
) {
  const journal = c.get("journal");
  const [burgers, stats, today, taste] = await Promise.all([
    listBurgers(c.env.DB, journal),
    readStats(c.env.DB, journal),
    todaysCard(c.env, c.executionCtx, journal, utcDay()),
    tasteProfile(c.env.DB, journal),
  ]);
  const mcpUrl = `${new URL(c.req.url).origin}/mcp/${c.get("key")}`;
  c.header("Cache-Control", "no-store");
  return c.html(
    <Home
      lang={c.get("lang")}
      burgers={burgers}
      stats={stats}
      today={today}
      taste={taste}
      mcpUrl={mcpUrl}
      error={error}
    />,
    error ? 422 : 200,
  );
}

const utcDay = () => new Date().toISOString().slice(0, 10);

/** The first validation problem, in the viewer's language. Zod's own English messages stay for logs. */
const firstIssue = (error: z.ZodError, lang: Lang) => {
  const issue = error.issues[0];
  if (!issue) return t(lang, "error.invalid");
  const field = String(issue.path[0] ?? "");
  const fieldLabel = {
    name: "error.fieldName",
    place: "error.fieldPlace",
    note: "error.fieldNote",
    rating: "error.fieldRating",
  }[field] as "error.fieldName" | undefined;
  const problem =
    issue.code === "too_small"
      ? "error.tooShort"
      : issue.code === "too_big"
        ? "error.tooLong"
        : issue.code === "invalid_format"
          ? "error.badCharacters"
          : issue.code === "invalid_value" || issue.code === "invalid_type"
            ? "error.badValue"
            : "error.generic";
  if (!fieldLabel) return t(lang, "error.invalid");
  return `${t(lang, fieldLabel)}${t(lang, "error.join")}${t(lang, problem)}`;
};

app.get("/", (c) => home(c));

app.post("/burgers", async (c) => {
  const form = await c.req.formData();
  const parsed = addSchema.safeParse({
    name: form.get("name"),
    place: blankToUndefined(form.get("place")),
  });
  if (!parsed.success) return home(c, firstIssue(parsed.error, c.get("lang")));
  const added = await addBurger(c.env.DB, c.get("journal"), parsed.data);
  if (!added) return home(c, t(c.get("lang"), "error.full", { max: MAX_BURGERS }));
  await tagBurger(c.env, c.executionCtx, added);
  return c.redirect("/", 303);
});

const idOf = (value: string) => (/^\d{1,15}$/.test(value) ? Number(value) : null);

app.post("/burgers/:id/devour", async (c) => {
  const id = idOf(c.req.param("id"));
  const form = await c.req.formData();
  const parsed = devourSchema.safeParse({
    rating: Number(form.get("rating")),
    note: blankToUndefined(form.get("note")),
  });
  if (!parsed.success) return home(c, firstIssue(parsed.error, c.get("lang")));
  const done = id !== null && (await devourBurger(c.env.DB, c.get("journal"), id, parsed.data));
  if (!done) return home(c, t(c.get("lang"), "error.notOnList"));
  await tagBurger(c.env, c.executionCtx, done);
  return c.redirect("/", 303);
});

app.post("/burgers/:id/undo", async (c) => {
  const id = idOf(c.req.param("id"));
  const done = id !== null && (await undoDevour(c.env.DB, c.get("journal"), id));
  if (!done) return home(c, t(c.get("lang"), "error.notDevoured"));
  await tagBurger(c.env, c.executionCtx, done);
  return c.redirect("/", 303);
});

app.post("/burgers/:id/delete", async (c) => {
  const id = idOf(c.req.param("id"));
  const done = id !== null && (await deleteBurger(c.env.DB, c.get("journal"), id));
  return done ? c.redirect("/", 303) : home(c, t(c.get("lang"), "error.gone"));
});

// One tap from today's card to the craving list, with the card's tags carried over.
app.post("/today/add", async (c) => {
  const journal = c.get("journal");
  const day = utcDay();
  const card = await todaysCard(c.env, c.executionCtx, journal, day);
  if (card.cravingId !== null) return c.redirect("/", 303);
  const lang = c.get("lang");
  const added = await addBurger(c.env.DB, journal, { name: card.name[lang] });
  if (!added) return home(c, t(lang, "error.full", { max: MAX_BURGERS }));
  await tagBurger(c.env, c.executionCtx, added);
  await linkPickToCraving(c.env.DB, journal, day, added.id);
  return c.redirect(`/#burger-${added.id}`, 303);
});

app.get("/journal.json", async (c) => {
  const burgers = await listBurgers(c.env.DB, c.get("journal"));
  c.header("Content-Disposition", 'attachment; filename="burger-journal.json"');
  c.header("Cache-Control", "no-store");
  return c.json({ exportedAt: new Date().toISOString(), burgers });
});

app.all("/mcp/:key", async (c) => {
  const key = c.req.param("key");
  if (!isKey(key)) return c.json({ error: "not_found" }, 404);
  return handleMcp(c.req.raw, c.env, c.executionCtx, await journalIdOf(key));
});

app.notFound((c) => c.text("Not found", 404));

app.onError((error, c) => {
  // Middleware such as the CSRF check signals with HTTPException; keep its status (403), not a 500.
  if (error instanceof HTTPException) return error.getResponse();
  console.error("unhandled error", error);
  return c.text("Something went wrong.", 500);
});

export default app;
