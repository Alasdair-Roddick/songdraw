import type { db } from "@/lib/db";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Database = typeof db | Transaction;

export type RowChange = {
	table: string;
	before: object | null;
	after: object | null;
};

export class MutationError extends Error {
	constructor(
		public status: number,
		message: string,
		public before: object | null = null,
	) {
		super(message);
	}
}
