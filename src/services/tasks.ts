import type { Database } from "bun:sqlite";
import { setTaskLabels } from "./labels";
import type { NewTask, Priority, Task, TaskPatch } from "./types";

type TaskRow = {
	id: number;
	title: string;
	notes: string | null;
	project: string | null;
	priority: number;
	due_at: string | null;
	completed_at: string | null;
	created_at: string;
};

const hydrate = (db: Database, row: TaskRow): Task => {
	const labels = db
		.query<{ name: string }, [number]>(
			`SELECT l.name FROM labels l
			 JOIN task_labels tl ON tl.label_id = l.id
			 WHERE tl.task_id = ?
			 ORDER BY l.name ASC`,
		)
		.all(row.id)
		.map((r) => r.name);
	return {
		id: row.id,
		title: row.title,
		notes: row.notes,
		project: row.project,
		priority: row.priority as Priority,
		dueAt: row.due_at,
		completedAt: row.completed_at,
		createdAt: row.created_at,
		labels,
	};
};

export const restoreTask = (db: Database, task: Task): Task => {
	db.query(
		`INSERT INTO tasks (id, title, notes, project, priority, due_at, completed_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		task.id,
		task.title,
		task.notes,
		task.project,
		task.priority,
		task.dueAt,
		task.completedAt,
		task.createdAt,
	);
	if (task.labels.length > 0) setTaskLabels(db, task.id, task.labels);
	return getTask(db, task.id) as Task;
};

export const createTask = (db: Database, input: NewTask): Task => {
	const priority: Priority = input.priority ?? 4;
	const { lastInsertRowid } = db
		.query(
			`INSERT INTO tasks (title, notes, project, priority, due_at)
			 VALUES (?, ?, ?, ?, ?)`,
		)
		.run(
			input.title,
			input.notes ?? null,
			input.project ?? null,
			priority,
			input.dueAt ?? null,
		);
	const id = Number(lastInsertRowid);
	if (input.labels?.length) setTaskLabels(db, id, input.labels);
	return getTask(db, id) as Task;
};

export const getTask = (db: Database, id: number): Task | undefined => {
	const row = db
		.query<TaskRow, [number]>("SELECT * FROM tasks WHERE id = ?")
		.get(id);
	return row ? hydrate(db, row) : undefined;
};

export const updateTask = (
	db: Database,
	id: number,
	patch: TaskPatch,
): Task | undefined => {
	const existing = getTask(db, id);
	if (!existing) return undefined;

	const fields: string[] = [];
	const values: (string | number | null)[] = [];
	if (patch.title !== undefined) {
		fields.push("title = ?");
		values.push(patch.title);
	}
	if (patch.notes !== undefined) {
		fields.push("notes = ?");
		values.push(patch.notes);
	}
	if (patch.project !== undefined) {
		fields.push("project = ?");
		values.push(patch.project);
	}
	if (patch.priority !== undefined) {
		fields.push("priority = ?");
		values.push(patch.priority);
	}
	if (patch.dueAt !== undefined) {
		fields.push("due_at = ?");
		values.push(patch.dueAt);
	}
	if (fields.length > 0) {
		values.push(id);
		db.query(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(
			...values,
		);
	}
	if (patch.labels !== undefined) setTaskLabels(db, id, patch.labels);

	return getTask(db, id);
};

export const completeTask = (db: Database, id: number): Task | undefined => {
	const existing = getTask(db, id);
	if (!existing || existing.completedAt) return existing;
	db.query(
		"UPDATE tasks SET completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
	).run(id);
	return getTask(db, id);
};

export const reopenTask = (db: Database, id: number): Task | undefined => {
	db.query("UPDATE tasks SET completed_at = NULL WHERE id = ?").run(id);
	return getTask(db, id);
};

export const deleteTask = (db: Database, id: number): boolean => {
	const { changes } = db.query("DELETE FROM tasks WHERE id = ?").run(id);
	return changes > 0;
};

type ListFilter = {
	project?: string;
	label?: string;
	completed?: boolean;
	all?: boolean;
};

export const listTasks = (db: Database, filter: ListFilter = {}): Task[] => {
	const where: string[] = [];
	const params: (string | number)[] = [];

	if (!filter.all) {
		if (filter.completed === true) where.push("t.completed_at IS NOT NULL");
		else where.push("t.completed_at IS NULL");
	}
	if (filter.project) {
		where.push("t.project = ?");
		params.push(filter.project);
	}
	if (filter.label) {
		where.push(`t.id IN (
			SELECT tl.task_id FROM task_labels tl
			JOIN labels l ON l.id = tl.label_id
			WHERE l.name = ?
		)`);
		params.push(filter.label.toLowerCase());
	}

	const sql = `SELECT * FROM tasks t
		${where.length ? `WHERE ${where.join(" AND ")}` : ""}
		ORDER BY
			CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END,
			t.due_at ASC,
			t.priority ASC,
			t.id ASC`;
	return db
		.query<TaskRow, typeof params>(sql)
		.all(...params)
		.map((r) => hydrate(db, r));
};

const startOfTomorrowUtcIso = (): string => {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() + 1);
	return d.toISOString();
};

export const listToday = (db: Database): Task[] => {
	const cutoff = startOfTomorrowUtcIso();
	return db
		.query<TaskRow, [string]>(
			`SELECT * FROM tasks
			 WHERE completed_at IS NULL
			   AND due_at IS NOT NULL
			   AND due_at < ?
			 ORDER BY due_at ASC, priority ASC, id ASC`,
		)
		.all(cutoff)
		.map((r) => hydrate(db, r));
};

export const listOverdue = (db: Database): Task[] => {
	const nowIso = new Date().toISOString();
	return db
		.query<TaskRow, [string]>(
			`SELECT * FROM tasks
			 WHERE completed_at IS NULL
			   AND due_at IS NOT NULL
			   AND due_at < ?
			 ORDER BY due_at ASC, priority ASC, id ASC`,
		)
		.all(nowIso)
		.map((r) => hydrate(db, r));
};

export const listUpcoming = (db: Database, days = 7): Task[] => {
	const now = new Date();
	const end = new Date(now);
	end.setDate(end.getDate() + days);
	return db
		.query<TaskRow, [string, string]>(
			`SELECT * FROM tasks
			 WHERE completed_at IS NULL
			   AND due_at IS NOT NULL
			   AND due_at >= ?
			   AND due_at < ?
			 ORDER BY due_at ASC, priority ASC, id ASC`,
		)
		.all(now.toISOString(), end.toISOString())
		.map((r) => hydrate(db, r));
};

export const searchTasks = (db: Database, needle: string): Task[] => {
	const like = `%${needle}%`;
	return db
		.query<TaskRow, [string, string]>(
			`SELECT * FROM tasks
			 WHERE (title LIKE ? OR notes LIKE ?)
			 ORDER BY completed_at IS NULL DESC, due_at ASC, id ASC`,
		)
		.all(like, like)
		.map((r) => hydrate(db, r));
};

export const listProjects = (
	db: Database,
): { project: string; open: number }[] =>
	db
		.query<{ project: string; open: number }, []>(
			`SELECT project, COUNT(*) AS open
			 FROM tasks
			 WHERE project IS NOT NULL AND completed_at IS NULL
			 GROUP BY project
			 ORDER BY open DESC, project ASC`,
		)
		.all();
