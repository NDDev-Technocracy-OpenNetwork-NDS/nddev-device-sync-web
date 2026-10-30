import type {
  CompanyCommand,
  NdsClient,
  Organization,
  OrganizationInvitationPageView,
  OrganizationMemberPageView,
  OrganizationOverviewView,
  View,
} from "@nds/runtime";
import { errorMessage } from "@/shared/api/errors";
import type { SimpleMessageKey } from "@/shared/i18n";

// Presentation ownership only. Rust retains credentials, membership admission,
// immutable commands and the final result fence. No opaque handle enters Query.
type Client = Pick<NdsClient, "organizations" | "select_organization" | "create_organization"> & {
  snapshot(): Pick<View, "authenticated" | "tenant_id" | "user_id" | "current_device_id">;
};
interface Presentation {
  selectionToken: object;
  commandToken: object | null;
  choices: OrganizationOverviewView[];
  overview: OrganizationOverviewView | null;
  members: OrganizationMemberPageView | null;
  invitations: OrganizationInvitationPageView | null;
  selected: string;
  working: boolean;
  pending: boolean;
  completed: boolean;
  reviewed: boolean;
  closed: boolean;
  error: SimpleMessageKey | null;
}
const empty = (selectionToken: object): Presentation => ({
  selectionToken,
  commandToken: null,
  choices: [],
  overview: null,
  members: null,
  invitations: null,
  selected: "",
  working: false,
  pending: false,
  completed: false,
  reviewed: false,
  closed: false,
  error: null,
});

export class OrganizationOwner {
  private active = false;
  private permitted = false;
  private loaded = false;
  private generation = {};
  private organization: Organization | null = null;
  private command: CompanyCommand | null = null;
  private operation: Promise<void> | null = null;
  private activationWaiting = false;
  private value = empty(this.generation);
  private changed = () => {};

