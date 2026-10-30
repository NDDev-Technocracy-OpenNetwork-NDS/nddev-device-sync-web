// Real React + generated WASM against the explicitly owned PG/SMTP fixture.
// No request mocks grant authority; the one fault drops an already accepted ACK.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { type Browser, chromium, type Page } from "playwright";
import { object } from "./inputs";

function loopback(value: unknown): string {
  assert.equal(typeof value, "string");
  const url = new URL(value as string);
  assert.equal(url.protocol, "http:");
  assert.ok(url.hostname === "127.0.0.1" || url.hostname === "localhost");
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  assert.equal(url.pathname, "/");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  return url.origin;
}
async function json(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  const bytes = await response.text();
  assert.ok(bytes.length <= 65536);
  const value: unknown = JSON.parse(bytes);
  assert.ok(object(value));
  return value;
}
async function until<T>(work: () => Promise<T | false>, seconds = 20): Promise<T> {
  const deadline = performance.now() + seconds * 1000;
  do {
    const value = await work();
    if (value !== false) return value;
    await delay(25);
  } while (performance.now() < deadline);
  throw new Error("owned browser acceptance boundary timed out");
}

test("real organizations preserve the personal Vault and retry the exact lost-ACK command", {
  skip: !process.env.NDS_FIXTURE_RECEIPT,
  timeout: 240000,
}, async () => {
  const file = process.env.NDS_FIXTURE_RECEIPT;
  assert.ok(file);
  const fixture: unknown = JSON.parse(readFileSync(file, "utf8"));
  assert.ok(object(fixture));
  assert.equal(fixture.status, "running");
  assert.ok(
    typeof fixture.expires_at_unix === "number" &&
      fixture.expires_at_unix > Date.now() / 1000 + 300,
  );
  const origin = loopback(fixture.base_url),
    mailbox = loopback(fixture.mailpit_url);
  assert.ok(
    typeof fixture.owner_email === "string" && fixture.owner_email.endsWith("@example.invalid"),
  );
  const source = process.env.NDS_EXPECT_SERVER_SOURCE;
  assert.ok(source && /^[a-f0-9]{40}$/.test(source));
  assert.equal((await json(`${origin}/v1/health`)).source_commit, source);
  const prior = await json(`${mailbox}/api/v1/messages`);
  assert.ok(Array.isArray(prior.messages));
  const old = new Set(
    prior.messages.map((row: unknown) => {
      assert.ok(object(row));
      return row.ID;
    }),
  );
  let browser: Browser | undefined;
  let page: Page | undefined;
  const forbidden: string[] = [],
    errors: string[] = [],
    hashes: string[] = [];
  const statuses: { method: string; status: number }[] = [];
  const deadline = setTimeout(() => {
    void browser?.close().catch(() => {});
  }, 230000);
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.NDS_TEST_CHROMIUM ? { executablePath: process.env.NDS_TEST_CHROMIUM } : {}),
    });
    const context = await browser.newContext({ locale: "en-US" });
    page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on("pageerror", (error) => errors.push(error.name));
    page.on("response", (response) => {
      if (new URL(response.url()).pathname.startsWith("/v3/organizations") && statuses.length < 32)
        statuses.push({ method: response.request().method(), status: response.status() });
    });
    await page.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (url.origin !== origin) {
        forbidden.push(url.origin);
        await route.abort();
        return;
      }
      if (url.pathname === "/v3/organizations" && request.method() === "POST") {
        const body = request.postDataBuffer();
        assert.ok(body);
        hashes.push(createHash("sha256").update(body).digest("hex"));
        if (hashes.length === 1) {
          const accepted = await route.fetch({ timeout: 15000 });
          try {
            assert.ok(accepted.status() === 200 || accepted.status() === 201);
          } finally {
            await accepted.dispose();
          }
          await route.abort("failed"); // Actual effect committed; caller learns no ACK.
          return;
        }
      }
      await route.continue();
    });
    await page.goto(origin);
    await page.bringToFront();
    await page.locator("#signin-email").fill(fixture.owner_email);
    await page.getByRole("button", { name: "Send sign-in code", exact: true }).click();
    const code = await until(async () => {
      const list = await json(`${mailbox}/api/v1/messages`);
      assert.ok(Array.isArray(list.messages));
      for (const row of list.messages) {
        assert.ok(object(row));
        if (old.has(row.ID)) continue;
        assert.equal(typeof row.ID, "string");
        const message = await json(`${mailbox}/api/v1/message/${row.ID}`);
        if (
          !Array.isArray(message.To) ||
          !message.To.some((to: unknown) => object(to) && to.Address === fixture.owner_email)
        )
          continue;
        const text = message.Text;
        if (typeof text !== "string") continue;
        const found = /\b[0-9]{8}\b/.exec(text);
        if (found) return found[0];
      }
      return false;
    });
    await page.locator("#signin-code").fill(code);
    await page.getByRole("button", { name: "Verify code", exact: true }).click();
    await page.getByRole("link", { name: "Organizations", exact: true }).waitFor();
    const principal = await page.locator("dl dd").first().innerText();
    assert.ok(principal);
    const marker = `multispace-witness-${randomUUID()}`;
    await page.getByRole("link", { name: "Vault and sync", exact: true }).click();
    await page.locator("#record-title").fill(marker);
    await page.locator("#record-username").fill("original-personal-owner");
    await page.locator("#record-secret").fill(`synthetic-${randomUUID()}`);
    await page.getByRole("button", { name: "Encrypt and queue for sync", exact: true }).click();
    await page.locator(".record strong").filter({ hasText: marker }).waitFor();

    await page.getByRole("link", { name: "Organizations", exact: true }).click();
    const selector = page.locator("#organization-space");
    await until(
      async () => (await selector.isEnabled()) && (await selector.locator("option").count()) === 2,
    );
    assert.equal(await selector.inputValue(), "");
    const original = await selector.locator("option").nth(1).getAttribute("value");
    assert.ok(original);
    const label = await selector.locator("option").nth(1).innerText();
    const name = label.split(" · ")[0];
    assert.ok(name);
    await page.locator("#organization-name").fill(name);
    await page.getByRole("button", { name: "Create organization", exact: true }).click();
    const retry = page.getByRole("button", { name: "Retry the same command", exact: true });
    await until(async () => await retry.isEnabled());
    assert.equal(hashes.length, 1);
    assert.equal(await selector.isEnabled(), false);
    await retry.click();
    await until(
      async () => (await selector.isEnabled()) && (await selector.locator("option").count()) === 3,
    );
    assert.equal(hashes.length, 2);
    assert.equal(hashes[0], hashes[1]);
    const ids = await selector
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
      );
    assert.equal(new Set(ids).size, 2);
    const second = ids.find((id) => id !== original);
    assert.ok(second);
    for (const id of [original, second, "", original]) {
      await selector.selectOption(id);
      await until(async () => (await selector.isEnabled()) && (await selector.inputValue()) === id);
    }
    await page.getByRole("link", { name: "Vault and sync", exact: true }).click();
    await page.locator(".record strong").filter({ hasText: marker }).waitFor();
    await page.getByRole("link", { name: "NDS session", exact: true }).click();
    assert.equal(await page.locator("dl dd").first().innerText(), principal);
    assert.deepEqual(forbidden, []);
    assert.deepEqual(errors, []);
    await context.close();
  } catch (error) {
    if (page && !page.isClosed()) {
      console.error(
        JSON.stringify({
          phase: "bounded organization UI diagnostic",
          focus: await page.evaluate(() => ({
            focused: document.hasFocus(),
            visibility: document.visibilityState,
          })),
          selectorEnabled: await page
            .locator("#organization-space")
            .isEnabled()
            .catch(() => false),
          options: await page.locator("#organization-space option").count(),
          alerts: (await page.getByRole("alert").allTextContents())
            .slice(0, 3)
            .map((text) => text.slice(0, 160)),
          statuses,
          errors,
        }),
      );
    }
    throw error;
  } finally {
    clearTimeout(deadline);
    await browser?.close();
  }
});
