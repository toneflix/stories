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

1. Put the video, poster and stills in `public/media/<id>/`, where `<id>` is the story's folder in `src/stories/`.
2. Add its entry to `ready` in `src/content/stories.ts`.
3. Add its id to `released` in `stories.json` at the repo root when it should go public.

Until then it shows as coming soon, and its video and live player are only served to accounts with early access. Those accounts see it in the feed and can open its links. To give an account early access, run this on the database (the Neon SQL editor works):

```sql
update "user" set early_access = true where email = 'name@example.com';
```

Releases only render and publish videos for released stories.

## Database changes

Edit `src/db/schema.ts`, then run `npm run db:generate` and commit the new file in `drizzle/`.
