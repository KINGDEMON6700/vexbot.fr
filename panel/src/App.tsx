import { Route, Routes } from "react-router-dom";
import { RootLayout } from "./layouts/RootLayout.js";
import { AccountSettingsPage } from "./pages/AccountSettingsPage.js";
import { CommandsPage } from "./pages/CommandsPage.js";
import { EmbedsPage } from "./pages/EmbedsPage.js";
import { LogsPage } from "./pages/LogsPage.js";
import { ModulesPage } from "./pages/ModulesPage.js";
import { MarketplacePage } from "./pages/MarketplacePage.js";
import { OverviewPage } from "./pages/OverviewPage.js";
import { ServerSelectionPage } from "./pages/ServerSelectionPage.js";
import { ServerTemplatesPage } from "./pages/ServerTemplatesPage.js";
import { TicketsPage } from "./pages/TicketsPage.js";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="embeds" element={<EmbedsPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="templates" element={<ServerTemplatesPage />} />
        <Route path="marketplace" element={<MarketplacePage />} />
        <Route path="commands" element={<CommandsPage />} />
        <Route path="modules" element={<ModulesPage />} />
        <Route path="account-settings" element={<AccountSettingsPage />} />
        <Route path="select-server" element={<ServerSelectionPage />} />
      </Route>
    </Routes>
  );
}
