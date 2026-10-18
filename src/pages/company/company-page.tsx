import type {
  CompanyCommand,
  OrganizationDeliveryView,
  OrganizationInvitationStatusView,
  OrganizationRoleView,
} from "@nds/runtime";
import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/shared/api/errors";
import { useRuntime } from "@/shared/api/runtime";
import { type SimpleMessageKey, useText } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const delivery: Record<OrganizationDeliveryView, SimpleMessageKey> = {
  Pending: "companyDeliveryPending",
  Accepted: "companyDeliveryAccepted",
  Failed: "companyDeliveryFailed",
  Unknown: "companyDeliveryUnknown",
};
const invitationStatus: Record<OrganizationInvitationStatusView, SimpleMessageKey> = {
  Pending: "companyInvitePending",
  Accepted: "companyJoined",
  Expired: "companyInviteExpired",
  Revoked: "companyInviteRevoked",
};
function selectedRole(value: string): OrganizationRoleView {
  if (value === "Admin" || value === "User") return value;
  throw new Error("invalid_input");
}
export function CompanyPage() {
  const { client, scope, view } = useRuntime();
  const { t } = useText();
  const cache = useQueryClient();
  const [memberCursor, setMemberCursor] = useState<string | null>(null);
  const [inviteCursor, setInviteCursor] = useState<string | null>(null);
  const overview = useQuery({
    queryKey: ["company", scope],
    queryFn: () => client.company(),
    enabled: view.authenticated,
    refetchInterval: 15_000,
  });
  const administrator =
    !overview.isError &&
    overview.data?.member.active === true &&
    overview.data.member.role === "Admin";
  const members = useQuery({
    queryKey: ["company-members", scope, memberCursor],
    queryFn: () => client.company_members(memberCursor),
    enabled: administrator,
    refetchInterval: 15_000,
  });
  const invitations = useQuery({
    queryKey: ["company-invitations", scope, inviteCursor],
    queryFn: () => client.company_invitations(inviteCursor),
    enabled: administrator,
    refetchInterval: 15_000,
  });
  const command = useRef<CompanyCommand | null>(null);
  const operation = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const [working, setWorking] = useState(false);
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<SimpleMessageKey | null>(null);
  const release = useCallback(() => {
    const owned = command.current;
    command.current = null;
    if (owned) {
      const running = operation.current;
      if (running)
        void running.then(
          () => owned.free(),
          () => owned.free(),
        );
      else owned.free();
    }
    if (mounted.current) setPending(false);
  }, []);
  useEffect(
    () => () => {
      mounted.current = false;
      release();
    },
    [release],
  );
  useEffect(() => {
    if (!administrator) {
      cache.removeQueries({ queryKey: ["company-members", scope] });
      cache.removeQueries({ queryKey: ["company-invitations", scope] });
    }
  }, [administrator, cache, scope]);
  async function refresh() {
    await cache.invalidateQueries({ queryKey: ["company", scope] });
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["company-members", scope] }),
      cache.invalidateQueries({ queryKey: ["company-invitations", scope] }),
    ]);
  }
  function submit(prepare?: () => Promise<CompanyCommand>) {
    if (operation.current || (prepare && command.current)) return;
    setWorking(true);
    setCompleted(false);
    setError(null);
    const task = (async () => {
      if (prepare) {
        const next = await prepare();
        if (!mounted.current) {
          next.free();
          return;
        }
        command.current = next;
        setPending(true);
      }
      const current = command.current;
      if (!current) return;
      await current.execute();
      if (mounted.current) {
        release();
        setCompleted(true);
        await refresh();
      }
    })();
    operation.current = task;
    void task
      .catch((error: unknown) => {
        if (mounted.current) setError(errorMessage(error));
      })
      .finally(() => {
        operation.current = null;
        if (mounted.current) setWorking(false);
      });
  }
  const defaults: { email: string; role: OrganizationRoleView } = { email: "", role: "User" };
  const form = useForm({
    defaultValues: defaults,
    onSubmit: ({ value }) => submit(() => client.company_invite(value.email, value.role)),
  });
  return (
    <div className="stack">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("companyTitle")}</h2>
          </CardTitle>
          <CardDescription>{t("companyPrivacy")}</CardDescription>
        </CardHeader>
        <CardContent className="stack">
          {overview.isPending && <p role="status">{t("working")}</p>}
          {overview.isError ? (
            <p role="alert" className="notice">
              {t(errorMessage(overview.error))}
            </p>
          ) : (
            overview.data && (
              <>
                <h3>{overview.data.name}</h3>
                <p>
                  {overview.data.member.role === "Admin" ? t("companyAdmin") : t("companyUser")}
                </p>
              </>
            )
          )}
          {error && (
            <p role="alert" className="notice">
              {t(error)}
            </p>
          )}
          {completed && <p role="status">{t("companyCompleted")}</p>}
          {pending && (
            <div className="notice stack">
              <p>{t("companyPending")}</p>
              <div className="actions">
                <Button disabled={working} onClick={() => submit()}>
                  {t("companyRetry")}
                </Button>
                <Button
                  variant="outline"
                  disabled={working}
                  onClick={() => {
                    void overview.refetch().then((result) => {
                      if (result.isSuccess) {
                        release();
                        void refresh();
                      }
                    });
                  }}
                >
                  {t("companyReview")}
                </Button>
              </div>
            </div>
          )}
          <Button
            variant="outline"
            disabled={working}
            onClick={() => {
              void refresh();
            }}
          >
            {t("moduleRefresh")}
          </Button>
        </CardContent>
      </Card>
      {administrator && (
        <div className="page-grid">
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>{t("companyMembers")}</h3>
              </CardTitle>
            </CardHeader>
            <CardContent className="stack">
              {members.isError ? (
                <p role="alert">{t(errorMessage(members.error))}</p>
              ) : (
                members.data?.members.map((member) => (
                  <fieldset className="record stack" key={member.user_id}>
                    <legend>{member.email ?? member.user_id}</legend>
                    <p>
                      {member.role === "Admin" ? t("companyAdmin") : t("companyUser")} ·{" "}
                      {member.active ? t("companyActive") : t("companyRemoved")}
                    </p>
                    {member.active && (
                      <div className="actions">
                        <Button
                          variant="outline"
                          disabled={working || pending}
                          onClick={() => {
                            if (
                              window.confirm(
                                t("companyChangeHelp", { member: member.email ?? member.user_id }),
                              )
                            )
                              submit(() =>
                                client.company_change_member(
                                  member.user_id,
                                  member.revision,
                                  member.role === "Admin" ? "User" : "Admin",
                                ),
                              );
                          }}
                        >
                          {t("companyChangeRole")}
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={working || pending}
                          onClick={() => {
                            if (
                              window.confirm(
                                t("companyChangeHelp", { member: member.email ?? member.user_id }),
                              )
                            )
                              submit(() =>
                                client.company_change_member(member.user_id, member.revision, null),
                              );
                          }}
                        >
                          {t("companyRemove")}
                        </Button>
                      </div>
                    )}
                  </fieldset>
                ))
              )}
              <div className="actions">
                {memberCursor && (
                  <Button variant="outline" onClick={() => setMemberCursor(null)}>
                    {t("moduleRefresh")}
                  </Button>
                )}
                {!members.isError && members.data?.next_cursor && (
                  <Button
                    variant="outline"
                    onClick={() => setMemberCursor(members.data?.next_cursor ?? null)}
                  >
                    {t("companyNextMembers")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>{t("companyInvite")}</h3>
              </CardTitle>
              <CardDescription>{t("companyDeliveryHelp")}</CardDescription>
            </CardHeader>
            <CardContent className="stack">
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
                      <Label htmlFor="invitation-email">{t("email")}</Label>
                      <Input
                        id="invitation-email"
                        type="email"
                        required
                        maxLength={254}
                        disabled={working || pending}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name="role">
                  {(field) => (
                    <div className="field">
                      <Label htmlFor="invitation-role">{t("companyChangeRole")}</Label>
                      <select
                        id="invitation-role"
                        value={field.state.value}
                        disabled={working || pending}
                        onChange={(event) => field.handleChange(selectedRole(event.target.value))}
                      >
                        <option value="User">{t("companyUser")}</option>
                        <option value="Admin">{t("companyAdmin")}</option>
                      </select>
                    </div>
                  )}
                </form.Field>
                <Button type="submit" disabled={working || pending}>
                  {t("companyInvite")}
                </Button>
              </form>
              {invitations.isError ? (
                <p role="alert">{t(errorMessage(invitations.error))}</p>
              ) : (
                invitations.data?.invitations.map((invitation) => (
                  <fieldset className="record stack" key={invitation.id}>
                    <legend>{invitation.email}</legend>
                    <p>
                      {t(invitationStatus[invitation.status])} · {t(delivery[invitation.delivery])}
                    </p>
                    {invitation.status === "Pending" && (
                      <Button
                        variant="outline"
                        disabled={working || pending}
                        onClick={() => submit(() => client.company_revoke(invitation.id))}
                      >
                        {t("companyRevoke")}
                      </Button>
                    )}
                  </fieldset>
                ))
              )}
              <div className="actions">
                {inviteCursor && (
                  <Button variant="outline" onClick={() => setInviteCursor(null)}>
                    {t("moduleRefresh")}
                  </Button>
                )}
                {!invitations.isError && invitations.data?.next_cursor && (
                  <Button
                    variant="outline"
                    onClick={() => setInviteCursor(invitations.data?.next_cursor ?? null)}
                  >
                    {t("companyNextInvitations")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
