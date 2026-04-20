import initial from "./001_initial.sql" with { type: "text" };

export type Migration = { name: string; sql: string };

export const migrations: Migration[] = [
	{ name: "001_initial", sql: initial },
];
