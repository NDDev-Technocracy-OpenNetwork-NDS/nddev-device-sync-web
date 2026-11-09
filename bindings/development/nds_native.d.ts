/* tslint:disable */
/* eslint-disable */
/**
 * A local sink is never evidence of remote collection or searchable delivery.
 */
export interface LocalDiagnostics {
    sink_initialized: boolean;
    /**
     * Actual local collection state; None means the SDK is unavailable.
     */
    collection_enabled: boolean | null;
    debug_enabled: boolean;
    debug_scope: DebugScope | null;
    rejected_fields_or_events: bigint | null;
    dropped_events: bigint | null;
    pending_events: bigint | null;
    write_failures: bigint | null;
    terminating: boolean | null;
    shutdown_incomplete: boolean | null;
}

/**
 * Authenticated device control as observed by this client (ADR 0018).
 * Presentation only: Rust admission decides with the same values.
 */
export interface DeviceControlView {
    /**
     * `fullauto` or `manual`.
     */
    mode: string;
    purposes: string[];
    /**
     * Zero means no authenticated policy was observed; manual applies.
     */
    revision: bigint;
    /**
     * `server`, `cached` (server unreachable) or `default` (never observed).
     */
    source: string;
}

/**
 * Bounded public credential metadata; no verifier/public-key bodies or secrets.
 */
export interface PasskeyView {
    id: string;
    created_at: string;
}

/**
 * Clipboard metadata only; plaintext is consumed by the native OS adapter.
 */
export interface ClipboardView {
    present: boolean;
    id: string;
    device_id: string;
    server_seq: bigint;
    bytes: number;
    conflicted: boolean;
}

/**
 * One stored diagnostic record: fixed, redacted fields only; absent fields are empty.
 */
export interface DiagnosticRecordView {
    timestamp: string;
    service_name: string;
    event_name: string;
    name: string;
    module: string;
    outcome: string;
    error_type: string;
    operation_id: string;
    device_id: string;
    duration_ms: number | null;
}

/**
 * Presentation state, never a bearer credential or a wire request.
 */
export interface View {
    invitation_pending: boolean;
    devices: DeviceView[];
    current_device_id: string;
    devices_checked_at: bigint;
    email_available: boolean;
    github_available: boolean;
    passkey_available: boolean;
    credential_store_ready: boolean;
    server_version: string;
    authenticated: boolean;
    session_verified: boolean;
    offline_authorized: boolean;
    offline_cache_ready: boolean;
    logout_pending: boolean;
    credential_revalidation_required: boolean;
    session_checked_at: bigint;
    user_id: string;
    tenant_id: string;
    auth_method: string;
    expires_at: string;
    flow: string;
    authorization_url: string;
    verification_code: string;
    expires_in_seconds: number;
    retry_after_seconds: number;
}

/**
 * Public metadata only; signing keys never cross the presentation boundary.
 */
export interface DeviceView {
    device_id: string;
    display_name: string;
    platform: string;
    revoked: boolean;
    is_current: boolean;
    created_at: string;
}

/**
 * Saved owner intent, not provider access or this device's consent.
 */
export interface GithubSourceView {
    credential: GithubCredentialReference | null;
    revision: string;
    pending_id: string | null;
    local_revision: string;
    conflicted: boolean;
}

/**
 * The device's effective collection policy as the server last stated it. Named apart from
 * the protocol's `CollectionMode` so bindings generated from this view never confuse them. `Debug` is always
 * finite: `DeliveryView::debug_expires_at` carries its end. The host that owns the local
 * telemetry controller opens or closes its own debug window from it.
 */
export type DeliveryCollection = "Unknown" | "Standard" | "Debug" | "Off";

export interface ConflictView {
    title: string;
    username: string;
    device_id: string;
    deleted: boolean;
}

