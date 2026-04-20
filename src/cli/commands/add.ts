import { defineCommand } from "citty";
import { asJson, formatTaskLine } from "../../output/format";
import { parseQuickAdd } from "../../parser/quickadd";
import { recordMutation } from "../../services/journal";
import { createTask } from "../../services/tasks";
import type { NewTask, Priority } from "../../services/types";
import { baseArgs, parseDueFlag, withDb } from "../shared";

export const addCommand = defineCommand({
	meta: { name: "add", description: "Add a task (quick-add or flags)" },
	args: {
		input: {
			type: "positional",
			description: "Quick-add string (optional if --title given)",
			required: false,
		},
		title: { type: "string", description: "Task title (overrides quick-add)" },
		notes: { type: "string", description: "Long-form notes" },
		project: { type: "string", description: "Project name" },
		priority: { type: "string", description: "Priority 1-4" },
		due: { type: "string", description: "Due date (natural language)" },
		label: {
			type: "string",
			description: "Label (repeatable)",
		},
		...baseArgs,
	},
	run({ args }) {
		const parsed = args.input ? parseQuickAdd(args.input) : undefined;

		const priority = args.priority
			? (Number(args.priority) as Priority)
			: parsed?.priority;
		if (priority !== undefined && ![1, 2, 3, 4].includes(priority))
			throw new Error(`priority must be 1-4, got ${priority}`);

		const flagLabels = typeof args.label === "string" ? [args.label] : [];
		const labels = [...(parsed?.labels ?? []), ...flagLabels];

		const dueAt =
			args.due !== undefined ? parseDueFlag(args.due) : (parsed?.dueAt ?? null);

		const title = args.title ?? parsed?.title;
		if (!title) throw new Error("title is required (positional or --title)");

		const input: NewTask = {
			title,
			notes: args.notes ?? null,
			project: args.project ?? parsed?.project ?? null,
			priority,
			dueAt,
			labels: labels.length > 0 ? labels : undefined,
		};

		const task = withDb((db) => {
			const created = createTask(db, input);
			recordMutation(db, { kind: "create", taskId: created.id });
			return created;
		});

		if (args.json) {
			console.log(asJson(task));
		} else {
			console.log(`added ${formatTaskLine(task)}`);
		}
	},
});
