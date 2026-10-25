import { App, TFile, TFolder } from "obsidian";
import { collectBooks, normalizeAccent, normalizeIcon } from "./book-metadata";
import { validateDateFormat } from "./date-format";
import { cachedFrontmatter } from "./frontmatter";
import type { FolderNoteConventionResolver } from "./folder-note-convention";
import { templatePathFromLink } from "./note-rules";
import { panelValues } from "./panel-format";
import type { CoordinatorHealthItem, RuntimeCoordinatorState } from "./types";

interface CommandManager {
	commands?: Record<string, unknown>;
	findCommand?: (id: string) => unknown;
}

function commandAvailable(app: App, id: string): boolean {
	const manager = (app as App & { commands?: CommandManager }).commands;
	return Boolean(manager?.findCommand?.(id) ?? manager?.commands?.[id]);
}

function runtimeItems(state: RuntimeCoordinatorState): CoordinatorHealthItem[] {
	const services: Array<[string, string, boolean]> = [
		["new-note-pipeline", "New-note pipeline", state.newNotePipeline],
		[
			"filename-date-sync",
			"Filename/date synchronization",
			state.filenameDateSync,
		],
		[
			"folder-title-sync",
			"Folder-note title synchronization",
			state.folderTitleSync,
		],
		["sorting-coordinator", "Selective sorting coordinator", state.sorting],
		[
			"book-decorations",
			"Book appearance and decoration",
			state.bookDecorations,
		],
	];
	return services.map(([id, label, active]) => ({
		id,
		label,
		detail: active
			? "Active"
			: state.initialized
				? "Unavailable"
				: "Waiting for layout",
		status: active ? "ok" : state.initialized ? "error" : "warning",
	}));
}

function workflowItems(
	app: App,
	convention: FolderNoteConventionResolver,
): CoordinatorHealthItem[] {
	const rootPath = convention.rootPath();
	const root = app.vault.getAbstractFileByPath(rootPath);
	if (!(root instanceof TFile)) {
		return [
			{
				id: "root-index",
				label: "Root workflow note",
				detail: `Missing ${rootPath} at the vault root`,
				status: "error",
			},
		];
	}

	const metadata = cachedFrontmatter(app, root);
	const rawFormat = metadata["template-date-format"];
	const rawPrefix = metadata["add-date-to-new-notes"];
	const rawTemplate = metadata["new-note-template"];
	const dateFormatOk =
		typeof rawFormat === "string" && Boolean(validateDateFormat(rawFormat));
	const prefixOk = typeof rawPrefix === "boolean";
	const templateLink =
		typeof rawTemplate === "string" ? rawTemplate.trim() : "";
	const templatePath = templatePathFromLink(templateLink);
	const template = templatePath
		? app.metadataCache.getFirstLinkpathDest(templatePath, root.path)
		: null;

	return [
		{
			id: "root-index",
			label: "Root workflow note",
			detail: `${rootPath} is available`,
			status: "ok",
		},
		{
			id: "date-format",
			label: "Filename date format",
			detail: dateFormatOk
				? String(rawFormat)
				: "template-date-format is missing or invalid",
			status: dateFormatOk ? "ok" : "error",
		},
		{
			id: "date-prefix",
			label: "Default date prefix",
			detail: prefixOk
				? rawPrefix
					? "Enabled"
					: "Disabled"
				: "add-date-to-new-notes must be true or false",
			status: prefixOk ? "ok" : "error",
		},
		{
			id: "note-template",
			label: "Default note template",
			detail: !templateLink
				? "Optional; none configured"
				: template instanceof TFile
					? `${templateLink} resolves to ${template.path}`
					: `${templateLink} does not resolve to a Markdown file`,
			status: !templateLink
				? "warning"
				: template instanceof TFile
					? "ok"
					: "error",
		},
	];
}

function bookItems(
	app: App,
	convention: FolderNoteConventionResolver,
): CoordinatorHealthItem[] {
	const folders = app.vault
		.getRoot()
		.children.filter(
			(child): child is TFolder =>
				child instanceof TFolder && child.name !== "templates",
		);
	const books = collectBooks(app, convention);
	const missingIndexes = folders.filter(
		(folder) =>
			!(
				app.vault.getAbstractFileByPath(
					convention.folderPath(folder),
				) instanceof TFile
			),
	);
	const invalidPanels = books.filter((book) => {
		const file = app.vault.getAbstractFileByPath(book.indexPath);
		if (!(file instanceof TFile)) return true;
		const panel = cachedFrontmatter(app, file).panel;
		const values = panelValues(panel);
		if (!values) return true;
		return !normalizeIcon(values.icon) || !normalizeAccent(values.accent);
	});

	return [
		{
			id: "books-detected",
			label: "Detected books",
			detail: `${books.length} first-level folder${books.length === 1 ? "" : "s"} with the configured folder note`,
			status: books.length > 0 ? "ok" : "warning",
		},
		{
			id: "book-indexes",
			label: "Book folder notes",
			detail:
				missingIndexes.length === 0
					? "Every first-level book folder has its configured folder note"
					: `Missing in: ${missingIndexes.map((folder) => folder.path).join(", ")}`,
			status: missingIndexes.length === 0 ? "ok" : "error",
		},
		{
			id: "quartz-compatibility",
			label: "Root Books for Quartz compatibility",
			detail: convention.snapshot().quartzCompatible
				? "Root and folder notes use index.md"
				: "Custom names need the book-structure/v2 staging adapter before Quartz builds",
			status: convention.snapshot().quartzCompatible ? "ok" : "warning",
		},
		{
			id: "book-panels",
			label: "Portable book appearance",
			detail:
				invalidPanels.length === 0
					? "Every book has a valid Lucide icon and six-digit accent"
					: `Missing or invalid in: ${invalidPanels.map((book) => book.name).join(", ")}`,
			status: invalidPanels.length === 0 ? "ok" : "warning",
		},
	];
}

export function auditCoordinatorHealth(
	app: App,
	state: RuntimeCoordinatorState,
	convention: FolderNoteConventionResolver,
): {
	workflow: CoordinatorHealthItem[];
	books: CoordinatorHealthItem[];
	runtime: CoordinatorHealthItem[];
} {
	const runtime = runtimeItems(state);
	const customSortAvailable = commandAvailable(
		app,
		"custom-sort:enable-custom-sorting",
	);
	runtime.push({
		id: "custom-sort-command",
		label: "Custom Sort refresh command",
		detail: customSortAvailable ? "Available" : "Command not registered",
		status: customSortAvailable ? "ok" : "error",
	});
	return {
		workflow: workflowItems(app, convention),
		books: bookItems(app, convention),
		runtime,
	};
}
