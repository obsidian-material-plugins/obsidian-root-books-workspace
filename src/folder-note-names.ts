import type { RootBooksWorkspaceSettings } from "./types";

export const FOLDER_NAME_TOKEN = "{{folder_name}}";
const INVALID_NAME = /[\\/:*?"<>|\0]/;
const RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export interface DetectedFolderNoteSettings {
	available: boolean;
	pattern: string;
	extension: string;
	storageLocation: string;
}

export interface FolderNoteConventionSnapshot {
	mode: RootBooksWorkspaceSettings["folderNoteNamingMode"];
	pattern: string;
	extension: string;
	storageLocation: string;
	detected: DetectedFolderNoteSettings;
	folderExample: string;
	rootPath: string;
	supported: boolean;
	quartzCompatible: boolean;
}

export function normalizeNoteBasename(
	value: unknown,
	fallback = "index",
): string {
	if (typeof value !== "string") return fallback;
	const trimmed = value.trim().replace(/\.md$/i, "");
	return trimmed &&
		trimmed !== "." &&
		trimmed !== ".." &&
		!INVALID_NAME.test(trimmed) &&
		!RESERVED_NAME.test(trimmed) &&
		!/[. ]$/.test(trimmed)
		? trimmed
		: fallback;
}

export function validNoteBasename(value: string): boolean {
	const trimmed = value.trim().replace(/\.md$/i, "");
	return Boolean(
		trimmed &&
		trimmed !== "." &&
		trimmed !== ".." &&
		!INVALID_NAME.test(trimmed) &&
		!RESERVED_NAME.test(trimmed) &&
		!/[. ]$/.test(trimmed),
	);
}

export function resolvedRootNoteName(
	mode: RootBooksWorkspaceSettings["rootNoteNamingMode"],
	customName: string,
	detectedPattern: string,
	vaultName: string,
): string {
	if (mode === "index") return "index";
	if (mode === "custom") return normalizeNoteBasename(customName);
	const name =
		mode === "folder-name"
			? vaultName
			: folderNoteBasename(detectedPattern, vaultName);
	return normalizeNoteBasename(name);
}

export function normalizedExtension(value: unknown): string {
	if (typeof value !== "string" || !value.trim()) return ".md";
	const trimmed = value.trim().toLocaleLowerCase();
	return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

export function folderNoteBasename(
	pattern: string,
	folderName: string,
): string {
	return pattern.replace(FOLDER_NAME_TOKEN, folderName);
}

export function resolveFolderNoteConvention(
	settings: RootBooksWorkspaceSettings,
	detected: DetectedFolderNoteSettings,
): FolderNoteConventionSnapshot {
	const mode = settings.folderNoteNamingMode;
	const detectedPattern = normalizeNoteBasename(detected.pattern);
	const pattern =
		mode === "folder-notes"
			? detectedPattern
			: mode === "folder-name"
				? FOLDER_NAME_TOKEN
				: mode === "custom"
					? normalizeNoteBasename(settings.customFolderNoteName)
					: "index";
	const extension =
		mode === "folder-notes"
			? normalizedExtension(detected.extension)
			: ".md";
	const storageLocation =
		mode === "folder-notes" ? detected.storageLocation : "insideFolder";
	const rootName = normalizeNoteBasename(settings.rootWorkflowNoteName);
	const exampleName = folderNoteBasename(pattern, "Research");
	const supported = extension === ".md" && storageLocation === "insideFolder";

	return {
		mode,
		pattern,
		extension,
		storageLocation,
		detected,
		folderExample: `Research/${exampleName}${extension}`,
		rootPath: `${rootName}.md`,
		supported,
		quartzCompatible:
			supported && pattern === "index" && rootName === "index",
	};
}
