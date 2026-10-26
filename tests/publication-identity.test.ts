import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(
	readFileSync(new URL("../manifest.json", import.meta.url), "utf8"),
) as {
	id: string;
	name: string;
	version: string;
	author: string;
	description: string;
};
const packageJson = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("keeps the published Obsidian identity and a releasable manifest", () => {
	assert.equal(manifest.id, "root-books-workspace");
	assert.match(manifest.id, /^[a-z-]+$/);
	assert.doesNotMatch(manifest.id, /obsidian|plugin$/);
	assert.equal(manifest.name, "Quartz Workspace Sync");
	assert.doesNotMatch(manifest.name, /obsidian|plugin/i);
	assert.equal(manifest.author, "Material Plugins");
	assert.doesNotMatch(manifest.description, /obsidian/i);
	assert.equal(manifest.version, packageJson.version);
});

test("keeps release styles compatible with Community Directory review", () => {
	assert.doesNotMatch(styles, /!important\b/);
});
