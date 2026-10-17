import { useForm } from "@tanstack/react-form";
import { useRef } from "react";
import { useRuntime } from "@/shared/api/runtime";
import { useText } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export function SignIn() {
  const { client, view, busy, run, observe } = useRuntime();
  const { t, locale } = useText();
  const code = useRef<HTMLInputElement>(null);
  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      await run(() => client.request_email(value.email, locale));
    },
  });
  const verification = useForm({
    onSubmit: async () => {
      await run(async () => {
        const input = code.current;
        if (!input) return;
        const value = input.value;
        input.value = "";
        await client.verify_email(value);
      }, true);
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("signIn")}</h2>
        </CardTitle>
        <CardDescription>{t("browserPrivacy")}</CardDescription>
      </CardHeader>
      <CardContent className="stack">
        {view.invitation_pending && <p className="notice">{t("invitationVerify")}</p>}
        {view.logout_pending && <p className="notice">{t("logoutPending")}</p>}
        <form
          className="fields"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="email">
            {(field) => (
              <div className="field">
                <Label htmlFor="signin-email">{t("email")}</Label>
                <Input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  disabled={busy}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
          <p className="muted">{t("emailHint")}</p>
          <div className="actions">
            <Button type="submit" disabled={busy || !view.email_available}>
              {t("sendCode")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !view.passkey_available}
              onClick={() => {
                void run(() => client.start_passkey(false, form.state.values.email, locale));
              }}
            >
              {t("passkey")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !view.github_available}
              onClick={() => {
                void run(() => client.start_github(locale));
              }}
            >
              {t("github")}
            </Button>
          </div>
          <p className="muted">{t("passkeyAccountHint")}</p>
        </form>
        {view.flow === "email" && (
          <form
            className="fields"
            onSubmit={(event) => {
              event.preventDefault();
              void verification.handleSubmit();
            }}
          >
            <Label htmlFor="signin-code">{t("code")}</Label>
            <Input
              id="signin-code"
              ref={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{8}"
              maxLength={8}
              disabled={busy}
              required
            />
            <Button type="submit" disabled={busy}>
              {t("verify")}
            </Button>
          </form>
        )}
        {view.flow === "email" && (
          <div className="actions">
            <p>{t("validFor", { seconds: view.expires_in_seconds })}</p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                client.cancel();
                if (code.current) code.current.value = "";
                observe();
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
