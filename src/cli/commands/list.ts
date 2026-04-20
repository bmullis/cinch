import { defineCommand } from "citty";
import { asJson, formatTaskList } from "../../output/format";
import { listTasks } from "../../services/tasks";
import { baseArgs, withDb } from "../shared";

export const listCommand = defineCommand({
	meta: { name: "list", description: "List tasks with optional filters" },
	args: {
		project: { type: "string", description: "Filter by project" },
		label: { type: "string", description: "Filter by label" },
		all: {
			type: "boolean",
			description: "Include completed tasks",
			default: false,
		},
		completed: {
			type: "boolean",
			description: "Show only completed tasks",
			default: false,
		},
		...baseArgs,
	},
	run({ args }) {
		const tasks = withDb((db) =>
			listTasks(db, {
				project: args.project,
				label: args.label,
				all: args.all,
				completed: args.completed,
			}),
		);
		console.log(
			args.json ? asJson(tasks) : formatTaskList(tasks, "no matching tasks."),
		);
	},
});
