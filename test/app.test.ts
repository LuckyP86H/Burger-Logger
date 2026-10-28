import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_BURGERS } from "../src/domain";

const ORIGIN = "https://burgers.test";

/** A tiny browser: remembers the journal cookie between requests, like a real visitor. */
class Visitor {
  cookie = "";

  async fetch(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("cookie", this.cookie);
    const response = await exports.default.fetch(`${ORIGIN}${path}`, {
      ...init,
      headers,
      redirect: "manual",
    });
    const set = response.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0] ?? "";
    return response;
  }

  post(path: string, fields: Record<string, string>, headers: Record<string, string> = {}) {
    return this.fetch(path, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", origin: ORIGIN, ...headers },
      body: new URLSearchParams(fields).toString(),
    });
  }

  async page() {
    return (await this.fetch("/")).text();
  }

  get key() {
    return this.cookie.split("=")[1] ?? "";
  }
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM burgers"),
    env.DB.prepare("DELETE FROM daily_picks"),
  ]);
});

/** Undoes the HTML escaping JSX applies, to compare page text with API data. */
const unescapeHtml = (text: string) =>
  text
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

const idOf = async (visitor: Visitor, name: string) => {
  const { burgers } = (await (await visitor.fetch("/journal.json")).json()) as {
    burgers: { id: number; name: string }[];
  };
  const found = burgers.find((burger) => burger.name === name);
  if (!found) throw new Error(`no burger named ${name}`);
  return found.id;
};

describe("the page", () => {
  it("is a full HTML document with a strict CSP, and gives each visitor a private cookie", async () => {
    const visitor = new Visitor();
    const response = await visitor.fetch("/");
    const html = await response.text();
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly.*SameSite=Lax/i);
    expect(visitor.key).toHaveLength(32);
    expect(html).toContain("Nothing queued");
  });

  it("escapes what people type", async () => {
    const visitor = new Visitor();
    await visitor.post("/burgers", { name: "<script>alert(1)</script>" });
    const html = await visitor.page();
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("the burger lifecycle", () => {
  it("adds a craving, devours it with a rating, and keeps the stats", async () => {
    const visitor = new Visitor();
    const added = await visitor.post("/burgers", { name: "  Double smash ", place: "Shake Shack" });
    expect(added.status).toBe(303);
    expect(added.headers.get("location")).toBe("/");

    const id = await idOf(visitor, "Double smash");
    const devoured = await visitor.post(`/burgers/${id}/devour`, {
      rating: "4",
      note: "Great bun",
    });
    expect(devoured.status).toBe(303);

    await visitor.post("/burgers", { name: "Bacon stack" });
    const second = await idOf(visitor, "Bacon stack");
    await visitor.post(`/burgers/${second}/devour`, { rating: "5" });

    const html = await visitor.page();
    expect(html).toMatch(/data-testid="stat-devoured">2</);
    expect(html).toMatch(/data-testid="stat-average">4\.5</);
    expect(html).toMatch(/data-testid="stat-best"[^>]*>Bacon stack</);
    expect(html).toContain("Great bun");
  });

  it("moves a devoured burger back to cravings and forgets the verdict", async () => {
    const visitor = new Visitor();
    await visitor.post("/burgers", { name: "Patty melt" });
    const id = await idOf(visitor, "Patty melt");
    await visitor.post(`/burgers/${id}/devour`, { rating: "3", note: "ok" });
    await visitor.post(`/burgers/${id}/undo`, {});

    const row = await env.DB.prepare(
      "SELECT status, rating, note, devoured_at FROM burgers WHERE id = ?",
    )
      .bind(id)
      .first();
    expect(row).toEqual({ status: "craving", rating: null, note: null, devoured_at: null });
  });

  it("deletes a burger", async () => {
    const visitor = new Visitor();
    await visitor.post("/burgers", { name: "Veggie" });
    const id = await idOf(visitor, "Veggie");
    expect((await visitor.post(`/burgers/${id}/delete`, {})).status).toBe(303);
    expect(await visitor.page()).not.toContain("Veggie");
    expect((await visitor.post(`/burgers/${id}/delete`, {})).status).toBe(422);
  });

  it("cannot devour the same burger twice", async () => {
    const visitor = new Visitor();
    await visitor.post("/burgers", { name: "Once" });
    const id = await idOf(visitor, "Once");
    await visitor.post(`/burgers/${id}/devour`, { rating: "5" });
    const again = await visitor.post(`/burgers/${id}/devour`, { rating: "1" });
    expect(again.status).toBe(422);
    const row = await env.DB.prepare("SELECT rating FROM burgers WHERE id = ?").bind(id).first();
    expect(row).toEqual({ rating: 5 });
  });
});

describe("privacy between journals", () => {
  it("shows each visitor only their own burgers and refuses to touch someone else's", async () => {
    const ada = new Visitor();
    const grace = new Visitor();
    await ada.post("/burgers", { name: "Adas burger" });
    const id = await idOf(ada, "Adas burger");

    expect(await grace.page()).not.toContain("Adas burger");
    expect((await grace.post(`/burgers/${id}/devour`, { rating: "1" })).status).toBe(422);
    expect((await grace.post(`/burgers/${id}/delete`, {})).status).toBe(422);
    expect(await ada.page()).toContain("Adas burger");
  });

  it("stores a hash of the key, never the key", async () => {
    const visitor = new Visitor();
    await visitor.post("/burgers", { name: "Hashed" });
    const row = await env.DB.prepare("SELECT journal_id FROM burgers").first<{
      journal_id: string;
    }>();
    expect(row?.journal_id).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.journal_id).not.toContain(visitor.key);
  });
});

describe("validation", () => {
  it.each([
    ["an empty name", { name: "   " }],
    ["a name over 80 characters", { name: "x".repeat(81) }],
    ["a place over 60 characters", { name: "ok", place: "p".repeat(61) }],
    ["a control character", { name: "bad\u0000name" }],
  ])("rejects %s with a message, not a crash", async (_label, fields) => {
    const visitor = new Visitor();
    const response = await visitor.post("/burgers", fields);
    expect(response.status).toBe(422);
    expect(await response.text()).toContain('role="alert"');
  });

  it.each(["0", "6", "2.5", "abc", ""])("rejects the rating %j", async (rating) => {
    const visitor = new Visitor();
    await visitor.post("/burgers", { name: "Rated" });
    const id = await idOf(visitor, "Rated");
    expect((await visitor.post(`/burgers/${id}/devour`, { rating })).status).toBe(422);
  });

  it("stops at the journal limit", async () => {
    const visitor = new Visitor();
    await visitor.post("/burgers", { name: "First" });
    const { journal_id } = (await env.DB.prepare("SELECT journal_id FROM burgers").first()) as {
      journal_id: string;
    };
    const fill = env.DB.prepare("INSERT INTO burgers (journal_id, name) VALUES (?1, ?2)");
    await env.DB.batch(
      Array.from({ length: MAX_BURGERS - 1 }, (_, i) => fill.bind(journal_id, `b${i}`)),
    );

    const response = await visitor.post("/burgers", { name: "One too many" });
    expect(response.status).toBe(422);
    expect(await response.text()).toContain("journal is full");
  });

  it("the database itself refuses a devoured burger with no rating", async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO burgers (journal_id, name, status) VALUES ('j', 'x', 'devoured')",
      ).run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare("INSERT INTO burgers (journal_id, name, rating) VALUES ('j', 'x', 3)").run(),
    ).rejects.toThrow();
  });
});

