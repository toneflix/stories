export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.DATABASE_URL) return;
  const { db } = await import('./db');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  await migrate(db as never, { migrationsFolder: 'drizzle' });
}
