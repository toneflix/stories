# Toneflix Stories website

Landing page, watch feed, story list and saved stories, with likes, comments, saves and shares.

Built with Next.js, Auth.js and Drizzle on Postgres.

## Run locally

```sh
cd site
npm install
npm run dev
```

Without `DATABASE_URL`, the site uses a local file database in `.data/` and migrates it on start. With no sign-in providers configured, a local-only "sign in by name" option appears so likes and comments can be tested.

## Deploy on Vercel

1. Import the repository and set **Root Directory** to `site`.
2. Add a Postgres database: Storage → Neon (Vercel Marketplace). This sets `DATABASE_URL`. Migrations run during each build.
3. Set `AUTH_SECRET` (`npx auth secret` prints one).
4. Sign-in, at least one of:
   - Google: `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. Redirect URI: `https://<domain>/api/auth/callback/google`.
   - Email link: `AUTH_RESEND_KEY` and `AUTH_EMAIL_FROM` (a sender on a domain verified in Resend).
5. Optional: `NEXT_PUBLIC_LIVE_BASE_URL` sets where the "Play it live" links point. Defaults to `https://toneflix.github.io/stories`.

See `.env.example` for the full list.

## Adding a story

1. Put the video, poster and stills in `public/media/<story>/`.
2. In `src/content/stories.ts`, turn its entry from coming soon into a released story with those files and its live link.

## Database changes

Edit `src/db/schema.ts`, then run `npm run db:generate` and commit the new file in `drizzle/`.
