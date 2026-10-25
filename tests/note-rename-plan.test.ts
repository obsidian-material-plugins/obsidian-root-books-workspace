import assert from "node:assert/strict";
import test from "node:test";
import { planNoteRenames } from "../src/note-rename-plan";

test("plans root and nested folder settings-note renames", () => {
	const result = planNoteRenames(
		[
			"index.md",
			"Research/index.md",
			"Research/Methods/index.md",
			"ordinary.md",
		],
		[
			{ path: "Research", name: "Research" },
			{ path: "Research/Methods", name: "Methods" },
		],
		{ rootPath: "index.md", localPattern: "index", extension: ".md" },
		{
			rootPath: "overview.md",
			localPattern: "{{folder_name}}",
			extension: ".md",
		},
	);
	assert.deepEqual(result.conflicts, []);
	assert.deepEqual(result.renames, [
		{ from: "index.md", to: "overview.md" },
		{ from: "Research/index.md", to: "Research/Research.md" },
		{
			from: "Research/Methods/index.md",
			to: "Research/Methods/Methods.md",
		},
	]);
});

test("lists every occupied destination before applying anything", () => {
	const result = planNoteRenames(
		[
			"index.md",
			"overview.md",
			"A/index.md",
			"A/A.md",
			"B/index.md",
			"B/B.md",
		],
		[
			{ path: "A", name: "A" },
			{ path: "B", name: "B" },
		],
		{ rootPath: "index.md", localPattern: "index", extension: ".md" },
		{
			rootPath: "overview.md",
			localPattern: "{{folder_name}}",
			extension: ".md",
		},
	);
	assert.deepEqual(result.conflicts, ["A/A.md", "B/B.md", "overview.md"]);
	assert.deepEqual(result.renames, []);
});

test("does not plan a rename for a differently cased source path", () => {
	const plan = planNoteRenames(
		["Index.md", "Book/Index.md"],
		[{ path: "Book", name: "Book" }],
		{ rootPath: "index.md", localPattern: "index", extension: ".md" },
		{
			rootPath: "home.md",
			localPattern: "{{folder_name}}",
			extension: ".md",
		},
	);
	assert.equal(plan.missingRoot, true);
	assert.deepEqual(plan.renames, []);
});
