import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { RootLayout } from "./layouts/RootLayout.js";
import { trackProductEvent } from "./lib/api.js";

const AccountSettingsPage = lazy(() => import("./pages/AccountSettingsPage.js").then((m) => ({ default: m.AccountSettingsPage })));
const AdminStatsPage = lazy(() => import("./pages/AdminStatsPage.js").then((m) => ({ default: m.AdminStatsPage })));
const CommandsPage = lazy(() => import("./pages/CommandsPage.js").then((m) => ({ default: m.CommandsPage })));
const EmbedsPage = lazy(() => import("./pages/EmbedsPage.js").then((m) => ({ default: m.EmbedsPage })));
const LoginPage = lazy(() => import("./pages/LoginPage.js").then((m) => ({ default: m.LoginPage })));
const LogsPage = lazy(() => import("./pages/LogsPage.js").then((m) => ({ default: m.LogsPage })));
const ModulesPage = lazy(() => import("./pages/ModulesPage.js").then((m) => ({ default: m.ModulesPage })));
const MarketplacePage = lazy(() => import("./pages/MarketplacePage.js").then((m) => ({ default: m.MarketplacePage })));
const OverviewPage = lazy(() => import("./pages/OverviewPage.js").then((m) => ({ default: m.OverviewPage })));
const ServerSelectionPage = lazy(() => import("./pages/ServerSelectionPage.js").then((m) => ({ default: m.ServerSelectionPage })));
const ServerTemplatesPage = lazy(() => import("./pages/ServerTemplatesPage.js").then((m) => ({ default: m.ServerTemplatesPage })));
const TicketsPage = lazy(() => import("./pages/TicketsPage.js").then((m) => ({ default: m.TicketsPage })));

function PageFallback() {
  return <div className="ui-card-muted p-6 text-sm text-zinc-400">Chargement de la page…</div>;
}

function PanelPageTracker() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith("/admin/stats")) return;
    trackProductEvent({
      type: "panel_page_view",
      source: "panel",
      path: `${location.pathname}${location.search}`,
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    let dirty = false;
    let dirtyCount = 0;
    let lastDirtyPath = "";

    const elementMeta = (target: EventTarget | null) => {
      const el = target instanceof Element ? target : null;
      if (!el) return {};
      const actionable = el.closest("button,a,input,select,textarea,[role='button']");
      if (!actionable) return {};
      const tag = actionable.tagName.toLowerCase();
      const input = actionable instanceof HTMLInputElement ? actionable : null;
      return {
        tag,
        type: input?.type || actionable.getAttribute("type") || null,
        name: actionable.getAttribute("name"),
        ariaLabel: actionable.getAttribute("aria-label"),
        title: actionable.getAttribute("title"),
        text: (actionable.textContent || "").trim().slice(0, 120),
        href: actionable instanceof HTMLAnchorElement ? actionable.href : null,
        checked: input?.type === "checkbox" ? input.checked : undefined,
        path: `${window.location.pathname}${window.location.search}`,
      };
    };

    const markDirty = (event: Event) => {
      const target = event.target;
      const input = target instanceof HTMLInputElement ? target : null;
      const select = target instanceof HTMLSelectElement ? target : null;
      const textarea = target instanceof HTMLTextAreaElement ? target : null;
      if (!input && !select && !textarea) return;
      dirty = true;
      dirtyCount += 1;
      lastDirtyPath = `${window.location.pathname}${window.location.search}`;
      trackProductEvent({
        type: "panel_field_changed",
        source: "panel",
        metadata: elementMeta(target),
      });
    };

    const onClick = (event: MouseEvent) => {
      if (window.location.pathname.startsWith("/admin/stats")) return;
      const meta = elementMeta(event.target);
      if (!Object.keys(meta).length) return;
      trackProductEvent({
        type: "panel_click",
        source: "panel",
        metadata: meta,
      });
    };

    const onMutation = (event: Event) => {
      const detail = (event as CustomEvent).detail as { ok?: boolean; path?: string; method?: string; status?: number } | undefined;
      if (detail?.ok) {
        if (dirty) {
          trackProductEvent({
            type: "panel_changes_saved",
            source: "panel",
            metadata: { dirtyCount, dirtyPath: lastDirtyPath, api: detail },
          });
        }
        dirty = false;
        dirtyCount = 0;
        lastDirtyPath = "";
      }
    };

    const flushExit = (reason: string) => {
      if (window.location.pathname.startsWith("/admin/stats")) return;
      trackProductEvent({
        type: "panel_session_exit",
        source: "panel",
        metadata: { reason, dirty, dirtyCount, dirtyPath: lastDirtyPath },
      });
      if (dirty) {
        trackProductEvent({
          type: "panel_unsaved_changes_left",
          source: "panel",
          metadata: { reason, dirtyCount, dirtyPath: lastDirtyPath },
        });
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushExit("hidden");
      } else {
        trackProductEvent({ type: "panel_session_return", source: "panel" });
      }
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("change", markDirty, true);
    window.addEventListener("vex:api-mutation", onMutation);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", () => flushExit("pagehide"));

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", markDirty, true);
      window.removeEventListener("vex:api-mutation", onMutation);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <PanelPageTracker />
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route index element={<OverviewPage />} />
          <Route path="embeds" element={<EmbedsPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="templates" element={<ServerTemplatesPage />} />
          <Route path="marketplace" element={<MarketplacePage />} />
          <Route path="commands" element={<CommandsPage />} />
          <Route path="modules" element={<ModulesPage />} />
          <Route path="account-settings" element={<AccountSettingsPage />} />
          <Route path="admin/stats" element={<AdminStatsPage />} />
          <Route path="select-server" element={<ServerSelectionPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
