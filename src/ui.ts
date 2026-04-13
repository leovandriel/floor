import assert from "./assert";
import type { Command, ControlCommand, SetNumberCommand } from "./control";
import { library } from "./library";
import type Physics from "./physics";
import type Renderer from "./render";
import type { Plan, RenderMode, RenderStats, TopologyMode } from "./types";
import { formatStateNumber } from "./url";
import type View from "./view";

function titleCase(value: string): string {
	return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function getRequiredElement<T extends HTMLElement>(
	id: string,
	type: { new (): T },
): T {
	const element = document.getElementById(id);
	assert(element instanceof type, "Missing element", id);
	return element;
}

export function getCanvas(id = "canvas"): HTMLCanvasElement | undefined {
	const canvas = document.getElementById(id);
	if (!(canvas instanceof HTMLCanvasElement)) {
		renderError([`Missing ${id} element.`]);
		return undefined;
	}
	return canvas;
}

export function renderError(lines: string[]): void {
	document.body.replaceChildren(
		...lines.map((line) => {
			const item = document.createElement("div");
			item.textContent = line;
			return item;
		}),
	);
}

export function isControlsTarget(target: EventTarget | null): boolean {
	return target instanceof HTMLElement && target.closest("#controls") !== null;
}

const stateCommandByField: Record<string, SetNumberCommand> = {
	x: "set-x",
	y: "set-y",
	rotation: "set-rotation",
	scale: "set-scale",
	factor: "set-factor",
	range: "set-range",
};

export default class UI {
	private panel!: HTMLElement;
	private planSelect!: HTMLSelectElement;
	private collapseButton!: HTMLButtonElement;
	private currentInput!: HTMLInputElement;
	private xInput!: HTMLInputElement;
	private yInput!: HTMLInputElement;
	private rotationInput!: HTMLInputElement;
	private scaleInput!: HTMLInputElement;
	private factorInput!: HTMLInputElement;
	private rangeInput!: HTMLInputElement;
	private debugInput!: HTMLInputElement;
	private renderModeInput!: HTMLSelectElement;
	private topologyModeInput!: HTMLSelectElement;
	private cellsOutput!: HTMLInputElement;
	private depthOutput!: HTMLInputElement;
	private branchesOutput!: HTMLInputElement;
	private fpsOutput!: HTMLInputElement;

	init(onCommand: (command: Command) => void): void {
		this.panel = getRequiredElement("controls", HTMLElement);
		this.planSelect = getRequiredElement("plan-select", HTMLSelectElement);
		const collapseButton = this.panel.querySelector(
			"[data-action='toggle-panel']",
		);
		assert(
			collapseButton instanceof HTMLButtonElement,
			"Missing element: controls toggle button",
		);
		this.collapseButton = collapseButton;
		this.currentInput = getRequiredElement("state-current", HTMLInputElement);
		this.xInput = getRequiredElement("state-x", HTMLInputElement);
		this.yInput = getRequiredElement("state-y", HTMLInputElement);
		this.rotationInput = getRequiredElement("state-rotation", HTMLInputElement);
		this.scaleInput = getRequiredElement("state-scale", HTMLInputElement);
		this.factorInput = getRequiredElement("state-factor", HTMLInputElement);
		this.rangeInput = getRequiredElement("state-range", HTMLInputElement);
		this.debugInput = getRequiredElement("toggle-debug", HTMLInputElement);
		this.renderModeInput = getRequiredElement("render-mode", HTMLSelectElement);
		this.topologyModeInput = getRequiredElement(
			"topology-mode",
			HTMLSelectElement,
		);
		this.cellsOutput = getRequiredElement("stats-cells", HTMLInputElement);
		this.depthOutput = getRequiredElement("stats-depth", HTMLInputElement);
		this.branchesOutput = getRequiredElement(
			"stats-branches",
			HTMLInputElement,
		);
		this.fpsOutput = getRequiredElement("stats-fps", HTMLInputElement);

		this.panel.hidden = false;
		this.populatePlanOptions();
		this.panel.addEventListener("click", (event) => {
			this.handleClick(event, onCommand);
		});
		this.panel.addEventListener("change", (event) => {
			this.handleChange(event, onCommand);
		});
	}

	sync(
		view: View,
		physics: Physics,
		renderer: Renderer,
		plan: Plan,
		topologyMode: TopologyMode,
		stats: RenderStats | undefined,
	): void {
		this.planSelect.value = plan.slug;
		this.currentInput.value = String(physics.currentCellId);
		this.currentInput.removeAttribute("max");
		this.xInput.value = formatStateNumber(physics.position.x);
		this.yInput.value = formatStateNumber(physics.position.y);
		this.rotationInput.value = formatStateNumber(physics.rotation);
		this.scaleInput.value = formatStateNumber(physics.scale);
		this.factorInput.value = formatStateNumber(view.factor);
		this.rangeInput.value = formatStateNumber(view.range);
		this.debugInput.checked = renderer.debug;
		this.renderModeInput.value = renderer.renderMode;
		this.topologyModeInput.value = topologyMode;
		for (const option of this.renderModeInput.options) {
			option.disabled = option.value !== "canvas" && !renderer.webglAvailable;
		}
		this.cellsOutput.value = String(stats?.cells ?? 0);
		this.depthOutput.value = String(stats?.maxDepth ?? 0);
		this.branchesOutput.value = String(stats?.branches ?? 0);
		this.fpsOutput.value =
			stats && stats.duration > 0
				? String(Math.round(1 / stats.duration))
				: "0";
	}

	private blurFocus(): void {
		const activeElement = document.activeElement;
		if (
			activeElement instanceof HTMLElement &&
			isControlsTarget(activeElement)
		) {
			activeElement.blur();
		}
	}

	private handleClick(
		event: MouseEvent,
		onCommand: (command: Command) => void,
	): void {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}

		const button = target.closest("button");
		if (!(button instanceof HTMLButtonElement)) {
			return;
		}

		if (button.dataset.action === "toggle-panel") {
			this.togglePanel();
			this.blurFocus();
			return;
		}

		if (button.dataset.action === "reset") {
			onCommand({ type: "reset" });
			this.blurFocus();
			return;
		}

		const command = button.dataset.command as ControlCommand | undefined;
		if (command) {
			onCommand({ type: command });
			this.blurFocus();
		}
	}

	private handleChange(
		event: Event,
		onCommand: (command: Command) => void,
	): void {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}

		if (target instanceof HTMLSelectElement && target.id === "plan-select") {
			onCommand({ type: "set-plan", slug: target.value });
			this.blurFocus();
			return;
		}

		if (target instanceof HTMLSelectElement && target.id === "render-mode") {
			onCommand({
				type: "set-render-mode",
				value: target.value as RenderMode,
			});
			this.blurFocus();
			return;
		}

		if (target instanceof HTMLSelectElement && target.id === "topology-mode") {
			onCommand({
				type: "set-topology-mode",
				value: target.value as TopologyMode,
			});
			this.blurFocus();
			return;
		}

		if (!(target instanceof HTMLInputElement)) {
			return;
		}

		const stateCommand = target.dataset.field
			? stateCommandByField[target.dataset.field]
			: undefined;
		if (target.dataset.field === "current") {
			if (!/^\d+$/.test(target.value)) {
				return;
			}
			onCommand({ type: "set-current", value: BigInt(target.value) });
			this.blurFocus();
			return;
		}
		if (stateCommand) {
			const value = Number(target.value);
			if (!Number.isFinite(value)) {
				return;
			}
			onCommand({ type: stateCommand, value });
			this.blurFocus();
			return;
		}

		if (target.dataset.toggle === "debug") {
			onCommand({ type: "set-debug", value: target.checked });
			this.blurFocus();
			return;
		}
	}

	private populatePlanOptions(): void {
		if (!this.planSelect) {
			return;
		}

		this.planSelect.replaceChildren(
			...library.map(({ slug }) => {
				const option = document.createElement("option");
				option.value = slug;
				option.textContent = titleCase(slug);
				return option;
			}),
		);
	}

	private togglePanel(): void {
		if (!this.panel || !this.collapseButton) {
			return;
		}

		const collapsed = this.panel.classList.toggle("controls--collapsed");
		const icon = this.collapseButton.querySelector(".controls__collapse-icon");
		if (icon) {
			icon.textContent = collapsed ? "▸" : "▾";
		}
		this.collapseButton.setAttribute("aria-expanded", String(!collapsed));
		this.collapseButton.setAttribute(
			"aria-label",
			collapsed ? "Expand debug panel" : "Collapse debug panel",
		);
	}
}
