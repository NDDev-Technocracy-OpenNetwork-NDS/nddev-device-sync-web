import type {
  GithubObservationView,
  GithubOwnerView,
  GithubRepositorySummaryView,
  GithubRepositoryVisibilityView,
} from "@nds/runtime";
import type { ReactNode } from "react";
import { type SimpleMessageKey, useText } from "@/shared/i18n";
import { formatTimestamp } from "@/shared/i18n/timestamp";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

const visibility: Record<GithubRepositoryVisibilityView, SimpleMessageKey> = {
  Public: "catalogPublic",
  Private: "catalogPrivate",
  Internal: "catalogInternal",
};

export function Observed({ value }: { value: string }) {
  const { t, locale } = useText();
  try {
    return <p>{t("catalogObserved", { time: formatTimestamp(BigInt(value), locale) })}</p>;
  } catch {
    return <p>{t("catalogObservationUnknown")}</p>;
  }
}
function Observation({ value }: { value: GithubObservationView }) {
  const { t } = useText();
  return (
    <div className="stack">
      <Observed value={value.observed_at_ms} />
      {value.pending && <p>{t("vaultRecordPending")}</p>}
      {value.conflicted && <p className="notice">{t("vaultConflict")}</p>}
    </div>
  );
}
export function CatalogOwner({
  id,
  owner,
  observation,
  children,
}: {
  id: string;
  owner: GithubOwnerView | null;
  observation: GithubObservationView | null;
  children: ReactNode;
}) {
  const { t } = useText();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{owner?.login ?? t("catalogMissingOwner", { id })}</h3>
        </CardTitle>
      </CardHeader>
      <CardContent className="stack">
        {owner && (
          <p>{owner.kind === "Organization" ? t("catalogOrganization") : t("catalogPersonal")}</p>
        )}
        {observation && <Observation value={observation} />}
        {children}
      </CardContent>
    </Card>
  );
}
export function CatalogRepository({
  repository,
  observation,
}: {
  repository: GithubRepositorySummaryView;
  observation: GithubObservationView | null;
}) {
  const { t } = useText();
  return (
    <section className="record stack">
      <strong>{repository.name}</strong>
      <p>{t(visibility[repository.visibility])}</p>
      {repository.archived && <p>{t("catalogArchived")}</p>}
      {repository.default_branch && <p>{repository.default_branch}</p>}
      {observation && <Observation value={observation} />}
    </section>
  );
}
