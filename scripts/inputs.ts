import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import inputs from "../assembly.lock.json";

export const root = resolve(import.meta.dirname, "..");
export function run(
  command: string,
  args: string[],
  cwd = root,
  environment: NodeJS.ProcessEnv = {},
): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 1_800_000,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      ...(command === "git"
        ? {
            GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
            GIT_CONFIG_NOSYSTEM: "1",
          }
        : {}),
      ...environment,
    },
  }).trim();
}
export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function readObject(path: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!object(value)) throw new Error(`Expected JSON object: ${path}`);
  return value;
}
function checkout(repository: string, commit: string, override?: string): string {
  if (
    !/^NDDev-Technocracy-OpenNetwork-NDS\/[a-z0-9-]+$/.test(repository) ||
    !/^[a-f0-9]{40}$/.test(commit)
  ) {
    throw new Error("Invalid pinned source");
  }
  const path = override
    ? resolve(override)
    : resolve(root, ".nds-cache", repository.split("/")[1] ?? "", commit);
  if (!existsSync(resolve(path, ".git"))) {
    if (override || existsSync(path))
      throw new Error("Source directory is not an owned Git checkout");
    mkdirSync(path, { recursive: true });
    run("git", ["init", "--quiet"], path);
    run("git", ["remote", "add", "origin", `https://github.com/${repository}.git`], path);
    run("git", ["fetch", "--depth", "1", "origin", commit], path);
    run("git", ["checkout", "--detach", commit], path);
  }
  if (
    run("git", ["rev-parse", "HEAD"], path) !== commit ||
    run("git", ["status", "--porcelain"], path)
  ) {
    throw new Error("Pinned source is dirty or at a different commit");
  }
  return path;
}
export function sources(): { shared: string; design: string; designCommit: string } {
  const shared = checkout(
    inputs.shared.repository,
    inputs.shared.commit,
    process.env.NDS_SHARED_SOURCE,
  );
  const provenance = readObject(resolve(shared, "generated/launcher-provenance.json"));
  const source = provenance.source;
  if (!object(source) || typeof source.commit !== "string")
    throw new Error("Missing canonical design input");
  const design = checkout(
    "NDDev-Technocracy-OpenNetwork-NDS/nddev-opennetwork-design-system",
    source.commit,
    process.env.NDS_DESIGN_SOURCE,
  );
  return { shared, design, designCommit: source.commit };
}
