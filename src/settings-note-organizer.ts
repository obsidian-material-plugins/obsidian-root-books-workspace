import { Notice, TFile } from "obsidian";
import type { Plugin } from "obsidian";
import type { FolderNoteConventionResolver } from "./folder-note-convention";
import {
	organizeSettingsFrontmatter,
	PORTABLE_PROPERTIES,
} from "./property-organizer";
import type { RootBooksWorkspaceSettings } from "./types";

export class SettingsNoteOrganizer {
	private timers = new Map<string, number>();
	private pending = new Set<string>();

	constructor(
		private readonly plugin: Plugin,
		private readonly convention: FolderNoteConventionResolver,
		private readonly settings: RootBooksWorkspaceSettings,
	) {}

	start(): void {
		const managedKeys = new Set(
			PORTABLE_PROPERTIES.map((property) => property.key),
		);
		this.plugin.registerDomEvent(
			document,
			"focusout",
			(event: FocusEvent) => {
				const target = event.target;
				if (!(target instanceof HTMLElement)) return;
				const properties = target.closest(".metadata-container");
				if (!properties) return;
				const file = this.plugin.app.workspace.getActiveFile();
				if (!(file instanceof TFile) || !this.isSettingsNote(file))
					return;
				const row = target.closest<HTMLElement>(".metadata-property");
				const keyElement = row?.querySelector<HTMLInputElement>(
					".metadata-property-key-input",
				);
				const key = keyElement?.value ?? keyElement?.textContent ?? "";
				if (managedKeys.has(key.trim())) this.pending.add(file.path);
				if (
					event.relatedTarget instanceof Node &&
					properties.contains(event.relatedTarget)
				)
					return;
				if (
					!this.pending.has(file.path) &&
					!(
						this.settings.completeGlobalProperties &&
						file.path === this.convention.rootPath()
					)
				)
					return;
				this.pending.delete(file.path);
				const previous = this.timers.get(file.path);
				if (previous !== undefined) window.clearTimeout(previous);
				this.timers.set(
					file.path,
					window.setTimeout(() => {
						this.timers.delete(file.path);
						void this.organize(file);
					}, 600),
				);
			},
			true,
		);
	}

	private isSettingsNote(file: TFile): boolean {
		return (
			file.path === this.convention.rootPath() ||
			this.convention.isFolderNote(file)
		);
	}

	async applyToAll(): Promise<void> {
		for (const file of this.plugin.app.vault.getMarkdownFiles()) {
			if (this.isSettingsNote(file)) await this.organize(file);
		}
	}

	private async organize(file: TFile): Promise<void> {
		if (!this.isSettingsNote(file)) return;
		const options = {
			position: this.settings.propertyPosition,
			order: this.settings.propertyOrder,
			completeGlobal: this.settings.completeGlobalProperties,
			isGlobal: file.path === this.convention.rootPath(),
		};
		try {
			const before = await this.plugin.app.vault.read(file);
			if (organizeSettingsFrontmatter(before, options) === before) return;
			await this.plugin.app.vault.process(file, (current) =>
				organizeSettingsFrontmatter(current, options),
			);
		} catch (error) {
			new Notice(
				`Could not arrange settings-note properties: ${error instanceof Error ? error.message : String(error)}`,
				10000,
			);
		}
	}

	dispose(): void {
		for (const timer of this.timers.values()) window.clearTimeout(timer);
		this.timers.clear();
		this.pending.clear();
	}
}
