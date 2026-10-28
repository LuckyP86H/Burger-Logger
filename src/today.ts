import { z } from "zod";
import type { AiSettings, ChatModel } from "./ai/models";
import { modelFromSettings } from "./ai/models";
import { generateObject } from "./ai/structured";
import type { Burger } from "./domain";
import {
  type Candidate,
  learnTaste,
  pickOfTheDay,
  type RatedBurger,
  tasteSummary,
} from "./taste/model";
import {
  TAG_LABELS,
  TAGS,
  type Tag,
  type TagRead,
  tagByKeywords,
  tagWithModel,
} from "./taste/tags";

/** Anything that can run work after the response is sent (a Worker's ExecutionContext). */
export interface Background {
  waitUntil(promise: Promise<unknown>): void;
}

export const modelFor = (env: Env): ChatModel | null =>
  modelFromSettings(env as unknown as AiSettings);

async function saveTags(
  db: D1Database,
  burgerId: number,
  tags: TagRead[],
  source: "keywords" | "model",
) {
  const insert = db.prepare(
    "INSERT INTO burger_tags (burger_id, tag, polarity, source) VALUES (?1, ?2, ?3, ?4)",
  );
  await db.batch([
    db.prepare("DELETE FROM burger_tags WHERE burger_id = ?1").bind(burgerId),
    ...tags.map((t) => insert.bind(burgerId, t.tag, t.polarity, source)),
  ]);
}

/**
 * Runs after every add, devour or undo. Keyword tags are saved before the response, so the taste
 * model is never stale; when a model is configured it re-reads the text in the background and its
 * validated tags replace the keyword ones. A model failure just leaves the keyword tags in place.
 */
export async function tagBurger(env: Env, background: Background, burger: Burger) {
  const input = { name: burger.name, place: burger.place, note: burger.note };
  await saveTags(env.DB, burger.id, tagByKeywords(input), "keywords");
  const model = modelFor(env);
  if (!model) return;
  background.waitUntil(
    tagWithModel(model, input)
      .then(async (tags) => {
        // Only overwrite if the burger is unchanged (an undo may have happened meanwhile).
        const current = await env.DB.prepare("SELECT note FROM burgers WHERE id = ?1")
          .bind(burger.id)
          .first<{ note: string | null }>();
        if (current && current.note === burger.note)
          await saveTags(env.DB, burger.id, tags, "model");
      })
      .catch((error) => console.warn("model tagging failed; keeping keyword tags", String(error))),
  );
}

interface TaggedRow {
  id: number;
  name: string;
  status: string;
  rating: number | null;
  devoured_at: string | null;
  tags: string | null;
}

async function loadJournal(db: D1Database, journal: string) {
  const { results } = await db
    .prepare(
      `SELECT b.id, b.name, b.status, b.rating, b.devoured_at,
              json_group_array(json_object('tag', t.tag, 'polarity', t.polarity))
                FILTER (WHERE t.tag IS NOT NULL) AS tags
       FROM burgers b LEFT JOIN burger_tags t ON t.burger_id = b.id
       WHERE b.journal_id = ?1
       GROUP BY b.id`,
    )
    .bind(journal)
    .all<TaggedRow>();
  const known = new Set<string>(TAGS);
  const tagsOf = (row: TaggedRow) =>
    (JSON.parse(row.tags ?? "[]") as TagRead[]).filter((t) => known.has(t.tag));
  const rated: RatedBurger[] = results
    .filter((r) => r.status === "devoured" && r.rating !== null && r.devoured_at)
    .map((r) => ({ rating: r.rating ?? 0, devouredAt: r.devoured_at ?? "", tags: tagsOf(r) }));
  const cravings: Candidate[] = results
    .filter((r) => r.status === "craving")
    .map((r) => ({
      key: `craving:${r.id}`,
      en: r.name,
      zh: null,
      tags: tagsOf(r).map((t) => t.tag),
      cravingId: r.id,
    }));
  return { rated, cravings };
}

export interface TodayCard {
  day: string;
  key: string;
  en: string;
  zh: string | null;
  tags: Tag[];
  cravingId: number | null;
  match: number;
  reasons: string[];
  /** 老黄历 style: what today favours (宜) and what to avoid (忌). */
  yi: string[];
  ji: string[];
  line: { en: string; zh: string };
  lineBy: string;
  learnedFrom: number;
}

const lineSchema = z.object({ en: z.string().min(1).max(140), zh: z.string().min(1).max(60) });

export interface TasteProfile {
  liked: Tag[];
  disliked: Tag[];
  learnedFrom: number;
  mean: number;
}

export async function tasteProfile(db: D1Database, journal: string): Promise<TasteProfile> {
  const { rated } = await loadJournal(db, journal);
  const model = learnTaste(rated);
  return {
    ...tasteSummary(model),
    learnedFrom: model.samples,
    mean: Math.round(model.mean * 10) / 10,
  };
}

