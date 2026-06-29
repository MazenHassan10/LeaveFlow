import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";

const databaseUrl = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: databaseUrl || "postgres://missing:missing@localhost:5432/missing"
});

export const authDb = new Kysely<unknown>({
  dialect: new PostgresDialect({ pool })
});

export const auth = betterAuth({
  appName: "Time-Off Tracker",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET || "development-secret-change-before-production",
  database: {
    db: authDb,
    type: "postgres"
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || ""
    }
  },
  plugins: [nextCookies()]
});
