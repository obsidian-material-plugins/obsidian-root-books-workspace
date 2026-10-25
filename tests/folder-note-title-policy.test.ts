import assert from "node:assert/strict";
import test from "node:test";
import { needsInitialFolderTitle } from "../src/folder-note-title-policy";

test("an authored folder-note title is never replaced by its folder name", () => {
	assert.equal(needsInitialFolderTitle({ title: "My own title" }), false);
	assert.equal(needsInitialFolderTitle({ title: "" }), false);
	assert.equal(needsInitialFolderTitle({ title: null }), false);
	assert.equal(needsInitialFolderTitle({ panel: "icon: lucide:book" }), true);
});
