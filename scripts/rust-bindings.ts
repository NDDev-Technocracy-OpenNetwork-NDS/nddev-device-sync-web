import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import assembly from "../assembly.lock.json";
import { object, root } from "./inputs";

export type BindingProfile = "development" | "production";

export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function bytes(path: string): Buffer {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > 1024 * 1024)
    throw new Error("Binding input must be a bounded regular file");
  return readFileSync(path);
}

export function bindingInputs(shared: string, development: boolean) {
  const toolchainBytes = bytes(join(root, "rust-toolchain.toml"));
  const toolchain: unknown = Bun.TOML.parse(toolchainBytes.toString("utf8"));
  if (
    !object(toolchain) ||
    !object(toolchain.toolchain) ||
    typeof toolchain.toolchain.channel !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(toolchain.toolchain.channel)
  )
    throw new Error("Bindings require the exact selected Rust toolchain");
  const lockBytes = bytes(join(shared, "packages/nds_native/rust/Cargo.lock"));
  const lock: unknown = Bun.TOML.parse(lockBytes.toString("utf8"));
  if (!object(lock) || !Array.isArray(lock.package)) throw new Error("Invalid Rust lock input");
  const bindgen = lock.package.filter((value) => object(value) && value.name === "wasm-bindgen");
  const selected: unknown = bindgen[0];
  if (bindgen.length !== 1 || !object(selected) || typeof selected.version !== "string")
    throw new Error("Bindings require one locked wasm-bindgen family");
  return {
    schema_version: 1,
    shared_repository: assembly.shared.repository,
    shared_source_commit: assembly.shared.commit,
    assembly_lock_sha256: sha256(bytes(join(root, "assembly.lock.json"))),
    rust_toolchain_sha256: sha256(toolchainBytes),
    rust_lock_sha256: sha256(lockBytes),
    rust_channel: toolchain.toolchain.channel,
    wasm_bindgen: selected.version,
    rust_target: "wasm32-unknown-unknown",
    rust_profile: development ? "debug" : "release",
    default_features: false,
    features: development ? ["browser-bindings", "development-http"] : ["browser-bindings"],
  };
}

export type BindingInputs = ReturnType<typeof bindingInputs>;

export function captureBindings(
  input: BindingInputs,
  declaration: string,
  source: string,
  compiler: string,
) {
  if (!compiler.startsWith(`rustc ${input.rust_channel} `))
    throw new Error("Binding compiler differs from the selected toolchain");
  const profile: BindingProfile = input.rust_profile === "release" ? "production" : "development";
  const content = bytes(declaration);
  const destination = resolve(root, ".build/source-bindings", profile);
  mkdirSync(destination, { recursive: true });
  writeFileSync(join(destination, "nds_native.d.ts"), content);
  writeFileSync(
    join(destination, "receipt.json"),
    `${JSON.stringify(
      {
        schema_version: 1,
        kind: "generated-rust-wasm-declarations",
        inputs: input,
        declaration_sha256: sha256(content),
        declaration_bytes: content.length,
        compiler_rust: compiler,
        producer_source_commit: source === "unknown" ? null : source,
        producer_repository: process.env.GITHUB_REPOSITORY ?? null,
        producer_run_id: process.env.GITHUB_RUN_ID ?? null,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Captured actual ${profile} WASM declarations (${content.length} bytes)`);
}
