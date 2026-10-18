import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { root } from "./inputs";

const result = await Bun.build({
  entrypoints: [resolve(root, "scripts/offline-worker.ts")],
  target: "browser",
  format: "iife",
  minify: false,
});
const output = result.outputs[0];
if (!result.success || result.outputs.length !== 1 || !output)
  throw new Error("Worker compilation failed");
const content = `// Generated from offline-worker.ts by the pinned Bun compiler. Do not edit.\n${await output.text()}`;
const path = resolve(root, "scripts/offline-worker.js");
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== content) throw new Error("App-shell worker projection drift");
} else writeFileSync(path, content);
