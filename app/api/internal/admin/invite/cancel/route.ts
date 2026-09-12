import { adminHandler } from "@/lib/admin-api";

export const runtime = "nodejs";
export const POST = adminHandler("invite/cancel");
