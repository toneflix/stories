# Deploying

The website lives in `site/` and runs on Vercel. The live stories ("Play it live") are served separately by GitHub Pages.

## Website on Vercel

### 1. Create the project

1. In Vercel, choose **Add New → Project** and import `toneflix/stories`.
2. Set **Root Directory** to `site`. Vercel detects Next.js; leave the build settings as they are.

### 2. Add the database

1. In the project, open **Storage → Create Database** and pick **Neon** (Postgres).
2. Connect it to the project for all environments. This adds `DATABASE_URL`.

Each build runs the database migrations before building, so new tables are created on deploy.

### 3. Set the environment variables

In **Settings → Environment Variables**:

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Added by Neon in step 2. |
| `AUTH_SECRET` | Yes | A random secret for sign-in. Run `npx auth secret` to get one. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | For Google sign-in | From Google Cloud, see below. |
| `AUTH_RESEND_KEY` | For email sign-in | An API key from [Resend](https://resend.com). |
| `AUTH_EMAIL_FROM` | With Resend | Sender, e.g. `Toneflix Stories <stories@toneflix.net>`. The domain must be verified in Resend. |
| `NEXT_PUBLIC_LIVE_BASE_URL` | No | Where "Play it live" links go. Defaults to `https://toneflix.github.io/stories`. |

Set up at least one sign-in method. Without one, visitors can watch but nobody can like, comment or save.

### 4. Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** of type **Web application**.
2. Add an authorised redirect URI for each domain the site runs on:
   `https://<your-domain>/api/auth/callback/google`
3. Copy the client ID and secret into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

Preview deployments get their own URLs, so Google sign-in only works on the domains you list here.

### 5. Deploy

Deploy from the Vercel dashboard, or push to `main`. Then add your domain under **Settings → Domains** and add its Google redirect URI from step 4.

### Check it works

- The homepage and `/watch` load and the video plays.
- Signing in works, and a like is still there after a page reload.

## Live stories on GitHub Pages

The live stories are built by the GitHub Pages workflow in `.github/workflows/pages.yml` on each push to `main`.

1. In the repository, open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.

They are then served at `https://toneflix.github.io/stories/`. If they move to another address, set `NEXT_PUBLIC_LIVE_BASE_URL` on Vercel and redeploy.

## Running locally

See `site/README.md`.
