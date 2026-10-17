import { IntlMessageFormat } from "intl-messageformat";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { en, type MessageArgs, type MessageKey, ru } from "./catalog.gen";

export type Locale = "en" | "ru";
export type SimpleMessageKey = {
  [K in MessageKey]: MessageArgs[K] extends undefined ? K : never;
}[MessageKey];
const messages = { en, ru };
const compiled = new Map<string, IntlMessageFormat>();
export function translate<K extends MessageKey>(
  locale: Locale,
  key: K,
  ...args: MessageArgs[K] extends undefined ? [] : [MessageArgs[K]]
): string {
  const cacheKey = `${locale}:${key}`;
  let message = compiled.get(cacheKey);
  if (!message) {
    message = new IntlMessageFormat(messages[locale][key], locale);
    compiled.set(cacheKey, message);
  }
  const plural = new Set<string>();
  function visit(nodes: ReturnType<IntlMessageFormat["getAst"]>) {
    for (const node of nodes) {
      if ("pluralType" in node) plural.add(node.value);
      if ("options" in node) for (const option of Object.values(node.options)) visit(option.value);
      if ("children" in node) visit(node.children);
    }
  }
  visit(message.getAst());
  const values: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(args[0] ?? {})) {
    if (typeof value === "bigint") {
      if (plural.has(name)) {
        const number = Number(value);
        if (!Number.isSafeInteger(number)) throw new Error("invalid_plural_count");
        values[name] = number;
      } else values[name] = value.toString();
    } else if (typeof value === "string" || typeof value === "number") values[name] = value;
    else throw new Error("invalid_message_argument");
  }
  const result = message.format(values);
  if (typeof result !== "string") throw new Error("invalid_message_format");
  return result;
}
const LocaleContext = createContext<{ locale: Locale; setLocale: (value: Locale) => void } | null>(
  null,
);
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(navigator.language.startsWith("ru") ? "ru" : "en");
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <LocaleContext value={{ locale, setLocale }}>{children}</LocaleContext>;
}
export function useText() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("missing_locale");
  const { locale } = context;
  function t<K extends MessageKey>(
    key: K,
    ...args: MessageArgs[K] extends undefined ? [] : [MessageArgs[K]]
  ) {
    return translate(locale, key, ...args);
  }
  return { ...context, t };
}
