import { defineCommand } from "citty";
import { asJson, formatTaskLine } from "../../output/format";
import { recordMutation } from "../../services/journal";
import { deleteTask, getTask } from "../../services/tasks";
import { baseArgs, withDb } from "../shared";

export const rmCommand = defineCommand({
	meta: { name: "rm", description: "Delete one or more tasks" },
	args: {
		ids: { type: "positional", description: "Task IDs", required: true },
		...baseArgs,
	},
	run({ args, rawArgs }) {
		const raw = rawArgs.filter((a) => !a.startsWith("-"));
		const ids = raw.map((s) => Number.parseInt(s, 10));
		if (ids.some(Number.isNaN))
			throw new Error(`invalid id(s): ${raw.join(" ")}`);

		const result = withDb((db) =>
			ids
				.map((id) => {
					const before = getTask(db, id);
					if (!before) return undefined;
					deleteTask(db, id);
					recordMutation(db, { kind: "delete", task: before });
					return before;
				})
				.filter((t) => t !== undefined),
		);

		if (args.json) {
			console.log(asJson(result));
			return;
		}
		if (result.length === 0) {
			console.log("no matching tasks");
			return;
		}
		for (const t of result) console.log(`deleted  ${formatTaskLine(t)}`);
	},
});
