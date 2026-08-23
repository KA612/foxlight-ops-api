import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5900,         // Ops UI dev port
    strictPort: true,   // fail if something else is on 5800
    proxy: {
      "/api": "http://localhost:5901"  // forward API calls to ops-api
    }
  }
});
