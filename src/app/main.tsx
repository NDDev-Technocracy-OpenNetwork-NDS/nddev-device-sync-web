import initialize, { capture_invitation_link, initialize_app, NdsClient } from "@nds/runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { type InvitationState, RuntimeProvider } from "@/shared/api/runtime";
import { reportFailure as report } from "@/shared/api/telemetry";
import { LocaleProvider, translate } from "@/shared/i18n";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

const startup = () => translate(navigator.language.startsWith("ru") ? "ru" : "en", "startupFailed");
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p role="alert">{startup()}</p> : this.props.children;
  }
}
function makeRouter() {
  return createRouter({
    routeTree,
    history: createHashHistory(),
    defaultErrorComponent: () => <p role="alert">{startup()}</p>,
  });
}
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof makeRouter>;
  }
}

async function start() {
  await initialize();
  function invitation(): InvitationState {
    if (!location.hash.startsWith("#invite/")) return "none";
    try {
      capture_invitation_link(location.href);
      return "received";
    } catch {
      return "invalid";
    }
  }
  const initialInvitation = invitation();
  initialize_app();
  window.addEventListener("hashchange", () => {
    const state = invitation();
    if (state !== "none")
      window.dispatchEvent(new CustomEvent("nds-invitation", { detail: state }));
  });
  window.addEventListener("error", (event) => {
    event.preventDefault();
    report("BrowserUnhandled");
  });
  window.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    report("BrowserUnhandled");
  });
  const client = new NdsClient(location.origin);
  const router = makeRouter();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "always",
        retry: false,
        refetchOnWindowFocus: false,
        structuralSharing: false,
        gcTime: 60_000,
      },
      mutations: { networkMode: "always", retry: false, gcTime: 0 },
    },
  });
  const element = document.getElementById("root");
  if (!element) throw new Error("missing_root");
  createRoot(element, {
    onCaughtError: () => report("ReactRender"),
    onUncaughtError: () => report("ReactRender"),
    onRecoverableError: () => report("ReactRender"),
  }).render(
    <Boundary>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <RuntimeProvider client={client} initialInvitation={initialInvitation}>
            <RouterProvider router={router} />
          </RuntimeProvider>
        </QueryClientProvider>
      </LocaleProvider>
    </Boundary>,
  );
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker
      .register("/nds-offline.js", { scope: "/", updateViaCache: "none" })
      .catch(() => report("BrowserUnhandled"));
  }
}
void start().catch(() => {
  report("BrowserUnhandled");
  const element = document.getElementById("root");
  if (element) {
    element.textContent = startup();
    element.setAttribute("role", "alert");
  }
});
