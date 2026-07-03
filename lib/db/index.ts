import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "./schema";
import * as trackAssetSchema from "./track-asset";

const schema = { ...authSchema, ...trackAssetSchema };

const client = postgres(process.env.DATABASE_URL!);

export const db = drizzle(client, { schema });
