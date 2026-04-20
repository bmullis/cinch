import type { Database } from "bun:sqlite";
import * as chrono from "chrono-node";
import { openDb } from "../db/connection";

export const withDb = <T>(fn: (db: Database) => T): T => {
	const db = openDb();
	try {
		return fn(db);
	} finally {
		db.close();
	}
};

export const parseDueFlag = (raw: string | undefined): string | null => {
	if (raw === undefined) return null;
	if (raw === "" || raw.toLowerCase() === "none") return null;
	const parsed = chrono.parseDate(raw, new Date(), { forwardDate: true });
	if (!parsed) throw new Error(`could not parse due date: "${raw}"`);
	return parsed.toISOString();
};

export const baseArgs = {
	json: {
		type: "boolean",
		description: "Output JSON instead of formatted text",
		default: false,
	},
} as const;
