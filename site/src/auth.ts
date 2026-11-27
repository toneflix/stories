import NextAuth, { type NextAuthConfig } from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { accounts, sessions, users, verificationTokens } from '@/db/schema';
import { signInEmail } from '@/lib/signin-email';

const isDev = process.env.NODE_ENV !== 'production';

export type ProviderId = 'google' | 'resend' | 'dev';

const providers: Provider[] = [];
export const enabledProviders: ProviderId[] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
  enabledProviders.push('google');
}

if (process.env.AUTH_RESEND_KEY) {
  providers.push(
    Resend({
      from: process.env.AUTH_EMAIL_FROM ?? 'Toneflix Stories <onboarding@resend.dev>',
      async sendVerificationRequest({ identifier: to, provider, url }) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: provider.from, to, ...signInEmail(url) }),
        });
        if (!res.ok) throw new Error(`Resend error: ${await res.text()}`);
      },
    }),
  );
  enabledProviders.push('resend');
}

// Local-only sign-in by name, so the social features can be tried without Google or email set up.
if (isDev) {
  providers.push(
    Credentials({
      id: 'dev',
      credentials: { name: { label: 'Name' } },
      async authorize(input) {
        const name = String(input?.name ?? '').trim().slice(0, 40);
        if (!name) return null;
        const email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@dev.local`;
        const [existing] = await db.select().from(users).where(eq(users.email, email));
        if (existing) return existing;
        const [created] = await db.insert(users).values({ name, email }).returning();
        return created;
      },
    }),
  );
  enabledProviders.push('dev');
}

const config: NextAuthConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers,
  session: { strategy: 'jwt' },
  secret: process.env.AUTH_SECRET ?? (isDev ? 'local-development-secret' : undefined),
  trustHost: true,
  pages: { signIn: '/', verifyRequest: '/?check-email=1' },
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
