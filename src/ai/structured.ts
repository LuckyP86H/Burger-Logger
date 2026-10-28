import { z } from "zod";
import type { ChatMessage, ChatModel } from "./models";

/**
 * Asks a model for JSON and only returns it if it passes the Zod schema. Models are unreliable
 * narrators: when a reply is malformed, the model gets the validation error back and one more try.
 * Anything still invalid is rejected, so bad model output can never reach the database.
 */
export async function generateObject<T extends z.ZodType>(
  model: ChatModel,
  messages: ChatMessage[],
  schema: T,
  options: { retries?: number; signal?: AbortSignal } = {},
): Promise<z.infer<T>> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  const conversation: ChatMessage[] = [
    {
      role: "system",
      content: `Reply with JSON only, no prose and no code fences. It must match this JSON Schema:\n${JSON.stringify(jsonSchema)}`,
    },
    ...messages,
  ];
  const attempts = 1 + (options.retries ?? 1);
  let lastError = "no reply";
  for (let attempt = 0; attempt < attempts; attempt++) {
    const reply = await model.complete(conversation, {
      schema: jsonSchema,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    const parsed = schema.safeParse(parseJson(reply));
    if (parsed.success) return parsed.data;
    lastError = parsed.error.issues
      .map((i) => `${i.path.join(".") || "reply"}: ${i.message}`)
      .join("; ");
    conversation.push(
      { role: "assistant", content: reply },
      {
        role: "user",
        content: `That reply was invalid (${lastError}). Reply again with corrected JSON only.`,
      },
    );
  }
  throw new Error(`model output failed validation: ${lastError}`);
}

/** Tolerates the usual wrappers: ```json fences and text around the object. */
function parseJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {}
    }
    return undefined;
  }
}
