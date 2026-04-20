import type { Database } from "bun:sqlite";

export const upsertLabel = (db: Database, name: string): number => {
	const normalized = name.trim().toLowerCase();
	db.query("INSERT OR IGNORE INTO labels (name) VALUES (?)").run(normalized);
	const row = db
		.query<{ id: number }, [string]>("SELECT id FROM labels WHERE name = ?")
		.get(normalized);
	if (!row) throw new Error(`failed to upsert label ${normalized}`);
	return row.id;
};

export const setTaskLabels = (
	db: Database,
	taskId: number,
	labels: string[],
): void => {
	db.query("DELETE FROM task_labels WHERE task_id = ?").run(taskId);
	const insert = db.prepare(
		"INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)",
	);
	for (const name of labels) {
		const labelId = upsertLabel(db, name);
		insert.run(taskId, labelId);
	}
};

export const listLabelsWithCounts = (
	db: Database,
): { name: string; open: number }[] =>
	db
		.query<{ name: string; open: number }, []>(
			`SELECT l.name, COUNT(tl.task_id) AS open
			 FROM labels l
			 LEFT JOIN task_labels tl ON tl.label_id = l.id
			 LEFT JOIN tasks t ON t.id = tl.task_id AND t.completed_at IS NULL
			 GROUP BY l.id, l.name
			 ORDER BY open DESC, l.name ASC`,
		)
		.all();
