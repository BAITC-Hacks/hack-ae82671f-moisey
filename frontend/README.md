# Career Quest frontend

React, Vite, and TypeScript frontend. Live API mode is the default; demo data is a separate optional adapter.

## Run

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

On PowerShell use `Copy-Item .env.example .env.local` and `npm.cmd` if script execution policy blocks `npm`. `VITE_API_URL=/api` uses the Vite development proxy; set `VITE_BACKEND_URL` to the backend origin. For a deployed frontend, set `VITE_API_URL` to an accessible API origin or reverse-proxy path. Set `VITE_USE_MOCK=true` to run without backend, then restart Vite. `VITE_*` variables are public in browser code; do not store secrets there.

Routes: `/`, `/employee/:id`, `/employee/:id/quest/:eventId`, `/hr`.

The single API client is `src/api/client.ts`. Response mapping is in `src/api/mappers.ts`, including the current backend's career skill-gap map and recommendation rows. Demo fixtures and in-memory completion are only in `src/api/mockAdapter.ts`.

The current backend does not yet implement `POST /employees/{employee_id}/activities/{event_id}/complete`. The frontend sends this request and displays the API error until the backend endpoint is ready.
