import { Database } from "bun:sqlite";
import { migrations } from "../src/db/migrations";

export const testDb = (): Database => {
	const db = new Database(":memory:");
	db.exec("PRAGMA foreign_keys = ON");
	for (const m of migrations) db.exec(m.sql);
	return db;
};
