import { defineCommand } from "citty";
import pc from "picocolors";
import { asJson } from "../../output/format";
import { listProjects } from "../../services/tasks";
import { baseArgs, withDb } from "../shared";

export const projectsCommand = defineCommand({
	meta: {
		name: "projects",
		description: "List projects with open task counts",
	},
	args: { ...baseArgs },
	run({ args }) {
		const rows = withDb((db) => listProjects(db));
		if (args.json) {
			console.log(asJson(rows));
			return;
		}
		if (rows.length === 0) {
			console.log(
				process.stdout.isTTY ? pc.dim("no projects yet.") : "no projects yet.",
			);
			return;
		}
		for (const r of rows) {
			const count = process.stdout.isTTY
				? pc.dim(`(${r.open})`)
				: `(${r.open})`;
			console.log(`${r.project}  ${count}`);
		}
	},
});