  constructor(
    private readonly client: Client,
    private readonly scope: string,
  ) {}
  snapshot = () => this.value;
  subscribe = (changed: () => void) => {
    this.changed = changed;
    return () => {
      if (this.changed === changed) this.changed = () => {};
    };
  };
  private publish(patch: Partial<Presentation>) {
    this.value = { ...this.value, ...patch };
    this.changed();
  }
  private current(generation = this.generation, organization?: Organization | null): boolean {
    if (!this.active || this.value.closed || generation !== this.generation) return false;
    const view = this.client.snapshot();
    return (
      JSON.stringify([view.authenticated, view.tenant_id, view.user_id, view.current_device_id]) ===
        this.scope &&
      (organization == null || (organization === this.organization && organization.is_current()))
    );
  }
  private afterOperation(free: () => void) {
    const operation = this.operation;
    if (operation) void operation.then(free, free);
    else free();
  }
  private retireSelection() {
    this.generation = {};
    const organization = this.organization;
    this.organization = null;
    if (organization) {
      organization.close();
      this.afterOperation(() => organization.free());
    }
    this.publish({
      selectionToken: this.generation,
      selected: "",
      overview: null,
      members: null,
      invitations: null,
    });
  }
  private releaseCommand() {
    const command = this.command;
    this.command = null;
    if (command) this.afterOperation(() => command.free());
    this.publish({ pending: false, commandToken: null });
  }
  start() {
    this.active = true;
    this.loaded = false;
    this.publish({ ...empty(this.generation), working: this.operation !== null });
  }
  stop() {
    this.active = false;
    this.retireSelection();
    this.releaseCommand();
    this.publish({ ...empty(this.generation), closed: true });
  }
  permit(permitted: boolean) {
    this.permitted = permitted;
    if (!permitted || this.loaded || !this.current()) return;
    if (!this.operation) void this.refresh();
    else if (!this.activationWaiting) {
      this.activationWaiting = true;
      void this.operation.then(() => {
        this.activationWaiting = false;
        if (this.permitted && !this.loaded && this.current()) void this.refresh();
      });
    }
  }
  observe() {
    if (!this.active || this.value.closed) return;
    if (!this.current()) {
      this.stop();
    } else if (this.organization && !this.organization.is_current()) {
      this.retireSelection();
      this.publish({ choices: [], error: "companyContextClosed" });
    }
  }
  canRetry(commandToken: object | null = this.value.commandToken) {
    return (
      commandToken != null &&
      commandToken === this.value.commandToken &&
      this.current() &&
      this.command?.is_current() === true
    );
  }
  matchesSelection(selectionToken: object) {
    return this.current(selectionToken, this.organization);
  }
  isCurrent() {
    return this.current(this.generation, this.organization);
  }
  private run(work: () => Promise<void>): Promise<void> {
    if (this.operation || !this.permitted || !this.current()) return Promise.resolve();
    this.publish({ working: true, error: null });
    const generation = this.generation;
    // Register the one owned operation before any provider future is polled.
    const task = Promise.resolve()
      .then(async () => {
        if (this.current(generation)) await work();
      })
      .catch((error: unknown) => {
        if (this.current()) {
          if (this.organization && !this.organization.is_current()) this.retireSelection();
          const message = errorMessage(error);
          this.publish({ error: message === "inputError" ? "companyInvalid" : message });
        }
      })
      .finally(() => {
        if (this.operation === task) this.operation = null;
        if (this.active) this.publish({ working: false });
      });
    this.operation = task;
    return task;
  }
  private async load(memberAfter: string | null = null, inviteAfter: string | null = null) {
    const generation = this.generation,
      organization = this.organization;
    this.publish({ overview: null, members: null, invitations: null });
    const choices = await this.client.organizations();
    if (!this.current(generation, organization)) return false;
    if (!organization) {
      this.loaded = true;
      this.publish({ choices });
      return true;
    }
    const overview = await organization.overview();
    if (!this.current(generation, organization)) return false;
    let members: OrganizationMemberPageView | null = null;
    let invitations: OrganizationInvitationPageView | null = null;
    if (overview.member.active && overview.member.role === "Admin") {
      members = await organization.members(memberAfter);
      if (!this.current(generation, organization)) return false;
      invitations = await organization.invitations(inviteAfter);
      if (!this.current(generation, organization)) return false;
    }
    this.loaded = true;
    this.publish({ choices, overview, members, invitations });
    return true;
  }
  refresh(
    memberAfter: string | null = null,
    inviteAfter: string | null = null,
    selectionToken: object = this.generation,
  ) {
    if (!this.current(selectionToken)) return Promise.resolve();
    return this.run(async () => {
      await this.load(memberAfter, inviteAfter);
    });
  }
  select(id: string, selectionToken: object = this.generation) {
    if (!this.current(selectionToken)) return Promise.resolve();
    if (this.command) return Promise.resolve();
    return this.run(async () => {
      const choice = this.value.choices.find((entry) => entry.company_id === id);
      this.retireSelection();
      this.publish({ completed: false, reviewed: false });
      const generation = this.generation;
      if (id) {
        if (!choice) throw new Error("authorization_denied");
        const organization = await this.client.select_organization(id, choice.member.revision);
        if (!this.current(generation)) {
          organization.close();
          organization.free();
          return;
        }
        this.organization = organization;
        this.publish({ selected: id });
      }
      await this.load();
    });
  }
  private async execute() {
    const command = this.command,
      generation = this.generation;
    if (!command) return;
    await command.execute();
    if (!this.current(generation) || this.command !== command) return;
    this.releaseCommand();
    this.publish({ completed: true });
    await this.load(); // A failed read cannot undo the confirmed command.
  }
  submit(
    prepare: (organization: Organization) => Promise<CompanyCommand>,
    selectionToken: object = this.generation,
  ) {
    const organization = this.organization;
    if (!organization || this.command || !this.current(selectionToken, organization))
      return Promise.resolve();
    return this.prepare(() => prepare(organization));
  }
  create(name: string, selectionToken: object = this.generation) {
    if (!this.current(selectionToken)) return Promise.resolve();
    return this.prepare(() => this.client.create_organization(name));
  }
  private prepare(prepare: () => Promise<CompanyCommand>) {
    if (this.command) return Promise.resolve();
    return this.run(async () => {
      const generation = this.generation;
      this.publish({ completed: false, reviewed: false });
      const command = await prepare();
      if (!this.current(generation)) {
        command.free();
        return;
      }
      this.command = command;
      this.publish({ pending: true, commandToken: {} });
      await this.execute();
    });
  }
  retry(commandToken: object | null = this.value.commandToken) {
    return this.canRetry(commandToken) ? this.run(() => this.execute()) : Promise.resolve();
  }
  review(commandToken: object | null = this.value.commandToken) {
    if (commandToken == null || commandToken !== this.value.commandToken) return Promise.resolve();
    return this.run(async () => {
      if (this.organization && !this.organization.is_current()) this.retireSelection();
      if (await this.load()) {
        this.releaseCommand();
        this.publish({ reviewed: true });
      }
    });
  }
}
