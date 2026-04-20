import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig } from "../config";
import { migrations } from "./migrations";

export const openDb = (path?: string): Database => {
	const dbPath = path ?? loadConfig().dbPath;
	if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
	const db = new Database(dbPath, { create: true });
	db.exec("PRAGMA journal_mode = WAL");
	db.exec("PRAGMA foreign_keys = ON");
	runMigrations(db);
	return db;
};

const runMigrations = (db: Database): void => {
	db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		name TEXT PRIMARY KEY,
		applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
	)`);

	const applied = new Set(
		db
			.query<{ name: string }, []>("SELECT name FROM schema_migrations")
			.all()
			.map((r) => r.name),
	);

	const pending = migrations.filter((m) => !applied.has(m.name));
	if (pending.length === 0) return;

	const insert = db.prepare("INSERT INTO schema_migrations (name) VALUES (?)");
	const tx = db.transaction(() => {
		for (const m of pending) {
			db.exec(m.sql);
			insert.run(m.name);
		}
	});
	tx();
};
