import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api requests (including the live event stream) go to server.mjs on port 3001.
export default defineConfig({ plugins: [react()], server: { proxy: { "/api": "http://localhost:3001" } } });
