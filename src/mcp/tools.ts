import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseDueFlag, withDb } from "../cli/shared";
import { parseQuickAdd } from "../parser/quickadd";
import { recordMutation, undoLast } from "../services/journal";
import { listLabelsWithCounts } from "../services/labels";
import {
	completeTask,
	createTask,
	deleteTask,
	getTask,
	listOverdue,
	listProjects,
	listTasks,
	listToday,
	listUpcoming,
	reopenTask,
	searchTasks,
	updateTask,
} from "../services/tasks";
import type { Priority, TaskPatch } from "../services/types";

type CallResult = {
	content: { type: "text"; text: string }[];
	isError?: boolean;
};

const ok = (data: unknown): CallResult => ({
	content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

const fail = (message: string): CallResult => ({
	content: [{ type: "text", text: message }],
	isError: true,
});

const priorityZ = z
	.number()
	.int()
	.min(1)
	.max(4)
	.describe("Priority 1 (highest) through 4 (lowest, default)");

const idsZ = z
	.array(z.number().int().positive())
	.min(1)
	.describe("Task IDs to act on");

export const registerTools = (server: McpServer): void => {
	server.registerTool(
		"add_task",
		{
			description:
				"Add a task. Use `input` for Todoist-style quick-add (e.g. 'Buy milk tomorrow p1 #groceries @urgent'), or use the explicit fields. Flags override quick-add values.",
			inputSchema: {
				input: z
					.string()
					.optional()
					.describe(
						"Quick-add string; parsed for p1-p4, #project, @label, and natural-language date",
					),
				title: z.string().optional(),
				notes: z.string().nullable().optional(),
				project: z.string().nullable().optional(),
				priority: priorityZ.optional(),
				due: z
					.string()
					.nullable()
					.optional()
					.describe(
						"Natural-language due date (e.g. 'tomorrow', 'fri 5pm'); null to clear",
					),
				labels: z.array(z.string()).optional(),
			},
		},
		(args) => {
			const parsed = args.input ? parseQuickAdd(args.input) : undefined;
			const title = args.title ?? parsed?.title;
			if (!title) return fail("title is required (pass `input` or `title`)");

			const priority: Priority | undefined =
				(args.priority as Priority | undefined) ?? parsed?.priority;
			const labels = [...(parsed?.labels ?? []), ...(args.labels ?? [])];

			let dueAt: string | null | undefined;
			if (args.due !== undefined) {
				dueAt = args.due === null ? null : parseDueFlag(args.due);
			} else {
				dueAt = parsed?.dueAt ?? null;
			}

			const task = withDb((db) => {
				const created = createTask(db, {
					title,
					notes: args.notes ?? null,
					project: args.project ?? parsed?.project ?? null,
					priority,
					dueAt,
					labels: labels.length > 0 ? labels : undefined,
				});
				recordMutation(db, { kind: "create", taskId: created.id });
				return created;
			});
			return ok(task);
		},
	);

	server.registerTool(
		"list_today",
		{ description: "Overdue + due-today tasks (default view)" },
		() => ok(withDb((db) => listToday(db))),
	);

	server.registerTool(
		"list_overdue",
		{ description: "Tasks past their due date and not completed" },
		() => ok(withDb((db) => listOverdue(db))),
	);

	server.registerTool(
		"list_upcoming",
		{
			description: "Tasks due in the next N days",
			inputSchema: {
				days: z.number().int().positive().default(7),
			},
		},
		(args) => ok(withDb((db) => listUpcoming(db, args.days))),
	);

	server.registerTool(
		"list_tasks",
		{
			description: "List tasks with optional filters",
			inputSchema: {
				project: z.string().optional(),
				label: z.string().optional(),
				all: z.boolean().optional().describe("Include completed tasks"),
				completed: z.boolean().optional().describe("Only completed tasks"),
			},
		},
		(args) => ok(withDb((db) => listTasks(db, args))),
	);

	server.registerTool(
		"search_tasks",
		{
			description: "Substring search over task title and notes",
			inputSchema: { query: z.string().min(1) },
		},
		(args) => ok(withDb((db) => searchTasks(db, args.query))),
	);

	server.registerTool(
		"complete_tasks",
		{
			description: "Mark one or more tasks complete",
			inputSchema: { ids: idsZ },
		},
		(args) => {
			const result = withDb((db) =>
				args.ids
					.map((id) => {
						const before = getTask(db, id);
						if (!before || before.completedAt) return before;
						const after = completeTask(db, id);
						if (after)
							recordMutation(db, { kind: "complete", taskId: after.id });
						return after;
					})
					.filter((t) => t !== undefined),
			);
			return ok(result);
		},
	);

	server.registerTool(
		"reopen_tasks",
		{
			description: "Reopen one or more completed tasks",
			inputSchema: { ids: idsZ },
		},
		(args) => {
			const result = withDb((db) =>
				args.ids
					.map((id) => {
						const before = getTask(db, id);
						if (!before?.completedAt) return before;
						const after = reopenTask(db, id);
						if (after) recordMutation(db, { kind: "reopen", taskId: after.id });
						return after;
					})
					.filter((t) => t !== undefined),
			);
			return ok(result);
		},
	);

	server.registerTool(
		"delete_tasks",
		{
			description: "Delete one or more tasks (undo-able via `undo`)",
			inputSchema: { ids: idsZ },
		},
		(args) => {
			const result = withDb((db) =>
				args.ids
					.map((id) => {
						const before = getTask(db, id);
						if (!before) return undefined;
						deleteTask(db, id);
						recordMutation(db, { kind: "delete", task: before });
						return before;
					})
					.filter((t) => t !== undefined),
			);
			return ok(result);
		},
	);

	server.registerTool(
		"edit_task",
		{
			description:
				"Edit a task's fields. Only provided fields are changed. Pass `due: null` to clear the due date, `labels: []` to remove all labels.",
			inputSchema: {
				id: z.number().int().positive(),
				title: z.string().optional(),
				notes: z.string().nullable().optional(),
				project: z.string().nullable().optional(),
				priority: priorityZ.optional(),
				due: z.string().nullable().optional(),
				labels: z.array(z.string()).optional(),
			},
		},
		(args) => {
			const patch: TaskPatch = {};
			if (args.title !== undefined) patch.title = args.title;
			if (args.notes !== undefined) patch.notes = args.notes;
			if (args.project !== undefined) patch.project = args.project;
			if (args.priority !== undefined)
				patch.priority = args.priority as Priority;
			if (args.due !== undefined)
				patch.dueAt = args.due === null ? null : parseDueFlag(args.due);
			if (args.labels !== undefined) patch.labels = args.labels;

			const updated = withDb((db) => {
				const before = getTask(db, args.id);
				if (!before) return undefined;
				const after = updateTask(db, args.id, patch);
				if (after)
					recordMutation(db, { kind: "update", taskId: args.id, before });
				return after;
			});
			if (!updated) return fail(`task #${args.id} not found`);
			return ok(updated);
		},
	);

	server.registerTool(
		"undo",
		{
			description:
				"Reverse the last mutation (create/complete/reopen/update/delete)",
		},
		() => ok(withDb((db) => undoLast(db))),
	);

	server.registerTool(
		"list_projects",
		{ description: "Projects with open task counts" },
		() => ok(withDb((db) => listProjects(db))),
	);

	server.registerTool(
		"list_labels",
		{ description: "Labels with open task counts" },
		() => ok(withDb((db) => listLabelsWithCounts(db))),
	);
};
