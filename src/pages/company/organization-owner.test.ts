/// <reference types="node" />
// Exercise the production presentation owner. These inert generated-interface
// fixtures are lifetime/order tests, never identity or server-effect evidence.
import assert from "node:assert/strict";
import test from "node:test";
import type { CompanyCommand, Organization, OrganizationOverviewView } from "@nds/runtime";
import { OrganizationOwner } from "./organization-owner";

function gate<T>() {
  let complete!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    complete = resolve;
  });
  let done = false;
  return {
    promise,
    release(value: T) {
      if (!done) {
        done = true;
        complete(value);
      }
    },
  };
}
async function until(ready: () => boolean) {
  for (let n = 0; n < 64; n++) {
    if (ready()) return;
    await Promise.resolve();
  }
  assert.fail("presentation did not reach the held boundary in 64 microtasks");
}
function overview(id: string, role: "Admin" | "User", revision: bigint): OrganizationOverviewView {
  return {
    company_id: id,
    name: "Same name",
    revision: 1n,
    member: { user_id: "original", email: null, role, active: true, revision },
  };
}
class Command implements CompanyCommand {
  calls = 0;
  frees = 0;
  readonly answers = [gate<boolean>(), gate<boolean>()];
  is_current() {
    return true;
  }
  async execute() {
    const answer = this.answers[this.calls++];
    assert.ok(answer, "no third automatic execution");
    if (!(await answer.promise)) throw new Error("request_timeout");
  }
  free() {
    this.frees++;
  }
  [Symbol.dispose]() {
    this.free();
  }
}
class Selected implements Organization {
  current = true;
  closed = 0;
  freed = 0;
  reads = 0;
  adminReads = 0;
  preparations = 0;
  refusal = false;
  held: ReturnType<typeof gate<OrganizationOverviewView>> | null = null;
  constructor(
    readonly view: OrganizationOverviewView,
    readonly command: Command,
  ) {}
  is_current() {
    return this.current;
  }
  async overview() {
    this.reads++;
    if (this.refusal) throw new Error("transport_unavailable");
    return this.held ? this.held.promise : this.view;
  }
  async members() {
    this.adminReads++;
    return { members: [], next_cursor: null };
  }
  async invitations() {
    this.adminReads++;
    return { invitations: [], next_cursor: null };
  }
  async invite() {
    this.preparations++;
    return this.command;
  }
  async revoke(): Promise<never> {
    throw new Error("unexpected revoke");
  }
  async change_member(): Promise<never> {
    throw new Error("unexpected member command");
  }
  close() {
    this.closed++;
    this.current = false;
  }
  free() {
    this.freed++;
  }
  [Symbol.dispose]() {
    this.free();
  }
}
class Fixture {
  authenticated = true;
  collectionCalls = 0;
  readonly command = new Command();
  readonly a = new Selected(overview("a", "Admin", 7n), this.command);
  readonly b = new Selected(overview("b", "User", 19n), this.command);
  readonly selections: [string, bigint][] = [];
  nextA = this.a;
  readonly owner = new OrganizationOwner(
    this,
    JSON.stringify([true, "personal", "original", "device"]),
  );
  snapshot() {
    return {
      authenticated: this.authenticated,
      tenant_id: "personal",
      user_id: "original",
      current_device_id: "device",
    };
  }
  async organizations() {
    this.collectionCalls++;
    return [this.a.view, this.b.view];
  }
  async select_organization(id: string, revision: bigint) {
    this.selections.push([id, revision]);
    return id === "a" ? this.nextA : this.b;
  }
  async create_organization(): Promise<never> {
    throw new Error("unexpected create");
  }
  async start() {
    this.owner.start();
    this.owner.permit(true);
    await until(() => this.owner.snapshot().choices.length === 2 && !this.owner.snapshot().working);
  }
  finish() {
    this.owner.stop();
    this.a.held?.release(this.a.view);
    this.b.held?.release(this.b.view);
    for (const answer of this.command.answers) answer.release(true);
  }
}

test("personal selection captures membership revision and never fetches admin rows for a member", {
  timeout: 5000,
}, async () => {
  const f = new Fixture();
  try {
    await f.start();
    assert.equal(f.selections.length, 0);
    await f.owner.select("a");
    await f.owner.select("b");
    assert.deepEqual(f.selections, [
      ["a", 7n],
      ["b", 19n],
    ]);
    assert.equal(f.owner.snapshot().overview?.member.role, "User");
    assert.equal(f.owner.snapshot().members, null);
    assert.equal(f.b.adminReads, 0);
    assert.equal(f.a.closed, 1);
    await until(() => f.a.freed === 1);
  } finally {
    f.finish();
  }
});

test("an old joined read cannot publish or free its opaque owner before completion", {
  timeout: 5000,
}, async () => {
  const f = new Fixture(),
    replacement = new Fixture();
  let read: Promise<void> | undefined;
  try {
    await f.start();
    await f.owner.select("a");
    f.a.held = gate<OrganizationOverviewView>();
    read = f.owner.refresh();
    await until(() => f.a.reads === 2);
    f.owner.stop();
    await replacement.start();
    await replacement.owner.select("b");
    assert.equal(f.a.freed, 0);
    assert.equal(f.owner.snapshot().overview, null);
    f.a.held.release(f.a.view);
    await read;
    assert.equal(f.a.freed, 1);
    assert.equal(f.owner.snapshot().overview, null);
    assert.equal(replacement.owner.snapshot().selected, "b");
    assert.equal(replacement.b.closed, 0);
  } finally {
    f.finish();
    replacement.finish();
    await read;
  }
});

