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

## Deploy

See [docs/DEPLOY.md](../docs/DEPLOY.md).

## Adding a story

1. Put the video, poster and stills in `public/media/<story>/`.
2. In `src/content/stories.ts`, turn its entry from coming soon into a released story with those files and its live link.

## Database changes

Edit `src/db/schema.ts`, then run `npm run db:generate` and commit the new file in `drizzle/`.
