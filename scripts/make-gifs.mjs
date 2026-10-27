// Records the README GIFs from the real app: starts a local dev server, drives it with
// Playwright, takes a screenshot per step, then stitches the frames with ffmpeg.
//   pnpm gifs        (needs ffmpeg on the PATH)
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const PORT = 8790;
const BASE = `http://localhost:${PORT}`;
const SIZE = { width: 760, height: 780 };
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

mkdirSync("docs", { recursive: true });

const server = spawn("pnpm", ["exec", "wrangler", "dev", "--port", String(PORT)], {
  stdio: "ignore",
  detached: true,
});
const stop = () => {
  try {
    process.kill(-server.pid);
  } catch {}
};
process.on("exit", stop);

for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${BASE}/api/health`)).ok) break;
  } catch {}
  if (i > 120) throw new Error("dev server did not start");
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const browser = await chromium.launch({ executablePath });

/** A recorder: `shot(caption, seconds)` saves a frame; `save(name)` writes docs/<name>.gif. */
function recorder(page) {
  const dir = mkdtempSync(join(tmpdir(), "frames-"));
  const frames = [];
  return {
    async shot(caption, seconds = 1.4) {
      // Let htmx's view transition finish, or the frame catches two pages cross-fading.
      await page.waitForTimeout(600);
      await page.evaluate((text) => {
        document.getElementById("gif-caption")?.remove();
        const el = document.createElement("div");
        el.id = "gif-caption";
        el.textContent = text;
        el.setAttribute(
          "style",
          "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:99;" +
            "padding:8px 16px;border-radius:999px;background:#2b1a10;color:#fff4d6;" +
            "font:600 15px system-ui,sans-serif;box-shadow:0 4px 14px #0006;white-space:nowrap",
        );
        document.body.append(el);
      }, caption);
      const file = join(dir, `${String(frames.length).padStart(3, "0")}.png`);
      await page.screenshot({ path: file });
      frames.push({ file, seconds });
    },
    save(name) {
      const list = frames
        .map((f) => `file '${f.file}'\nduration ${f.seconds}`)
        .concat(`file '${frames.at(-1).file}'`)
        .join("\n");
      const listFile = join(dir, "frames.txt");
      writeFileSync(listFile, list);
      const filter =
        "fps=8,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4";
      const result = spawnSync(
        "ffmpeg",
        [
          "-y",
          "-loglevel",
          "error",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listFile,
          "-vf",
          filter,
          `docs/${name}.gif`,
        ],
        { stdio: "inherit" },
      );
      if (result.status !== 0) throw new Error("ffmpeg failed");
      process.stdout.write(`wrote docs/${name}.gif\n`);
    },
  };
}

async function newPage({ javaScriptEnabled = true } = {}) {
  const context = await browser.newContext({
    viewport: SIZE,
    javaScriptEnabled,
    bypassCSP: true, // only so the recorder can overlay a caption; the app itself is unchanged
    colorScheme: "light",
  });
  return context.newPage();
}

async function lifecycle(page, rec, extra = "") {
  await page.goto(BASE);
  await rec.shot(`An empty journal${extra}`);
  await page.getByLabel("Burger", { exact: true }).fill("Double smash");
  await page.getByLabel(/^Where/).fill("Shake Shack");
  await rec.shot("Write down a craving", 1.6);
  await page.getByRole("button", { name: "Add to cravings" }).click();
  await page.getByTestId("craving").first().waitFor();
  await rec.shot("It joins the craving list");
  const item = page.getByTestId("craving").first();
  await item.getByText("Devour it!").click();
  await item.getByRole("radio", { name: "4 out of 5" }).check();
  await item.getByLabel(/^Note/).fill("Great bun, a bit salty");
  await rec.shot("Devour it: rate it and add a note", 1.8);
  await item.getByRole("button", { name: "Log it" }).click();
  await page.getByTestId("devoured").first().waitFor();
  await rec.shot("It moves over, and the stats update", 2.2);
}

// 1. The core loop.
{
  const page = await newPage();
  const rec = recorder(page);
  await lifecycle(page, rec);
  rec.save("log-and-devour");
  await page.context().close();
}

// 2. Same loop with JavaScript off: plain forms and redirects.
{
  const page = await newPage({ javaScriptEnabled: false });
  const rec = recorder(page);
  await lifecycle(page, rec, " (JavaScript off)");
  rec.save("no-javascript");
  await page.context().close();
}

// 3. An AI agent logs a burger over MCP; the page shows it.
{
  const page = await newPage();
  const rec = recorder(page);
  await page.goto(BASE);
  const mcpUrl = await page.evaluate(() => document.querySelector("[data-testid=mcp-url]").value);

  const call = async (id, name, args) => {
    const request = { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } };
    const response = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(request),
    });
    return { request, response: await response.json() };
  };

  await rec.shot("Your journal, before the agent", 1.8);
  const added = await call(1, "add_burger", { name: "Agent special", place: "MCP Grill" });
  const burger = JSON.parse(added.response.result.content[0].text);
  const devoured = await call(2, "devour_burger", {
    id: burger.id,
    rating: 5,
    note: "Logged by an agent",
  });

  const terminal = (
    title,
    call,
  ) => `<body style="margin:0;background:#1b120c;color:#f6eadb;font:15px/1.5 ui-monospace,monospace;padding:28px">
    <p style="color:#f0a05a;font:600 17px system-ui">${title}</p>
    <p style="color:#c3b09c">POST /mcp/&lt;your private key&gt;</p>
    <pre style="white-space:pre-wrap;word-break:break-all;margin:0 0 18px">${JSON.stringify(call.request.params, null, 2)}</pre>
    <p style="color:#c3b09c">→ result</p>
    <pre style="white-space:pre-wrap;word-break:break-all;margin:0">${JSON.stringify(JSON.parse(call.response.result.content[0].text), null, 2)}</pre></body>`;

  await page.setContent(terminal("1. The agent calls add_burger", added));
  await rec.shot("Agent → MCP tool call", 2.6);
  await page.setContent(terminal("2. Then devour_burger", devoured));
  await rec.shot("Agent → MCP tool call", 2.6);
  await page.goto(BASE);
  await rec.shot("The same journal, in the browser", 2.4);
  rec.save("agent-mcp");
  await page.context().close();
}

await browser.close();
stop();