/** Builds (once per day) and returns today's card. */
export async function todaysCard(
  env: Env,
  background: Background,
  journal: string,
  day: string,
): Promise<TodayCard> {
  const cached = await env.DB.prepare(
    "SELECT pick FROM daily_picks WHERE journal_id = ?1 AND day = ?2",
  )
    .bind(journal, day)
    .first<{ pick: string }>();
  if (cached) {
    const card = JSON.parse(cached.pick) as TodayCard;
    const stillThere =
      card.cravingId === null ||
      (await env.DB.prepare(
        "SELECT 1 FROM burgers WHERE id = ?1 AND journal_id = ?2 AND status = 'craving'",
      )
        .bind(card.cravingId, journal)
        .first());
    if (stillThere) return card;
  }

  const { rated, cravings } = await loadJournal(env.DB, journal);
  const taste = learnTaste(rated);
  const { candidate, prediction } = pickOfTheDay(taste, cravings, journal, day);
  const { disliked } = tasteSummary(taste);

  const reasons: string[] = [];
  for (const { tag, weight } of prediction.contributions
    .filter((c) => c.weight > 0.1)
    .slice(0, 2)) {
    reasons.push(
      `you rate ${TAG_LABELS[tag].en} ${weight > 0 ? "+" : ""}${weight.toFixed(1)} above your average`,
    );
  }
  if (prediction.noveltyReason) reasons.push(prediction.noveltyReason);
  if (candidate.cravingId !== null) reasons.push("it's already on your craving list");
  if (taste.samples < 3) reasons.push(`still learning: ${taste.samples} of 3 ratings so far`);

  // 宜 always describes the pick itself: what in it you like, or 尝鲜 (try something new) when
  // it was chosen for novelty. 忌 is what your notes complain about, as long as the pick avoids it.
  const favoured = prediction.contributions.filter((c) => c.weight > 0.1).map((c) => c.tag);
  const yi = favoured.slice(0, 2).map((t) => TAG_LABELS[t].zh);
  if (!yi.length && prediction.noveltyReason) yi.push("尝鲜");
  const ji = disliked
    .filter((t) => !candidate.tags.includes(t))
    .slice(0, 2)
    .map((t) => `太${TAG_LABELS[t].zh}`);
  const card: TodayCard = {
    day,
    key: candidate.key,
    en: candidate.en,
    zh: candidate.zh,
    tags: candidate.tags,
    cravingId: candidate.cravingId,
    match: prediction.match,
    reasons,
    yi: yi.length ? yi : ["尝鲜"],
    ji: ji.length ? ji : ["空腹排长队"],
    line: {
      en: favoured.length
        ? `A good day for ${favoured
            .slice(0, 2)
            .map((t) => TAG_LABELS[t].en)
            .join(" and ")}.`
        : "A good day to try something new.",
      zh: yi.length && yi[0] !== "尝鲜" ? `今日宜${yi.join("、")}。` : "今日宜尝鲜。",
    },
    lineBy: "template",
    learnedFrom: taste.samples,
  };

  await env.DB.prepare(
    "INSERT INTO daily_picks (journal_id, day, pick) VALUES (?1, ?2, ?3) ON CONFLICT (journal_id, day) DO UPDATE SET pick = excluded.pick",
  )
    .bind(journal, day, JSON.stringify(card))
    .run();

  // The witty line is the only part a model writes, and it is optional: the template stands in
  // until the model's validated line arrives, and stays if the model is missing or fails.
  const model = modelFor(env);
  if (model) {
    background.waitUntil(
      generateObject(
        model,
        [
          {
            role: "system",
            content:
              "You write one playful line for a daily burger card, in the style of a Chinese almanac (老黄历). English under 120 characters, Chinese under 40 characters. No links, no emoji spam.",
          },
          {
            role: "user",
            content: `Write today's line.\nBurger: ${card.en}${card.zh ? ` (${card.zh})` : ""}\n宜: ${card.yi.join(", ")}\n忌: ${card.ji.join(", ")}\nWhy: ${card.reasons.join("; ")}`,
          },
        ],
        lineSchema,
      )
        .then((line) =>
          env.DB.prepare("UPDATE daily_picks SET pick = ?3 WHERE journal_id = ?1 AND day = ?2")
            .bind(journal, day, JSON.stringify({ ...card, line, lineBy: model.id }))
            .run(),
        )
        .catch((error) => console.warn("model line failed; keeping the template", String(error))),
    );
  }
  return card;
}

/** Remembers that today's pick is now on the craving list, so the card offers "devour" next. */
export async function linkPickToCraving(
  db: D1Database,
  journal: string,
  day: string,
  cravingId: number,
) {
  await db
    .prepare(
      "UPDATE daily_picks SET pick = json_set(pick, '$.cravingId', ?3, '$.key', ?4) WHERE journal_id = ?1 AND day = ?2",
    )
    .bind(journal, day, cravingId, `craving:${cravingId}`)
    .run();
}
