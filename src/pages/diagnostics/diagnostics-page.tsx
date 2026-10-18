import { client_diagnostics, configure_debug, type ExportPolicy } from "@nds/runtime";
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
  const local = read.data?.local;
  const delivery = read.data?.delivery;
  const count = (value: bigint | null) => value?.toString() ?? t("notChecked");
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
                    disabled={busy || local.debug_enabled}
                    onChange={(event) => {
                      if (event.target.value === "Http" || event.target.value === "Io")
                        setDebugScope(event.target.value);
                    }}
                  >
                    <option value="Http">{t("diagnosticsHttp")}</option>
                    <option value="Io">{t("diagnosticsIo")}</option>
                  </select>
                  <Button
                    disabled={busy}
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
            <nav className="actions" aria-label={t("moduleDiagnostics")}>
              <Link to="/incidents">{t("alertsTitle")}</Link>
            </nav>
            <p>{delivery.initialized ? t("telemetryInitialized") : t("telemetryUnavailable")}</p>
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
