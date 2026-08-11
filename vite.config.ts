import { defineConfig, type Plugin } from "vite";

function apiPlugin(): Plugin {
  return {
    name: "ubw-api",
    async configureServer(server) {
      const { createApiApp } = await import("./server/index.js");
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
