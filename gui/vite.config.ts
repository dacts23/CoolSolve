import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend port: override with COOLSOLVE_BACKEND when it runs elsewhere.
// (No @types/node here: read the env without naming the node globals.)
const nodeEnv = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const backend = nodeEnv?.COOLSOLVE_BACKEND || 'http://localhost:8550';

// The backend runs on 8550 in both dev and preview.
const proxy = {
  '/api': {
    target: backend,
    changeOrigin: true,
  },
  // Served by the CoolSolve binary too: the documentation and the model library
  '/docs': {
    target: backend,
    changeOrigin: true,
  },
  '/library': {
    target: backend,
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    proxy,
  },
  preview: {
    port: 5173,
    proxy,
  },
})