test("unknown effect keeps one exact command; read failure and refresh never retry it", {
  timeout: 5000,
}, async () => {
  const f = new Fixture();
  let sent: Promise<void> | undefined;
  try {
    await f.start();
    await f.owner.select("a");
    sent = f.owner.submit((organization) =>
      organization.invite("synthetic@example.invalid", "User"),
    );
    await until(() => f.command.calls === 1);
    f.command.answers[0]?.release(false);
    await sent;
    assert.equal(f.owner.snapshot().pending, true);
    assert.equal(f.command.frees, 0);
    await f.owner.select("b");
    assert.equal(f.selections.length, 1);
    await f.owner.refresh();
    assert.equal(f.command.calls, 1);
    assert.equal(f.a.preparations, 1);
    f.a.refusal = true;
    await f.owner.review();
    assert.equal(f.owner.snapshot().pending, true);
    assert.equal(f.command.frees, 0);
    f.a.refusal = false;
    sent = f.owner.retry();
    await until(() => f.command.calls === 2);
    f.command.answers[1]?.release(true);
    await sent;
    assert.equal(f.owner.snapshot().completed, true);
    assert.equal(f.owner.snapshot().pending, false);
    await until(() => f.command.frees === 1);
    assert.equal(f.a.preparations, 1);
  } finally {
    f.finish();
    await sent;
  }
});

test("session loss seals presentation while admitted effect is still joined", {
  timeout: 5000,
}, async () => {
  const f = new Fixture();
  let sent: Promise<void> | undefined;
  try {
    await f.start();
    await f.owner.select("a");
    sent = f.owner.submit((organization) =>
      organization.invite("synthetic@example.invalid", "User"),
    );
    await until(() => f.command.calls === 1);
    f.authenticated = false;
    f.owner.observe();
    assert.equal(f.owner.snapshot().closed, true);
    assert.equal(f.owner.snapshot().overview, null);
    assert.equal(f.a.closed, 1);
    assert.equal(f.a.freed, 0);
    assert.equal(f.command.frees, 0);
    f.command.answers[0]?.release(true);
    await sent;
    assert.equal(f.owner.snapshot().completed, false);
    assert.equal(f.a.freed, 1);
    assert.equal(f.command.frees, 1);
  } finally {
    f.finish();
    await sent;
  }
});

test("an unpolled operation cannot borrow a restarted presentation lifetime", {
  timeout: 5000,
}, async () => {
  const f = new Fixture();
  try {
    f.owner.start();
    f.owner.permit(true);
    f.owner.stop();
    f.owner.start();
    f.owner.permit(true);
    await until(() => f.owner.snapshot().choices.length === 2 && !f.owner.snapshot().working);
    assert.equal(f.collectionCalls, 1);
    assert.equal(f.owner.isCurrent(), true);
  } finally {
    f.finish();
  }
});

test("returning to the same organization cannot reuse an old confirmation or event", {
  timeout: 5000,
}, async () => {
  const f = new Fixture();
  try {
    await f.start();
    await f.owner.select("a");
    const original = f.owner.snapshot().selectionToken;
    await f.owner.select("b");
    f.nextA = new Selected(f.a.view, f.command);
    await f.owner.select("a");
    assert.notEqual(f.owner.snapshot().selectionToken, original);
    assert.equal(f.owner.matchesSelection(original), false);
    let prepared = false;
    await f.owner.submit(async () => {
      prepared = true;
      return f.command;
    }, original);
    await f.owner.create("stale name", original);
    const calls = f.collectionCalls;
    await f.owner.refresh(null, null, original);
    assert.equal(f.collectionCalls, calls);
    assert.equal(prepared, false);
    assert.equal(f.command.calls, 0);
    assert.equal(f.nextA.closed, 0);
  } finally {
    f.finish();
  }
});

test("an old retry or review cannot consume a newer explicit command", {
  timeout: 5000,
}, async () => {
  const f = new Fixture(),
    next = new Command();
  let sent: Promise<void> | undefined;
  try {
    await f.start();
    await f.owner.select("a");
    sent = f.owner.submit(async () => f.command);
    await until(() => f.command.calls === 1);
    f.command.answers[0]?.release(false);
    await sent;
    const old = f.owner.snapshot().commandToken;
    assert.ok(old);
    await f.owner.review(old);
    assert.equal(f.owner.snapshot().pending, false);
    sent = f.owner.submit(async () => next);
    await until(() => next.calls === 1);
    next.answers[0]?.release(false);
    await sent;
    const current = f.owner.snapshot().commandToken;
    assert.ok(current);
    assert.notEqual(current, old);
    await f.owner.retry(old);
    const reads = f.collectionCalls;
    await f.owner.review(old);
    assert.equal(next.calls, 1);
    assert.equal(f.collectionCalls, reads);
    assert.equal(f.owner.snapshot().commandToken, current);
    sent = f.owner.retry(current);
    await until(() => next.calls === 2);
    next.answers[1]?.release(true);
    await sent;
    await until(() => next.frees === 1);
    assert.equal(f.owner.snapshot().completed, true);
  } finally {
    f.finish();
    for (const answer of next.answers) answer.release(true);
    await sent;
  }
});
