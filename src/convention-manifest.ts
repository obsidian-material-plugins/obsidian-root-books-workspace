import type { App } from "obsidian";
import type { FolderNoteConventionSnapshot } from "./folder-note-names";

export const CONVENTION_MANIFEST_PATH = ".obsidian-to-quartz-workspace.json";
export const BOOK_STRUCTURE_CONTRACT = "book-structure/v2";

export interface BookStructureManifest {
	contract: typeof BOOK_STRUCTURE_CONTRACT;
	globalNote: string;
	localNotePattern: string;
}

const INVALID_BASENAME = /[\\/:*?"<>|]/;
const RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function validPortableNoteName(
	value: string,
	allowToken = false,
): boolean {
	if (!value.endsWith(".md")) return false;
	const basename = value.slice(0, -3);
	const withoutToken = basename.replace("{{folder_name}}", "folder");
	return Boolean(
		basename &&
		basename !== "." &&
		basename !== ".." &&
		!INVALID_BASENAME.test(basename) &&
		![...basename].some((character) => character.charCodeAt(0) < 32) &&
		!RESERVED_NAME.test(withoutToken) &&
		!/[. ]$/.test(basename) &&
		(allowToken || !basename.includes("{{folder_name}}")) &&
		(!allowToken ||
			!basename
				.replace("{{folder_name}}", "")
				.includes("{{folder_name}}")),
	);
}

export function buildConventionManifest(
	convention: FolderNoteConventionSnapshot,
): BookStructureManifest {
	const globalNote = convention.rootPath;
	const localNotePattern = `${convention.pattern}${convention.extension}`;
	if (
		!convention.supported ||
		!validPortableNoteName(globalNote) ||
		!validPortableNoteName(localNotePattern, true)
	) {
		throw new Error(
			"The selected note names cannot be used by Quartz. Choose Markdown notes inside their folders.",
		);
	}
	return { contract: BOOK_STRUCTURE_CONTRACT, globalNote, localNotePattern };
}

export async function readConventionManifest(
	app: App,
): Promise<BookStructureManifest | null> {
	const adapter = app.vault.adapter;
	if (!(await adapter.exists(CONVENTION_MANIFEST_PATH))) return null;
	const value: unknown = JSON.parse(
		await adapter.read(CONVENTION_MANIFEST_PATH),
	);
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw new Error("The portable note convention must be a JSON object.");
	const record = value as Record<string, unknown>;
	if (
		record.contract !== BOOK_STRUCTURE_CONTRACT ||
		typeof record.globalNote !== "string" ||
		!validPortableNoteName(record.globalNote) ||
		typeof record.localNotePattern !== "string" ||
		!validPortableNoteName(record.localNotePattern, true)
	)
		throw new Error(
			"The portable note convention is invalid or uses an unsupported contract.",
		);
	return {
		contract: BOOK_STRUCTURE_CONTRACT,
		globalNote: record.globalNote,
		localNotePattern: record.localNotePattern,
	};
}

export async function saveConventionManifest(
	app: App,
	convention: FolderNoteConventionSnapshot,
): Promise<void> {
	const next = `${JSON.stringify(buildConventionManifest(convention), null, 2)}\n`;
	const adapter = app.vault.adapter;
	const previous = await adapter
		.read(CONVENTION_MANIFEST_PATH)
		.catch(() => null);
	if (previous !== next) await adapter.write(CONVENTION_MANIFEST_PATH, next);
}
