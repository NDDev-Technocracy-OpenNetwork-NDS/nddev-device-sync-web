import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { object, readObject, root, sources } from "./inputs";

const arguments_ = process.argv.slice(2);
if (
  arguments_.length > 1 ||
  arguments_.some((value) => !["--check", "--prepare-assets"].includes(value))
)
  throw new Error("Unknown presentation generation option");
const check = arguments_[0] === "--check";
const prepareAssets = arguments_[0] === "--prepare-assets";
const { shared, design } = sources({ prepare: !check });
const en = readObject(resolve(shared, "packages/nds_ui/lib/l10n/app_en.arb"));
const ru = readObject(resolve(shared, "packages/nds_ui/lib/l10n/app_ru.arb"));
const keys = Object.keys(en)
  .filter((key) => !key.startsWith("@"))
  .sort();
if (
  JSON.stringify(keys) !==
  JSON.stringify(
    Object.keys(ru)
      .filter((key) => !key.startsWith("@"))
      .sort(),
  )
) {
  throw new Error("Canonical locale keys differ");
}
function catalog(source: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    keys.map((key) => {
      const value = source[key];
      if (typeof value !== "string") throw new Error(`Invalid message: ${key}`);
      return [key, value];
    }),
  );
}
const argumentsByKey = keys.map((key) => {
  const metadata = en[`@${key}`];
  const placeholders = object(metadata) ? metadata.placeholders : undefined;
  if (placeholders === undefined) return `  ${JSON.stringify(key)}: undefined;`;
  if (!object(placeholders)) throw new Error(`Invalid placeholders: ${key}`);
  const fields = Object.entries(placeholders).map(([name, field]) => {
    if (!object(field) || (field.type !== "int" && field.type !== "String"))
      throw new Error(`Unsupported placeholder: ${key}.${name}`);
    return `${JSON.stringify(name)}: ${field.type === "int" ? "number | bigint" : "string"}`;
  });
  return `  ${JSON.stringify(key)}: { ${fields.join("; ")} };`;
});
const output = resolve(root, "src/shared/i18n/catalog.gen.ts");
const content = `// Generated from the pinned shared en/ru ARB catalog. Do not edit.\nexport const en = ${JSON.stringify(catalog(en), null, 2)} as const;\nexport type MessageKey = keyof typeof en;\nexport const ru = ${JSON.stringify(catalog(ru), null, 2)} satisfies Record<MessageKey, string>;\nexport type MessageArgs = {\n${argumentsByKey.join("\n")}\n};\n`;
if (check || prepareAssets) {
  if (readFileSync(output, "utf8") !== content) throw new Error("Localization projection drift");
} else {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, content);
}
for (const [from, to] of [
  ["tokens/tokens.css", "src/shared/design/tokens.css"],
  ["assets/nddev-mark.svg", "public/nddev-mark.svg"],
  ...["Regular", "Medium", "SemiBold"].map((weight) => [
    `packages/flutter/assets/fonts/IBMPlexSans-${weight}.ttf`,
    `public/fonts/IBMPlexSans-${weight}.ttf`,
  ]),
  ["packages/flutter/assets/fonts/OFL.txt", "public/fonts/OFL.txt"],
]) {
  if (!from || !to) throw new Error("Invalid canonical asset path");
  const output = resolve(root, to);
  if (check) {
    if (!readFileSync(resolve(design, from)).equals(readFileSync(output)))
      throw new Error(`Canonical presentation asset drift: ${to}`);
  } else {
    mkdirSync(dirname(output), { recursive: true });
    copyFileSync(resolve(design, from), output);
  }
}
console.log(
  `${check ? "Checked" : "Prepared"} ${keys.length} messages and canonical OpenNetwork assets`,
);
