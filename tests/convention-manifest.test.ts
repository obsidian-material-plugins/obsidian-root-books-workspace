import assert from "node:assert/strict";
import test from "node:test";
import {
	buildConventionManifest,
	validPortableNoteName,
} from "../src/convention-manifest";
import { resolveFolderNoteConvention } from "../src/folder-note-names";
import { DEFAULT_SETTINGS } from "../src/types";

test("exports the resolved root name and local pattern", () => {
	const snapshot = resolveFolderNoteConvention(
		{
			...DEFAULT_SETTINGS,
			folderNoteNamingMode: "folder-name",
			rootWorkflowNoteName: "overview",
		},
		{
			available: true,
			pattern: "index",
			extension: ".md",
			storageLocation: "insideFolder",
		},
	);
	assert.deepEqual(buildConventionManifest(snapshot), {
		contract: "book-structure/v2",
		globalNote: "overview.md",
		localNotePattern: "{{folder_name}}.md",
	});
});

test("rejects traversal and more than one folder token", () => {
	assert.equal(validPortableNoteName("../index.md"), false);
	assert.equal(validPortableNoteName("con.md"), false);
	assert.equal(
		validPortableNoteName("{{folder_name}}-{{folder_name}}.md", true),
		false,
	);
});
