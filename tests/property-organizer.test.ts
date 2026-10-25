import assert from "node:assert/strict";
import test from "node:test";
import { organizeSettingsFrontmatter } from "../src/property-organizer";

test("moves complete multiline properties without changing their YAML text", () => {
	const source =
		'---\r\ntitle: Book\r\nsorting-spec: |\r\n  > a-z by-metadata: created\r\npanel: |\r\n  icon: lucide:book-open\r\n  accent: "#e04b0b"\r\n---\r\nBody\r\n';
	const result = organizeSettingsFrontmatter(source, {
		position: "top",
		order: ["panel", "sorting-spec"],
		completeGlobal: false,
		isGlobal: false,
	});
	assert.ok(result.indexOf("panel: |") < result.indexOf("sorting-spec: |"));
	assert.ok(
		result.indexOf("sorting-spec: |") < result.indexOf("title: Book"),
	);
	assert.ok(result.includes('  accent: "#e04b0b"\r\n'));
	assert.equal(
		organizeSettingsFrontmatter(result, {
			position: "top",
			order: ["panel", "sorting-spec"],
			completeGlobal: false,
			isGlobal: false,
		}),
		result,
	);
});

test("adds shipped defaults only to the global settings note", () => {
	const source = "---\ntitle: Home\n---\nBody\n";
	const options = {
		position: "bottom" as const,
		order: [],
		completeGlobal: true,
	};
	const global = organizeSettingsFrontmatter(source, {
		...options,
		isGlobal: true,
	});
	assert.ok(global.includes("exercise-preview-size-limit: 50 MB"));
	assert.ok(global.includes("add-date-to-new-notes: false"));
	assert.ok(!global.includes("prefix-new-dates:"));
	assert.equal(
		organizeSettingsFrontmatter(source, { ...options, isGlobal: false }),
		source,
	);
	assert.equal(
		organizeSettingsFrontmatter(global, { ...options, isGlobal: true }),
		global,
	);
});

test("skips malformed and duplicate-key frontmatter", () => {
	const options = {
		position: "top" as const,
		order: [],
		completeGlobal: false,
		isGlobal: true,
	};
	assert.throws(() =>
		organizeSettingsFrontmatter("---\npanel: a\npanel: b\n---\n", options),
	);
	assert.equal(
		organizeSettingsFrontmatter("---\npanel: a\n", options),
		"---\npanel: a\n",
	);
});
