// Execution host only: exercise actual compiler-produced source inputs, never a fake ABI.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { object, root, sources } from "./inputs";
import { bindingInputs, checkCompiledBindings, readBindingContract } from "./rust-bindings";

const { shared } = sources({ prepare: false });
const production = bindingInputs(shared, false);
const development = bindingInputs(shared, true);
const original = readBindingContract(production);
readBindingContract(development);
const directory = mkdtempSync(join(tmpdir(), "nds-binding-inputs-"));
const canonical = join(root, "bindings/production");
const receiptBefore = readFileSync(join(canonical, "receipt.json"));
try {
  copyFileSync(join(canonical, "nds_native.d.ts"), join(directory, "nds_native.d.ts"));
  copyFileSync(join(canonical, "receipt.json"), join(directory, "receipt.json"));
  assert.ok(readBindingContract(production, directory).equals(original));
  assert.throws(() => readBindingContract(development, directory), /Compiled binding contract/);
  assert.throws(
    () => readBindingContract({ ...production, shared_source_commit: "0".repeat(40) }, directory),
    /Compiled binding contract/,
  );
  const damaged = Buffer.from(original);
  damaged[0] = (damaged[0] ?? 0) ^ 1;
  writeFileSync(join(directory, "nds_native.d.ts"), damaged);
  assert.throws(() => readBindingContract(production, directory), /Compiled binding contract/);
  assert.throws(
    () => checkCompiledBindings(production, join(directory, "nds_native.d.ts")),
    /Actual wasm-bindgen declarations drifted/,
  );
  writeFileSync(join(directory, "nds_native.d.ts"), original);
  const receipt = JSON.parse(receiptBefore.toString("utf8"));
  receipt.producer_source_commit = "0".repeat(40);
  writeFileSync(join(directory, "receipt.json"), JSON.stringify(receipt));
  assert.throws(() => readBindingContract(production, directory), /Compiled binding contract/);
  assert.ok(readFileSync(join(canonical, "nds_native.d.ts")).equals(original));
  assert.ok(readFileSync(join(canonical, "receipt.json")).equals(receiptBefore));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
const mark = join(root, "public/nddev-mark.svg");
const originalMark = readFileSync(mark);
const damagedMark = Buffer.from(originalMark);
damagedMark[0] = (damagedMark[0] ?? 0) ^ 1;
try {
  writeFileSync(mark, damagedMark);
  assert.throws(
    () =>
      execFileSync("bun", ["run", "scripts/generate-presentation.ts", "--check"], {
        cwd: root,
        stdio: "pipe",
        timeout: 30_000,
      }),
    (error: unknown) =>
      object(error) &&
      Buffer.isBuffer(error.stderr) &&
      error.stderr.toString().includes("Canonical presentation asset drift: public/nddev-mark.svg"),
  );
  assert.ok(readFileSync(mark).equals(damagedMark), "check must not repair its input");
} finally {
  writeFileSync(mark, originalMark);
}
assert.ok(readFileSync(mark).equals(originalMark));
console.log(
  "Actual inputs: source/profile/provenance/payload refusal, compiler drift and read-only assets passed",
);
