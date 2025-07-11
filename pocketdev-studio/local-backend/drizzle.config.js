import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.js',
  out: './db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './db/pocketdev.db'
  },
  verbose: true,
  strict: true
});