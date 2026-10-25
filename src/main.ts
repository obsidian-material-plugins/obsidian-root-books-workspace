import { Notice, Plugin, TFile, TFolder, normalizePath } from "obsidian";
import { CreatedFromFilenameSync } from "./created-from-filename";
import {
	buildConventionManifest,
	readConventionManifest,
	saveConventionManifest,
} from "./convention-manifest";
import { BookDecorations } from "./decorations";
import { FolderNoteTitleSync } from "./folder-note-titles";
import {
	FolderNoteConventionResolver,
	normalizeNoteBasename,
} from "./folder-note-convention";
import {
	auditWatchTargets,
	exportCommunityInstallManagerProfile,
	loadWatchProfile,
	resetWatchProfile,
	saveWatchProfile,
} from "./integrations";
import { watchAuditIssueKeys } from "./integration-audit";
import { NewNotePipeline } from "./new-note-pipeline";
import { planNoteRenames } from "./note-rename-plan";
import type { NoteRenamePlan } from "./note-rename-plan";
import { normalizePropertyOrder } from "./property-organizer";
import { RootBooksWorkspaceSettingTab } from "./settings";
import { SettingsNoteOrganizer } from "./settings-note-organizer";
import { SortingCoordinator } from "./sorting";
import { DEFAULT_SETTINGS } from "./types";
import type {
	RootBooksWorkspaceSettings,
	RuntimeCoordinatorState,
	WatchedTarget,
} from "./types";
import { registerUniqueNoteAction } from "./unique-note";

const WATCH_AUDIT_INTERVAL_MS = 3000;

export default class RootBooksWorkspacePlugin extends Plugin {
	settings: RootBooksWorkspaceSettings = { ...DEFAULT_SETTINGS };
	watchTargets: WatchedTarget[] = [];
	watchProfileHasOverride = false;
	private initialized = false;
	readonly folderNoteConvention = new FolderNoteConventionResolver(
		this.app,
		this.settings,
	);
	private sorting: SortingCoordinator | null = null;
	private pipeline: NewNotePipeline | null = null;
	private createdFromFilename: CreatedFromFilenameSync | null = null;
	private folderTitles: FolderNoteTitleSync | null = null;
	private decorations: BookDecorations | null = null;
	private noteOrganizer: SettingsNoteOrganizer | null = null;
	private filenameDateSyncActive = false;
	private watchProfileLoadError: string | null = null;
	private previousWatchIssueKeys = new Set<string>();
	private watchAuditRunning = false;

