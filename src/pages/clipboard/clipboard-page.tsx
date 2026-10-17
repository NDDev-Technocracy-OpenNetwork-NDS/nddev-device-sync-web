import { useForm } from "@tanstack/react-form";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { errorMessage } from "@/shared/api/errors";
import { useRuntime } from "@/shared/api/runtime";
import { type SimpleMessageKey, useText } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

const describeError = (error: unknown): SimpleMessageKey =>
  error instanceof Error && error.message === "vault_invalid_input"
    ? "clipboardRejected"
    : errorMessage(error);

export function ClipboardPage() {
  const { client, scope, busy, run } = useRuntime();
  const { t } = useText();
  const cache = useQueryClient();
  const input = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [reservationError, setReservationError] = useState<SimpleMessageKey | null>(null);
  const options = queryOptions({
    queryKey: ["clipboard", scope],
    queryFn: () => client.clipboard_snapshot(),
  });
  const read = useQuery({ ...options, enabled: !busy, refetchInterval: 2000 });
  function command(action: () => Promise<unknown>) {
    setCopied(false);
    setReservationError(null);
    return run(
      async () => {
        await cache.fetchQuery(options).catch(() => undefined);
        await action();
      },
      false,
      describeError,
    );
  }
  const form = useForm({
    onSubmit: async () => {
      await command(async () => {
        const field = input.current;
        if (!field) throw new Error("cancelled");
        // Only the DOM and Rust handle plaintext; Form and Query contain no text value.
        try {
          await client.clipboard_publish_text(field.value);
          field.value = "";
        } finally {
          if (!field.isConnected) field.value = "";
        }
      });
      await cache.invalidateQueries({ queryKey: options.queryKey });
    },
  });
  function copy() {
    let ticket: string | null | undefined;
    try {
      // Reserve browser user activation before the first asynchronous operation.
      ticket = client.reserve_clipboard_copy();
    } catch (error) {
      setCopied(false);
      setReservationError(describeError(error));
      return;
    }
    void command(async () => {
      await client.clipboard_copy(ticket);
      setCopied(true);
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("sharedClipboard")}</h2>
        </CardTitle>
        <CardDescription>{t("clipboardHelp")}</CardDescription>
      </CardHeader>
      <CardContent className="stack">
        <form
          className="fields"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <Label htmlFor="shared-text">{t("sharedText")}</Label>
          <Textarea
            id="shared-text"
            ref={input}
            required
            rows={3}
            maxLength={8192}
            autoComplete="off"
            disabled={busy}
          />
          <Button type="submit" disabled={busy}>
            {t("shareText")}
          </Button>
        </form>
        {read.isPending ? (
          <p role="status">{t("working")}</p>
        ) : read.isError ? (
          <p role="alert">{t(describeError(read.error))}</p>
        ) : (
          <p>
            {read.data?.present
              ? t("clipboardReady", { sequence: read.data.server_seq, bytes: read.data.bytes })
              : t("clipboardEmpty")}
          </p>
        )}
        {!read.isError && read.data?.conflicted && <p className="notice">{t("vaultConflict")}</p>}
        {reservationError && <p role="alert">{t(reservationError)}</p>}
        {copied && <p role="status">{t("clipboardCopied")}</p>}
        <Button disabled={busy || read.isError || read.data?.present !== true} onClick={copy}>
          {t("copySharedClipboard")}
        </Button>
      </CardContent>
    </Card>
  );
}
