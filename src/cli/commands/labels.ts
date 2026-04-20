import { defineCommand } from "citty";
import pc from "picocolors";
import { asJson } from "../../output/format";
import { listLabelsWithCounts } from "../../services/labels";
import { baseArgs, withDb } from "../shared";

export const labelsCommand = defineCommand({
	meta: { name: "labels", description: "List labels with open task counts" },
	args: { ...baseArgs },
	run({ args }) {
		const rows = withDb((db) => listLabelsWithCounts(db));
		if (args.json) {
			console.log(asJson(rows));
			return;
		}
		if (rows.length === 0) {
			console.log(
				process.stdout.isTTY ? pc.dim("no labels yet.") : "no labels yet.",
			);
			return;
		}
		for (const r of rows) {
			const count = process.stdout.isTTY
				? pc.dim(`(${r.open})`)
				: `(${r.open})`;
			console.log(`@${r.name}  ${count}`);
		}
	},
});
