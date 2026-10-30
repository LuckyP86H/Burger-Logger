import { z } from "zod";

export const MAX_BURGERS = 200;

/** Printable text only: no control characters or line breaks in names that are shown back. */
const printable = /^[^\p{C}]*$/u;

/**
 * One definition of the input rules, shared by the HTML forms and the MCP tools, so the two
 * doors into the journal can never disagree about what a valid burger is.
 */
export const fields = {
  name: z.string().trim().min(1).max(80).regex(printable),
  place: z.string().trim().max(60).regex(printable).optional(),
  rating: z.number().int().min(1).max(5),
  note: z.string().trim().max(200).regex(printable).optional(),
};

export const addSchema = z.object({ name: fields.name, place: fields.place });
export const devourSchema = z.object({ rating: fields.rating, note: fields.note });

export type Status = "craving" | "devoured";

export interface Burger {
  id: number;
  name: string;
  place: string | null;
  status: Status;
  rating: number | null;
  note: string | null;
  created_at: string;
  devoured_at: string | null;
}

export interface Stats {
  cravings: number;
  devoured: number;
  averageRating: number | null;
  best: { name: string; rating: number } | null;
}

/** A secret is 24 random bytes as URL-safe base64: 32 characters, 192 bits. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export const isKey = (value: string | undefined): value is string =>
  value !== undefined && KEY_PATTERN.test(value);

export function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_");
}

/** The database stores only this hash, never the key itself. */
export async function journalIdOf(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Empty form fields arrive as "": treat them as absent. */
export const blankToUndefined = (value: FormDataEntryValue | null): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;
