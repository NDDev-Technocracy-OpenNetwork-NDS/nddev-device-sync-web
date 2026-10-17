import { record_client_failure } from "@nds/runtime";

export function reportFailure(kind: "ReactRender" | "BrowserUnhandled"): void {
  try {
    record_client_failure(kind);
  } catch {
    // A failed SDK cannot safely report itself. Never print exception payloads.
  }
}
