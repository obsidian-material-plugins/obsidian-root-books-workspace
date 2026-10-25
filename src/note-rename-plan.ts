import { folderNoteBasename } from "./folder-note-names";

export interface NoteConventionPaths {
	rootPath: string;
	localPattern: string;
	extension: string;
}

export interface FolderPath {
	path: string;
	name: string;
}

export interface PlannedNoteRename {
	from: string;
	to: string;
}

export interface NoteRenamePlan {
	renames: PlannedNoteRename[];
	conflicts: string[];
	missingRoot: boolean;
}

function localPath(
	folder: FolderPath,
	convention: NoteConventionPaths,
): string {
	return `${folder.path}/${folderNoteBasename(convention.localPattern, folder.name)}${convention.extension}`;
}

/** Plan every existing settings-note rename without changing the vault. */
export function planNoteRenames(
	existingPaths: readonly string[],
	folders: readonly FolderPath[],
	current: NoteConventionPaths,
	next: NoteConventionPaths,
): NoteRenamePlan {
	const existing = new Map(
		existingPaths.map((path) => [path.toLowerCase(), path]),
	);
	const exactPaths = new Set(existingPaths);
	const renames: PlannedNoteRename[] = [];
	const conflicts = new Set<string>();
	const destinations = new Set<string>();
	const queue = (from: string, to: string): void => {
		if (!exactPaths.has(from) || from === to) return;
		const destination = to.toLowerCase();
		if (existing.has(destination) || destinations.has(destination)) {
			conflicts.add(to);
			return;
		}
		destinations.add(destination);
		renames.push({ from, to });
	};

	queue(current.rootPath, next.rootPath);
	for (const folder of folders) {
		queue(localPath(folder, current), localPath(folder, next));
	}

	return {
		renames: renames.sort((a, b) => a.from.localeCompare(b.from)),
		conflicts: [...conflicts].sort(),
		missingRoot: !exactPaths.has(current.rootPath),
	};
}