export interface DeliveryView {
    initialized: boolean;
    /**
     * Last demonstrated payload-write readiness of the platform durable spool.
     */
    local_persistence_ready: boolean | null;
    policy: ExportPolicy;
    collection: DeliveryCollection;
    /**
     * Unix seconds when the debug collection window ends; 0 outside debug.
     */
    debug_expires_at: bigint;
    paused: boolean;
    pending: number;
    delivered: bigint;
    dropped: bigint;
    failures: bigint;
    spans_pending: number;
    spans_delivered: bigint;
    spans_dropped: bigint;
    spans_failures: bigint;
    last_success_at: bigint;
}

export interface DeviceModuleView {
    id: string;
    version: string;
    supported: boolean;
    installed: boolean | null;
    local_tool_supported: boolean;
    local_tool_installed: boolean | null;
    enabled: boolean;
    permissions: string[];
    required_permissions: string[];
    optional_permissions: string[];
    readiness: string;
    checked_at_ms: bigint | null;
    error_class: string | null;
    revision: bigint;
    pending_id: string | null;
    conflicted: boolean;
}

export interface DiagnosticPage {
    records: DiagnosticRecordView[];
    truncated: boolean;
}

export interface GithubCommitSyncView {
    outcome: string;
    reason: string;
    /**
     * Actual local completion time; absent while an attempt is running.
     */
    observed_at_ms: string | null;
}

export interface GithubConnectionView {
    /**
     * Connection is distinct from successful synchronization of commits.
     */
    outcome: string;
    reason: string;
    relative_path: string;
    intent_queued: boolean;
}

export interface GithubCredentialReference {
    record_ref: string;
    title: string;
    username: string;
    revision: string;
    pending_id: string | null;
}

export interface GithubCredentialReferencePage {
    items: GithubCredentialReference[];
    next_after: string;
    has_more: boolean;
}

export interface GithubObservationView {
    revision: string;
    pending: boolean;
    conflicted: boolean;
    observed_at_ms: string;
}

export interface GithubOwnerView {
    id: string;
    login: string;
    kind: GithubOwnerKindView;
}

export interface GithubRepositoryGroupView {
    owner: GithubOwnerView;
    repositories: GithubRepositorySummaryView[];
}

export interface GithubRepositoryPageView {
    principal: GithubOwnerView;
    groups: GithubRepositoryGroupView[];
    observed_at_ms: string;
    continuation: GithubCatalogContinuationView;
}

export interface GithubRepositorySummaryView {
    id: string;
    name: string;
    visibility: GithubRepositoryVisibilityView;
    archived: boolean;
    default_branch: string | null;
}

export interface GithubSavedOwnerView {
    owner: GithubOwnerView;
    observation: GithubObservationView;
}

export interface GithubSavedRepositoryGroupView {
    owner_id: string;
    owner: GithubSavedOwnerView | null;
    repositories: GithubSavedRepositoryView[];
    /**
     * The owner is on the host's ignored-account list: its saved data stays, but it is not
     * discovered, connected or synchronized and is left out of counts and actions.
     */
    ignored: boolean;
}

export interface GithubSavedRepositoryPageView {
    local_workspace_supported: boolean;
    groups: GithubSavedRepositoryGroupView[];
    observed_seq: string;
    local_revision: string;
    has_more: boolean;
}

export interface GithubSavedRepositoryView {
    repository: GithubRepositorySummaryView;
    observation: GithubObservationView;
    synchronization: GithubCommitSyncView | null;
    /**
     * The repository itself is on the host's ignore list: its saved data stays, but it is not
     * discovered, connected or synchronized.
     */
    ignored: boolean;
}

export interface IncidentPage {
    incidents: IncidentView[];
    next_cursor: string;
    generated_at: string;
}

export interface IncidentView {
    id: string;
    service: string;
    kind: string;
    severity: string;
    state: string;
    revision: bigint;
    occurrences: bigint;
    first_seen: string;
    last_seen: string;
    silenced_until: string;
}

