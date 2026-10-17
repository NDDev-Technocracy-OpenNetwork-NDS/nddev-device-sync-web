import type { ClientLifecycle, NdsClient, View } from "@nds/runtime";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SimpleMessageKey } from "../i18n";
import { errorMessage } from "./errors";
import { reportFailure } from "./telemetry";

interface Runtime {
  client: NdsClient;
  view: View;
  scope: string;
  busy: boolean;
  error: SimpleMessageKey | null;
  invitation: InvitationState;
  run: (action: () => Promise<unknown>, enroll?: boolean) => Promise<boolean>;
  observe: () => void;
}
export type InvitationState = "none" | "received" | "invalid";
const RuntimeContext = createContext<Runtime | null>(null);
function identity(view: View): string {
  return JSON.stringify([view.authenticated, view.tenant_id, view.user_id, view.current_device_id]);
}
export function RuntimeProvider({
  client,
  children,
  initialInvitation,
}: {
  client: NdsClient;
  children: ReactNode;
  initialInvitation: InvitationState;
}) {
  const cache = useQueryClient();
  const [view, setView] = useState(() => client.snapshot());
  const scope = identity(view);
  const currentScope = useRef(scope);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SimpleMessageKey | null>(null);
  const [invitation, setInvitation] = useState(initialInvitation);
  const active = useRef(true);
  const inAction = useRef(false);
  const reconciliation = useRef<Promise<void> | null>(null);
  const observe = useCallback(() => {
    const next = client.snapshot();
    const nextScope = identity(next);
    if (currentScope.current !== nextScope) {
      cache.clear();
      currentScope.current = nextScope;
    }
    setView(next);
    if (next.invitation_pending) setInvitation("none");
  }, [client, cache]);
  const run = useCallback(
    async (action: () => Promise<unknown>, enroll = false) => {
      if (inAction.current) return false;
      inAction.current = true;
      setBusy(true);
      setError(null);
      try {
        await reconciliation.current;
        await action();
        const next = client.snapshot();
        if (
          next.authenticated &&
          (next.session_verified || next.offline_authorized) &&
          (enroll || !next.current_device_id) &&
          next.flow !== "passkey_registration"
        ) {
          await client.prepare_device("");
        }
        return true;
      } catch (error) {
        setError(errorMessage(error));
        return false;
      } finally {
        observe();
        inAction.current = false;
        setBusy(false);
      }
    },
    [client, observe],
  );
  useEffect(() => {
    let ticks = 0;
    function lifecycle() {
      const state: ClientLifecycle =
        document.visibilityState === "hidden"
          ? "Hidden"
          : document.hasFocus()
            ? "Resumed"
            : "Inactive";
      active.current = client.lifecycle(state);
    }
    function reconcile() {
      if (!active.current || inAction.current || reconciliation.current) return;
      reconciliation.current = (async () => {
        try {
          await client.reconcile();
          await client.import_browser_invitation();
        } catch (error) {
          // Rust records refusal/transport outcomes; its snapshot remains authoritative.
          if (errorMessage(error) === "genericError") reportFailure("BrowserUnhandled");
        } finally {
          observe();
          reconciliation.current = null;
        }
      })();
    }
    lifecycle();
    const onVisibility = () => {
      lifecycle();
      reconcile();
    };
    const onExit = () => {
      active.current = client.lifecycle("Detached");
    };
    const onInvitation = (event: Event) => {
      const value: unknown = event instanceof CustomEvent ? event.detail : undefined;
      if (value === "received" || value === "invalid") {
        setInvitation(value);
        reconcile();
      }
    };
    const clock = window.setInterval(() => {
      if (!active.current) return;
      observe();
      if (++ticks % 5 === 0) reconcile();
    }, 1000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    window.addEventListener("blur", lifecycle);
    window.addEventListener("pagehide", onExit);
    window.addEventListener("pageshow", onVisibility);
    window.addEventListener("nds-invitation", onInvitation);
    void run(async () => {
      await client.refresh();
      await client.import_browser_invitation();
    }, true);
    return () => {
      clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      window.removeEventListener("blur", lifecycle);
      window.removeEventListener("pagehide", onExit);
      window.removeEventListener("pageshow", onVisibility);
      window.removeEventListener("nds-invitation", onInvitation);
      client.cancel();
    };
  }, [client, observe, run]);
  return (
    <RuntimeContext value={{ client, view, scope, busy, error, invitation, run, observe }}>
      {children}
    </RuntimeContext>
  );
}
export function useRuntime(): Runtime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error("missing_runtime");
  return runtime;
}
