import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import assembly from "../assembly.lock.json";
import type { Asset } from "./assets";
import { object, root, run, sources } from "./inputs";

const development = process.argv.includes("--development-http");
if (process.argv.slice(2).some((arg) => arg !== "--development-http"))
  throw new Error("Unknown build option");
const assemblyDirty = Boolean(run("git", ["status", "--porcelain"]));
if (assemblyDirty && !development) throw new Error("Production assembly must be committed");
const source = assemblyDirty ? "unknown" : run("git", ["rev-parse", "HEAD"]);
const { shared, designCommit } = sources();
run("bun", ["run", "check:worker"]);
run("bun", ["run", "scripts/generate-presentation.ts"]);
const rust = resolve(shared, "packages/nds_native/rust");
const prepare = resolve(shared, "packages/nds_native/tool/prepare_native.py");
const target = process.env.CARGO_TARGET_DIR ?? resolve(root, ".nds-cache/rust");
const environment = { CARGO_TARGET_DIR: target, NDS_SOURCE_COMMIT: assembly.shared.commit };
const cargo = (args: string[]) =>
  run("python3", [prepare, "--", "cargo", ...args], rust, environment);
const metadata: unknown = JSON.parse(cargo(["metadata", "--locked", "--format-version", "1"]));
if (!object(metadata) || !Array.isArray(metadata.packages))
  throw new Error("Invalid Cargo metadata");
const packages: unknown[] = metadata.packages;
function packageMetadata(name: string) {
  const selected = packages.filter((item) => object(item) && item.name === name);
  const item = selected[0];
  if (
    selected.length !== 1 ||
    !object(item) ||
    typeof item.version !== "string" ||
    typeof item.manifest_path !== "string"
  )
    throw new Error(`Expected one ${name} package`);
  return { version: item.version, path: dirname(item.manifest_path) };
}
for (const name of [
  "nddev-device-sync-domain",
  "nddev-device-sync-application",
  "nddev-device-sync-accounts",
  "nddev-device-sync-vault",
  "nddev-device-sync-telemetry",
])
  packageMetadata(name);
const bindgen = packageMetadata("wasm-bindgen").version;
if (run("wasm-bindgen", ["--version"]) !== `wasm-bindgen ${bindgen}`)
  throw new Error("wasm-bindgen CLI differs from Cargo.lock");
cargo([
  "build",
  "--locked",
  "--lib",
  "--target",
  "wasm32-unknown-unknown",
  "--jobs",
  "4",
  "--no-default-features",
  "--features",
  `browser-bindings${development ? ",development-http" : ""}`,
  ...(development ? [] : ["--release"]),
]);
const pkg = resolve(root, "public/pkg");
rmSync(pkg, { recursive: true, force: true });
run("wasm-bindgen", [
  "--target",
  "web",
  "--out-dir",
  pkg,
  "--out-name",
  "nds_native",
  resolve(target, "wasm32-unknown-unknown", development ? "debug" : "release", "nds_native.wasm"),
]);
mkdirSync(resolve(root, "src/shared/api/generated"), { recursive: true });
copyFileSync(
  join(pkg, "nds_native.d.ts"),
  resolve(root, "src/shared/api/generated/nds_native.d.ts"),
);
for (const file of readdirSync(pkg)) if (file.endsWith(".d.ts")) rmSync(join(pkg, file));
run("bun", ["run", "build:ui"]);
run("bun", ["run", "typecheck"]);
const output = resolve(root, "build/react");
copyFileSync(
  resolve(packageMetadata("nddev-device-sync-vault").path, "src/browser_worker.js"),
  join(output, "nds-vault-worker.js"),
);
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const provenance = {
  schema_version: 1,
  presentation: "react",
  assembly_source_commit: source,
  shared_source_commit: assembly.shared.commit,
  design_source_commit: designCommit,
  development_http: development,
  rust_target: "wasm32-unknown-unknown",
  rust: run("rustc", ["--version"], rust),
  wasm_bindgen: bindgen,
  bun: Bun.version,
  bun_lock_sha256: digest(readFileSync(join(root, "bun.lock"))),
  assembly_lock_sha256: digest(readFileSync(join(root, "assembly.lock.json"))),
  rust_lock_sha256: digest(readFileSync(join(rust, "Cargo.lock"))),
};
writeFileSync(join(output, "nds-build.json"), `${JSON.stringify(provenance, null, 2)}\n`);
function inventory(directory: string, prefix = ""): Asset[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = prefix + entry.name;
      if (entry.isSymbolicLink()) throw new Error("Artifact symlink");
      if (entry.isDirectory()) return inventory(join(directory, entry.name), `${path}/`);
      if (!entry.isFile() || ["nds-assets.json", "nds-offline.js"].includes(path)) return [];
      const bytes = readFileSync(join(directory, entry.name));
      if (bytes.length > 64 * 1024 * 1024) throw new Error("Asset exceeds server bound");
      return [{ path, sha256: digest(bytes), bytes: bytes.length }];
    })
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}
const assets = inventory(output);
if (
  assets.length > 4094 ||
  assets.reduce((total, asset) => total + asset.bytes, 0) > 126 * 1024 * 1024
)
  throw new Error("Artifact exceeds server bound");
// Both presentations use the same TypeScript-owned app-shell projection.
const worker = readFileSync(join(root, "scripts/offline-worker.js"), "utf8");
const build = digest(`${JSON.stringify(assets)}\0${worker}`);
const workerBytes = `const BUILD=${JSON.stringify(build)};\nconst ASSETS=${JSON.stringify(assets)};\n${worker}`;
writeFileSync(join(output, "nds-offline.js"), workerBytes);
assets.push({
  path: "nds-offline.js",
  sha256: digest(workerBytes),
  bytes: Buffer.byteLength(workerBytes),
});
writeFileSync(
  join(output, "nds-assets.json"),
  `${JSON.stringify({ schema_version: 1, files: assets }, null, 2)}\n`,
);
if (!development && run("git", ["status", "--porcelain"])) {
  throw new Error("Generated source drifted during the production build");
}
console.log(
  JSON.stringify({
    build,
    assets: assets.length,
    source,
    shared: assembly.shared.commit,
    development,
  }),
);
