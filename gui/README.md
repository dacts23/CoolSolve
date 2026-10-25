# CoolSolve GUI

React + TypeScript + Vite single-page app for CoolSolve. It is served by the
CoolSolve binary (`coolsolve --gui`, port 8550) and calls its REST + SSE API.

- `npm install` then `npm run dev` for development (proxies `/api`, `/docs`,
  `/library` to `http://localhost:8550`).
- `npm run build` produces `dist/`, which the CMake build embeds into the
  CoolSolve binary.
- `npm test` runs the node-based tests (`src/__tests__/`).
- `npm run lint` runs ESLint.

See `docs/gui.md` in the repository root for the full design reference.
