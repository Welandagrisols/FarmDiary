# Farm Diary

A mobile app for recording farm activities, managing crop seasons, tracking costs and harvests, and keeping plot and soil records.

## Run & Operate

- The Replit mobile preview starts through the managed `artifacts/farm-diary: expo` workflow.
- The API starts through `artifacts/api-server: API Server`.
- Install dependencies from the workspace root with `pnpm install --frozen-lockfile`.
- Run the full TypeScript check with `pnpm run typecheck`.
- Run Farm Diary tests with `pnpm --filter @workspace/farm-diary test`.
- The API health endpoint is `/api/healthz`.

## Stack

- pnpm workspaces, Node.js 22+, TypeScript
- Mobile app: Expo, React Native, Expo Router
- API: Express
- Data and authentication: Supabase

## Where things live

- `artifacts/farm-diary/app/` — app screens and routes
- `artifacts/farm-diary/context/` — authentication, farm selection, and data sync
- `artifacts/farm-diary/lib/supabase-storage.ts` — Supabase data access
- `artifacts/api-server/src/` — Express server and API routes
- `artifacts/farm-diary/tests/` — app logic tests

## Environment

- The mobile app uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- The API needs the private `SUPABASE_SERVICE_ROLE_KEY` Replit Secret; it uses `SUPABASE_URL` when set, otherwise the public Supabase URL.
- `GEMINI_API_KEY` enables soil-report text extraction and is optional.
- Keep service-role and other private keys in Replit Secrets, not in source files or `EXPO_PUBLIC_` variables.

## Gotchas

- Run the API on Node.js 22 or newer; the Supabase client needs Node's built-in WebSocket support.
- Farm Diary also supports offline writes and later sync; do not replace its local cache with mock data.
- The Expo app has existing iOS and Android bundle identifiers; preserve them.
