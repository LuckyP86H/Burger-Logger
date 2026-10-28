import { CATALOG } from "./catalog";
import { PATTIES, type Tag, type TagRead } from "./tags";

/**
 * A tiny linear taste model you can read in one sitting.
 *
 * Every devoured burger is a training example: its rating minus your average rating is how much
 * better (or worse) than usual it was. Each tag on it shares that difference; a note that praises
 * or complains about a tag pushes that tag a full point further. Summing per tag and dividing by
 * (count + SHRINK) gives a weight that stays near zero until a tag has a few examples: the same
 * idea as ridge regularisation, without the matrix maths.
 */
const SHRINK = 2;
const NOTE_PUSH = 1;
const DEFAULT_MEAN = 3.5;

export interface RatedBurger {
  rating: number;
  devouredAt: string;
  tags: TagRead[];
}

export interface TasteModel {
  mean: number;
  samples: number;
  weights: Partial<Record<Tag, number>>;
  /** How many rated burgers each tag appeared on: the evidence behind each weight. */
  counts: Partial<Record<Tag, number>>;
  /** When each patty type was last eaten, for the novelty bonus. */
  lastPatty: Partial<Record<Tag, string>>;
}

export function learnTaste(rated: readonly RatedBurger[]): TasteModel {
  const mean = rated.length ? rated.reduce((s, b) => s + b.rating, 0) / rated.length : DEFAULT_MEAN;
  const sums = new Map<Tag, { total: number; n: number }>();
  const lastPatty: Partial<Record<Tag, string>> = {};
  for (const burger of rated) {
    for (const { tag, polarity } of burger.tags) {
      const entry = sums.get(tag) ?? { total: 0, n: 0 };
      entry.total += burger.rating - mean + polarity * NOTE_PUSH;
      entry.n += 1;
      sums.set(tag, entry);
      if (PATTIES.includes(tag) && (lastPatty[tag] ?? "") < burger.devouredAt)
        lastPatty[tag] = burger.devouredAt;
    }
  }
  const weights: Partial<Record<Tag, number>> = {};
  const counts: Partial<Record<Tag, number>> = {};
  for (const [tag, { total, n }] of sums) {
    weights[tag] = total / (n + SHRINK);
    counts[tag] = n;
  }
  return { mean, samples: rated.length, weights, counts, lastPatty };
}

export interface Contribution {
  tag: Tag;
  weight: number;
}

export interface Prediction {
  rating: number;
  /** 0-100, for the card. */
  match: number;
  contributions: Contribution[];
  novelty: number;
  noveltyReason: string | null;
}

const daysBetween = (from: string, to: string) =>
  Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);

export function predict(model: TasteModel, tags: readonly Tag[], today: string): Prediction {
  const contributions = tags
    .map((tag) => ({ tag, weight: model.weights[tag] ?? 0 }))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  const patty = tags.find((tag) => PATTIES.includes(tag));
  let novelty = 0;
  let noveltyReason: string | null = null;
  if (patty && model.samples > 0) {
    const last = model.lastPatty[patty];
    const days = last ? daysBetween(last, `${today}T12:00:00Z`) : Number.POSITIVE_INFINITY;
    if (days >= 14) {
      novelty = 0.3;
      noveltyReason = last ? `no ${patty} for ${days} days` : `you haven't logged ${patty} yet`;
    } else if (days <= 1) {
      novelty = -0.3;
    }
  }
  const raw = model.mean + contributions.reduce((s, c) => s + c.weight, 0) + novelty;
  const rating = Math.min(5, Math.max(1, raw));
  return {
    rating,
    match: Math.round(((rating - 1) / 4) * 100),
    contributions,
    novelty,
    noveltyReason,
  };
}

/**
 * Tags with the strongest learned feelings, for the "your taste" strip and 忌. A tag needs at
 * least two examples: one bad cheeseburger should not announce that you dislike beef.
 */
export function tasteSummary(model: TasteModel, count = 3) {
  const entries = (Object.entries(model.weights) as [Tag, number][]).filter(
    ([tag]) => (model.counts[tag] ?? 0) >= 2,
  );
  const liked = entries
    .filter(([, w]) => w > 0.15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count);
  const disliked = entries
    .filter(([, w]) => w < -0.15)
    .sort((a, b) => a[1] - b[1])
    .slice(0, count);
  return { liked: liked.map(([tag]) => tag), disliked: disliked.map(([tag]) => tag) };
}

export interface Candidate {
  key: string;
  en: string;
  zh: string | null;
  tags: Tag[];
  /** A craving id when the pick is already on the user's list. */
  cravingId: number | null;
}

/** FNV-1a, then mulberry32: the same journal on the same day always gets the same pick. */
function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Today's pick: score every candidate, keep the best few, then draw one with a seeded die.
 * The weights are a softmax over the score gap (temperature 0.25): a pick 0.25 points behind the
 * best is about a third as likely. Mostly the best match, sometimes a near-miss, never noise.
 */
export function pickOfTheDay(
  model: TasteModel,
  cravings: readonly Candidate[],
  journal: string,
  today: string,
): { candidate: Candidate; prediction: Prediction } {
  const cravingKeys = new Set(cravings.map((c) => c.en.toLowerCase()));
  const candidates: Candidate[] = [
    ...cravings,
    ...CATALOG.filter((c) => !cravingKeys.has(c.en.toLowerCase())).map((c) => ({
      key: `catalog:${c.slug}`,
      en: c.en,
      zh: c.zh,
      tags: c.tags,
      cravingId: null,
    })),
  ];
  const scored = candidates
    .map((candidate) => {
      const prediction = predict(model, candidate.tags, today);
      // Something you already want gets a nudge: the card should help you act on your own list.
      const bonus = candidate.cravingId !== null ? 0.25 : 0;
      return { candidate, prediction, score: prediction.rating + bonus };
    })
    .sort((a, b) => b.score - a.score || a.candidate.key.localeCompare(b.candidate.key));
  const shortlist = scored.slice(0, 4);
  const best = shortlist[0]?.score ?? 0;
  const weights = shortlist.map((s) => Math.exp((s.score - best) / 0.25));
  let roll = seededRandom(`${journal}:${today}`)() * weights.reduce((a, b) => a + b, 0);
  for (const [i, entry] of shortlist.entries()) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) return entry;
  }
  // biome-ignore lint/style/noNonNullAssertion: the catalog guarantees at least one candidate
  return shortlist[0]!;
}
