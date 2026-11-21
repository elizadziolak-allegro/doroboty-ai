import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
const outfile = path.resolve("artifacts/functions/screening.mjs");
await build({
  entryPoints: ["netlify/functions/screening.ts"],
  outfile,
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
const handler = await import(pathToFileURL(outfile).href);
const response = await handler.default(new Request("https://local-build.invalid/api/health"), {
  site: {},
});
assert.equal(response.status, 200);
assert.equal((await response.json()).configured, false);
assert.equal(handler.config.rateLimit.windowLimit, 12);
console.log("Function bundled and disabled health verified locally; not a Netlify deployment.");
