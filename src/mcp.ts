import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { addBurger, deleteBurger, devourBurger, listBurgers, readStats } from "./db";
import { fields } from "./domain";
import { type Background, tagBurger, tasteProfile, todaysCard } from "./today";

const asText = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
});
const failure = (message: string) => ({
  isError: true,
  content: [{ type: "text" as const, text: message }],
});

/** The journal's tools. Each call is bound to one journal, so an agent can only see its own. */
function buildServer(env: Env, background: Background, journal: string): McpServer {
  const db = env.DB;
  const server = new McpServer({ name: "burger-logger", version: "2.0.0" });

  server.registerTool(
    "list_burgers",
    {
      description: "List burgers in the journal, newest first. Optionally filter by status.",
      inputSchema: { status: z.enum(["craving", "devoured"]).optional() },
    },
    async ({ status }) => {
      const all = await listBurgers(db, journal);
      return asText(status ? all.filter((burger) => burger.status === status) : all);
    },
  );

  server.registerTool(
    "add_burger",
    {
      description: "Add a burger to the craving list.",
      inputSchema: { name: fields.name, place: fields.place },
    },
    async (input) => {
      const burger = await addBurger(db, journal, input);
      return burger
        ? asText(burger)
        : failure("The journal is full (200 burgers). Delete some first.");
    },
  );

  server.registerTool(
    "devour_burger",
    {
      description: "Mark a craving as devoured, with a 1 to 5 rating and an optional note.",
      inputSchema: { id: z.number().int().positive(), rating: fields.rating, note: fields.note },
    },
    async ({ id, ...verdict }) => {
      const burger = await devourBurger(db, journal, id, verdict);
      if (burger) await tagBurger(env, background, burger);
      return burger ? asText(burger) : failure(`Burger ${id} is not on the craving list.`);
    },
  );

  server.registerTool(
    "delete_burger",
    {
      description: "Delete a burger from the journal for good.",
      inputSchema: { id: z.number().int().positive() },
    },
    async ({ id }) =>
      (await deleteBurger(db, journal, id)) ? asText({ deleted: id }) : failure(`No burger ${id}.`),
  );

  server.registerTool(
    "journal_stats",
    { description: "Counts, the average rating and the best burger so far." },
    async () => asText(await readStats(db, journal)),
  );

  server.registerTool(
    "todays_burger",
    {
      description:
        "Today's personal burger pick (今日汉堡): the burger, match %, reasons from the user's taste model, and the 宜/忌 almanac line. The same pick all day.",
    },
    async () =>
      asText(await todaysCard(env, background, journal, new Date().toISOString().slice(0, 10))),
  );

  server.registerTool(
    "taste_profile",
    {
      description:
        "What the taste model has learned: liked and disliked tags, and from how many ratings.",
    },
    async () => asText(await tasteProfile(db, journal)),
  );

  return server;
}

/**
 * Stateless MCP over Streamable HTTP: a fresh server per request, JSON responses, no sessions.
 * That fits Workers, where there is no long-lived process to hold a session.
 */
export async function handleMcp(
  request: Request,
  env: Env,
  background: Background,
  journal: string,
) {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await buildServer(env, background, journal).connect(transport);
  return transport.handleRequest(request);
}
