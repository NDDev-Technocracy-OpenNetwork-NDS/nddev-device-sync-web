import type {
  GithubCredentialReference,
  GithubCredentialReferencePage,
  GithubRepositoryPageView,
  GithubSavedRepositoryPageView,
  GithubSourceView,
} from "@nds/runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/shared/api/errors";
import { useRuntime } from "@/shared/api/runtime";
import { reportFailure } from "@/shared/api/telemetry";
import { type SimpleMessageKey, useText } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { CatalogOwner, CatalogRepository, Observed } from "./catalog-values";

function message(error: unknown, saved: boolean): SimpleMessageKey {
  if (!(error instanceof Error)) {
    reportFailure("BrowserUnhandled");
    return "catalogUnavailable";
  }
  switch (error.message) {
    case "ModuleDisabled":
      return "moduleDisabled";
    case "ModulePermissionRequired":
      return "modulePermissionRequired";
    case "ModuleConfigurationConflict":
      return "moduleConfigurationConflict";
    case "AuthorizationRequired":
      return "catalogSignIn";
    case "CredentialChanged":
      return "catalogCredentialChanged";
    case "Busy":
      return "operationBusy";
    case "Cancelled":
      return "catalogCancelled";
    case "Timeout":
      return "catalogTimeout";
    case "InvalidInput":
      return saved ? "catalogReadSavedAgain" : "catalogChooseCredential";
    case "InvalidResponse":
      return "catalogInvalidResponse";
    case "ProviderFailed":
      return "catalogProviderFailed";
    case "Unavailable":
      return "catalogUnavailable";
    case "CapacityExhausted":
      return "catalogCapacityReached";
    default: {
      const description = errorMessage(error);
      if (description === "genericError") reportFailure("BrowserUnhandled");
      return description;
    }
  }
}
type Action = (current: () => boolean) => Promise<void>;
function credentialKey(record: GithubCredentialReference): string {
  return JSON.stringify([record.record_ref, record.revision, record.pending_id]);
}