export interface OrganizationInvitationPageView {
    invitations: OrganizationInvitationView[];
    next_cursor: string | null;
}

export interface OrganizationInvitationView {
    id: string;
    issuer_user_id: string;
    email: string;
    role: OrganizationRoleView;
    expires_at_ms: bigint;
    status: OrganizationInvitationStatusView;
    delivery: OrganizationDeliveryView;
}

export interface OrganizationMemberPageView {
    members: OrganizationMemberView[];
    next_cursor: string | null;
}

export interface OrganizationMemberView {
    user_id: string;
    email: string | null;
    role: OrganizationRoleView;
    active: boolean;
    revision: bigint;
}

export interface OrganizationOverviewView {
    company_id: string;
    name: string;
    revision: bigint;
    member: OrganizationMemberView;
}

export interface RecordPage {
    observed_seq: bigint;
    local_revision: bigint;
    items: RecordView[];
    next_after: string;
    has_more: boolean;
}

export interface RecordView {
    observed_seq: bigint;
    deleted: boolean;
    id: string;
    title: string;
    username: string;
    revision: bigint;
    /**
     * Local operation identity for optimistic editing; not a server revision.
     */
    pending_id: string | null;
    conflicted: boolean;
    conflict: ConflictView | null;
}

export interface StatePage {
    observed_seq: bigint;
    local_revision: bigint;
    items: StateView[];
    next_after: string;
    has_more: boolean;
}

export interface StateView {
    kind: string;
    id: string;
    device_id: string;
    label: string;
    version: string;
    platform: string;
    reachability: string;
    configured: boolean;
    enabled: boolean | null;
    permissions: string[];
    checked_at_ms: bigint;
    observed_at_ms: bigint;
    expires_at_ms: bigint;
    error_class: string;
    revision: bigint;
    pending_id: string | null;
    conflicted: boolean;
}

export interface VaultView {
    unlocked: boolean;
    key_id: string;
    pending: number;
    conflicts: number;
    cursor: bigint;
    /**
     * Local durable mutation counter, independent of the committed cursor.
     */
    local_revision: bigint;
    last_sync_at: bigint;
    catching_up: boolean;
    sync_error: string;
    /**
     * Browser retention preference observed at client startup; native is None.
     * Even persistent browser storage can be cleared explicitly by the user.
     */
    browser_persistent: boolean | null;
}

export type ClientLifecycle = "Ready" | "Resumed" | "Inactive" | "Hidden" | "Paused" | "Detached";

export type DebugScope = "Http" | "Transport" | "Database" | "Io" | "Process";

export type ExportPolicy = "Unknown" | "Enabled" | "Disabled";

export type FailureKind = "FlutterFramework" | "DartUnhandled" | "NativeBridge" | "ReactRender" | "BrowserUnhandled";

export type GithubCatalogContinuationView = "More" | "EndOfAccessScope" | "LimitReached";

export type GithubOwnerKindView = "User" | "Organization";

export type GithubRepositoryVisibilityView = "Public" | "Private" | "Internal";

export type OrganizationDeliveryView = "Pending" | "Accepted" | "Failed" | "Unknown";

export type OrganizationInvitationStatusView = "Pending" | "Accepted" | "Expired" | "Revoked";

export type OrganizationRoleView = "Admin" | "User";


export class CompanyCommand {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    execute(): Promise<void>;
    is_current(): boolean;
}

