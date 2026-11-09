import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import assembly from "../assembly.lock.json";
import { object, root } from "./inputs";

export type BindingProfile = "development" | "production";

export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function outputDirectory(parts: string[]): string {
  let directory = root;
  for (const part of parts) {
    directory = join(directory, part);
    if (!existsSync(directory)) mkdirSync(directory);
    if (!lstatSync(directory).isDirectory())
      throw new Error("Generated output directory must not be redirected");
  }
  return directory;
}

function regularOrMissing(path: string) {
  try {
    if (!lstatSync(path).isFile()) throw new Error("Generated output file must be regular");
  } catch (error) {
    if (!object(error) || error.code !== "ENOENT") throw error;
  }
}

function bytes(path: string): Buffer {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size === 0 || stat.size > 1024 * 1024)
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

export function bindingProfile(input: BindingInputs): BindingProfile {
  return input.rust_profile === "release" ? "production" : "development";
}

export function readBindingContract(input: BindingInputs, directory?: string): Buffer {
  const location = directory ?? join(root, "bindings", bindingProfile(input));
  if (!existsSync(join(location, "receipt.json")))
    throw new Error(
      "Missing compiled binding contract; generate source inputs on an execution host",
    );
  const receipt: unknown = JSON.parse(bytes(join(location, "receipt.json")).toString("utf8"));
  const provenance: unknown = JSON.parse(
    bytes(join(root, "bindings/provenance.json")).toString("utf8"),
  );
  const declaration = bytes(join(location, "nds_native.d.ts"));
  if (
    !object(provenance) ||
    provenance.schema_version !== 1 ||
    provenance.kind !== "generated-rust-wasm-source-inputs" ||
    !positiveInteger(provenance.repository_id) ||
    !positiveInteger(provenance.workflow_run_id) ||
    !positiveInteger(provenance.artifact_id) ||
    typeof provenance.repository !== "string" ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(provenance.repository) ||
    typeof provenance.archive_sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(provenance.archive_sha256) ||
    !object(receipt) ||
    receipt.schema_version !== 1 ||
    receipt.kind !== "generated-rust-wasm-declarations" ||
    !isDeepStrictEqual(receipt.inputs, input) ||
    receipt.declaration_bytes !== declaration.length ||
    receipt.declaration_sha256 !== sha256(declaration) ||
    receipt.producer_repository !== provenance.repository ||
    receipt.producer_source_commit !== provenance.source_commit ||
    receipt.producer_run_id !== String(provenance.workflow_run_id) ||
    typeof receipt.compiler_rust !== "string" ||
    !receipt.compiler_rust.startsWith(`rustc ${input.rust_channel} `) ||
    typeof receipt.producer_source_commit !== "string" ||
    !/^[a-f0-9]{40}$/.test(receipt.producer_source_commit) ||
    (receipt.producer_repository !== null &&
      (typeof receipt.producer_repository !== "string" ||
        !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(receipt.producer_repository))) ||
    (receipt.producer_run_id !== null &&
      (typeof receipt.producer_run_id !== "string" ||
        !/^[1-9][0-9]{0,19}$/.test(receipt.producer_run_id)))
  )
    throw new Error("Compiled binding contract differs from its exact source, profile or bytes");
  return declaration;
}

export function checkCompiledBindings(input: BindingInputs, declaration: string) {
  if (!readBindingContract(input).equals(bytes(declaration)))
    throw new Error("Actual wasm-bindgen declarations drifted; regenerate the source contract");
}

export function checkSourceBindings(shared: string, prepare: boolean) {
  const production = readBindingContract(bindingInputs(shared, false));
  readBindingContract(bindingInputs(shared, true));
  if (prepare) {
    const directory = outputDirectory(["src", "shared", "api", "generated"]);
    const destination = join(directory, "nds_native.d.ts");
    regularOrMissing(destination);
    const source = join(root, "bindings/production/nds_native.d.ts");
    copyFileSync(source, destination);
    if (!production.equals(bytes(destination)))
      throw new Error("Prepared declaration bytes differ");
  }
  console.log("Both compiled binding profiles match the exact selected Rust inputs");
}

export function captureBindings(
  input: BindingInputs,
  declaration: string,
  source: string,
  compiler: string,
) {
  if (!compiler.startsWith(`rustc ${input.rust_channel} `))
    throw new Error("Binding compiler differs from the selected toolchain");
  const profile = bindingProfile(input);
  const content = bytes(declaration);
  const destination = outputDirectory([".build", "source-bindings", profile]);
  const license = resolve(root, ".build/source-bindings/LICENSE");
  regularOrMissing(license);
  regularOrMissing(join(destination, "nds_native.d.ts"));
  regularOrMissing(join(destination, "receipt.json"));
  copyFileSync(join(root, "LICENSE"), license);
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
