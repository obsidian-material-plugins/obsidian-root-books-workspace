import assert from "node:assert/strict";
import test from "node:test";
import {
	normalizeNoteBasename,
	resolveFolderNoteConvention,
	validNoteBasename,
} from "../src/folder-note-names";
import { DEFAULT_SETTINGS } from "../src/types";

const detectedIndex = {
	available: true,
	pattern: "index",
	extension: ".md",
	storageLocation: "insideFolder",
};

test("normalizes safe Markdown basenames and rejects path-like values", () => {
	assert.equal(normalizeNoteBasename(" home.md "), "home");
	assert.equal(normalizeNoteBasename("../home"), "index");
	assert.equal(validNoteBasename("{{folder_name}}"), true);
	assert.equal(validNoteBasename("folder/note"), false);
});

test("follows the detected Folder Notes naming template", () => {
	const resolved = resolveFolderNoteConvention(DEFAULT_SETTINGS, {
		...detectedIndex,
		pattern: "{{folder_name}}",
	});

	assert.equal(resolved.folderExample, "Research/Research.md");
	assert.equal(resolved.rootPath, "index.md");
	assert.equal(resolved.quartzCompatible, false);
});

test("supports fixed custom folder notes and a separate root workflow note", () => {
	const resolved = resolveFolderNoteConvention(
		{
			...DEFAULT_SETTINGS,
			folderNoteNamingMode: "custom",
			customFolderNoteName: "_about",
			rootWorkflowNoteName: "home",
		},
		detectedIndex,
	);

	assert.equal(resolved.folderExample, "Research/_about.md");
	assert.equal(resolved.rootPath, "home.md");
	assert.equal(resolved.quartzCompatible, false);
});

test("marks the shared index convention as Quartz compatible", () => {
	const resolved = resolveFolderNoteConvention(
		{ ...DEFAULT_SETTINGS, folderNoteNamingMode: "index" },
		detectedIndex,
	);

	assert.equal(resolved.folderExample, "Research/index.md");
	assert.equal(resolved.quartzCompatible, true);
});

test("reports non-Markdown or external Folder Notes storage as unsupported", () => {
	const resolved = resolveFolderNoteConvention(DEFAULT_SETTINGS, {
		...detectedIndex,
		extension: ".canvas",
		storageLocation: "parentFolder",
	});

	assert.equal(resolved.supported, false);
	assert.equal(resolved.quartzCompatible, false);
});
