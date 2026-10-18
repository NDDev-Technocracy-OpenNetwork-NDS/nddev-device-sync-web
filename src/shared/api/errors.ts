import type { SimpleMessageKey } from "../i18n";

// Presentation mapping only. Authorization and retry policy remain in Rust.
const messages: Readonly<Record<string, SimpleMessageKey>> = {
  module_configuration_changed: "moduleSettingsChanged",
  module_disabled: "moduleDisabled",
  module_permission_required: "modulePermissionRequired",
  module_configuration_conflict: "moduleConfigurationConflict",
  module_not_installed: "moduleNotInstalled",
  module_unsupported: "providerUnavailable",
  invalid_endpoint: "endpointError",
  invalid_input: "inputError",
  transport_unavailable: "networkError",
  request_timeout: "networkError",
  dependency_unavailable: "networkError",
  credential_store_unavailable: "storeError",
  vault_storage_unavailable: "vaultStorageUnavailable",
  vault_storage_full: "storageFull",
  credential_revalidation_required: "revalidationRequired",
  invalid_response: "responseError",
  cancelled: "cancelledError",
  busy: "rateError",
  online_verification_required: "rateError",
  server_busy: "rateError",
  authentication_failed: "authError",
  challenge_expired: "expiredError",
  device_revoked: "deviceRevokedHelp",
  rate_limited: "rateError",
  authorization_denied: "companyDenied",
  last_administrator: "companyLastAdmin",
  operation_conflict: "companyConflict",
  command_expired: "companyExpired",
  invitation_unavailable: "companyInvitationUnavailable",
  recent_authentication_required: "passkeyFreshLogin",
  browser_unavailable: "launchError",
  method_unavailable: "unavailable",
  diagnostics_unavailable: "diagnosticsUnavailable",
  telemetry_unavailable: "telemetryUnavailable",
  vault_invalid_input: "vaultInputError",
  vault_locked: "vaultLocked",
  vault_authentication_failed: "vaultProofError",
  vault_dependency_unavailable: "vaultDependencyUnavailable",
  vault_busy: "rateError",
  vault_cancelled: "cancelledError",
  vault_key_registration_required: "vaultRegistrationRequired",
  sync_capacity_exhausted: "serverCapacityExhausted",
};
export function errorMessage(error: unknown): SimpleMessageKey {
  return error instanceof Error && Object.hasOwn(messages, error.message)
    ? (messages[error.message] ?? "genericError")
    : "genericError";
}
