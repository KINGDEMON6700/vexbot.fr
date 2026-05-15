import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { GuildProvider } from "./contexts/GuildContext.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <GuildProvider>
          <App />
        </GuildProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
