<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Install with `npm ci`, then `npx next typegen`. `LayoutProps` is generated into gitignored `.next/types` and `next-env.d.ts`. `tsc --noEmit` fails until `next typegen`, `next dev`, or `next build` has run. The command is documented in `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`.
- Dev server: `npm run dev` serves the app at http://127.0.0.1:43127 (loopback only).
- Supabase, Google OAuth, and `PURPLEAIR_API_KEY` are optional. Without them the panels still load local files under `data/` plus public agency APIs, and operator accounts stay in gitignored `data/admins.json`. In development the session secret falls back to the value in `lib/session-secret.ts`.
- `npm run build` fails until `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, because `app/api/config/route.js` throws at import. `npm run dev` does not compile that route until it is requested.
- `npm run lint` currently exits with existing ESLint errors. That is independent of install.
