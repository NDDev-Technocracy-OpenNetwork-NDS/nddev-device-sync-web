import type { StateView } from "@nds/runtime";
import { useState } from "react";
import { errorMessage } from "@/shared/api/errors";
import { useRuntime } from "@/shared/api/runtime";
import { useReplicaPage } from "@/shared/api/use-replica-page";
import { useText } from "@/shared/i18n";
import { formatTimestamp } from "@/shared/i18n/timestamp";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export function StatesPage() {
  const { client, busy } = useRuntime();
  const { t, locale } = useText();
  const [after, setAfter] = useState("");
  const { read, command, reload } = useReplicaPage("states", after, (client, cursor) =>
    client.sync_states(cursor),
  );
  const vault = read.data?.vault;
  const page = read.data?.page;
  const date = (value: bigint) => (value === 0n ? t("notChecked") : formatTimestamp(value, locale));
  function label(item: StateView) {
    if (item.kind !== "account_state") return item.label;
    if (item.label === "email_otp") return t("emailMethod");
    if (item.label === "passkey") return t("passkeyMethod");
    return item.label === "github" ? "GitHub" : item.label;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("syncedState")}</h2>
        </CardTitle>
        <CardDescription>{t("stateHelp")}</CardDescription>
      </CardHeader>
      <CardContent className="stack">
        <div className="actions">
          <Button
            disabled={busy}
            onClick={() => {
              void command(() => client.publish_device_state()).then(reload);
            }}
          >
            {t("publishDeviceState")}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void reload()}>
            {t("moduleRefresh")}
          </Button>
        </div>
        {read.isPending || read.data?.busy ? <p role="status">{t("working")}</p> : null}
        {read.isError ? (
          <p role="alert">{t(errorMessage(read.error))}</p>
        ) : vault?.unlocked === false ? (
          <p role="alert">{t("vaultLocked")}</p>
        ) : (
          <>
            {vault?.sync_error && (
              <p role="alert">{t(errorMessage(new Error(vault.sync_error)))}</p>
            )}
            {page?.items.length === 0 && <p>{t("noRecords")}</p>}
            {page?.items.map((item) => (
              <section className="record stack" key={item.id}>
                <h3>
                  {item.kind === "device_state"
                    ? t("stateDevices")
                    : item.kind === "module_state"
                      ? t("module")
                      : t("sessionTitle")}
                </h3>
                <strong>{label(item)}</strong>
                {item.platform && <p>{item.platform}</p>}
                {item.version && <p>{item.version}</p>}
                <dl>
                  <dt>{t("stateDevice")}</dt>
                  <dd>{item.device_id}</dd>
                  <dt>{t("verified")}</dt>
                  <dd>{date(item.observed_at_ms)}</dd>
                  {item.checked_at_ms !== 0n && (
                    <>
                      <dt>{t("lastRun")}</dt>
                      <dd>{date(item.checked_at_ms)}</dd>
                    </>
                  )}
                  {item.expires_at_ms !== 0n && (
                    <>
                      <dt>{t("expires")}</dt>
                      <dd>{date(item.expires_at_ms)}</dd>
                    </>
                  )}
                </dl>
                {item.kind === "module_state" && (
                  <p>
                    {!item.configured
                      ? t("providerUnavailable")
                      : item.reachability === "reachable"
                        ? t("reachable")
                        : item.reachability === "failed"
                          ? t("providerFailed")
                          : item.reachability === "unavailable"
                            ? t("providerUnavailable")
                            : t("notChecked")}
                  </p>
                )}
                <p>{t("vaultRevision", { revision: item.revision.toString() })}</p>
                {item.pending_id && <p>{t("vaultRecordPending")}</p>}
                {item.conflicted && <p className="notice">{t("vaultConflict")}</p>}
              </section>
            ))}
            <div className="actions">
              {after && (
                <Button variant="outline" disabled={busy} onClick={() => setAfter("")}>
                  {t("vaultFirstPage")}
                </Button>
              )}
              {!read.data?.busy && page?.has_more && (
                <Button variant="outline" disabled={busy} onClick={() => setAfter(page.next_after)}>
                  {t("nextPage")}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
