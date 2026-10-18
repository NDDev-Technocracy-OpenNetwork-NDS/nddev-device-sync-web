import type { PasskeyView } from "@nds/runtime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/shared/api/errors";
import { useRuntime } from "@/shared/api/runtime";
import { useText } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export function PasskeysPage() {
  const { client, view, scope, busy, run } = useRuntime();
  const { t, locale } = useText();
  const cache = useQueryClient();
  const key = ["passkeys", scope];
  const keys = useQuery({
    queryKey: key,
    queryFn: () => client.passkeys(),
    // Finishing or cancelling registration enables a fresh list read.
    enabled: view.flow === "",
  });
  const disabled = busy || keys.isFetching || view.flow !== "";
  function remove(id: string) {
    if (!window.confirm(t("passkeyRemoveHelp", { id: id.slice(0, 12) }))) return;
    void run(async () => {
      await client.revoke_passkey(id);
      if (client.snapshot().authenticated) {
        // A committed revocation does not depend on a second successful request.
        cache.setQueryData<PasskeyView[]>(key, (current) =>
          current?.filter((item) => item.id !== id),
        );
      }
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("passkeysTitle")}</h2>
        </CardTitle>
        <CardDescription>{t("passkeysHelp")}</CardDescription>
      </CardHeader>
      <CardContent className="stack">
        <div className="actions">
          <Button
            disabled={disabled || !view.session_verified}
            onClick={() => {
              void run(() => client.start_passkey(true, null, locale));
            }}
          >
            {t("registerPasskey")}
          </Button>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => {
              void keys.refetch();
            }}
          >
            {t("moduleRefresh")}
          </Button>
        </div>
        {keys.isFetching && <p role="status">{t("working")}</p>}
        {keys.isError ? (
          <p role="alert">{t(errorMessage(keys.error))}</p>
        ) : (
          <>
            {keys.data?.length === 0 && <p>{t("passkeysEmpty")}</p>}
            {keys.data?.map((passkey) => (
              <div className="record stack" key={passkey.id}>
                <strong>{passkey.id.slice(0, 12)}</strong>
                <p>
                  {t("passkeyCreated", {
                    time: new Date(passkey.created_at).toLocaleString(locale),
                  })}
                </p>
                <Button
                  variant="destructive"
                  disabled={disabled || !view.session_verified}
                  onClick={() => remove(passkey.id)}
                >
                  {t("passkeyRemove")}
                </Button>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
