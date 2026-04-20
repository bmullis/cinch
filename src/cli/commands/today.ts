import { defineCommand } from "citty";
import { asJson, formatTaskList } from "../../output/format";
import { listToday } from "../../services/tasks";
import { baseArgs, withDb } from "../shared";

export const todayCommand = defineCommand({
	meta: {
		name: "today",
		description: "Show overdue + due-today tasks (default view)",
	},
	args: { ...baseArgs },
	run({ args }) {
		const tasks = withDb((db) => listToday(db));
		console.log(
			args.json ? asJson(tasks) : formatTaskList(tasks, "all clear."),
		);
	},
});
