import type {
  CompanyCommand,
  Organization,
  OrganizationDeliveryView,
  OrganizationInvitationStatusView,
  OrganizationMemberView,
  OrganizationRoleView,
} from "@nds/runtime";
import { useForm } from "@tanstack/react-form";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRuntime } from "@/shared/api/runtime";
import { type SimpleMessageKey, useText } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { OrganizationOwner } from "./organization-owner";

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
  const { client, scope, busy, workPermitted } = useRuntime();
  const { t } = useText();
  const owner = useMemo(() => new OrganizationOwner(client, scope), [client, scope]);
  const state = useSyncExternalStore(owner.subscribe, owner.snapshot);
  const [memberCursor, setMemberCursor] = useState<string | null>(null);
  const [inviteCursor, setInviteCursor] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [confirmation, setConfirmation] = useState<{
    owner: OrganizationOwner;
    selectionToken: object;
    member: OrganizationMemberView;
    role: OrganizationRoleView | null;
  } | null>(null);
  useEffect(() => {
    owner.start();
    const clock = window.setInterval(() => owner.observe(), 1000);
    return () => {
      clearInterval(clock);
      owner.stop();
    };
  }, [owner]);
  useEffect(() => {
    owner.permit(workPermitted);
  }, [owner, workPermitted]);
  const { overview, members, invitations, working, pending, completed, error } = state;
  const current = owner.isCurrent();
  const enabled = !busy && !working && !pending && workPermitted && current;
  const administrator =
    current && overview?.member.active === true && overview.member.role === "Admin";
  const defaults: { email: string; role: OrganizationRoleView } = { email: "", role: "User" };
  const form = useForm({
    defaultValues: defaults,
    onSubmitMeta: { owner, selectionToken: state.selectionToken },
    onSubmit: ({ value, meta }) => {
      if (meta.owner !== owner) return;
      return owner.submit(
        (organization) => organization.invite(value.email, value.role),
        meta.selectionToken,
      );
    },
  });
  const formContext = useRef<{ owner: OrganizationOwner; selectionToken: object } | null>(null);
  useEffect(() => {
    if (
      formContext.current?.owner === owner &&
      formContext.current.selectionToken === state.selectionToken
    )
      return;
    formContext.current = { owner, selectionToken: state.selectionToken };
    form.reset();
    setName("");
    setMemberCursor(null);
    setInviteCursor(null);
    setConfirmation(null);
  }, [form, owner, state.selectionToken]);
  function submit(prepare: (organization: Organization) => Promise<CompanyCommand>) {
    void owner.submit(prepare, state.selectionToken);
  }
  function refresh() {
    return owner.refresh(memberCursor, inviteCursor, state.selectionToken);
  }
  function change(member: OrganizationMemberView, role: OrganizationRoleView | null) {
    if (enabled && owner.matchesSelection(state.selectionToken))
      setConfirmation({ owner, selectionToken: state.selectionToken, member, role });
  }
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
          <div className="field">
            <Label htmlFor="organization-space">{t("companySpace")}</Label>
            <select
              id="organization-space"
              value={state.selected}
              disabled={!enabled}
              onChange={(event) => {
                void owner.select(event.target.value, state.selectionToken);
              }}
            >
              <option value="">{t("companyPersonal")}</option>
              {state.choices.map((choice) => (
                <option key={choice.company_id} value={choice.company_id}>
                  {choice.name} ·{" "}
                  {choice.member.role === "Admin" ? t("companyAdmin") : t("companyUser")} ·{" "}
                  {choice.company_id}
                </option>
              ))}
            </select>
          </div>
          {!state.selected && <p>{t("companyPersonalHelp")}</p>}
          <div className="field">
            <Label htmlFor="organization-name">{t("companyName")}</Label>
            <Input
              id="organization-name"
              value={name}
              maxLength={160}
              disabled={!enabled}
              onChange={(event) => setName(event.target.value)}
            />
            <Button
              disabled={!enabled || !name.trim()}
              onClick={() => {
                void owner.create(name.trim(), state.selectionToken);
              }}
            >
              {t("companyCreate")}
            </Button>
            <p>{t("companyCreateHelp")}</p>
          </div>
          {working && <p role="status">{t("working")}</p>}
          {state.closed && <p role="alert">{t("companyContextClosed")}</p>}
          {current && overview && (
            <>
              <h3>{overview.name}</h3>
              <p>{overview.member.role === "Admin" ? t("companyAdmin") : t("companyUser")}</p>
            </>
          )}
          {error && (
            <p role="alert" className="notice">
              {t(error)}
            </p>
          )}
          {completed && <p role="status">{t("companyCompleted")}</p>}
          {state.reviewed && <p role="status">{t("companyReviewedUnknown")}</p>}
          {pending && (
            <div className="notice stack">
              <p>{t("companyPending")}</p>
              <div className="actions">
                <Button
                  disabled={
                    working || busy || !workPermitted || !owner.canRetry(state.commandToken)
                  }
                  onClick={() => {
                    void owner.retry(state.commandToken);
                  }}
                >
                  {t("companyRetry")}
                </Button>
                <Button
                  variant="outline"
                  disabled={working || busy || !workPermitted || !current}
                  onClick={() => {
                    void owner.review(state.commandToken);
                  }}
                >
                  {t("companyReview")}
                </Button>
              </div>
            </div>
          )}
          <Button
            variant="outline"
            disabled={working || busy || !workPermitted || !current}
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
              {members?.members.map((member) => (
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
                        disabled={!enabled}
                        onClick={() => change(member, member.role === "Admin" ? "User" : "Admin")}
                      >
                        {t("companyChangeRole")}
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={!enabled}
                        onClick={() => change(member, null)}
                      >
                        {t("companyRemove")}
                      </Button>
                    </div>
                  )}
                </fieldset>
              ))}
              <div className="actions">
                {memberCursor && (
                  <Button
                    variant="outline"
                    disabled={working || !current}
                    onClick={() => {
                      setMemberCursor(null);
                      void owner.refresh(null, inviteCursor, state.selectionToken);
                    }}
                  >
                    {t("moduleRefresh")}
                  </Button>
                )}
                {members?.next_cursor && (
                  <Button
                    variant="outline"
                    disabled={working || !current}
                    onClick={() => {
                      const next = members?.next_cursor ?? null;
                      setMemberCursor(next);
                      void owner.refresh(next, inviteCursor, state.selectionToken);
                    }}
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
                  // Capture at the DOM event, before the form's awaited validation.
                  void form.handleSubmit({ owner, selectionToken: state.selectionToken });
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
                        disabled={!enabled}
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
                        disabled={!enabled}
                        onChange={(event) => field.handleChange(selectedRole(event.target.value))}
                      >
                        <option value="User">{t("companyUser")}</option>
                        <option value="Admin">{t("companyAdmin")}</option>
                      </select>
                    </div>
                  )}
                </form.Field>
                <Button type="submit" disabled={!enabled}>
                  {t("companyInvite")}
                </Button>
              </form>
              {invitations?.invitations.map((invitation) => (
                <fieldset className="record stack" key={invitation.id}>
                  <legend>{invitation.email}</legend>
                  <p>
                    {t(invitationStatus[invitation.status])} · {t(delivery[invitation.delivery])}
                  </p>
                  {invitation.status === "Pending" && (
                    <Button
                      variant="outline"
                      disabled={!enabled}
                      onClick={() => submit((organization) => organization.revoke(invitation.id))}
                    >
                      {t("companyRevoke")}
                    </Button>
                  )}
                </fieldset>
              ))}
              <div className="actions">
                {inviteCursor && (
                  <Button
                    variant="outline"
                    disabled={working || !current}
                    onClick={() => {
                      setInviteCursor(null);
                      void owner.refresh(memberCursor, null, state.selectionToken);
                    }}
                  >
                    {t("moduleRefresh")}
                  </Button>
                )}
                {invitations?.next_cursor && (
                  <Button
                    variant="outline"
                    disabled={working || !current}
                    onClick={() => {
                      const next = invitations?.next_cursor ?? null;
                      setInviteCursor(next);
                      void owner.refresh(memberCursor, next, state.selectionToken);
                    }}
                  >
                    {t("companyNextInvitations")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {confirmation &&
        confirmation.owner === owner &&
        confirmation.selectionToken === state.selectionToken &&
        current && (
          <dialog
            ref={(dialog) => {
              if (dialog && !dialog.open) dialog.showModal();
            }}
            onCancel={(event) => {
              event.preventDefault();
              setConfirmation(null);
            }}
          >
            <h3>{t(confirmation.role == null ? "companyRemove" : "companyChangeRole")}</h3>
            <p>
              {t("companyChangeHelp", {
                member: confirmation.member.email ?? confirmation.member.user_id,
              })}
            </p>
            <div className="actions">
              <Button variant="outline" onClick={() => setConfirmation(null)}>
                {t("cancel")}
              </Button>
              <Button
                disabled={!enabled}
                onClick={() => {
                  const captured = confirmation;
                  setConfirmation(null);
                  if (
                    captured.owner === owner &&
                    owner.matchesSelection(captured.selectionToken) &&
                    owner.isCurrent()
                  )
                    submit((organization) =>
                      organization.change_member(
                        captured.member.user_id,
                        captured.member.revision,
                        captured.role,
                      ),
                    );
                }}
              >
                {t("companyConfirm")}
              </Button>
            </div>
          </dialog>
        )}
    </div>
  );
}
