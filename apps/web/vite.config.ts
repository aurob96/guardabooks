import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT ?? "4000"}`,
        changeOrigin: true
      }
    }
  },
  preview: {
    host: "0.0.0.0"
  }
});
