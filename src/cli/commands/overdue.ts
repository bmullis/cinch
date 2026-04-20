import { defineCommand } from "citty";
import { asJson, formatTaskList } from "../../output/format";
import { listOverdue } from "../../services/tasks";
import { baseArgs, withDb } from "../shared";

export const overdueCommand = defineCommand({
	meta: { name: "overdue", description: "Show overdue open tasks" },
	args: { ...baseArgs },
	run({ args }) {
		const tasks = withDb((db) => listOverdue(db));
		console.log(
			args.json ? asJson(tasks) : formatTaskList(tasks, "nothing overdue."),
		);
	},
});