export class NdsClient {
    free(): void;
    [Symbol.dispose](): void;
    cancel(): void;
    cancel_github_catalog(): void;
    clear_github_catalog_source(expected_revision: string, expected_pending?: string | null): Promise<void>;
    clipboard_copy(ticket?: string | null): Promise<void>;
    clipboard_publish_text(text: string): Promise<string>;
    clipboard_snapshot(): Promise<ClipboardView>;
    configure_module(module: string, enabled: boolean, permissions: Array<any>, expected_revision: bigint, pending_id?: string | null): Promise<void>;
    create_organization(name: string): Promise<CompanyCommand>;
    delivery_snapshot(): DeliveryView;
    device_modules(): Promise<DeviceModuleView[]>;
    diagnostic_search(organization_id: string, traces: boolean, minutes: number, limit: number): Promise<DiagnosticPage>;
    github_catalog_credentials(after: string): Promise<GithubCredentialReferencePage>;
    github_catalog_source(): Promise<GithubSourceView>;
    github_repository_page(next_page: boolean): Promise<GithubRepositoryPageView>;
    import_browser_invitation(): Promise<View>;
    incident_action(id: string, expected: bigint, silence_seconds: number): Promise<IncidentView>;
    incidents(after: string): Promise<IncidentPage>;
    lifecycle(state: ClientLifecycle): boolean;
    logout(): Promise<View>;
    constructor(endpoint: string);
    organizations(): Promise<OrganizationOverviewView[]>;
    passkeys(): Promise<PasskeyView[]>;
    poll_github(): Promise<View>;
    poll_passkey(): Promise<View>;
    prepare_device(name: string): Promise<View>;
    publish_device_state(): Promise<VaultView>;
    reconcile(): Promise<View>;
    refresh(): Promise<View>;
    refresh_devices(): Promise<View>;
    request_email(email: string, locale: string): Promise<View>;
    reserve_clipboard_copy(): string | undefined;
    revoke_device(id: string): Promise<View>;
    revoke_passkey(id: string): Promise<View>;
    saved_github_repository_page(next_page: boolean): Promise<GithubSavedRepositoryPageView>;
    select_github_credential(record_ref: string, revision: string, pending_id: string | null | undefined, expected_source_revision: string, expected_source_pending?: string | null): Promise<void>;
    select_organization(company: string, membership_revision: bigint): Promise<Organization>;
    snapshot(): View;
    start_github(locale: string): Promise<View>;
    start_passkey(register: boolean, email: string | null | undefined, locale: string): Promise<View>;
    sync_states(after: string): Promise<StatePage>;
    vault_copy_secret(id: string, ticket?: string | null): Promise<void>;
    vault_delete(id: string, expected: bigint, pending?: string | null): Promise<VaultView>;
    vault_records(after: string): Promise<RecordPage>;
    vault_refresh(): Promise<VaultView>;
    vault_resolve(id: string, expected: bigint, pending: string | null | undefined, cursor: bigint, use_conflict: boolean): Promise<VaultView>;
    vault_save(id: string | null | undefined, expected: bigint, pending: string | null | undefined, title: string, username: string, secret: string): Promise<VaultView>;
    vault_snapshot(): Promise<VaultView>;
    vault_sync(): Promise<VaultView>;
    verify_email(code: string): Promise<View>;
}

export class Organization {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    change_member(user: string, expected: bigint, role?: OrganizationRoleView | null): Promise<CompanyCommand>;
    close(): void;
    invitations(after?: string | null): Promise<OrganizationInvitationPageView>;
    invite(email: string, role: OrganizationRoleView): Promise<CompanyCommand>;
    is_current(): boolean;
    members(after?: string | null): Promise<OrganizationMemberPageView>;
    overview(): Promise<OrganizationOverviewView>;
    revoke(id: string): Promise<CompanyCommand>;
}

export function capture_invitation_link(route: string): void;

export function client_diagnostics(): LocalDiagnostics;

export function configure_debug(scope: DebugScope, seconds: number): void;

export function initialize_app(): void;

export function nds_journal_execute(command: string): string;

export function nds_journal_open(scope: string): Promise<void>;

export function nds_journal_pause(): void;

export function nds_journal_resume(): Promise<void>;

export function new_vault_record_id(): string;

export function record_client_failure(kind: FailureKind): boolean;

export function record_client_lifecycle(state: ClientLifecycle): boolean;

export function shutdown_telemetry(): Promise<LocalDiagnostics>;

