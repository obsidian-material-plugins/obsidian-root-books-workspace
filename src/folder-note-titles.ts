import { Plugin, TFile } from "obsidian";
import { cachedFrontmatter, frontmatterRecord } from "./frontmatter";
import type { FolderNoteConventionResolver } from "./folder-note-convention";
import { needsInitialFolderTitle } from "./folder-note-title-policy";

export class FolderNoteTitleSync {
	private timers = new Map<string, number>();

	constructor(
		private readonly plugin: Plugin,
		private readonly convention: FolderNoteConventionResolver,
	) {}

	start(): void {
		this.plugin.registerEvent(
			this.plugin.app.vault.on("create", (item) => {
				if (item instanceof TFile) this.schedule(item);
			}),
		);
	}

	private isFolderNote(file: TFile): boolean {
		return this.convention.isFolderNote(file);
	}

	private schedule(file: TFile): void {
		if (!this.isFolderNote(file)) return;
		const existing = this.timers.get(file.path);
		if (existing !== undefined) window.clearTimeout(existing);
		this.timers.set(
			file.path,
			window.setTimeout(() => {
				this.timers.delete(file.path);
				void this.synchronize(file);
			}, 250),
		);
	}

	private async synchronize(file: TFile): Promise<void> {
		if (!this.isFolderNote(file) || !file.parent) return;
		const expected = file.parent.name;
		if (!needsInitialFolderTitle(cachedFrontmatter(this.plugin.app, file)))
			return;
		await this.plugin.app.fileManager.processFrontMatter(
			file,
			(value: unknown) => {
				const frontmatter = frontmatterRecord(value);
				if (needsInitialFolderTitle(frontmatter))
					frontmatter.title = expected;
			},
		);
	}

	dispose(): void {
		for (const timer of this.timers.values()) window.clearTimeout(timer);
		this.timers.clear();
	}
}