export function CatalogPage() {
  const { client, workPermitted } = useRuntime();
  const { t } = useText();
  const [saved, setSaved] = useState(true);
  const mode = useRef(true);
  const [credentials, setCredentials] = useState<GithubCredentialReferencePage | null>(null);
  const [selected, setSelected] = useState<GithubCredentialReference | null>(null);
  const [source, setSource] = useState<GithubSourceView | null>(null);
  const [page, setPage] = useState<GithubRepositoryPageView | null>(null);
  const [stored, setStored] = useState<GithubSavedRepositoryPageView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SimpleMessageKey | null>(null);
  const epoch = useRef(0);
  const running = useRef(false);
  const mounted = useRef(false);
  const stop = useCallback(() => {
    epoch.current++;
    running.current = false;
    try {
      client.cancel_github_catalog();
    } catch {
      reportFailure("BrowserUnhandled");
    }
  }, [client]);
  const run = useCallback(
    async (action: Action) => {
      if (running.current || !workPermitted) return;
      running.current = true;
      const admitted = ++epoch.current;
      const current = () => mounted.current && epoch.current === admitted;
      setBusy(true);
      setError(null);
      try {
        await action(current);
      } catch (error) {
        const description = message(error, mode.current);
        if (!current()) return;
        const code = error instanceof Error ? error.message : "";
        if (code === "Busy") {
          try {
            const source = await client.github_catalog_source();
            if (current()) {
              setSource(source);
              setSelected(source.credential);
            }
          } catch {
            if (current()) {
              setSource(null);
              setSelected(null);
            }
          }
          if (!current()) return;
        }
        // Preserve the accepted page for an explicit retry of Rust's original remainder.
        if (!["Busy", "Timeout", "CapacityExhausted"].includes(code)) {
          setPage(null);
          setStored(null);
        }
        if (code === "CredentialChanged" || code === "AuthorizationRequired") {
          setCredentials(null);
          setSelected(null);
        }
        setError(description);
      } finally {
        if (current()) {
          running.current = false;
          setBusy(false);
        }
      }
    },
    [workPermitted, client],
  );
  const loadCredentials = useCallback(
    (after = "") =>
      run(async (current) => {
        const source = await client.github_catalog_source();
        const value = await client.github_catalog_credentials(after);
        if (current()) {
          setCredentials(value);
          setSource(source);
          const selected = source.credential;
          setSelected(
            selected === null
              ? null
              : (value.items.find((record) => credentialKey(record) === credentialKey(selected)) ??
                  selected),
          );
        }
      }),
    [client, run],
  );
  const loadSaved = useCallback(
    (next = false) =>
      run(async (current) => {
        if (!next) setStored(null);
        const value = await client.saved_github_repository_page(next);
        if (current()) setStored(value);
      }),
    [client, run],
  );
  const loadProvider = (next = false) =>
    run(async (current) => {
      if (!next) setPage(null);
      const value = await client.github_repository_page(next);
      if (current()) setPage(value);
    });
  useEffect(() => {
    mounted.current = true;
    setCredentials(null);
    setSelected(null);
    setSource(null);
    setPage(null);
    setStored(null);
    setError(null);
    setBusy(false);
    if (workPermitted) void (mode.current ? loadSaved() : loadCredentials());
    return () => {
      mounted.current = false;
      stop();
    };
  }, [workPermitted, stop, loadSaved, loadCredentials]);

  const select = (record: GithubCredentialReference | null) =>
    run(async (current) => {
      if (!source || source.conflicted) return;
      if (record === null) {
        await client.clear_github_catalog_source(source.revision, source.pending_id);
      } else {
        await client.select_github_credential(
          record.record_ref,
          record.revision,
          record.pending_id,
          source.revision,
          source.pending_id,
        );
      }
      if (!current()) return;
      setPage(null);
      setSelected(record);
      setSource(null);
      const saved = await client.github_catalog_source();
      if (current()) {
        setSource(saved);
        setSelected(saved.credential);
      }
    });
  function changeMode(value: boolean) {
    setSaved(value);
    mode.current = value;
    setError(null);
    if (value) void loadSaved();
    else if (!credentials) void loadCredentials();
  }
  function cancel() {
    stop();
    setBusy(false);
    setPage(null);
    setStored(null);
    setError("catalogCancelled");
  }
  const choices = credentials?.items ?? [];
  const selectionOnPage =
    selected !== null &&
    choices.some((choice) => credentialKey(choice) === credentialKey(selected));
  const disabled = busy || !workPermitted;
  return (
    <div className="stack">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("catalogTitle")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="stack">
          <div className="actions">
            <Button
              variant={saved ? "default" : "outline"}
              aria-pressed={saved}
              disabled={disabled}
              onClick={() => changeMode(true)}
            >
              {t("catalogSaved")}
            </Button>
            <Button
              variant={saved ? "outline" : "default"}
              aria-pressed={!saved}
              disabled={disabled}
              onClick={() => changeMode(false)}
            >
              {t("catalogProvider")}
            </Button>
          </div>
          {!workPermitted && <p role="status">{t("catalogPaused")}</p>}
          {busy && <p role="status">{t("working")}</p>}
          {workPermitted && error && <p role="alert">{t(error)}</p>}
          {workPermitted &&
            (saved ? (
              <>
                <p>{t("catalogSavedHelp")}</p>
                <div className="actions">
                  <Button disabled={disabled} onClick={() => void loadSaved()}>
                    {t("catalogReadSaved")}
                  </Button>
                  {stored?.has_more && (
                    <Button
                      variant="outline"
                      disabled={disabled}
                      onClick={() => void loadSaved(true)}
                    >
                      {t("catalogSavedNext")}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p>{t("catalogHelp")}</p>
                <p>{t("catalogSourceHelp")}</p>
                {source?.pending_id !== null && source !== null && (
                  <p role="status">{t("vaultRecordPending")}</p>
                )}
                {source?.conflicted && <p role="alert">{t("vaultConflict")}</p>}
                <Label htmlFor="catalog-credential">{t("catalogCredential")}</Label>
                <select
                  id="catalog-credential"
                  disabled={disabled || source === null || source.conflicted}
                  value={selected === null ? "" : credentialKey(selected)}
                  onChange={(event) => {
                    const record = choices.find(
                      (record) => credentialKey(record) === event.target.value,
                    );
                    if (record) void select(record);
                  }}
                >
                  <option value="" disabled>
                    {t("catalogChooseCredential")}
                  </option>
                  {selected && !selectionOnPage && (
                    <option value={credentialKey(selected)}>
                      {selected.title || selected.record_ref}
                    </option>
                  )}
                  {choices.map((record) => (
                    <option key={credentialKey(record)} value={credentialKey(record)}>
                      {record.title || record.record_ref}
                    </option>
                  ))}
                </select>
                {selected?.username && <p>{selected.username}</p>}
                <div className="actions">
                  {source?.credential !== null && source !== null && (
                    <Button
                      variant="outline"
                      disabled={disabled || source.conflicted}
                      onClick={() => void select(null)}
                    >
                      {t("catalogClearSource")}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={disabled}
                    onClick={() => void loadCredentials()}
                  >
                    {t("catalogRefreshCredentials")}
                  </Button>
                  {credentials?.has_more && (
                    <Button
                      variant="outline"
                      disabled={disabled}
                      onClick={() => void loadCredentials(credentials.next_after)}
                    >
                      {t("catalogMoreCredentials")}
                    </Button>
                  )}
                </div>
                {credentials?.items.length === 0 && !busy && !error && (
                  <p>{t("catalogNoCredentials")}</p>
                )}
                <div className="actions">
                  <Button disabled={disabled || !selected} onClick={() => void loadProvider()}>
                    {t("catalogRead")}
                  </Button>
                  {page?.continuation === "More" && (
                    <Button
                      variant="outline"
                      disabled={disabled}
                      onClick={() => void loadProvider(true)}
                    >
                      {t("catalogNextPage")}
                    </Button>
                  )}
                </div>
              </>
            ))}
          {busy && (
            <Button variant="outline" onClick={cancel}>
              {t("actionCancel")}
            </Button>
          )}
        </CardContent>
      </Card>
      {workPermitted &&
        (saved ? (
          <>
            {stored?.groups.length === 0 && <p>{t("catalogEmptyPage")}</p>}
            {stored?.groups.map((group) => (
              <CatalogOwner
                key={group.owner_id}
                id={group.owner_id}
                owner={group.owner?.owner ?? null}
                observation={group.owner?.observation ?? null}
              >
                {group.repositories.map((item) => (
                  <CatalogRepository
                    key={item.repository.id}
                    repository={item.repository}
                    observation={item.observation}
                  />
                ))}
              </CatalogOwner>
            ))}
          </>
        ) : (
          page && (
            <>
              <p>{t("catalogPrincipal", { login: page.principal.login })}</p>
              <Observed value={page.observed_at_ms} />
              <p>{t("catalogPageScope")}</p>
              {page.groups.length === 0 && <p>{t("catalogEmptyPage")}</p>}
              {page.groups.map((group) => (
                <CatalogOwner
                  key={group.owner.id}
                  id={group.owner.id}
                  owner={group.owner}
                  observation={null}
                >
                  {group.repositories.map((repository) => (
                    <CatalogRepository
                      key={repository.id}
                      repository={repository}
                      observation={null}
                    />
                  ))}
                </CatalogOwner>
              ))}
              <p>
                {page.continuation === "More"
                  ? t("catalogHasMore")
                  : page.continuation === "EndOfAccessScope"
                    ? t("catalogAccessEnd")
                    : t("catalogLimitReached")}
              </p>
            </>
          )
        ))}
    </div>
  );
}
