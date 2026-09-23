# Career Quest frontend

React, Vite, and TypeScript frontend. Live API mode is the default; demo data is a separate optional adapter.

## Run

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

On PowerShell use `Copy-Item .env.example .env.local` and `npm.cmd` if script execution policy blocks `npm`. Set `VITE_API_URL` to the backend origin. Set `VITE_USE_MOCK=true` to run without backend, then restart Vite. `VITE_*` variables are public in browser code; do not store secrets there.

Routes: `/`, `/employee/:id`, `/employee/:id/quest/:eventId`, `/hr`.

The single API client is `src/api/client.ts`. Response mapping is in `src/api/mappers.ts`; adjust it to the backend response schema when that schema is available. Demo fixtures and in-memory completion are only in `src/api/mockAdapter.ts`.
