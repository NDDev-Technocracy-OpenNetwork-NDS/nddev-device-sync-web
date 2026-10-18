import { useRuntime } from "@/shared/api/runtime";
import { useText } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export function SessionPage() {
  const { client, view, busy, run } = useRuntime();
  const { t } = useText();
  return (
    <div className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("sessionTitle")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="stack">
          <dl>
            <dt>{t("user")}</dt>
            <dd>{view.user_id}</dd>
            <dt>{t("instance")}</dt>
            <dd>{view.server_version}</dd>
            <dt>{t("expires")}</dt>
            <dd>{view.expires_at}</dd>
          </dl>
          {view.offline_authorized && <p className="notice">{t("offlineAuthorized")}</p>}
          {!view.session_verified && !view.offline_authorized && (
            <p className="notice">{t("unverified")}</p>
          )}
          {view.credential_revalidation_required && (
            <p className="notice">{t("revalidationRequired")}</p>
          )}
          <div className="actions">
            <Button
              disabled={busy}
              onClick={() => {
                void run(() => client.refresh(), true);
              }}
            >
              {t("refresh")}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                void run(() => client.logout());
              }}
            >
              {t("logout")}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("devicesTitle")}</h2>
          </CardTitle>
          <CardDescription>{t("devicesHelp")}</CardDescription>
        </CardHeader>
        <CardContent className="stack">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              void run(() => client.refresh_devices());
            }}
          >
            {t("refreshDevices")}
          </Button>
          {view.devices.map((device) => (
            <div className="record stack" key={device.device_id}>
              <strong>{device.display_name || device.platform}</strong>
              <p>
                {device.is_current ? t("thisDevice") : device.platform} ·{" "}
                {device.revoked ? t("deviceRevoked") : t("deviceActive")}
              </p>
              {!device.revoked && (
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        t("revokeDeviceHelp", { name: device.display_name || device.device_id }),
                      )
                    )
                      void run(() => client.revoke_device(device.device_id));
                  }}
                >
                  {t("revokeDevice")}
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
