import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Tauri expects a fixed port and loads the build from relative paths.
  server: { port: 5173, strictPort: true },
  base: "./",
  clearScreen: false,
});
