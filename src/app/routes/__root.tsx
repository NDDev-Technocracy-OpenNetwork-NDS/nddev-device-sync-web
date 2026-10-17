import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Approval } from "@/pages/session/approval";
import { useRuntime } from "@/shared/api/runtime";
import { useText } from "@/shared/i18n";

const SignIn = lazy(() =>
  import("@/pages/session/sign-in").then((module) => ({ default: module.SignIn })),
);

export const Route = createRootRoute({ component: Layout });
function Layout() {
  const { view, error, busy, scope, invitation } = useRuntime();
  const { locale, setLocale, t } = useText();
  return (
    <div className="app-shell stack">
      <header className="app-header">
        <span className="brand-mark" aria-hidden="true" />
        <h1>{t("appTitle")}</h1>
        <select
          aria-label="English / Русский"
          value={locale}
          onChange={(event) => setLocale(event.target.value === "ru" ? "ru" : "en")}
        >
          <option value="en">English</option>
          <option value="ru">Русский</option>
        </select>
      </header>
      {view.authenticated && (
        <nav className="actions" aria-label={t("appTitle")}>
          <Link to="/" activeOptions={{ exact: true }}>
            {t("sessionTab")}
          </Link>
          <Link to="/company">{t("companyTitle")}</Link>
          <Link to="/vault">{t("vaultTitle")}</Link>
          <Link to="/passkeys">{t("passkeysTitle")}</Link>
        </nav>
      )}
      {error && (
        <p role="alert" className="notice">
          {t(error)}
        </p>
      )}
      {invitation === "invalid" && (
        <p role="alert" className="notice">
          {t("inputError")}
        </p>
      )}
      {invitation === "received" && view.authenticated && (
        <p className="notice">{t("invitationSignOut")}</p>
      )}
      {busy && <p role="status">{t("working")}</p>}
      <main key={scope} className="stack">
        {view.authorization_url && <Approval key={view.authorization_url} />}
        {view.authenticated ? (
          <Outlet />
        ) : (
          <Suspense fallback={<p role="status">{t("working")}</p>}>
            <SignIn />
          </Suspense>
        )}
      </main>
    </div>
  );
}
