import { mkdirSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

function connect(): Db {
  const url = process.env.DATABASE_URL;
  if (url) return drizzleNeon(neon(url), { schema }) as unknown as Db;
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
    throw new Error('DATABASE_URL is not set');
  }
  // Local development and tests use an embedded Postgres stored in .data/.
  const dir = process.env.PGLITE_DIR ?? '.data/pglite';
  mkdirSync(dir, { recursive: true });
  return drizzlePglite(new PGlite(dir), { schema }) as unknown as Db;
}

const globalForDb = globalThis as unknown as { db?: Db };

const instance = () => (globalForDb.db ??= connect());

// Connects on first use, so importing this module during a build never opens a database.
export const db = new Proxy({} as Db, {
  get: (_, key) => {
    const real = instance();
    const value = Reflect.get(real, key);
    return typeof value === 'function' ? value.bind(real) : value;
  },
  getPrototypeOf: () => Object.getPrototypeOf(instance()),
});

export const usesLocalDb = !process.env.DATABASE_URL;
