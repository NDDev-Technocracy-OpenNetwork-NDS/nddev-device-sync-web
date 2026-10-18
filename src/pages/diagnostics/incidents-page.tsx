import type { IncidentPage, IncidentView } from "@nds/runtime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRuntime } from "@/shared/api/runtime";
import { useText } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export function IncidentsPage() {
  const { client, scope, busy, run } = useRuntime();
  const { t, locale } = useText();
  const cache = useQueryClient();
  const [after, setAfter] = useState("");
  const key = ["incidents", scope, after];
  const read = useQuery({ queryKey: key, queryFn: () => client.incidents(after) });
  const disabled = busy || read.isFetching || read.isError;
  function act(incident: IncidentView, seconds: number) {
    void run(async () => {
      const updated = await client.incident_action(incident.id, incident.revision, seconds);
      // Use the committed receipt without making success depend on another read.
      cache.setQueryData<IncidentPage>(
        key,
        (page) =>
          page && {
            ...page,
            incidents: page.incidents.map((item) => (item.id === updated.id ? updated : item)),
          },
      );
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("alertsTitle")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="stack">
        <Button
          variant="outline"
          disabled={busy || read.isFetching}
          onClick={() => {
            void read.refetch();
          }}
        >
          {t("moduleRefresh")}
        </Button>
        {read.isFetching && <p role="status">{t("working")}</p>}
        {read.isError && (
          <p role="alert">
            {t(
              read.error instanceof Error && read.error.message === "busy"
                ? "operationBusy"
                : "incidentsUnavailable",
            )}
          </p>
        )}
        {read.data && (
          <p>
            {t("incidentsObserved", {
              time: new Date(read.data.generated_at).toLocaleString(locale),
            })}
          </p>
        )}
        {!read.isError && read.data?.incidents.length === 0 && <p>{t("noIncidents")}</p>}
        {read.data?.incidents.map((incident) => (
          <section className="record stack" key={incident.id}>
            <h3>{incident.service}</h3>
            <p>
              {t("incidentState", {
                kind: incident.kind,
                state: incident.state,
                occurrences: incident.occurrences,
              })}
            </p>
            {incident.silenced_until && (
              <p>
                {t("silenceIncident")} · {t("expires")}:{" "}
                {new Date(incident.silenced_until).toLocaleString(locale)}
              </p>
            )}
            {incident.state !== "resolved" && (
              <div className="actions">
                <Button disabled={disabled} onClick={() => act(incident, 0)}>
                  {t("acknowledgeIncident")}
                </Button>
                <Button variant="outline" disabled={disabled} onClick={() => act(incident, 3600)}>
                  {t("silenceIncident")}
                </Button>
              </div>
            )}
          </section>
        ))}
        <div className="actions">
          {after && (
            <Button
              variant="outline"
              disabled={busy || read.isFetching}
              onClick={() => setAfter("")}
            >
              {t("vaultFirstPage")}
            </Button>
          )}
          {read.data?.next_cursor && (
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => setAfter(read.data?.next_cursor ?? "")}
            >
              {t("moreIncidents")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