	async onload(): Promise<void> {
		await this.loadSettings();
		await this.folderNoteConvention.refreshDetection();
		try {
			let manifest = await readConventionManifest(this.app);
			if (!manifest) {
				const initial = this.folderNoteConvention.snapshot();
				manifest = buildConventionManifest(initial);
				await saveConventionManifest(this.app, initial);
			}
			this.folderNoteConvention.adopt(manifest);
		} catch (error) {
			new Notice(
				`Could not publish the note convention: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		this.addSettingTab(new RootBooksWorkspaceSettingTab(this.app, this));
		this.app.workspace.onLayoutReady(() => void this.initialize());
	}

	private async initialize(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;

		this.sorting = new SortingCoordinator(this);
		this.pipeline = new NewNotePipeline(
			this,
			this.sorting,
			this.folderNoteConvention,
		);
		this.folderTitles = new FolderNoteTitleSync(
			this,
			this.folderNoteConvention,
		);
		this.decorations = new BookDecorations(
			this,
			this.settings,
			this.folderNoteConvention,
		);
		registerUniqueNoteAction(
			this,
			this.settings,
			this.pipeline,
			this.folderNoteConvention,
		);

		await this.pipeline.start();
		this.createdFromFilename = new CreatedFromFilenameSync(
			this,
			this.settings,
			() => this.saveSettings(),
			this.sorting,
			this.folderNoteConvention,
		);
		await this.createdFromFilename.start();
		this.filenameDateSyncActive = true;
		this.folderTitles.start();
		this.decorations.start();
		this.noteOrganizer = new SettingsNoteOrganizer(
			this,
			this.folderNoteConvention,
			this.settings,
		);
		this.noteOrganizer.start();

		if (this.watchProfileLoadError)
			new Notice(this.watchProfileLoadError, 10000);
		if (this.settings.exportWatchProfileOnStartup) {
			try {
				await exportCommunityInstallManagerProfile(
					this.app,
					this.watchTargets,
				);
			} catch (error) {
				new Notice(
					`Could not export the Community Install Manager profile: ${error instanceof Error ? error.message : String(error)}`,
					10000,
				);
			}
		}
		await this.startWatchAuditMonitoring();
	}

	refreshDecorations(): void {
		this.decorations?.refresh();
	}

	async refreshFolderNoteDetection(): Promise<void> {
		await this.folderNoteConvention.refreshDetection();
		await this.pipeline?.refreshConvention();
		await this.createdFromFilename?.refreshConvention();
		this.refreshDecorations();
	}

	openAppearancePicker(): void {
		this.decorations?.openAppearancePicker();
	}

	runtimeCoordinatorState(): RuntimeCoordinatorState {
		return {
			initialized: this.initialized,
			newNotePipeline: this.pipeline !== null,
			filenameDateSync: this.filenameDateSyncActive,
			folderTitleSync: this.folderTitles !== null,
			sorting: this.sorting !== null,
			bookDecorations: this.decorations !== null,
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async applyPropertySettings(): Promise<void> {
		await this.saveSettings();
		await this.noteOrganizer?.applyToAll();
	}

	async applyNoteConvention(
		candidate: RootBooksWorkspaceSettings,
		preview: NoteRenamePlan,
	): Promise<void> {
		const current = this.folderNoteConvention.snapshot();
		const next = this.folderNoteConvention.preview(candidate);
		const nextManifest = buildConventionManifest(next);
		const files = this.app.vault.getAllLoadedFiles();
		const plan = planNoteRenames(
			files.map((file) => file.path),
			files
				.filter(
					(file): file is TFolder =>
						file instanceof TFolder && !file.isRoot(),
				)
				.map((folder) => ({ path: folder.path, name: folder.name })),
			{
				rootPath: current.rootPath,
				localPattern: current.pattern,
				extension: current.extension,
			},
			{
				rootPath: next.rootPath,
				localPattern: next.pattern,
				extension: next.extension,
			},
		);
		if (plan.conflicts.length > 0)
			throw new Error(
				`These destinations already exist: ${plan.conflicts.join(", ")}`,
			);
		if (JSON.stringify(plan) !== JSON.stringify(preview))
			throw new Error(
				"Settings notes changed since this preview. Review the filenames again before applying.",
			);

		const completed: typeof plan.renames = [];
		const previous = { ...this.settings };
		try {
			for (const rename of plan.renames) {
				const file = this.app.vault.getAbstractFileByPath(rename.from);
				if (!(file instanceof TFile))
					throw new Error(
						`Settings note disappeared: ${rename.from}`,
					);
				await this.app.fileManager.renameFile(file, rename.to);
				completed.push(rename);
			}
			Object.assign(this.settings, candidate);
			await saveConventionManifest(this.app, next);
			this.folderNoteConvention.adopt(nextManifest);
			await this.saveSettings();
			await this.refreshFolderNoteDetection();
		} catch (error) {
			Object.assign(this.settings, previous);
			const rollbackErrors: string[] = [];
			for (const rename of completed.reverse()) {
				try {
					const file = this.app.vault.getAbstractFileByPath(
						rename.to,
					);
					if (!(file instanceof TFile))
						throw new Error(`Missing ${rename.to}`);
					await this.app.fileManager.renameFile(file, rename.from);
				} catch (rollbackError) {
					rollbackErrors.push(
						rollbackError instanceof Error
							? rollbackError.message
							: String(rollbackError),
					);
				}
			}
			await saveConventionManifest(this.app, current).catch(
				() => undefined,
			);
			this.folderNoteConvention.adopt(buildConventionManifest(current));
			await this.saveSettings().catch(() => undefined);
			const reason =
				error instanceof Error ? error.message : String(error);
			throw new Error(
				rollbackErrors.length
					? `${reason}; rollback needs attention: ${rollbackErrors.join(", ")}`
					: reason,
			);
		}
	}

	async saveWatchTargets(targets: readonly WatchedTarget[]): Promise<void> {
		await saveWatchProfile(this.app, targets);
		this.watchTargets = targets.map((target) => structuredClone(target));
		this.watchProfileHasOverride = true;
	}

	async resetWatchTargets(): Promise<void> {
		const profile = await resetWatchProfile(this.app);
		this.watchTargets = profile.targets;
		this.watchProfileHasOverride = false;
	}

	private notifyAboutWatchIssues(
		audits: Awaited<ReturnType<typeof auditWatchTargets>>,
		live = false,
	): void {
		const problems = audits.filter((audit) => !audit.configured);
		if (problems.length === 0) return;
		const names = problems
			.slice(0, 3)
			.map((audit) => audit.name)
			.join(", ");
		const remainder = problems.length - 3;
		new Notice(
			live
				? `Obsidian to quartz workspace detected a watched-state change: ${names}${remainder > 0 ? ` and ${remainder} more` : ""} ${problems.length === 1 ? "needs" : "need"} attention. Open its settings for details.`
				: `Obsidian to quartz workspace found ${problems.length} watched target${problems.length === 1 ? "" : "s"} needing attention: ${names}${remainder > 0 ? ` and ${remainder} more` : ""}. Open its settings for details.`,
			10000,
		);
	}

	private issueKeys(
		audits: Awaited<ReturnType<typeof auditWatchTargets>>,
	): Set<string> {
		return new Set(audits.flatMap((audit) => watchAuditIssueKeys(audit)));
	}

	private async startWatchAuditMonitoring(): Promise<void> {
		const audits = await auditWatchTargets(this.app, this.watchTargets);
		this.previousWatchIssueKeys = this.issueKeys(audits);
		if (this.settings.notifyOnAuditIssues)
			this.notifyAboutWatchIssues(audits);
		this.registerInterval(
			window.setInterval(
				() => void this.pollWatchAudit(),
				WATCH_AUDIT_INTERVAL_MS,
			),
		);
	}

	private async pollWatchAudit(): Promise<void> {
		if (this.watchAuditRunning) return;
		this.watchAuditRunning = true;
		try {
			const audits = await auditWatchTargets(this.app, this.watchTargets);
			const currentIssueKeys = this.issueKeys(audits);
			const newlyProblematic = audits.filter((audit) =>
				watchAuditIssueKeys(audit).some(
					(key) => !this.previousWatchIssueKeys.has(key),
				),
			);
			this.previousWatchIssueKeys = currentIssueKeys;
			if (
				this.settings.notifyOnAuditIssues &&
				newlyProblematic.length > 0
			)
				this.notifyAboutWatchIssues(newlyProblematic, true);
		} catch {
			// A transient read failure is retried on the next interval.
		} finally {
			this.watchAuditRunning = false;
		}
	}

	private async loadSettings(): Promise<void> {
		let stored =
			(await this.loadData()) as Partial<RootBooksWorkspaceSettings> | null;
		let migratedLegacyData = false;
		if (!stored) {
			const previousPath = normalizePath(
				`${this.app.vault.configDir}/plugins/root-books-workspace/data.json`,
			);
			if (await this.app.vault.adapter.exists(previousPath)) {
				try {
					stored = JSON.parse(
						await this.app.vault.adapter.read(previousPath),
					) as Partial<RootBooksWorkspaceSettings>;
					migratedLegacyData = true;
				} catch {
					new Notice(
						"The former plugin settings could not be read; default settings will be used.",
					);
				}
			}
		}
		const namingMode = stored?.folderNoteNamingMode;
		const storedRootName = normalizeNoteBasename(
			stored?.rootWorkflowNoteName,
			DEFAULT_SETTINGS.rootWorkflowNoteName,
		);
		const rootMode = stored?.rootNoteNamingMode;
		this.settings = Object.assign(this.settings, {
			schemaVersion: 6,
			folderNoteNamingMode:
				namingMode === "folder-notes" ||
				namingMode === "index" ||
				namingMode === "folder-name" ||
				namingMode === "custom"
					? namingMode
					: DEFAULT_SETTINGS.folderNoteNamingMode,
			customFolderNoteName: normalizeNoteBasename(
				stored?.customFolderNoteName,
				DEFAULT_SETTINGS.customFolderNoteName,
			),
			rootNoteNamingMode:
				rootMode === "folder-notes" ||
				rootMode === "index" ||
				rootMode === "folder-name" ||
				rootMode === "custom"
					? rootMode
					: storedRootName === "index"
						? "index"
						: "custom",
			customRootNoteName: normalizeNoteBasename(
				stored?.customRootNoteName,
				storedRootName,
			),
			rootWorkflowNoteName: storedRootName,
			lastValidDateFormat:
				stored?.lastValidDateFormat ??
				DEFAULT_SETTINGS.lastValidDateFormat,
			optionalFilenameTimeFormat:
				stored?.optionalFilenameTimeFormat ??
				DEFAULT_SETTINGS.optionalFilenameTimeFormat,
			colorTabs: stored?.colorTabs ?? DEFAULT_SETTINGS.colorTabs,
			showBookLabel:
				stored?.showBookLabel ?? DEFAULT_SETTINGS.showBookLabel,
			notifyOnAuditIssues:
				stored?.notifyOnAuditIssues ??
				DEFAULT_SETTINGS.notifyOnAuditIssues,
			exportWatchProfileOnStartup:
				stored?.exportWatchProfileOnStartup ??
				DEFAULT_SETTINGS.exportWatchProfileOnStartup,
			propertyPosition:
				stored?.propertyPosition === "top" ? "top" : "bottom",
			propertyOrder: normalizePropertyOrder(stored?.propertyOrder),
			completeGlobalProperties: stored?.completeGlobalProperties === true,
		});
		const profile = await loadWatchProfile(this.app);
		this.watchTargets = profile.profile.targets;
		this.watchProfileHasOverride = profile.hasOverride;
		this.watchProfileLoadError = profile.error ?? null;
		if (migratedLegacyData) await this.saveSettings();
	}

	onunload(): void {
		this.pipeline?.dispose();
		this.folderTitles?.dispose();
		this.sorting?.dispose();
		this.decorations?.dispose();
		this.noteOrganizer?.dispose();
	}
}
