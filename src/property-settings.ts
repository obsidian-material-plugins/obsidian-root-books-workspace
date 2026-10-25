import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";
import {
	normalizePropertyOrder,
	PORTABLE_PROPERTIES,
} from "./property-organizer";
import type { RootBooksWorkspaceSettings } from "./types";

class PropertyOrderModal extends Modal {
	private order: string[];

	constructor(
		app: App,
		current: readonly string[],
		private readonly apply: (order: string[]) => Promise<void>,
	) {
		super(app);
		this.order = normalizePropertyOrder(current);
	}

	onOpen(): void {
		this.setTitle("Arrange plugin frontmatter properties");
		this.render();
	}

	private render(): void {
		this.contentEl.empty();
		this.contentEl.createEl("p", {
			text: "Use the arrows to set the order. Multiline values move as one property.",
		});
		for (const [index, key] of this.order.entries()) {
			const property = PORTABLE_PROPERTIES.find(
				(item) => item.key === key,
			);
			if (!property) continue;
			const label = `${key} · ${property.owner} · ${property.scope}${property.defaultYaml === undefined ? "" : ` · default: ${property.defaultYaml}`}`;
			new Setting(this.contentEl)
				.setName(label)
				.addButton((button) =>
					button
						.setButtonText("↑")
						.setTooltip(`Move ${key} up`)
						.setDisabled(index === 0)
						.onClick(() => this.move(index, -1)),
				)
				.addButton((button) =>
					button
						.setButtonText("↓")
						.setTooltip(`Move ${key} down`)
						.setDisabled(index === this.order.length - 1)
						.onClick(() => this.move(index, 1)),
				);
		}
		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText("Cancel").onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText("Apply order")
					.setCta()
					.onClick(async () => {
						button.setDisabled(true);
						await this.apply(this.order);
						this.close();
					}),
			);
	}

	private move(index: number, offset: number): void {
		const other = index + offset;
		const left = this.order[index];
		const right = this.order[other];
		if (left === undefined || right === undefined) return;
		this.order[index] = right;
		this.order[other] = left;
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export function renderPropertySettings(
	setting: Setting,
	app: App,
	settings: RootBooksWorkspaceSettings,
	save: () => Promise<void>,
): void {
	const container = setting.descEl.createDiv({
		cls: "root-books-property-settings",
	});
	container.createEl("p", {
		text: "Compatible properties can be grouped at the top or bottom of a settings note. Their values, comments, and multiline text are kept when the Properties panel loses focus.",
	});
	new Setting(container)
		.setName("Position in settings notes")
		.addDropdown((dropdown) =>
			dropdown
				.addOption("top", "Top")
				.addOption("bottom", "Bottom")
				.setValue(settings.propertyPosition)
				.onChange(async (value) => {
					settings.propertyPosition =
						value === "top" ? "top" : "bottom";
					await save();
				}),
		);
	new Setting(container)
		.setName("Manual property order")
		.setDesc(
			"View each property's owner, scope, and shipped default before choosing its position.",
		)
		.addButton((button) =>
			button.setButtonText("Arrange properties").onClick(() =>
				new PropertyOrderModal(
					app,
					settings.propertyOrder,
					async (order) => {
						settings.propertyOrder = order;
						await save();
					},
				).open(),
			),
		);
	new Setting(container)
		.setName("Add missing global properties")
		.setDesc(
			"Off by default. Fills shipped defaults only in the global settings note. Local notes stay sparse and inherit absent values.",
		)
		.addToggle((toggle) =>
			toggle
				.setValue(settings.completeGlobalProperties)
				.onChange(async (value) => {
					settings.completeGlobalProperties = value;
					await save();
				}),
		);
}