describe("cross-site requests", () => {
  it("rejects a form post from another origin", async () => {
    const visitor = new Visitor();
    const response = await visitor.post(
      "/burgers",
      { name: "Forged" },
      { origin: "https://evil.test" },
    );
    expect(response.status).toBe(403);
    expect(await visitor.page()).not.toContain("Forged");
  });
});

describe("export", () => {
  it("downloads the journal as JSON", async () => {
    const visitor = new Visitor();
    await visitor.post("/burgers", { name: "Exported" });
    const response = await visitor.fetch("/journal.json");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    const body = (await response.json()) as { burgers: { name: string }[] };
    expect(body.burgers.map((burger) => burger.name)).toEqual(["Exported"]);
  });
});

describe("MCP", () => {
  type Rpc = {
    result?: { isError?: boolean; tools?: { name: string }[]; content: { text: string }[] };
  };
  const rpc = async (key: string, method: string, params: unknown = {}, id = 1) => {
    const response = await exports.default.fetch(`${ORIGIN}/mcp/${key}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    return { status: response.status, body: (await response.json()) as Rpc };
  };
  const call = (key: string, name: string, args: unknown = {}) =>
    rpc(key, "tools/call", { name, arguments: args });
  const text = (result: { body: Rpc }) =>
    JSON.parse(result.body.result?.content[0]?.text ?? "null");

  it("lists the tools", async () => {
    const visitor = new Visitor();
    await visitor.fetch("/");
    const { status, body } = await rpc(visitor.key, "tools/list");
    expect(status).toBe(200);
    expect((body.result?.tools ?? []).map((tool) => tool.name).sort()).toEqual([
      "add_burger",
      "delete_burger",
      "devour_burger",
      "journal_stats",
      "list_burgers",
      "taste_profile",
      "todays_burger",
    ]);
  });

  it("an agent logs a burger and the browser sees it in the same journal", async () => {
    const visitor = new Visitor();
    await visitor.fetch("/");
    const added = text(
      await call(visitor.key, "add_burger", { name: "Agent special", place: "MCP Grill" }),
    );
    expect(added.status).toBe("craving");

    await call(visitor.key, "devour_burger", {
      id: added.id,
      rating: 5,
      note: "logged by an agent",
    });
    const html = await visitor.page();
    expect(html).toContain("Agent special");
    expect(html).toContain("logged by an agent");
    expect(text(await call(visitor.key, "journal_stats"))).toMatchObject({
      devoured: 1,
      averageRating: 5,
    });
  });

  it("applies the same validation as the forms", async () => {
    const visitor = new Visitor();
    await visitor.fetch("/");
    const result = await call(visitor.key, "devour_burger", { id: 1, rating: 9 });
    expect(result.body.result?.isError ?? true).toBe(true);
  });

  it("keeps journals apart and rejects malformed keys", async () => {
    const one = new Visitor();
    const two = new Visitor();
    await one.fetch("/");
    await two.fetch("/");
    await call(one.key, "add_burger", { name: "Private" });
    expect(text(await call(two.key, "list_burgers"))).toEqual([]);

    const bad = await exports.default.fetch(`${ORIGIN}/mcp/not-a-key`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(bad.status).toBe(404);
  });
});

describe("今日汉堡 (today's burger)", () => {
  it("shows one pick per day and keeps it across reloads", async () => {
    const visitor = new Visitor();
    const first = await visitor.page();
    expect(first).toContain("今日汉堡");
    expect(first).toMatch(/data-testid="almanac"/);
    const title = first.match(/<h2 id="today-title">([^<]+)</)?.[1];
    expect(title).toBeTruthy();
    expect((await visitor.page()).match(/<h2 id="today-title">([^<]+)</)?.[1]).toBe(title);
  });

  it("adds today's pick to the craving list, then points at it", async () => {
    const visitor = new Visitor();
    const title = (await visitor.page()).match(/<h2 id="today-title">([^<]+)</)?.[1] ?? "";
    const added = await visitor.post("/today/add", {});
    expect(added.status).toBe(303);
    expect(added.headers.get("location")).toMatch(/^\/#burger-\d+$/);
    const html = await visitor.page();
    expect(html).toContain("It&#39;s on your list: devour it today");
    expect(html).toMatch(
      new RegExp(
        `data-testid="craving"[^>]*>[\\s\\S]*${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      ),
    );
    // Adding again does nothing new.
    await visitor.post("/today/add", {});
    expect(
      (await (await visitor.fetch("/journal.json")).json()) as { burgers: unknown[] },
    ).toMatchObject({
      burgers: [expect.anything()],
    });
  });

  it("tags burgers from their name and note, and drops tags with the burger", async () => {
    const visitor = new Visitor();
    await visitor.post("/burgers", { name: "Smoky bacon cheeseburger" });
    const id = await idOf(visitor, "Smoky bacon cheeseburger");
    await visitor.post(`/burgers/${id}/devour`, { rating: "4", note: "great bacon, a bit salty" });
    const { results } = await env.DB.prepare(
      "SELECT tag, polarity FROM burger_tags WHERE burger_id = ? ORDER BY tag",
    )
      .bind(id)
      .all();
    expect(results).toEqual(
      expect.arrayContaining([
        { tag: "bacon", polarity: 1 },
        { tag: "salty", polarity: -1 },
        { tag: "smoky", polarity: 0 },
        { tag: "cheesy", polarity: 0 },
      ]),
    );
    await visitor.post(`/burgers/${id}/delete`, {});
    const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM burger_tags WHERE burger_id = ?")
      .bind(id)
      .first();
    expect(left).toEqual({ n: 0 });
  });

  it("learns from ratings and shows it in the taste strip and the almanac", async () => {
    const visitor = new Visitor();
    for (const [name, rating, note] of [
      ["Smoky BBQ bacon", "5", "loved the bacon"],
      ["Smoked brisket burger", "5", ""],
      ["Salty pretzel burger", "2", "way too salty"],
      ["Anchovy burger", "2", "too salty again"],
    ] as const) {
      await visitor.post("/burgers", { name });
      const id = await idOf(visitor, name);
      await visitor.post(`/burgers/${id}/devour`, { rating, note });
    }
    await env.DB.prepare("DELETE FROM daily_picks").run();
    const html = await visitor.page();
    expect(html).toMatch(/data-testid="taste"[\s\S]*\+ smoky/);
    expect(html).toMatch(/class="chip dislike">− salty/);
    // 忌 warns about saltiness, unless today's pick is itself salty.
    const row = await env.DB.prepare("SELECT pick FROM daily_picks").first<{ pick: string }>();
    const card = JSON.parse(row?.pick ?? "{}") as { tags: string[]; ji: string[] };
    expect(card.ji.includes("太咸")).toBe(!card.tags.includes("salty"));
    if (!card.tags.includes("salty")) expect(html).toContain("太咸");
  });

  it("is available to agents over MCP, and matches the page", async () => {
    const visitor = new Visitor();
    const title = unescapeHtml(
      (await visitor.page()).match(/<h2 id="today-title">([^<]+)</)?.[1] ?? "",
    );
    const response = await exports.default.fetch(`${ORIGIN}/mcp/${visitor.key}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "todays_burger", arguments: {} },
      }),
    });
    const body = (await response.json()) as { result: { content: { text: string }[] } };
    const card = JSON.parse(body.result.content[0]?.text ?? "{}");
    expect(card.en).toBe(title);
    expect(card.yi.length).toBeGreaterThan(0);
  });
});
