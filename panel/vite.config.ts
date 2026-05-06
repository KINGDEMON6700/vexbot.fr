import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Écoute sur toutes les interfaces : accessible via 192.168.x.x et l’IP publique (si pare-feu OK).
    host: true,
    port: 5173,
    strictPort: false,
  },
});
