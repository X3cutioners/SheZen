/**
 * lib/db/client.ts
 * Neon HTTP driver + Drizzle ORM instance.
 * SERVER-ONLY — never import from client components.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
