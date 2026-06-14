import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    port: 5173,
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
    proxy: {
      "/api": "http://127.0.0.1:9000",
      "/r": "http://127.0.0.1:9000",
    },
  },
  plugins: [react()],
});
