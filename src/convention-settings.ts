import {
	App,
	ButtonComponent,
	Modal,
	Notice,
	Setting,
	TFolder,
} from "obsidian";
import type { Plugin, TextComponent } from "obsidian";
import { buildConventionManifest } from "./convention-manifest";
import {
	resolvedRootNoteName,
	validNoteBasename,
} from "./folder-note-convention";
import type { FolderNoteConventionSnapshot } from "./folder-note-convention";
import { planNoteRenames } from "./note-rename-plan";
import type { NoteRenamePlan } from "./note-rename-plan";
import type { RootBooksSettingsHost } from "./settings";
import type { RootBooksWorkspaceSettings } from "./types";

type NamingMode = RootBooksWorkspaceSettings["folderNoteNamingMode"];

function conventionPaths(convention: FolderNoteConventionSnapshot) {
	return {
		rootPath: convention.rootPath,
		localPattern: convention.pattern,
		extension: convention.extension,
	};
}

function notePlan(
	app: App,
	current: FolderNoteConventionSnapshot,
	next: FolderNoteConventionSnapshot,
): NoteRenamePlan {
	const files = app.vault.getAllLoadedFiles();
	return planNoteRenames(
		files.map((file) => file.path),
		files
			.filter(
				(file): file is TFolder =>
					file instanceof TFolder && !file.isRoot(),
			)
			.map((folder) => ({ path: folder.path, name: folder.name })),
		conventionPaths(current),
		conventionPaths(next),
	);
}