export function supports_clipboard(): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_companycommand_free: (a: number, b: number) => void;
    readonly __wbg_ndsclient_free: (a: number, b: number) => void;
    readonly __wbg_organization_free: (a: number, b: number) => void;
    readonly capture_invitation_link: (a: number, b: number) => [number, number];
    readonly client_diagnostics: () => [number, number, number];
    readonly companycommand_execute: (a: number) => any;
    readonly companycommand_is_current: (a: number) => number;
    readonly configure_debug: (a: any, b: any) => [number, number];
    readonly initialize_app: () => [number, number];
    readonly nds_journal_execute: (a: number, b: number) => [number, number, number, number];
    readonly nds_journal_open: (a: number, b: number) => any;
    readonly nds_journal_pause: () => [number, number];
    readonly nds_journal_resume: () => any;
    readonly ndsclient_cancel: (a: number) => void;
    readonly ndsclient_cancel_github_catalog: (a: number) => void;
    readonly ndsclient_clear_github_catalog_source: (a: number, b: number, c: number, d: number, e: number) => any;
    readonly ndsclient_clipboard_copy: (a: number, b: number, c: number) => any;
    readonly ndsclient_clipboard_publish_text: (a: number, b: number, c: number) => any;
    readonly ndsclient_clipboard_snapshot: (a: number) => any;
    readonly ndsclient_configure_module: (a: number, b: number, c: number, d: any, e: any, f: any, g: number, h: number) => any;
    readonly ndsclient_create_organization: (a: number, b: number, c: number) => any;
    readonly ndsclient_delivery_snapshot: (a: number) => [number, number, number];
    readonly ndsclient_device_modules: (a: number) => any;
    readonly ndsclient_diagnostic_search: (a: number, b: number, c: number, d: any, e: any, f: any) => any;
    readonly ndsclient_github_catalog_credentials: (a: number, b: number, c: number) => any;
    readonly ndsclient_github_catalog_source: (a: number) => any;
    readonly ndsclient_github_repository_page: (a: number, b: any) => any;
    readonly ndsclient_import_browser_invitation: (a: number) => any;
    readonly ndsclient_incident_action: (a: number, b: number, c: number, d: any, e: any) => any;
    readonly ndsclient_incidents: (a: number, b: number, c: number) => any;
    readonly ndsclient_lifecycle: (a: number, b: any) => [number, number, number];
    readonly ndsclient_logout: (a: number) => any;
    readonly ndsclient_new: (a: number, b: number) => [number, number, number];
    readonly ndsclient_organizations: (a: number) => any;
    readonly ndsclient_passkeys: (a: number) => any;
    readonly ndsclient_poll_github: (a: number) => any;
    readonly ndsclient_poll_passkey: (a: number) => any;
    readonly ndsclient_prepare_device: (a: number, b: number, c: number) => any;
    readonly ndsclient_publish_device_state: (a: number) => any;
    readonly ndsclient_reconcile: (a: number) => any;
    readonly ndsclient_refresh: (a: number) => any;
    readonly ndsclient_refresh_devices: (a: number) => any;
    readonly ndsclient_request_email: (a: number, b: number, c: number, d: number, e: number) => any;
    readonly ndsclient_reserve_clipboard_copy: (a: number) => [number, number, number, number];
    readonly ndsclient_revoke_device: (a: number, b: number, c: number) => any;
    readonly ndsclient_revoke_passkey: (a: number, b: number, c: number) => any;
    readonly ndsclient_saved_github_repository_page: (a: number, b: any) => any;
    readonly ndsclient_select_github_credential: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => any;
    readonly ndsclient_select_organization: (a: number, b: number, c: number, d: any) => any;
    readonly ndsclient_snapshot: (a: number) => [number, number, number];
    readonly ndsclient_start_github: (a: number, b: number, c: number) => any;
    readonly ndsclient_start_passkey: (a: number, b: any, c: number, d: number, e: number, f: number) => any;
    readonly ndsclient_sync_states: (a: number, b: number, c: number) => any;
    readonly ndsclient_vault_copy_secret: (a: number, b: number, c: number, d: number, e: number) => any;
    readonly ndsclient_vault_delete: (a: number, b: number, c: number, d: any, e: number, f: number) => any;
    readonly ndsclient_vault_records: (a: number, b: number, c: number) => any;
    readonly ndsclient_vault_refresh: (a: number) => any;
    readonly ndsclient_vault_resolve: (a: number, b: number, c: number, d: any, e: number, f: number, g: any, h: any) => any;
    readonly ndsclient_vault_save: (a: number, b: number, c: number, d: any, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => any;
    readonly ndsclient_vault_snapshot: (a: number) => any;
    readonly ndsclient_vault_sync: (a: number) => any;
    readonly ndsclient_verify_email: (a: number, b: number, c: number) => any;
    readonly new_vault_record_id: () => [number, number];
    readonly organization_change_member: (a: number, b: number, c: number, d: any, e: number) => any;
    readonly organization_close: (a: number) => void;
    readonly organization_invitations: (a: number, b: number, c: number) => any;
    readonly organization_invite: (a: number, b: number, c: number, d: any) => any;
    readonly organization_is_current: (a: number) => number;
    readonly organization_members: (a: number, b: number, c: number) => any;
    readonly organization_overview: (a: number) => any;
    readonly organization_revoke: (a: number, b: number, c: number) => any;
    readonly record_client_failure: (a: any) => [number, number, number];
    readonly record_client_lifecycle: (a: any) => [number, number, number];
    readonly shutdown_telemetry: () => any;
    readonly supports_clipboard: () => number;
    readonly rust_sqlite_wasm_abort: () => void;
    readonly rust_sqlite_wasm_assert_fail: (a: number, b: number, c: number, d: number) => void;
    readonly rust_sqlite_wasm_calloc: (a: number, b: number) => number;
    readonly rust_sqlite_wasm_malloc: (a: number) => number;
    readonly rust_sqlite_wasm_free: (a: number) => void;
    readonly rust_sqlite_wasm_getentropy: (a: number, b: number) => number;
    readonly rust_sqlite_wasm_localtime: (a: number) => number;
    readonly rust_sqlite_wasm_realloc: (a: number, b: number) => number;
    readonly sqlite3_os_end: () => number;
    readonly sqlite3_os_init: () => number;
    readonly ring_core_0_17_14__bn_mul_mont: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly wasm_bindgen_3fe5eb340a9a16dc___convert__closures_____invoke___alloc_42d2b33bd937efdb___string__String__core_37ee0ce0c4cd57d5___result__Result_alloc_42d2b33bd937efdb___string__String__wasm_bindgen_3fe5eb340a9a16dc___JsValue___true_: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly wasm_bindgen_3fe5eb340a9a16dc___convert__closures_____invoke___js_sys_1005db6f334d89e1___Function_fn_wasm_bindgen_3fe5eb340a9a16dc___JsValue_____wasm_bindgen_3fe5eb340a9a16dc___sys__Undefined___js_sys_1005db6f334d89e1___Function_fn_wasm_bindgen_3fe5eb340a9a16dc___JsValue_____wasm_bindgen_3fe5eb340a9a16dc___sys__Undefined_______true_: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen_3fe5eb340a9a16dc___convert__closures_____invoke___wasm_bindgen_3fe5eb340a9a16dc___JsValue__core_37ee0ce0c4cd57d5___result__Result_____wasm_bindgen_3fe5eb340a9a16dc___JsError___true_: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_3fe5eb340a9a16dc___convert__closures_____invoke___bool__true_: (a: number, b: number) => number;
    readonly wasm_bindgen_3fe5eb340a9a16dc___convert__closures_____invoke_______true_: (a: number, b: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_destroy_closure: (a: number, b: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
