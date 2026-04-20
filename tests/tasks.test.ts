import { describe, expect, test } from "bun:test";
import {
	completeTask,
	createTask,
	deleteTask,
	getTask,
	listOverdue,
	listTasks,
	listUpcoming,
	reopenTask,
	restoreTask,
	searchTasks,
	updateTask,
} from "../src/services/tasks";
import { testDb } from "./helpers";

describe("tasks service", () => {
	test("create fills defaults and returns hydrated task", () => {
		const db = testDb();
		const t = createTask(db, { title: "first" });
		expect(t.id).toBe(1);
		expect(t.title).toBe("first");
		expect(t.priority).toBe(4);
		expect(t.completedAt).toBeNull();
		expect(t.labels).toEqual([]);
	});

	test("create with labels normalizes via join table", () => {
		const db = testDb();
		const t = createTask(db, { title: "tagged", labels: ["A", "b"] });
		expect(t.labels).toEqual(["a", "b"]);
	});

	test("complete then reopen round-trips", () => {
		const db = testDb();
		const t = createTask(db, { title: "x" });
		const done = completeTask(db, t.id);
		expect(done?.completedAt).not.toBeNull();
		const open = reopenTask(db, t.id);
		expect(open?.completedAt).toBeNull();
	});

	test("update applies partial patch including labels", () => {
		const db = testDb();
		const t = createTask(db, { title: "x", labels: ["a"] });
		const updated = updateTask(db, t.id, {
			title: "y",
			priority: 1,
			labels: ["b", "c"],
		});
		expect(updated?.title).toBe("y");
		expect(updated?.priority).toBe(1);
		expect(updated?.labels).toEqual(["b", "c"]);
	});

	test("delete then restore preserves id and labels", () => {
		const db = testDb();
		const t = createTask(db, { title: "keep", labels: ["k"] });
		expect(deleteTask(db, t.id)).toBe(true);
		expect(getTask(db, t.id)).toBeUndefined();
		const restored = restoreTask(db, t);
		expect(restored.id).toBe(t.id);
		expect(restored.labels).toEqual(["k"]);
	});

	test("list filters by project/label/all", () => {
		const db = testDb();
		createTask(db, { title: "a", project: "work" });
		createTask(db, { title: "b", project: "home", labels: ["urgent"] });
		const done = createTask(db, { title: "c" });
		completeTask(db, done.id);

		expect(listTasks(db).length).toBe(2);
		expect(listTasks(db, { project: "work" }).length).toBe(1);
		expect(listTasks(db, { label: "urgent" }).length).toBe(1);
		expect(listTasks(db, { all: true }).length).toBe(3);
		expect(listTasks(db, { completed: true }).length).toBe(1);
	});

	test("overdue/upcoming/today queries honor due window", () => {
		const db = testDb();
		const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
		const later = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
		const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

		createTask(db, { title: "past", dueAt: past });
		createTask(db, { title: "soon", dueAt: soon });
		createTask(db, { title: "later", dueAt: later });
		createTask(db, { title: "far", dueAt: far });

		expect(listOverdue(db).map((t) => t.title)).toEqual(["past"]);
		expect(
			listUpcoming(db)
				.map((t) => t.title)
				.sort(),
		).toEqual(["later", "soon"]);
	});

	test("search finds by title substring", () => {
		const db = testDb();
		createTask(db, { title: "Buy milk" });
		createTask(db, { title: "Call dentist" });
		expect(searchTasks(db, "milk").map((t) => t.title)).toEqual(["Buy milk"]);
	});
});
