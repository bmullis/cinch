import { describe, expect, test } from "bun:test";
import { parseQuickAdd } from "../src/parser/quickadd";

describe("quick-add parser", () => {
	test("extracts priority / project / labels and leaves clean title", () => {
		const r = parseQuickAdd("Buy milk p1 #groceries @urgent @store");
		expect(r.title).toBe("Buy milk");
		expect(r.priority).toBe(1);
		expect(r.project).toBe("groceries");
		expect(r.labels).toEqual(["urgent", "store"]);
	});

	test("parses natural language date and strips it from title", () => {
		const r = parseQuickAdd("Finish report tomorrow p2 #work");
		expect(r.title).toBe("Finish report");
		expect(r.priority).toBe(2);
		expect(r.project).toBe("work");
		expect(r.dueAt).not.toBeNull();
		expect(r.rawDatePhrase).toBeDefined();
	});

	test("returns null dueAt when no date phrase is present", () => {
		const r = parseQuickAdd("Just a title");
		expect(r.title).toBe("Just a title");
		expect(r.dueAt).toBeNull();
	});

	test("priority must be a word boundary (p5 in title is not priority)", () => {
		const r = parseQuickAdd("Review p5k config file");
		expect(r.priority).toBeUndefined();
		expect(r.title).toBe("Review p5k config file");
	});
});
