import { useForm } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
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
  const [opened, setOpened] = useState(false);
  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setOpened(false);
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
  useEffect(() => {
    if (!opened) return;
    let timer: number | undefined;
    let disposed = false;
    function schedule() {
      clearTimeout(timer);
      const current = client.snapshot();
      if (
        disposed ||
        document.visibilityState === "hidden" ||
        !["github", "passkey", "passkey_registration"].includes(current.flow) ||
        current.expires_in_seconds === 0
      )
        return;
      timer = window.setTimeout(
        async () => {
          if (document.visibilityState !== "hidden") {
            await run(
              () => (current.flow === "github" ? client.poll_github() : client.poll_passkey()),
              true,
            );
          }
          schedule();
        },
        Math.min(30, Math.max(1, current.retry_after_seconds)) * 1000,
      );
    }
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [opened, client, run]);
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
                setOpened(false);
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
                setOpened(false);
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
        {view.authorization_url && (
          <div className="stack">
            <p>{t("githubHelp")}</p>
            <strong>{view.verification_code}</strong>
            <a
              className="notice"
              href={view.authorization_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpened(true)}
            >
              {t("openGithub")}
            </a>
            {opened && <p role="status">{t("awaitApproval")}</p>}
          </div>
        )}
        {view.flow && (
          <div className="actions">
            <p>{t("validFor", { seconds: view.expires_in_seconds })}</p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setOpened(false);
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
