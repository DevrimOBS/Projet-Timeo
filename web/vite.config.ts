import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

const httpsEnabled = process.env.VITE_HTTPS_ENABLED === "true";
const httpsKeyFile = process.env.VITE_HTTPS_KEY_FILE ?? "/certs/server.key";
const httpsCertFile = process.env.VITE_HTTPS_CERT_FILE ?? "/certs/server.crt";

const httpsConfig = httpsEnabled
  ? {
      key: fs.readFileSync(httpsKeyFile),
      cert: fs.readFileSync(httpsCertFile)
    }
  : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    https: httpsConfig,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
        secure: false
      }
    }
  }
});