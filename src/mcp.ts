import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { addBurger, deleteBurger, devourBurger, listBurgers, readStats } from "./db";
import { fields } from "./domain";

const asText = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
});
const failure = (message: string) => ({
  isError: true,
  content: [{ type: "text" as const, text: message }],
});

/** The journal's tools. Each call is bound to one journal, so an agent can only see its own. */
function buildServer(db: D1Database, journal: string): McpServer {
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

  return server;
}

/**
 * Stateless MCP over Streamable HTTP: a fresh server per request, JSON responses, no sessions.
 * That fits Workers, where there is no long-lived process to hold a session.
 */
export async function handleMcp(request: Request, db: D1Database, journal: string) {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await buildServer(db, journal).connect(transport);
  return transport.handleRequest(request);
}
