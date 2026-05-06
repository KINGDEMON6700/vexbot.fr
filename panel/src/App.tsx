import { Route, Routes } from "react-router-dom";
import { RootLayout } from "./layouts/RootLayout.js";
import { CommandsPage } from "./pages/CommandsPage.js";
import { EmbedsPage } from "./pages/EmbedsPage.js";
import { LogsPage } from "./pages/LogsPage.js";
import { PatchnotesPage } from "./pages/PatchnotesPage.js";
import { OverviewPage } from "./pages/OverviewPage.js";
import { RolesPage } from "./pages/RolesPage.js";
import { TicketsPage } from "./pages/TicketsPage.js";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="embeds" element={<EmbedsPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="commands" element={<CommandsPage />} />
        <Route path="patchnotes" element={<PatchnotesPage />} />
      </Route>
    </Routes>
  );
}
