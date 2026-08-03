import { defineConfig, type Plugin } from "vite";
import { createApiApp } from "./server/index.js";

function apiPlugin(): Plugin {
  return {
    name: "deadism-api",
    configureServer(server) {
      server.middlewares.use(createApiApp());
    },
  };
}

export default defineConfig({
  plugins: [apiPlugin()],
  server: {
    port: 5173,
  },
});
