import {
  new_vault_record_id,
  type RecordPage,
  type RecordView,
  type VaultView,
} from "@nds/runtime";
import { useForm } from "@tanstack/react-form";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { errorMessage } from "@/shared/api/errors";
import { useRuntime } from "@/shared/api/runtime";
import { useText } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type VaultRead = { vault: VaultView; records: RecordPage | null; busy: boolean };
function localBusy(error: unknown): boolean {
  return error instanceof Error && error.message === "vault_busy";
}
export function VaultPage() {
  const { client, scope, busy, run } = useRuntime();
  const { t, locale } = useText();
  const cache = useQueryClient();
  const [after, setAfter] = useState("");
  const [editing, setEditing] = useState<RecordView | null>(null);
  const [draftId, setDraftId] = useState(new_vault_record_id);
  const secret = useRef<HTMLInputElement>(null);
  const key = ["vault", scope, after];
  const options = queryOptions({
    queryKey: key,
    queryFn: async (): Promise<VaultRead> => {
      const previous = cache.getQueryData<VaultRead>(key);
      let metadata: VaultView;
      try {
        metadata = await client.vault_snapshot();
      } catch (error) {
        if (localBusy(error) && previous) return { ...previous, busy: true };
        throw error;
      }
      if (!metadata.unlocked) return { vault: metadata, records: null, busy: false };
      const prior = previous?.vault.key_id === metadata.key_id ? previous.records : null;
      if (
        prior &&
        prior.local_revision === metadata.local_revision &&
        prior.observed_seq === metadata.cursor
      ) {
        return { vault: metadata, records: prior, busy: false };
      }
      // A failed read never marks a revision as loaded. The next visible tick retries it.
      try {
        return { vault: metadata, records: await client.vault_records(after), busy: false };
      } catch (error) {
        if (localBusy(error)) return { vault: metadata, records: prior ?? null, busy: true };
        throw error;
      }
    },
  });
  const read = useQuery({ ...options, enabled: !busy, refetchInterval: 1000 });
  const vault = read.data?.vault;
  const records = read.data?.records;
  const unlocked = !read.isError && vault?.unlocked === true;
  async function reload() {
    await cache.invalidateQueries({ queryKey: ["vault", scope] });
  }
  function command(action: () => Promise<unknown>) {
    return run(async () => {
      // Settle the one presentation read before mutation; Rust checks fresh authority itself.
      await cache.fetchQuery(options).catch(() => undefined);
      await action();
    });
  }
  const form = useForm({
    defaultValues: { title: "", username: "" },
    onSubmit: async ({ value }) => {
      const accepted = await command(async () => {
        const input = secret.current;
        if (!input) throw new Error("cancelled");
        // The secret is passed straight to Rust, never into Form/Query state.
        const pending = client.vault_save(
          editing?.id ?? draftId,
          editing?.revision ?? 0n,
          editing?.pending_id ?? null,
          value.title.trim(),
          value.username.trim(),
          input.value,
        );
        try {
          await pending;
          input.value = "";
        } finally {
          if (!input.isConnected) input.value = "";
        }
      });
      if (accepted) {
        setEditing(null);
        setDraftId(new_vault_record_id());
        form.reset();
      }
      await reload();
    },
  });
  function reset() {
    if (secret.current) secret.current.value = "";
    setEditing(null);
    setDraftId(new_vault_record_id());
    form.reset();
  }
  function act(action: () => Promise<unknown>) {
    void command(action).then(reload);
  }
  function syncTime(value: bigint): string {
    const millis = Number(value * 1000n);
    const date = new Date(millis);
    return Number.isSafeInteger(millis) && Number.isFinite(date.getTime())
      ? date.toLocaleString(locale)
      : value.toString();
  }
  return (
    <div className="stack">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("vaultTitle")}</h2>
          </CardTitle>
          <CardDescription>{t("browserVaultHelp")}</CardDescription>
        </CardHeader>
        <CardContent className="stack">
          {read.isError ? (
            <p role="alert">{t(errorMessage(read.error))}</p>
          ) : (
            <p>{unlocked ? t("vaultUnlocked") : t("vaultLocked")}</p>
          )}
          {vault && (
            <>
              <p>{t("vaultCounts", { pending: vault.pending, conflicts: vault.conflicts })}</p>
              <p>
                {vault.catching_up
                  ? t("syncCatchingUp")
                  : vault.last_sync_at === 0n
                    ? t("syncNotObserved")
                    : t("syncLastSeen", { time: syncTime(vault.last_sync_at) })}
              </p>
              {vault.browser_persistent !== null && (
                <p className="notice">
                  {vault.browser_persistent
                    ? t("browserStoragePersistent")
                    : t("browserStorageEvictable")}
                </p>
              )}
              {vault.sync_error && (
                <p role="alert">{t(errorMessage(new Error(vault.sync_error)))}</p>
              )}
            </>
          )}
          <Button disabled={busy} onClick={() => act(() => client.vault_sync())}>
            {t("vaultSync")}
          </Button>
        </CardContent>
      </Card>
      {unlocked && (
        <div className="page-grid">
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>{editing ? t("vaultEditing", { title: editing.title }) : t("vaultSave")}</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="fields"
                key={draftId}
                onSubmit={(event) => {
                  event.preventDefault();
                  void form.handleSubmit();
                }}
              >
                <form.Field name="title">
                  {(field) => (
                    <div className="field">
                      <Label htmlFor="record-title">{t("vaultRecordTitle")}</Label>
                      <Input
                        id="record-title"
                        required
                        disabled={busy}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name="username">
                  {(field) => (
                    <div className="field">
                      <Label htmlFor="record-username">{t("vaultUsername")}</Label>
                      <Input
                        id="record-username"
                        maxLength={254}
                        disabled={busy}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </div>
                  )}
                </form.Field>
                <Label htmlFor="record-secret">{t("vaultSecret")}</Label>
                <Input
                  id="record-secret"
                  ref={secret}
                  type="password"
                  autoComplete="new-password"
                  disabled={busy}
                />
                <div className="actions">
                  <Button type="submit" disabled={busy}>
                    {t("vaultSave")}
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={reset}>
                    {t("actionCancel")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>{t("vaultTitle")}</h3>
              </CardTitle>
            </CardHeader>
            <CardContent className="stack">
              {read.data?.busy && <p role="status">{t("operationBusy")}</p>}
              {records?.items.map((record) => (
                <div className="record stack" key={record.id}>
                  <strong>{record.title}</strong>
                  <p>{record.username}</p>
                  <p>{t("vaultRevision", { revision: record.revision.toString() })}</p>
                  {record.pending_id && <p>{t("vaultRecordPending")}</p>}
                  {record.deleted && <p>{t("vaultDeleted")}</p>}
                  {record.conflicted && <p className="notice">{t("vaultConflict")}</p>}
                  {record.conflict && (
                    <p>
                      {record.conflict.deleted
                        ? t("vaultConflictingDelete")
                        : t("vaultConflictingTitle", { title: record.conflict.title })}
                    </p>
                  )}
                  <div className="actions">
                    {!record.deleted && !record.conflicted && (
                      <>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            if (secret.current) secret.current.value = "";
                            setEditing(record);
                            setDraftId(new_vault_record_id());
                            form.reset({ title: record.title, username: record.username });
                          }}
                        >
                          {t("vaultEdit")}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            const ticket = client.reserve_clipboard_copy();
                            act(() => client.vault_copy_secret(record.id, ticket));
                          }}
                        >
                          {t("vaultCopySecret")}
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(t("vaultDeleteHelp", { title: record.title })))
                              act(() =>
                                client.vault_delete(record.id, record.revision, record.pending_id),
                              );
                          }}
                        >
                          {t("vaultDelete")}
                        </Button>
                      </>
                    )}
                    {record.conflicted &&
                      [false, true].map((conflict) => (
                        <Button
                          key={String(conflict)}
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            const choice = conflict ? t("vaultUseConflict") : t("vaultKeepServer");
                            if (window.confirm(t("vaultResolveHelp", { choice })))
                              act(() =>
                                client.vault_resolve(
                                  record.id,
                                  record.revision,
                                  record.pending_id,
                                  record.observed_seq,
                                  conflict,
                                ),
                              );
                          }}
                        >
                          {conflict ? t("vaultUseConflict") : t("vaultKeepServer")}
                        </Button>
                      ))}
                  </div>
                </div>
              ))}
              <div className="actions">
                {after && (
                  <Button variant="outline" onClick={() => setAfter("")}>
                    {t("vaultFirstPage")}
                  </Button>
                )}
                {!read.data?.busy && records?.has_more && (
                  <Button variant="outline" onClick={() => setAfter(records?.next_after ?? "")}>
                    {t("vaultNextPage")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
