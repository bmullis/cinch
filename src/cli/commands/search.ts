import { defineCommand } from "citty";
import { asJson, formatTaskList } from "../../output/format";
import { searchTasks } from "../../services/tasks";
import { baseArgs, withDb } from "../shared";

export const searchCommand = defineCommand({
	meta: { name: "search", description: "Substring search over title/notes" },
	args: {
		query: {
			type: "positional",
			description: "Search text",
			required: true,
		},
		...baseArgs,
	},
	run({ args }) {
		const tasks = withDb((db) => searchTasks(db, args.query));
		console.log(
			args.json ? asJson(tasks) : formatTaskList(tasks, "no matches."),
		);
	},
});
