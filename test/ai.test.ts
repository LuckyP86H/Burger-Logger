import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  anthropic,
  type ChatMessage,
  fake,
  modelFromSettings,
  ollama,
  openAICompatible,
} from "../src/ai/models";
import { generateObject } from "../src/ai/structured";
import { learnTaste, pickOfTheDay, predict, tasteSummary } from "../src/taste/model";
import { tagByKeywords, tagWithModel } from "../src/taste/tags";

/** Records the one request a provider makes and answers with `reply`. */
function recorder(reply: unknown) {
  const seen: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return new Response(JSON.stringify(reply), { headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { seen, fetchImpl, body: () => JSON.parse(String(seen[0]?.init.body)) };
}
const header = (init: RequestInit | undefined, name: string) =>
  new Headers(init?.headers).get(name);
const messages: ChatMessage[] = [
  { role: "system", content: "be brief" },
  { role: "user", content: "hi" },
];

describe("providers speak each vendor's wire format", () => {
  it("Ollama (local or cloud): /api/chat, bearer key, JSON Schema as `format`", async () => {
    const r = recorder({ message: { content: "ok" } });
    const model = ollama(
      { baseUrl: "https://ollama.com/", model: "qwen3:8b", apiKey: "k" },
      r.fetchImpl,
    );
    expect(await model.complete(messages, { schema: { type: "object" } })).toBe("ok");
    expect(r.seen[0]?.url).toBe("https://ollama.com/api/chat");
    expect(header(r.seen[0]?.init, "authorization")).toBe("Bearer k");
    expect(r.body()).toMatchObject({
      model: "qwen3:8b",
      stream: false,
      format: { type: "object" },
    });
    expect(model.id).toBe("ollama:qwen3:8b");
  });

  it("OpenAI-compatible (DeepSeek, Qwen, GLM, Kimi, OpenAI...): /chat/completions", async () => {
    const r = recorder({ choices: [{ message: { content: "ok" } }] });
    const model = openAICompatible(
      { baseUrl: "https://api.deepseek.com", model: "deepseek-chat", apiKey: "k" },
      r.fetchImpl,
    );
    expect(await model.complete(messages, { schema: {} })).toBe("ok");
    expect(r.seen[0]?.url).toBe("https://api.deepseek.com/chat/completions");
    expect(r.body()).toMatchObject({
      model: "deepseek-chat",
      response_format: { type: "json_object" },
    });
  });

  it("Anthropic: system prompt separated, x-api-key and version headers", async () => {
    const r = recorder({ content: [{ type: "text", text: "ok" }] });
    const model = anthropic({ model: "claude-sonnet-5-5", apiKey: "k" }, r.fetchImpl);
    expect(await model.complete(messages)).toBe("ok");
    expect(r.seen[0]?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(header(r.seen[0]?.init, "x-api-key")).toBe("k");
    expect(header(r.seen[0]?.init, "anthropic-version")).toBeTruthy();
    expect(r.body()).toMatchObject({
      system: "be brief",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("an HTTP error becomes an exception, never a silent empty answer", async () => {
    const failing = (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;
    await expect(
      ollama({ baseUrl: "http://x", model: "m" }, failing).complete(messages),
    ).rejects.toThrow(/503/);
  });

  it("configuration picks the provider, and incomplete settings mean no model", () => {
    expect(modelFromSettings({})).toBeNull();
    expect(modelFromSettings({ AI_PROVIDER: "none" })).toBeNull();
    expect(modelFromSettings({ AI_PROVIDER: "ollama" })).toBeNull();
    expect(modelFromSettings({ AI_PROVIDER: "anthropic", AI_MODEL: "claude" })).toBeNull();
    expect(modelFromSettings({ AI_PROVIDER: "ollama", AI_MODEL: "qwen3:8b" })?.id).toBe(
      "ollama:qwen3:8b",
    );
    expect(
      modelFromSettings({ AI_PROVIDER: "openai", AI_MODEL: "glm-4", AI_BASE_URL: "https://x/v4" })
        ?.id,
    ).toBe("openai:glm-4");
  });
});

describe("structured output", () => {
  const schema = z.object({ n: z.number().int() });

  it("accepts fenced JSON", async () => {
    const model = fake([{ when: /./, reply: '```json\n{"n": 3}\n```' }]);
    expect(await generateObject(model, [{ role: "user", content: "go" }], schema)).toEqual({
      n: 3,
    });
  });

  it("gives the model one repair attempt with the validation error", async () => {
    let calls = 0;
    const model = {
      id: "flaky",
      async complete(conversation: ChatMessage[]) {
        calls++;
        return calls === 1
          ? '{"n": "three"}'
          : conversation.at(-1)?.content.includes("invalid")
            ? '{"n": 3}'
            : "{}";
      },
    };
    expect(await generateObject(model, [{ role: "user", content: "go" }], schema)).toEqual({
      n: 3,
    });
    expect(calls).toBe(2);
  });

  it("rejects output that stays invalid, so it never reaches the database", async () => {
    const model = fake([{ when: /./, reply: "I'd rather chat about burgers" }]);
    await expect(generateObject(model, [{ role: "user", content: "go" }], schema)).rejects.toThrow(
      /validation/,
    );
  });
});

describe("tagging: turning text into features", () => {
  const tags = (name: string, note?: string) =>
    Object.fromEntries(tagByKeywords({ name, note: note ?? null }).map((t) => [t.tag, t.polarity]));

  it("reads ingredients and styles from the name", () => {
    expect(tags("Double smash cheeseburger")).toMatchObject({
      beef: 0,
      double: 0,
      smash: 0,
      cheesy: 0,
    });
    expect(tags("Nashville hot chicken")).toMatchObject({ chicken: 0 });
  });

  it("reads praise and complaints from the note, clause by clause", () => {
    expect(tags("Classic", "great bacon, a bit salty")).toMatchObject({ bacon: 1, salty: -1 });
    expect(tags("Classic", "too greasy")).toMatchObject({ rich: -1 });
  });

  it("understands Chinese notes too", () => {
    expect(tags("烟熏牛肉堡", "太咸了，培根很好吃")).toMatchObject({
      smoky: 0,
      beef: 0,
      salty: -1,
      bacon: 1,
    });
  });

  it("does not invent tags from partial words", () => {
    expect(tags("Hamburger", "eggplant on the side")).not.toHaveProperty("egg");
  });

  it("a model tagger is held to the closed vocabulary", async () => {
    const good = fake([{ when: /Label/, reply: '{"tags":[{"tag":"salty","polarity":-1}]}' }]);
    expect(await tagWithModel(good, { name: "x" })).toEqual([{ tag: "salty", polarity: -1 }]);
    const rogue = fake([{ when: /Label/, reply: '{"tags":[{"tag":"umami-bomb","polarity":1}]}' }]);
    await expect(tagWithModel(rogue, { name: "x" })).rejects.toThrow();
  });
});

describe("the taste model", () => {
  const day = (d: number) => `2026-10-${String(d).padStart(2, "0")}T12:00:00Z`;

  it("learns a positive weight for what you rate high and a negative one for complaints", () => {
    const model = learnTaste([
      {
        rating: 5,
        devouredAt: day(1),
        tags: [
          { tag: "smoky", polarity: 0 },
          { tag: "beef", polarity: 0 },
        ],
      },
      { rating: 5, devouredAt: day(2), tags: [{ tag: "smoky", polarity: 1 }] },
      {
        rating: 2,
        devouredAt: day(3),
        tags: [
          { tag: "salty", polarity: -1 },
          { tag: "beef", polarity: 0 },
        ],
      },
    ]);
    expect(model.weights.smoky).toBeGreaterThan(0.5);
    expect(model.weights.salty).toBeLessThan(-0.5);
    expect(Math.abs(model.weights.beef ?? 0)).toBeLessThan(0.5);
  });

  it("only reports a like or dislike with at least two examples", () => {
    const model = learnTaste([
      { rating: 5, devouredAt: day(1), tags: [{ tag: "smoky", polarity: 0 }] },
      { rating: 5, devouredAt: day(2), tags: [{ tag: "smoky", polarity: 0 }] },
      { rating: 1, devouredAt: day(3), tags: [{ tag: "beef", polarity: 0 }] },
    ]);
    expect(model.weights.beef).toBeLessThan(-0.5);
    expect(tasteSummary(model)).toEqual({ liked: ["smoky"], disliked: [] });
  });

  it("shrinks weights learned from a single example", () => {
    const one = learnTaste([
      { rating: 5, devouredAt: day(1), tags: [{ tag: "egg", polarity: 0 }] },
    ]);
    expect(one.weights.egg).toBe(0); // one sample is its own average, so nothing is "above average" yet
    const few = learnTaste([
      { rating: 5, devouredAt: day(1), tags: [{ tag: "egg", polarity: 0 }] },
      { rating: 3, devouredAt: day(2), tags: [] },
    ]);
    expect(few.weights.egg).toBeCloseTo(1 / 3); // (5 - 4) / (1 + 2)
  });

  it("rewards a patty you haven't had for a while", () => {
    const model = learnTaste([
      { rating: 4, devouredAt: day(1), tags: [{ tag: "chicken", polarity: 0 }] },
      { rating: 4, devouredAt: day(27), tags: [{ tag: "beef", polarity: 0 }] },
    ]);
    const chicken = predict(model, ["chicken"], "2026-10-28");
    const beef = predict(model, ["beef"], "2026-10-28");
    expect(chicken.noveltyReason).toBe("no chicken for 27 days");
    expect(chicken.rating).toBeGreaterThan(beef.rating);
  });

  it("picks the same burger all day, and not always the same one", () => {
    const model = learnTaste([]);
    const pick = (journal: string, d: string) => pickOfTheDay(model, [], journal, d).candidate.key;
    expect(pick("j1", "2026-10-28")).toBe(pick("j1", "2026-10-28"));
    const week = new Set(
      Array.from({ length: 14 }, (_, i) => pick("j1", `2026-11-${String(i + 1).padStart(2, "0")}`)),
    );
    expect(week.size).toBeGreaterThan(1);
  });

  it("leans towards your own cravings when they fit your taste", () => {
    const model = learnTaste([
      { rating: 5, devouredAt: day(1), tags: [{ tag: "spicy", polarity: 1 }] },
      { rating: 2, devouredAt: day(2), tags: [{ tag: "sweet", polarity: -1 }] },
    ]);
    const craving = {
      key: "craving:7",
      en: "Ghost pepper smash",
      tags: ["beef", "spicy", "smash"] as const,
      cravingId: 7,
    };
    const picks = Array.from({ length: 20 }, (_, i) =>
      pickOfTheDay(model, [{ ...craving, tags: [...craving.tags] }], `j${i}`, "2026-10-28"),
    );
    expect(picks.filter((p) => p.candidate.cravingId === 7).length).toBeGreaterThan(6);
    expect(
      picks.every((p) => !p.candidate.tags.includes("sweet") || p.prediction.rating >= 3),
    ).toBe(true);
  });
});
