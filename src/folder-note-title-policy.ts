export function needsInitialFolderTitle(
	frontmatter: Record<string, unknown>,
): boolean {
	return !Object.prototype.hasOwnProperty.call(frontmatter, "title");
}