class ConventionApplyModal extends Modal {
	constructor(
		app: App,
		private readonly host: RootBooksSettingsHost & Plugin,
		private readonly candidate: RootBooksWorkspaceSettings,
		private readonly plan: NoteRenamePlan,
		private readonly onApplied: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Review settings-note filenames");
		this.contentEl.createEl("p", {
			text: "Applying this convention will update the portable filename record and rename these existing notes:",
		});
		if (this.plan.renames.length === 0) {
			this.contentEl.createEl("p", {
				text: "No existing notes need renaming.",
			});
		} else {
			const list = this.contentEl.createEl("ul");
			for (const rename of this.plan.renames)
				list.createEl("li", { text: `${rename.from} → ${rename.to}` });
		}
		if (this.plan.missingRoot)
			this.contentEl.createEl("p", {
				cls: "root-books-status-warning",
				text: "The current global settings note is missing. Applying the convention will not create it.",
			});
		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText("Cancel").onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText("Apply changes")
					.setCta()
					.onClick(async () => {
						button.setDisabled(true);
						try {
							await this.host.applyNoteConvention(
								this.candidate,
								this.plan,
							);
							this.close();
							this.onApplied();
						} catch (error) {
							button.setDisabled(false);
							new Notice(
								error instanceof Error
									? error.message
									: String(error),
								10000,
							);
						}
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export function renderConventionSettings(
	setting: Setting,
	app: App,
	host: RootBooksSettingsHost & Plugin,
	draft: RootBooksWorkspaceSettings,
	rerender: () => void,
	onApplied: () => void,
): void {
	setting.settingEl.dataset.rootBooksReturnAnchor = "vault-note-conventions";
	const container = setting.descEl.createDiv({
		cls: "root-books-note-conventions",
	});
	const current = host.folderNoteConvention.snapshot();
	const summary = container.createDiv({
		cls: "root-books-convention-summary",
	});
	let rootInput: TextComponent | null = null;
	let localInput: TextComponent | null = null;
	let previewButton!: ButtonComponent;

	const candidateConvention = (): {
		settings: RootBooksWorkspaceSettings;
		snapshot: FolderNoteConventionSnapshot;
	} => {
		const rootName = resolvedRootNoteName(
			draft.rootNoteNamingMode,
			draft.customRootNoteName,
			current.detected.pattern,
			app.vault.getName(),
		);
		const settings = {
			...host.settings,
			folderNoteNamingMode: draft.folderNoteNamingMode,
			customFolderNoteName: draft.customFolderNoteName,
			rootNoteNamingMode: draft.rootNoteNamingMode,
			customRootNoteName: draft.customRootNoteName,
			rootWorkflowNoteName: rootName,
		};
		return {
			settings,
			snapshot: host.folderNoteConvention.preview(settings),
		};
	};

	const refreshPreview = (): void => {
		const { snapshot } = candidateConvention();
		const plan = notePlan(app, current, snapshot);
		const invalidRoot =
			draft.rootNoteNamingMode === "custom" &&
			!validNoteBasename(draft.customRootNoteName);
		const invalidLocal =
			draft.folderNoteNamingMode === "custom" &&
			!validNoteBasename(draft.customFolderNoteName);
		const rootCollision = plan.conflicts.includes(snapshot.rootPath);
		const localCollision = plan.conflicts.some(
			(path) => path !== snapshot.rootPath,
		);
		rootInput?.inputEl.classList.toggle(
			"root-books-filename-invalid",
			invalidRoot || rootCollision,
		);
		localInput?.inputEl.classList.toggle(
			"root-books-filename-invalid",
			invalidLocal || localCollision,
		);
		rootInput?.inputEl.setAttribute(
			"aria-invalid",
			String(invalidRoot || rootCollision),
		);
		localInput?.inputEl.setAttribute(
			"aria-invalid",
			String(invalidLocal || localCollision),
		);
		summary.empty();
		summary.createDiv({
			text: `Global settings note: ${snapshot.rootPath}`,
		});
		summary.createDiv({ text: `Local example: ${snapshot.folderExample}` });
		if (
			draft.folderNoteNamingMode !== "folder-notes" &&
			current.detected.available &&
			`${snapshot.pattern}${snapshot.extension}` !==
				`${current.detected.pattern}${current.detected.extension}`
		)
			summary.createDiv({
				cls: "root-books-status-warning",
				text: "Folder Notes may still create notes with its own filename. Change its naming setting separately if new folder notes should use this convention.",
			});
		if (`${snapshot.pattern}${snapshot.extension}` !== "index.md")
			summary.createDiv({
				cls: "root-books-status-warning",
				text: "Custom File Explorer Sorting has a separate folder-note name setting. Match it to this local filename to keep sorting rules available.",
			});
		if (
			draft.folderNoteNamingMode === "folder-notes" ||
			draft.rootNoteNamingMode === "folder-notes"
		)
			summary.createDiv({
				text: current.detected.available
					? `Detected from Folder Notes: ${current.detected.pattern}${current.detected.extension}`
					: "Folder Notes naming could not be detected; index.md is the fallback.",
			});
		if (invalidRoot || invalidLocal)
			summary.createDiv({
				cls: "root-books-status-error",
				text: "Enter a valid Markdown basename without path separators or reserved characters.",
			});
		if (plan.conflicts.length > 0) {
			summary.createDiv({
				cls: "root-books-status-error",
				text: "That filename is already in use. These renames would fail:",
			});
			const list = summary.createEl("ul", {
				cls: "root-books-collision-paths",
			});
			for (const path of plan.conflicts)
				list.createEl("li", { text: path });
		}
		let manifestError = "";
		try {
			buildConventionManifest(snapshot);
		} catch (error) {
			manifestError =
				error instanceof Error ? error.message : String(error);
		}
		if (manifestError)
			summary.createDiv({
				cls: "root-books-status-error",
				text: manifestError,
			});
		if (
			!invalidRoot &&
			!invalidLocal &&
			!manifestError &&
			plan.conflicts.length === 0
		) {
			summary.createDiv({
				text:
					plan.renames.length === 0
						? "No existing settings notes need renaming."
						: `${plan.renames.length} existing settings note${plan.renames.length === 1 ? "" : "s"} would be renamed.`,
			});
		}
		previewButton.setDisabled(
			Boolean(
				invalidRoot ||
				invalidLocal ||
				manifestError ||
				plan.conflicts.length,
			),
		);
	};

	const addModeRow = (
		scope: "root" | "local",
		name: string,
		description: string,
	): void => {
		const mode =
			scope === "root"
				? draft.rootNoteNamingMode
				: draft.folderNoteNamingMode;
		const row = new Setting(container).setName(name).setDesc(description);
		row.settingEl.addClass("root-books-convention-row");
		const refreshSlot = row.controlEl.createDiv({
			cls: "root-books-refresh-slot",
		});
		if (mode === "folder-notes")
			new ButtonComponent(refreshSlot)
				.setButtonText("Refresh detection")
				.onClick(async () => {
					await host.refreshFolderNoteDetection();
					rerender();
				});
		row.addDropdown((dropdown) =>
			dropdown
				.addOption("folder-notes", "Follow Folder Notes")
				.addOption("index", "Use index.md")
				.addOption(
					"folder-name",
					scope === "root"
						? "Use the vault name"
						: "Use the folder name",
				)
				.addOption("custom", "Use a custom name")
				.setValue(mode)
				.onChange((value) => {
					if (
						![
							"folder-notes",
							"index",
							"folder-name",
							"custom",
						].includes(value)
					)
						return;
					if (scope === "root")
						draft.rootNoteNamingMode = value as NamingMode;
					else draft.folderNoteNamingMode = value as NamingMode;
					rerender();
				}),
		);
	};

	addModeRow(
		"root",
		"Global settings filename",
		"The vault-wide settings note. Folder Notes does not manage this root note.",
	);
	if (draft.rootNoteNamingMode === "custom") {
		const row = new Setting(container)
			.setName("Custom global filename")
			.setDesc("Enter a Markdown basename without .md.");
		row.settingEl.addClass("root-books-convention-row");
		row.addText((text) => {
			rootInput = text;
			text.setValue(draft.customRootNoteName);
			text.onChange((value) => {
				draft.customRootNoteName = value;
				refreshPreview();
			});
		});
	}
	addModeRow(
		"local",
		"Local settings and overwrites filename",
		"Optional settings notes in folders can override global values for their subtrees.",
	);
	if (draft.folderNoteNamingMode === "custom") {
		const row = new Setting(container)
			.setName("Custom local filename")
			.setDesc(
				"Enter one Markdown basename, used in every folder that has a settings note.",
			);
		row.settingEl.addClass("root-books-convention-row");
		row.addText((text) => {
			localInput = text;
			text.setValue(draft.customFolderNoteName);
			text.onChange((value) => {
				draft.customFolderNoteName = value;
				refreshPreview();
			});
		});
	}

	previewButton = new ButtonComponent(container).setButtonText(
		"Preview changes",
	);
	previewButton.onClick(() => {
		const { settings, snapshot } = candidateConvention();
		const plan = notePlan(app, current, snapshot);
		if (plan.conflicts.length > 0) return;
		new ConventionApplyModal(app, host, settings, plan, onApplied).open();
	});
	refreshPreview();
}
