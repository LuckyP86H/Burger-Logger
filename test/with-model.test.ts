import { env, exports } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";

// This file runs with AI_PROVIDER=fake (see vitest.config.ts): the full app with a model attached.
const ORIGIN = "https://burgers.test";

describe("with a model connected", () => {
  it("re-tags in the background and writes the sensory preview, without slowing the response", async () => {
    const first = await exports.default.fetch(`${ORIGIN}/`, { redirect: "manual" });
    const cookie = first.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(await first.text()).toContain("Preview from a template");

    const added = await exports.default.fetch(`${ORIGIN}/burgers`, {
      method: "POST",
      redirect: "manual",
      headers: { cookie, origin: ORIGIN, "content-type": "application/x-www-form-urlencoded" },
      body: "name=Mystery+burger",
    });
    expect(added.status).toBe(303);

    await vi.waitFor(async () => {
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM burger_tags WHERE source = 'model'",
      ).first<{ n: number }>();
      expect(row?.n).toBeGreaterThan(0);
    });
    await vi.waitFor(async () => {
      const html = await (
        await exports.default.fetch(`${ORIGIN}/`, { headers: { cookie } })
      ).text();
      expect(html).toContain("Preview by fake:demo");
      expect(html).toContain("A crackle as you bite through the crisp edge");
    });
  });
});
