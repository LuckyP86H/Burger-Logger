/**
 * One small interface for every chat model, so the app never depends on a vendor. Free local or
 * hosted open models (Ollama: Qwen, DeepSeek, GLM, Llama...) and paid APIs (Claude, GPT, Gemini,
 * Kimi K2) plug in by configuration only. Keys stay on the server; the browser never sees them.
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  /** A JSON Schema the reply must follow. Providers that support it enforce it natively. */
  schema?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface ChatModel {
  /** Shown in the UI and stored with results, e.g. "ollama:qwen3:8b". */
  readonly id: string;
  complete(messages: ChatMessage[], options?: CompleteOptions): Promise<string>;
}

type Fetch = typeof fetch;
const TIMEOUT_MS = 20_000;

async function postJson(
  fetchImpl: Fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

const bearer = (key?: string): Record<string, string> =>
  key ? { authorization: `Bearer ${key}` } : {};

/** Ollama's native API: local (http://localhost:11434) or Ollama Cloud (https://ollama.com). */
export function ollama(
  config: { baseUrl: string; model: string; apiKey?: string },
  fetchImpl: Fetch = fetch,
): ChatModel {
  return {
    id: `ollama:${config.model}`,
    async complete(messages, options = {}) {
      const data = await postJson(
        fetchImpl,
        `${config.baseUrl.replace(/\/$/, "")}/api/chat`,
        bearer(config.apiKey),
        {
          model: config.model,
          messages,
          stream: false,
          ...(options.schema ? { format: options.schema } : {}),
          options: { temperature: 0.4 },
        },
        options.signal,
      );
      const content = (data.message as { content?: unknown } | undefined)?.content;
      if (typeof content !== "string") throw new Error("Ollama returned no message");
      return content;
    },
  };
}

/** Any OpenAI-compatible endpoint: OpenAI, DeepSeek, Qwen (DashScope), GLM, Kimi, Gemini, Ollama /v1. */
export function openAICompatible(
  config: { baseUrl: string; model: string; apiKey?: string },
  fetchImpl: Fetch = fetch,
): ChatModel {
  return {
    id: `openai:${config.model}`,
    async complete(messages, options = {}) {
      const data = await postJson(
        fetchImpl,
        `${config.baseUrl.replace(/\/$/, "")}/chat/completions`,
        bearer(config.apiKey),
        {
          model: config.model,
          messages,
          temperature: 0.4,
          ...(options.schema ? { response_format: { type: "json_object" } } : {}),
        },
        options.signal,
      );
      const choices = data.choices as { message?: { content?: unknown } }[] | undefined;
      const content = choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("The model returned no message");
      return content;
    },
  };
}

/** Anthropic's Messages API (Claude). */
export function anthropic(
  config: { model: string; apiKey: string; baseUrl?: string },
  fetchImpl: Fetch = fetch,
): ChatModel {
  return {
    id: `anthropic:${config.model}`,
    async complete(messages, options = {}) {
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      const data = await postJson(
        fetchImpl,
        `${(config.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`,
        { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
        {
          model: config.model,
          max_tokens: 1024,
          system,
          messages: messages.filter((m) => m.role !== "system"),
        },
        options.signal,
      );
      const block = (data.content as { type?: string; text?: unknown }[] | undefined)?.find(
        (part) => part.type === "text",
      );
      if (typeof block?.text !== "string") throw new Error("Claude returned no text");
      return block.text;
    },
  };
}

/**
 * A scripted model for tests and offline demos: each reply is chosen by the first rule whose
 * pattern matches the last user message. Deterministic, free, and never calls the network.
 */
export function fake(rules: { when: RegExp; reply: string }[], id = "fake"): ChatModel {
  return {
    id,
    async complete(messages) {
      const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      const rule = rules.find((r) => r.when.test(last));
      if (!rule) throw new Error("fake model: no rule matches");
      return rule.reply;
    },
  };
}

/** The settings a deployment provides: plain vars plus one secret, AI_API_KEY. */
export interface AiSettings {
  AI_PROVIDER?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  AI_API_KEY?: string;
}

const DEMO_FAKE = fake(
  [
    {
      when: /^Label this burger/,
      reply: '{"tags":[{"tag":"beef","polarity":0},{"tag":"cheesy","polarity":0}]}',
    },
    {
      when: /^Write today's line/,
      reply: '{"en":"The grill gods smile on melted cheese today.","zh":"今日宜芝士，诸事皆融。"}',
    },
  ],
  "fake:demo",
);

/** Picks the model from configuration. Null means "no model": every AI feature has a fallback. */
export function modelFromSettings(
  settings: AiSettings,
  fetchImpl: Fetch = fetch,
): ChatModel | null {
  const provider = settings.AI_PROVIDER?.trim().toLowerCase();
  const model = settings.AI_MODEL?.trim();
  const apiKey = settings.AI_API_KEY?.trim() || undefined;
  switch (provider) {
    case "ollama":
      return model
        ? ollama(
            {
              baseUrl: settings.AI_BASE_URL || "http://localhost:11434",
              model,
              ...(apiKey ? { apiKey } : {}),
            },
            fetchImpl,
          )
        : null;
    case "openai":
      return model && settings.AI_BASE_URL
        ? openAICompatible(
            { baseUrl: settings.AI_BASE_URL, model, ...(apiKey ? { apiKey } : {}) },
            fetchImpl,
          )
        : null;
    case "anthropic":
      return model && apiKey
        ? anthropic(
            { model, apiKey, ...(settings.AI_BASE_URL ? { baseUrl: settings.AI_BASE_URL } : {}) },
            fetchImpl,
          )
        : null;
    case "fake":
      return DEMO_FAKE;
    default:
      return null;
  }
}
