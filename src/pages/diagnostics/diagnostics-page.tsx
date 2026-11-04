import {
  client_diagnostics,
  configure_debug,
  type DeliveryCollection,
  type ExportPolicy,
} from "@nds/runtime";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { errorMessage } from "@/shared/api/errors";
import { useRuntime } from "@/shared/api/runtime";
import { type SimpleMessageKey, useText } from "@/shared/i18n";
import { formatTimestamp } from "@/shared/i18n/timestamp";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

const policy: Record<ExportPolicy, SimpleMessageKey> = {
  Unknown: "exportUnknown",
  Enabled: "exportEnabled",
  Disabled: "exportDisabled",
};
// The device's effective collection policy (P2); debug carries its end.
const collection: Record<Exclude<DeliveryCollection, "Debug">, SimpleMessageKey> = {
  Unknown: "collectionUnknown",
  Standard: "collectionStandard",
  Off: "collectionOff",
};

export function DiagnosticsPage() {
  const { client, scope, view, busy, run } = useRuntime();
  const { t, locale } = useText();
  const [debugScope, setDebugScope] = useState<"Http" | "Io">("Http");
  const read = useQuery({
    queryKey: ["diagnostics", scope],
    queryFn: () => ({
      local: client_diagnostics(),
      delivery: view.authenticated ? client.delivery_snapshot() : null,
    }),
    refetchInterval: 1000,
  });
  const own = useQuery({
    queryKey: ["own-diagnostics", scope],
    queryFn: () => client.diagnostic_search("", false, 60, 50),
    enabled: false,
    retry: false,
  });
  // The stored projection has no row ID. Keep identical occurrences, with keys
  // stable across reordering of other records in this read-only snapshot.
  const occurrences = new Map<string, number>();
  const records = own.data?.records.map((record) => {
    const identity = JSON.stringify(record);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    return { record, key: `${identity}:${occurrence}` };
  });
  const local = read.data?.local;
  const delivery = read.data?.delivery;
  const count = (value: bigint | null) => value?.toString() ?? t("notChecked");
  const at = (value: string) => {
    const milliseconds = Date.parse(value);
    return Number.isSafeInteger(milliseconds)
      ? formatTimestamp(BigInt(milliseconds), locale)
      : t("notChecked");
  };
  return (
    <div className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("moduleDiagnostics")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="stack">
          {read.isError && <p role="alert">{t(errorMessage(read.error))}</p>}
          {read.isPending && <p role="status">{t("working")}</p>}
          {local?.sink_initialized === false && <p role="alert">{t("diagnosticsUnavailable")}</p>}
          {!read.isError && local && (
            <>
              <p
                data-local-collection={
                  local.collection_enabled === null ? "unknown" : String(local.collection_enabled)
                }
              >
                {t(
                  local.collection_enabled === true
                    ? "diagnosticsCollectionActive"
                    : local.collection_enabled === false
                      ? "diagnosticsCollectionOff"
                      : "diagnosticsCollectionUnknown",
                )}
              </p>
              <p>
                {t("diagnosticsDegraded", {
                  rejected: count(local.rejected_fields_or_events),
                  dropped: count(local.dropped_events),
                  failures: count(local.write_failures),
                  pending: count(local.pending_events),
                })}
              </p>
              {local.sink_initialized && (
                <>
                  <select
                    aria-label={t("moduleDiagnostics")}
                    value={local.debug_scope ?? debugScope}
                    disabled={busy || local.debug_enabled || local.collection_enabled !== true}
                    onChange={(event) => {
                      if (event.target.value === "Http" || event.target.value === "Io")
                        setDebugScope(event.target.value);
                    }}
                  >
                    <option value="Http">{t("diagnosticsHttp")}</option>
                    <option value="Io">{t("diagnosticsIo")}</option>
                  </select>
                  <Button
                    disabled={busy || local.collection_enabled !== true}
                    onClick={() => {
                      void run(async () =>
                        configure_debug(debugScope, local.debug_enabled ? 0 : 300),
                      );
                    }}
                  >
                    {local.debug_enabled ? t("diagnosticsOff") : t("diagnostics")}
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {view.authenticated && !read.isError && delivery && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t("eventsLabel")}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="stack">
            <p>{t(policy[delivery.policy])}</p>
            <p>
              {delivery.collection === "Debug"
                ? t("collectionDebug", {
                    until: formatTimestamp(delivery.debug_expires_at * 1000n, locale),
                  })
                : t(collection[delivery.collection])}
            </p>
            <nav className="actions" aria-label={t("moduleDiagnostics")}>
              <Link to="/incidents">{t("alertsTitle")}</Link>
            </nav>
            <Button
              variant="outline"
              disabled={busy || own.isFetching}
              onClick={() => {
                void own.refetch();
              }}
            >
              {t("ownDiagnostics")}
            </Button>
            {own.isFetching && <p role="status">{t("working")}</p>}
            {own.isError && <p role="alert">{t(errorMessage(own.error))}</p>}
            {!own.isError && own.data?.records.length === 0 && <p>{t("diagnosticsEmpty")}</p>}
            {!own.isError &&
              records?.map(({ record, key }) => (
                <section className="record stack" key={key}>
                  <h3>{record.event_name || record.name || record.service_name}</h3>
                  <p>
                    {at(record.timestamp)} · {record.service_name}
                  </p>
                  <p>
                    {[record.module, record.outcome, record.error_type].filter(Boolean).join(" · ")}
                  </p>
                  {record.operation_id && <p>{record.operation_id}</p>}
                </section>
              ))}
            {!own.isError && own.data?.truncated && (
              <p role="status">{t("diagnosticsTruncated")}</p>
            )}

            {!delivery.initialized && <p>{t("telemetryUnavailable")}</p>}
            {delivery.initialized && delivery.policy === "Enabled" && !delivery.paused && (
              <p>{t("telemetryInitialized")}</p>
            )}
            {delivery.local_persistence_ready !== null && (
              <p>
                {delivery.local_persistence_ready
                  ? t("telemetryPersistenceReady")
                  : t("telemetryPersistenceUnavailable")}
              </p>
            )}
            {delivery.paused && <p>{t("exportPaused")}</p>}
            <h3>{t("eventsLabel")}</h3>
            <p>
              {t("telemetryDelivery", {
                pending: delivery.pending,
                delivered: delivery.delivered,
                dropped: delivery.dropped,
                failures: delivery.failures,
              })}
            </p>
            <h3>{t("spansLabel")}</h3>
            <p>
              {t("telemetryDelivery", {
                pending: delivery.spans_pending,
                delivered: delivery.spans_delivered,
                dropped: delivery.spans_dropped,
                failures: delivery.spans_failures,
              })}
            </p>
            {delivery.last_success_at !== 0n && (
              <p>
                {t("exportLastSeen", {
                  time: formatTimestamp(delivery.last_success_at * 1000n, locale),
                })}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
