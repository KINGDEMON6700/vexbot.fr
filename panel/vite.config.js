import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
const panelDir = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@vexImg": path.resolve(panelDir, "../img"),
        },
    },
    server: {
        host: true,
        port: 5173,
        strictPort: false,
        allowedHosts: [".vexbot.fr", "vexbot.fr", "panel.vexbot.fr", "www.vexbot.fr"],
    },
});
