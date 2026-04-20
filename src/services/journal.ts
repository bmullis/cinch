import type { Database } from "bun:sqlite";
import {
	completeTask,
	deleteTask,
	getTask,
	reopenTask,
	restoreTask,
	updateTask,
} from "./tasks";
import type { Task } from "./types";

export type MutationKind =
	| "create"
	| "update"
	| "complete"
	| "reopen"
	| "delete";

type Payload =
	| { kind: "create"; taskId: number }
	| { kind: "update"; taskId: number; before: Task }
	| { kind: "complete"; taskId: number }
	| { kind: "reopen"; taskId: number }
	| { kind: "delete"; task: Task };

const JOURNAL_LIMIT = 50;

export const recordMutation = (db: Database, payload: Payload): void => {
	db.query("INSERT INTO journal (kind, payload) VALUES (?, ?)").run(
		payload.kind,
		JSON.stringify(payload),
	);
	db.query(
		`DELETE FROM journal
		 WHERE id NOT IN (
		   SELECT id FROM journal ORDER BY id DESC LIMIT ?
		 )`,
	).run(JOURNAL_LIMIT);
};

export type UndoResult =
	| { kind: "nothing" }
	| { kind: "created"; task: Task }
	| { kind: "reopened"; task: Task }
	| { kind: "completed"; task: Task }
	| { kind: "reverted"; task: Task }
	| { kind: "deleted"; id: number };

export const undoLast = (db: Database): UndoResult => {
	const row = db
		.query<{ id: number; payload: string }, []>(
			"SELECT id, payload FROM journal ORDER BY id DESC LIMIT 1",
		)
		.get();
	if (!row) return { kind: "nothing" };

	const payload = JSON.parse(row.payload) as Payload;
	const deleteJournalEntry = () =>
		db.query("DELETE FROM journal WHERE id = ?").run(row.id);

	switch (payload.kind) {
		case "create": {
			deleteTask(db, payload.taskId);
			deleteJournalEntry();
			return { kind: "deleted", id: payload.taskId };
		}
		case "delete": {
			const restored = restoreTask(db, payload.task);
			deleteJournalEntry();
			return { kind: "created", task: restored };
		}
		case "complete": {
			const task = reopenTask(db, payload.taskId);
			deleteJournalEntry();
			if (!task) return { kind: "nothing" };
			return { kind: "reopened", task };
		}
		case "reopen": {
			const task = completeTask(db, payload.taskId);
			deleteJournalEntry();
			if (!task) return { kind: "nothing" };
			return { kind: "completed", task };
		}
		case "update": {
			const before = payload.before;
			const current = getTask(db, before.id);
			if (!current) {
				deleteJournalEntry();
				return { kind: "nothing" };
			}
			const reverted = updateTask(db, before.id, {
				title: before.title,
				notes: before.notes,
				project: before.project,
				priority: before.priority,
				dueAt: before.dueAt,
				labels: before.labels,
			});
			deleteJournalEntry();
			if (!reverted) return { kind: "nothing" };
			return { kind: "reverted", task: reverted };
		}
	}
};
