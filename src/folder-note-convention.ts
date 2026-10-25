import { normalizePath } from "obsidian";
import type { App, TFile, TFolder } from "obsidian";
import {
	folderNoteBasename,
	normalizedExtension,
	resolveFolderNoteConvention,
} from "./folder-note-names";
import type {
	DetectedFolderNoteSettings,
	FolderNoteConventionSnapshot,
} from "./folder-note-names";
import type { BookStructureManifest } from "./convention-manifest";
import { pluginSettings } from "./integrations";
import type { RootBooksWorkspaceSettings } from "./types";

export {
	normalizeNoteBasename,
	resolveFolderNoteConvention,
	resolvedRootNoteName,
	validNoteBasename,
} from "./folder-note-names";
export type {
	DetectedFolderNoteSettings,
	FolderNoteConventionSnapshot,
} from "./folder-note-names";

export class FolderNoteConventionResolver {
	private applied: Pick<
		BookStructureManifest,
		"globalNote" | "localNotePattern"
	> | null = null;
	private detected: DetectedFolderNoteSettings = {
		available: false,
		pattern: "index",
		extension: ".md",
		storageLocation: "insideFolder",
	};

	constructor(
		private readonly app: App,
		private readonly settings: RootBooksWorkspaceSettings,
	) {}

	async refreshDetection(): Promise<void> {
		const stored = await pluginSettings(this.app, "folder-notes");
		const rawPattern = stored.folderNoteName;
		this.detected = {
			available:
				typeof rawPattern === "string" && Boolean(rawPattern.trim()),
			pattern:
				typeof rawPattern === "string" && rawPattern.trim()
					? rawPattern.trim()
					: "index",
			extension: normalizedExtension(stored.folderNoteType),
			storageLocation:
				typeof stored.storageLocation === "string"
					? stored.storageLocation
					: "insideFolder",
		};
	}

	snapshot(): FolderNoteConventionSnapshot {
		const resolved = resolveFolderNoteConvention(
			this.settings,
			this.detected,
		);
		if (!this.applied) return resolved;
		const pattern = this.applied.localNotePattern.slice(0, -3);
		return {
			...resolved,
			pattern,
			extension: ".md",
			storageLocation: "insideFolder",
			rootPath: this.applied.globalNote,
			folderExample: `Research/${folderNoteBasename(pattern, "Research")}.md`,
			supported: true,
			quartzCompatible:
				pattern === "index" && this.applied.globalNote === "index.md",
		};
	}

	adopt(manifest: BookStructureManifest): void {
		this.applied = {
			globalNote: manifest.globalNote,
			localNotePattern: manifest.localNotePattern,
		};
	}

	preview(
		settings: RootBooksWorkspaceSettings,
	): FolderNoteConventionSnapshot {
		return resolveFolderNoteConvention(settings, this.detected);
	}

	rootPath(): string {
		return this.snapshot().rootPath;
	}

	folderPath(folder: Pick<TFolder, "path" | "name">): string {
		const convention = this.snapshot();
		const name = folderNoteBasename(convention.pattern, folder.name);
		return normalizePath(`${folder.path}/${name}${convention.extension}`);
	}

	isFolderNote(file: TFile): boolean {
		return Boolean(
			file.extension === "md" &&
			file.parent &&
			!file.parent.isRoot() &&
			file.path === this.folderPath(file.parent),
		);
	}

	isRootWorkflowNote(file: TFile): boolean {
		return file.path === this.rootPath();
	}
}
