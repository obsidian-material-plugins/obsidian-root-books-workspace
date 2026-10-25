export type PropertyPosition = "top" | "bottom";

export interface PortableProperty {
	key: string;
	owner: string;
	scope: "global" | "local" | "both";
	defaultYaml?: string;
}

export const PORTABLE_PROPERTIES: readonly PortableProperty[] = [
	{
		key: "template-date-format",
		owner: "Obsidian to quartz workspace",
		scope: "global",
		defaultYaml: "DD.MM.YYYY",
	},
	{
		key: "add-date-to-new-notes",
		owner: "Obsidian to quartz workspace",
		scope: "global",
		defaultYaml: "false",
	},
	{
		key: "new-note-template",
		owner: "Obsidian to quartz workspace",
		scope: "both",
		defaultYaml: '""',
	},
	{
		key: "prefix-new-dates",
		owner: "Obsidian to quartz workspace",
		scope: "local",
	},
	{ key: "panel", owner: "Root Books appearance", scope: "local" },
	{
		key: "exercise-preview-size-limit",
		owner: "Exerciser",
		scope: "global",
		defaultYaml: "50 MB",
	},
	{
		key: "sorting-spec",
		owner: "Custom File Explorer Sorting syntax",
		scope: "both",
	},
];

export const DEFAULT_PROPERTY_ORDER = PORTABLE_PROPERTIES.map(({ key }) => key);

export function normalizePropertyOrder(value: unknown): string[] {
	const chosen = Array.isArray(value)
		? value.filter(
				(key): key is string =>
					typeof key === "string" &&
					DEFAULT_PROPERTY_ORDER.includes(key),
			)
		: [];
	return [...new Set([...chosen, ...DEFAULT_PROPERTY_ORDER])];
}

export interface OrganizeOptions {
	position: PropertyPosition;
	order: readonly string[];
	completeGlobal: boolean;
	isGlobal: boolean;
}

interface Segment {
	key: string;
	lines: string[];
}

function parsedYaml(source: string): Record<string, unknown> {
	const document = parseDocument(source, { uniqueKeys: true, strict: true });
	if (document.errors.length)
		throw new Error(
			"Invalid frontmatter YAML; settings properties were left unchanged.",
		);
	try {
		const value: unknown = document.toJS({ maxAliasCount: 100 });
		if (value === null) return {};
		if (typeof value !== "object" || Array.isArray(value))
			throw new Error("Expected a YAML mapping");
		return value as Record<string, unknown>;
	} catch {
		throw new Error(
			"Invalid frontmatter YAML or alias; settings properties were left unchanged.",
		);
	}
}

function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, item]) => [key, canonical(item)]),
		);
	return value;
}

function validateChange(before: string, after: string): void {
	const original = parsedYaml(before);
	const changed = parsedYaml(after);
	for (const [key, value] of Object.entries(original)) {
		if (
			!Object.hasOwn(changed, key) ||
			JSON.stringify(canonical(value)) !==
				JSON.stringify(canonical(changed[key]))
		)
			throw new Error(
				`Moving ${key} would change a YAML value; settings properties were left unchanged.`,
			);
	}
}

/** Move complete source slices so block scalars, quoting, and comments stay intact. */
export function organizeSettingsFrontmatter(
	source: string,
	options: OrganizeOptions,
): string {
	const match = /^(---\r?\n)([\s\S]*?)(\r?\n---)(?=\r?\n|$)/.exec(source);
	if (!match) {
		if (
			!options.completeGlobal ||
			!options.isGlobal ||
			source.startsWith("---")
		)
			return source;
		const defaults = normalizePropertyOrder(options.order).flatMap(
			(key) => {
				const property = PORTABLE_PROPERTIES.find(
					(candidate) => candidate.key === key,
				);
				return property &&
					property.scope !== "local" &&
					property.defaultYaml !== undefined
					? [`${key}: ${property.defaultYaml}`]
					: [];
			},
		);
		return defaults.length
			? `---\n${defaults.join("\n")}\n---\n${source}`
			: source;
	}
	const newline = match[1]!.includes("\r\n") ? "\r\n" : "\n";
	const lines = match[2]!.split(/\r?\n/);
	const starts: Array<{ key: string; at: number }> = [];
	const seen = new Set<string>();
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		const key = /^([A-Za-z][A-Za-z0-9_-]*):(?:[ \t]|$)/.exec(line)?.[1];
		if (!key) {
			if (line && !/^\s|#/.test(line))
				throw new Error(
					"Unsupported top-level YAML syntax; settings properties were left unchanged.",
				);
			continue;
		}
		if (seen.has(key))
			throw new Error(
				`Duplicate frontmatter property ${key}; settings properties were left unchanged.`,
			);
		seen.add(key);
		starts.push({ key, at: index });
	}
	const prefix = starts.length
		? lines.slice(0, starts[0]!.at)
		: lines.filter(Boolean);
	const segments: Segment[] = starts.map((start, index) => ({
		key: start.key,
		lines: lines.slice(start.at, starts[index + 1]?.at ?? lines.length),
	}));
	const managed = new Set(DEFAULT_PROPERTY_ORDER);
	if (options.completeGlobal && options.isGlobal) {
		for (const property of PORTABLE_PROPERTIES) {
			if (
				property.scope === "local" ||
				property.defaultYaml === undefined ||
				seen.has(property.key)
			)
				continue;
			segments.push({
				key: property.key,
				lines: [`${property.key}: ${property.defaultYaml}`],
			});
		}
	}
	const order = normalizePropertyOrder(options.order);
	const ordered = order.flatMap((key) =>
		segments.filter((segment) => segment.key === key),
	);
	const other = segments.filter((segment) => !managed.has(segment.key));
	const arranged =
		options.position === "top"
			? [...ordered, ...other]
			: [...other, ...ordered];
	const inside = [
		...prefix,
		...arranged.flatMap((segment) => segment.lines),
	].join(newline);
	validateChange(match[2]!, inside);
	return `${match[1]}${inside}${match[3]}${source.slice(match[0].length)}`;
}
import { parseDocument } from "yaml";
