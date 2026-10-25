/** Read the v2 literal scalar and the v1 mapping during migration. */
export function panelValues(
	value: unknown,
): { icon: unknown; accent: unknown } | null {
	if (typeof value === "string") {
		const lines = value.replace(/\n$/, "").split("\n");
		if (lines.length !== 2) return null;
		const parsed: Record<string, string> = {};
		for (const line of lines) {
			const match = /^(icon|accent): (.+)$/.exec(line);
			const key = match?.[1];
			const content = match?.[2];
			if (!key || !content || Object.hasOwn(parsed, key)) return null;
			parsed[key] = content;
		}
		const accent = parsed.accent;
		if (!parsed.icon || !accent) return null;
		const quoted = /^(["'])(#[0-9a-fA-F]{6})\1$/.exec(accent);
		return {
			icon: parsed.icon,
			accent: quoted ? quoted[2] : accent,
		};
	}
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return null;
	const record = value as Record<string, unknown>;
	return { icon: record.icon, accent: record.accent };
}

export function panelLiteral(icon: string, accent: string): string {
	return `icon: ${icon}\naccent: "${accent}"\n`;
}
