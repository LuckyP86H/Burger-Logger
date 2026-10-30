import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

/** The Worker under test, optionally with extra bindings (e.g. a fake model). */
const worker = (bindings: Record<string, string> = {}) =>
  cloudflareTest(async () => ({
    wrangler: { configPath: "./wrangler.jsonc" },
    // TEST_MIGRATIONS is a test-only binding so the setup file can create the schema.
    miniflare: {
      bindings: { TEST_MIGRATIONS: await readD1Migrations("./migrations"), ...bindings },
    },
  }));

const setupFiles = ["./test/apply-migrations.ts"];

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [worker()],
        test: {
          name: "app",
          include: ["test/**/*.test.ts"],
          exclude: ["test/with-model.test.ts"],
          setupFiles,
        },
      },
      {
        plugins: [worker({ AI_PROVIDER: "fake" })],
        test: { name: "with-model", include: ["test/with-model.test.ts"], setupFiles },
      },
    ],
  },
});
