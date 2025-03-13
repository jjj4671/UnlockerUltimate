import { defineConfig } from "drizzle-kit";

// Default to a placeholder URL if DATABASE_URL is not set
const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/brightproxy";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
