import { useEffect, useState } from "react";
import { useRuntime } from "@/shared/api/runtime";
import { useText } from "@/shared/i18n";
import { Button, buttonVariants } from "@/shared/ui/button";

// Mounted for one Rust-owned authorization URL; a new flow resets its polling.
export function Approval() {
  const { client, view, busy, run, observe } = useRuntime();
  const { t } = useText();
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!opened) return;
    let timer: number | undefined;
    let disposed = false;
    let polling = false;
    function schedule() {
      clearTimeout(timer);
      const current = client.snapshot();
      if (
        disposed ||
        polling ||
        document.visibilityState === "hidden" ||
        !["github", "passkey", "passkey_registration"].includes(current.flow) ||
        current.expires_in_seconds === 0
      )
        return;
      timer = window.setTimeout(
        async () => {
          if (!disposed && document.visibilityState !== "hidden") {
            polling = true;
            try {
              await run(
                () => (current.flow === "github" ? client.poll_github() : client.poll_passkey()),
                true,
              );
            } finally {
              polling = false;
            }
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
    <section className="notice stack" aria-label={t("awaitApproval")}>
      <p>{t(view.flow === "github" ? "githubHelp" : "passkeyHelp")}</p>
      <strong>{view.verification_code}</strong>
      <a
        className={`${buttonVariants({ variant: "outline" })} min-h-(--on-size-target-min)`}
        href={view.authorization_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setOpened(true)}
      >
        {t(view.flow === "github" ? "openGithub" : "openPasskey")}
      </a>
      {opened && <p role="status">{t("awaitApproval")}</p>}
      <p>{t("validFor", { seconds: view.expires_in_seconds })}</p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => {
          client.cancel();
          observe();
        }}
      >
        {t("cancel")}
      </Button>
    </section>
  );
}
