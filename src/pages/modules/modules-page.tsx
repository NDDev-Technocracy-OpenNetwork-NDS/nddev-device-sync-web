import type { DeviceModuleView } from "@nds/runtime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { errorMessage } from "@/shared/api/errors";
import { useRuntime } from "@/shared/api/runtime";
import { useText } from "@/shared/i18n";
import { moduleLabel, permissionLabel, readinessLabel } from "@/shared/i18n/modules";
import { formatTimestamp } from "@/shared/i18n/timestamp";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";

function Settings({ module, saved }: { module: DeviceModuleView; saved: () => Promise<void> }) {
  const { client, run, busy } = useRuntime();
  const { t } = useText();
  const [basis, setBasis] = useState(module);
  const [enabled, setEnabled] = useState(module.enabled);
  const [permissions, setPermissions] = useState(() => new Set(module.permissions));
  const [submitted, setSubmitted] = useState(false);
  const changed =
    enabled !== basis.enabled ||
    permissions.size !== basis.permissions.length ||
    basis.permissions.some((value) => !permissions.has(value));
  const sourceChanged =
    basis.revision !== module.revision ||
    basis.pending_id !== module.pending_id ||
    basis.conflicted !== module.conflicted;
  const sameSetting =
    basis.enabled === module.enabled &&
    basis.conflicted === module.conflicted &&
    basis.permissions.length === module.permissions.length &&
    basis.permissions.every((value) => module.permissions.includes(value));
  const stale = sourceChanged && !sameSetting;
  useEffect(() => {
    if (!sourceChanged) return;
    if (!changed || submitted) {
      setBasis(module);
      setEnabled(module.enabled);
      setPermissions(new Set(module.permissions));
    } else if (sameSetting) setBasis(module);
  }, [module, changed, submitted, sourceChanged, sameSetting]);
  async function submit() {
    setSubmitted(false);
    const ok = await run(() =>
      client.configure_module(
        module.id,
        enabled,
        [...permissions].sort(),
        basis.revision,
        basis.pending_id,
      ),
    );
    if (!ok) return;
    setSubmitted(true);
    await saved();
  }
  return (
    <div className="stack">
      <p>{t(readinessLabel(module.readiness))}</p>
      <p>
        {t(
          module.installed === true
            ? "moduleInstalled"
            : module.installed === false
              ? "moduleNotInstalled"
              : "moduleInstallationUnknown",
        )}
      </p>
      <Label htmlFor={`module-${module.id}-enabled`} className="actions">
        <Checkbox
          id={`module-${module.id}-enabled`}
          aria-label={t("moduleEnabled")}
          checked={enabled}
          disabled={busy || module.conflicted || !module.supported}
          onCheckedChange={(checked) => {
            setEnabled(checked);
            setSubmitted(false);
          }}
        />
        {t("moduleEnabled")}
      </Label>
      {module.required_permissions.length + module.optional_permissions.length > 0 && (
        <fieldset className="stack" disabled={busy || module.conflicted}>
          <legend>{t("modulePermissions")}</legend>
          {[...new Set([...module.required_permissions, ...module.optional_permissions])].map(
            (permission) => (
              <Label
                key={permission}
                htmlFor={`module-${module.id}-${permission}`}
                className="actions"
              >
                <Checkbox
                  id={`module-${module.id}-${permission}`}
                  aria-label={t(permissionLabel(permission))}
                  checked={permissions.has(permission)}
                  onCheckedChange={(checked) => {
                    setPermissions((previous) => {
                      const next = new Set(previous);
                      if (checked) next.add(permission);
                      else next.delete(permission);
                      return next;
                    });
                    setSubmitted(false);
                  }}
                />
                {t(permissionLabel(permission))}
              </Label>
            ),
          )}
        </fieldset>
      )}
      {stale && (
        <div role="status">
          <p>{t("moduleSettingsChanged")}</p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setBasis(module);
              setEnabled(module.enabled);
              setPermissions(new Set(module.permissions));
              setSubmitted(false);
            }}
          >
            {t("moduleReloadDraft")}
          </Button>
        </div>
      )}
      <Button
        disabled={busy || stale || !changed || module.conflicted}
        onClick={() => void submit()}
      >
        {t("moduleSave")}
      </Button>
      {submitted && <p role="status">{t("moduleSaved")}</p>}
      {module.pending_id && <p>{t("vaultRecordPending")}</p>}
    </div>
  );
}

export function ModulesPage() {
  const { client, scope, busy, workPermitted } = useRuntime();
  const { locale, t } = useText();
  const cache = useQueryClient();
  const key = ["device-modules", scope] as const;
  const modules = useQuery({
    queryKey: key,
    queryFn: () => client.device_modules(),
    enabled: !busy && workPermitted,
    refetchInterval: workPermitted ? 5000 : false,
  });
  return (
    <div className="stack">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("localModules")}</h2>
          </CardTitle>
          <CardDescription>{t("moduleManagementHelp")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled={busy || modules.isFetching} onClick={() => void modules.refetch()}>
            {t("moduleRefresh")}
          </Button>
          {modules.error && <p role="alert">{t(errorMessage(modules.error))}</p>}
        </CardContent>
      </Card>
      {modules.data?.map((module) => (
        <Card key={module.id}>
          <CardHeader>
            <CardTitle>
              <h3>
                {moduleLabel(module.id)
                  ? t(moduleLabel(module.id) ?? "module")
                  : module.id.toUpperCase()}
              </h3>
            </CardTitle>
            <CardDescription>
              {module.version}
              {module.checked_at_ms ? ` · ${formatTimestamp(module.checked_at_ms, locale)}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Settings
              key={`${scope}:${module.id}`}
              module={module}
              saved={async () => {
                await cache.invalidateQueries({ queryKey: key });
              }}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
