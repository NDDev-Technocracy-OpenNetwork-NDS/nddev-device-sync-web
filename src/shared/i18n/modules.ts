import type { SimpleMessageKey } from "@/shared/i18n";

export function permissionLabel(value: string): SimpleMessageKey {
  switch (value) {
    case "read_only":
      return "permissionReadOnly";
    case "credential_store":
      return "permissionCredentialStore";
    case "process_execution":
      return "permissionProcessExecution";
    case "local_network":
      return "permissionLocalNetwork";
    case "user_service":
      return "permissionUserService";
    case "clipboard":
      return "permissionClipboard";
    case "git_write":
      return "permissionGitWrite";
    case "browser_control":
      return "permissionBrowserControl";
    default:
      return "modulePermissions";
  }
}
export function readinessLabel(value: string): SimpleMessageKey {
  switch (value) {
    case "disabled":
      return "moduleDisabled";
    case "unsupported":
      return "providerUnavailable";
    case "not_installed":
      return "moduleNotInstalled";
    case "permission_required":
      return "modulePermissionRequired";
    case "conflicted":
      return "moduleConfigurationConflict";
    case "ready":
      return "reachable";
    case "unavailable":
      return "providerUnavailable";
    case "failed":
      return "providerFailed";
    default:
      return "notChecked";
  }
}
export function moduleLabel(value: string): SimpleMessageKey | null {
  switch (value) {
    case "sysinfo":
      return "systemInfo";
    case "clipboard":
      return "clipboardHistory";
    case "cleaner":
      return "cleaner";
    case "updater":
      return "updater";
    case "browser-use":
      return "browserAutomation";
    case "cache":
      return "networkCache";
    default:
      return null;
  }
}
