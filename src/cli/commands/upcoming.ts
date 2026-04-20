import { defineCommand } from "citty";
import { asJson, formatTaskList } from "../../output/format";
import { listUpcoming } from "../../services/tasks";
import { baseArgs, withDb } from "../shared";

export const upcomingCommand = defineCommand({
	meta: { name: "upcoming", description: "Show tasks due in the next N days" },
	args: {
		days: { type: "string", description: "Look-ahead window", default: "7" },
		...baseArgs,
	},
	run({ args }) {
		const days = Number.parseInt(args.days, 10);
		if (Number.isNaN(days) || days < 1) throw new Error("--days must be >= 1");
		const tasks = withDb((db) => listUpcoming(db, days));
		console.log(
			args.json
				? asJson(tasks)
				: formatTaskList(tasks, `nothing in the next ${days} days.`),
		);
	},
});
