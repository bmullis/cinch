import { describe, expect, test } from "bun:test";
import { recordMutation, undoLast } from "../src/services/journal";
import {
	completeTask,
	createTask,
	deleteTask,
	getTask,
	reopenTask,
	updateTask,
} from "../src/services/tasks";
import { testDb } from "./helpers";

describe("undo journal", () => {
	test("undo of create deletes the task", () => {
		const db = testDb();
		const t = createTask(db, { title: "poof" });
		recordMutation(db, { kind: "create", taskId: t.id });

		const res = undoLast(db);
		expect(res.kind).toBe("deleted");
		expect(getTask(db, t.id)).toBeUndefined();
	});

	test("undo of complete reopens the task", () => {
		const db = testDb();
		const t = createTask(db, { title: "x" });
		completeTask(db, t.id);
		recordMutation(db, { kind: "complete", taskId: t.id });

		const res = undoLast(db);
		expect(res.kind).toBe("reopened");
		expect(getTask(db, t.id)?.completedAt).toBeNull();
	});

	test("undo of delete restores with original id", () => {
		const db = testDb();
		const t = createTask(db, { title: "gone", labels: ["a"] });
		deleteTask(db, t.id);
		recordMutation(db, { kind: "delete", task: t });

		const res = undoLast(db);
		expect(res.kind).toBe("created");
		const restored = getTask(db, t.id);
		expect(restored?.id).toBe(t.id);
		expect(restored?.labels).toEqual(["a"]);
	});

	test("undo of update reverts field values", () => {
		const db = testDb();
		const before = createTask(db, { title: "orig", priority: 3 });
		updateTask(db, before.id, { title: "new", priority: 1 });
		recordMutation(db, { kind: "update", taskId: before.id, before });

		const res = undoLast(db);
		expect(res.kind).toBe("reverted");
		const after = getTask(db, before.id);
		expect(after?.title).toBe("orig");
		expect(after?.priority).toBe(3);
	});

	test("undo of reopen re-completes", () => {
		const db = testDb();
		const t = createTask(db, { title: "x" });
		completeTask(db, t.id);
		reopenTask(db, t.id);
		recordMutation(db, { kind: "reopen", taskId: t.id });

		const res = undoLast(db);
		expect(res.kind).toBe("completed");
		expect(getTask(db, t.id)?.completedAt).not.toBeNull();
	});

	test("undo with empty journal is a no-op", () => {
		const db = testDb();
		expect(undoLast(db).kind).toBe("nothing");
	});
});
