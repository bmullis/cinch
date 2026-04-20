import { homedir } from "node:os";
import { join } from "node:path";

export type Config = {
	dbPath: string;
};

export const loadConfig = (): Config => {
	const override = process.env.CINCH_DB;
	if (override) return { dbPath: override };

	const xdg = process.env.XDG_DATA_HOME;
	const base = xdg ?? join(homedir(), ".local", "share");
	return { dbPath: join(base, "cinch", "cinch.db") };
};
