import Canvas, { color } from "./canvas";
import {
	checkPlan,
	defaultPlanSlug,
	getPlanBySlug,
	planSlugs,
} from "./library";
import * as math from "./math";
import { point } from "./math";
import Scene from "./scene";
import type { MouseAction, Plan, Point, RenderStats } from "./types";

declare const __DEV__: boolean;

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

interface UrlState {
	current: number;
	x: number;
	y: number;
	rotation: number;
	scale: number;
	factor: number;
	range: number;
	debug: boolean;
}

type StateField =
	| "current"
	| "x"
	| "y"
	| "rotation"
	| "scale"
	| "factor"
	| "range";
type ToggleField = "debug";
type ControlCommand =
	| "turn-left"
	| "turn-right"
	| "move-forward"
	| "move-backward"
	| "move-left"
	| "move-right"
	| "scale-up"
	| "scale-down"
	| "zoom-in"
	| "zoom-out"
	| "warp-in"
	| "warp-out";

const commandByCode: Record<string, ControlCommand> = {
	ArrowLeft: "turn-left",
	KeyQ: "turn-left",
	ArrowRight: "turn-right",
	KeyE: "turn-right",
	ArrowUp: "move-forward",
	KeyW: "move-forward",
	ArrowDown: "move-backward",
	KeyS: "move-backward",
	KeyA: "move-left",
	KeyD: "move-right",
	Digit0: "warp-in",
	Numpad0: "warp-in",
	Digit9: "warp-out",
	Numpad9: "warp-out",
	Digit8: "zoom-in",
	Numpad8: "zoom-in",
	Digit7: "zoom-out",
	Numpad7: "zoom-out",
	Digit6: "scale-up",
	Numpad6: "scale-up",
	Digit5: "scale-down",
	Numpad5: "scale-down",
};

const commandOrder: ControlCommand[] = [
	"turn-left",
	"turn-right",
	"move-forward",
	"move-backward",
	"move-left",
	"move-right",
	"scale-up",
	"scale-down",
	"zoom-in",
	"zoom-out",
	"warp-in",
	"warp-out",
];

interface Controls {
	panel: HTMLElement;
	planSelect: HTMLSelectElement;
	collapseButton: HTMLButtonElement;
	currentInput: HTMLInputElement;
	xInput: HTMLInputElement;
	yInput: HTMLInputElement;
	rotationInput: HTMLInputElement;
	scaleInput: HTMLInputElement;
	factorInput: HTMLInputElement;
	rangeInput: HTMLInputElement;
	debugInput: HTMLInputElement;
	tilesOutput: HTMLInputElement;
	depthOutput: HTMLInputElement;
	branchesOutput: HTMLInputElement;
	fpsOutput: HTMLInputElement;
}

function parseNumberParam(
	params: URLSearchParams,
	key: string,
): number | undefined {
	const value = params.get(key);
	if (value === null) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseIntegerParam(
	params: URLSearchParams,
	key: string,
): number | undefined {
	const parsed = parseNumberParam(params, key);
	return parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined;
}

function parseBooleanParam(params: URLSearchParams, key: string): boolean {
	return params.get(key) === "1";
}

function setBooleanParam(
	params: URLSearchParams,
	key: string,
	value: boolean,
): void {
	if (value) {
		params.set(key, "1");
	} else {
		params.delete(key);
	}
}

function formatStateNumber(value: number): string {
	return value.toFixed(6).replace(/\.?0+$/, "");
}

function createDefaultUrlState(): UrlState {
	return {
		current: 0,
		x: 0.5,
		y: 0.2,
		rotation: 0,
		scale: 0.2,
		factor: 1,
		range: 0.5,
		debug: false,
	};
}

function serializeScene(scene: Scene): UrlState {
	return {
		current: scene.current,
		x: scene.position.x,
		y: scene.position.y,
		rotation: scene.rotation,
		scale: scene.scale,
		factor: scene.canvas.factor,
		range: scene.canvas.range,
		debug: scene.showTile && scene.showCurrent && scene.showSelf,
	};
}

function parseUrlState(
	params: URLSearchParams,
	plan: Plan,
): UrlState | undefined {
	const defaults = createDefaultUrlState();
	const current = parseIntegerParam(params, "c") ?? defaults.current;
	const x = parseNumberParam(params, "x") ?? defaults.x;
	const y = parseNumberParam(params, "y") ?? defaults.y;
	const rotation = parseNumberParam(params, "r") ?? defaults.rotation;
	const scale = parseNumberParam(params, "s") ?? defaults.scale;
	const factor = parseNumberParam(params, "f") ?? defaults.factor;
	const range = parseNumberParam(params, "g") ?? defaults.range;

	if (
		current < 0 ||
		current >= plan.tiles.length ||
		scale <= 0 ||
		factor <= 0 ||
		range <= 0
	) {
		return undefined;
	}

	return {
		current,
		x,
		y,
		rotation,
		scale,
		factor,
		range,
		debug: parseBooleanParam(params, "d"),
	};
}

function parsePlanSlug(pathname: string): string | undefined {
	return pathname.split("/").filter(Boolean)[0];
}

function titleCase(value: string): string {
	return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function getRequiredElement<T extends HTMLElement>(
	id: string,
	type: { new (): T },
): T | undefined {
	const element = document.getElementById(id);
	return element instanceof type ? element : undefined;
}

const defaultPlanCandidate = getPlanBySlug(defaultPlanSlug);

if (!defaultPlanCandidate) {
	throw new Error(`Missing default plan: ${defaultPlanSlug}`);
}

const defaultPlan: Plan = defaultPlanCandidate;

export default class App {
	scene: Scene | undefined = undefined;
	context: CanvasRenderingContext2D | undefined = undefined;
	controls: Controls | undefined = undefined;
	lastDrag: Point | undefined = undefined;
	lastUrlUpdateAt = 0;
	pendingUrlUpdate: number | undefined = undefined;
	keyFrame: number | undefined = undefined;
	lastKeyFrameAt: number | undefined = undefined;
	lastRenderAt: number | undefined = undefined;
	renderFps = 0;
	lastRenderStats: RenderStats = {
		tiles: 0,
		branches: 0,
		avatars: 0,
		maxDepth: 0,
	};
	planSlug = defaultPlanSlug;
	plan = defaultPlan;
	private readonly heldCodes = new Set<string>();

	private readonly urlUpdateIntervalMs = 100;

	private readonly onKeyDown = (event: KeyboardEvent): void =>
		this.handleKey(event);
	private readonly onKeyUp = (event: KeyboardEvent): void =>
		this.handleKeyUp(event);
	private readonly onMouseMove = (event: MouseEvent): void =>
		this.handleMouse(event, "move");
	private readonly onMouseOut = (event: MouseEvent): void =>
		this.handleMouse(event, "out");
	private readonly onMouseDown = (event: MouseEvent): void =>
		this.handleMouse(event, "down");
	private readonly onMouseUp = (event: MouseEvent): void =>
		this.handleMouse(event, "up");
	private readonly onResize = (): void => this.handleResize();
	private readonly onPopState = (): void => this.restoreLocationState();
	private readonly onControlsClick = (event: MouseEvent): void =>
		this.handleControlsClick(event);
	private readonly onControlsChange = (event: Event): void =>
		this.handleControlsChange(event);
	private readonly onWindowBlur = (): void => this.clearHeldCommands();

	handleKey(event: KeyboardEvent): void {
		if (this.isControlsTarget(event.target)) {
			return;
		}
		if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
			return;
		}
		const command = commandByCode[event.code];
		if (command) {
			this.heldCodes.add(event.code);
			this.startKeyLoop();
			return;
		}
		if (event.repeat) {
			return;
		}
		const scene = this.requireScene();
		switch (event.code) {
			case "KeyX":
				this.toggleDebug(scene);
				break;
			case "KeyR":
				this.resetScene();
				return;
			case "Digit0":
			case "Numpad0":
				this.applyCommand(scene, "warp-in");
				break;
			default:
				return;
		}
		scene.canvas.setMouse(undefined);
		this.renderAndSync(true);
	}

	handleKeyUp(event: KeyboardEvent): void {
		this.heldCodes.delete(event.code);
		if (this.heldCodes.size === 0) {
			this.stopKeyLoop();
		}
	}

	handleMouse(event: MouseEvent, action: MouseAction): void {
		if (this.isControlsTarget(event.target)) {
			return;
		}
		const scene = this.requireScene();
		const p = point(event.pageX, event.pageY);
		if (!this.lastDrag && action === "down") {
			this.lastDrag = p;
		} else if (this.lastDrag && action === "up") {
			this.lastDrag = undefined;
		} else if (this.lastDrag && action === "move") {
			const delta = scene.canvas.unscale(
				point(this.lastDrag.x - p.x, this.lastDrag.y - p.y),
			);
			scene.handleMove(
				point(
					(delta.x * scene.canvas.range) / scene.step,
					(delta.y * scene.canvas.range) / scene.step,
				),
			);
			this.lastDrag = p;
			action = "drag";
		}
		const mouse = action === "move" ? p : undefined;
		scene.canvas.setMouse(mouse);
		this.recordRenderStats(scene.render(action));
		if (action === "drag") {
			this.scheduleUrlStateUpdate();
			this.syncControls();
		}
	}

	handleResize(): void {
		const scene = this.requireScene();
		const context = this.requireContext();
		const size = this.resizeCanvas(context);
		scene.canvas.setSize(size);
		this.recordRenderStats(scene.render());
	}

	getContext(): CanvasRenderingContext2D | undefined {
		const canvas = document.getElementById("canvas");
		const message = document.getElementById("message");

		if (
			!(canvas instanceof HTMLCanvasElement) ||
			!(message instanceof HTMLElement)
		) {
			return undefined;
		}

		if (canvas.getContext) {
			message.remove();
			return canvas.getContext("2d") || undefined;
		} else {
			canvas.remove();
			message.innerHTML = "Your browser does not support canvas rendering.";
			return undefined;
		}
	}

	resizeCanvas(context: CanvasRenderingContext2D): Point {
		const size = point(window.innerWidth, window.innerHeight);
		context.canvas.width = size.x * 2;
		context.canvas.height = size.y * 2;
		context.canvas.style.width = `${size.x}px`;
		context.canvas.style.height = `${size.y}px`;
		context.setTransform(2, 0, 0, 2, 0, 0);
		return size;
	}

	createScene(context: CanvasRenderingContext2D): Scene {
		const size = this.resizeCanvas(context);
		const canvas2 = new Canvas(context, size, color(0.8, 0.8, 0.8));
		const scene = new Scene(canvas2, this.plan);
		return scene;
	}

	attachHandlers(): void {
		document.addEventListener("keydown", this.onKeyDown);
		document.addEventListener("keyup", this.onKeyUp);
		window.addEventListener("resize", this.onResize);
		window.addEventListener("blur", this.onWindowBlur);
		document.addEventListener("mousemove", this.onMouseMove);
		document.addEventListener("mouseout", this.onMouseOut);
		document.addEventListener("mousedown", this.onMouseDown);
		document.addEventListener("mouseup", this.onMouseUp);
		window.addEventListener("popstate", this.onPopState);
		this.controls?.panel.addEventListener("click", this.onControlsClick);
		this.controls?.panel.addEventListener("change", this.onControlsChange);
	}

	start(): void {
		this.loadPlanFromLocation();
		checkPlan(this.plan);
		const context = this.getContext();
		if (!context) return;
		this.context = context;
		if (isDev) {
			this.controls = this.getControls();
			if (this.controls) {
				this.controls.panel.hidden = false;
				this.populatePlanOptions();
			}
		}
		this.scene = this.createScene(context);
		this.applyUrlState(this.scene, this.readUrlState());
		this.recordRenderStats(this.scene.render());
		this.syncControls();
		this.attachHandlers();
	}

	static init(): void {
		const app = new App();
		if (document.readyState === "complete") {
			app.start();
			return;
		}
		window.addEventListener("load", () => app.start(), { once: true });
	}

	private updateUrlState(): void {
		const scene = this.requireScene();
		const defaults = createDefaultUrlState();
		const params = new URLSearchParams(window.location.search);
		const state = serializeScene(scene);
		if (state.current !== defaults.current) {
			params.set("c", String(state.current));
		} else {
			params.delete("c");
		}
		if (state.x !== defaults.x) {
			params.set("x", formatStateNumber(state.x));
		} else {
			params.delete("x");
		}
		if (state.y !== defaults.y) {
			params.set("y", formatStateNumber(state.y));
		} else {
			params.delete("y");
		}
		if (state.rotation !== defaults.rotation) {
			params.set("r", formatStateNumber(state.rotation));
		} else {
			params.delete("r");
		}
		if (state.scale !== defaults.scale) {
			params.set("s", formatStateNumber(state.scale));
		} else {
			params.delete("s");
		}
		if (state.factor !== defaults.factor) {
			params.set("f", formatStateNumber(state.factor));
		} else {
			params.delete("f");
		}
		if (state.range !== defaults.range) {
			params.set("g", formatStateNumber(state.range));
		} else {
			params.delete("g");
		}
		setBooleanParam(params, "d", state.debug);
		const nextSearch = params.toString();
		const nextPath = `/${this.planSlug}`;
		const nextUrl = `${nextPath}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
		try {
			window.history.replaceState(null, "", nextUrl);
			this.lastUrlUpdateAt = Date.now();
		} catch {
			// Browsers may reject excessively frequent history updates.
		}
	}

	private applyCommand(scene: Scene, command: ControlCommand): void {
		this.applyHeldCommand(scene, command, 1 / 60);
	}

	private applyHeldCommand(
		scene: Scene,
		command: ControlCommand,
		deltaSeconds: number,
	): void {
		const amount = deltaSeconds * 6;
		const noise = () => math.noise() * amount;
		const scaleRatio = 1.1 ** amount;
		switch (command) {
			case "turn-left":
				scene.handleTurn(-0.05 * amount + noise());
				break;
			case "turn-right":
				scene.handleTurn(0.05 * amount + noise());
				break;
			case "move-forward":
				scene.handleMove(point(noise(), amount + noise()));
				break;
			case "move-backward":
				scene.handleMove(point(noise(), -amount + noise()));
				break;
			case "move-left":
				scene.handleMove(point(-amount + noise(), noise()));
				break;
			case "move-right":
				scene.handleMove(point(amount + noise(), noise()));
				break;
			case "scale-up":
				scene.scale *= scaleRatio;
				break;
			case "scale-down":
				scene.scale /= scaleRatio;
				break;
			case "zoom-in":
				scene.canvas.zoom(scaleRatio);
				break;
			case "zoom-out":
				scene.canvas.zoom(1 / scaleRatio);
				break;
			case "warp-in":
				scene.canvas.warp(1 / scaleRatio);
				break;
			case "warp-out":
				scene.canvas.warp(scaleRatio);
				break;
		}
	}

	private renderAndSync(scheduleUrlUpdate = false): void {
		const scene = this.requireScene();
		this.recordRenderStats(scene.render());
		this.syncControls();
		if (scheduleUrlUpdate) {
			this.scheduleUrlStateUpdate();
		}
	}

	private readUrlState(): UrlState | undefined {
		const params = new URLSearchParams(window.location.search);
		return parseUrlState(params, this.plan);
	}

	private scheduleUrlStateUpdate(): void {
		if (this.pendingUrlUpdate !== undefined) {
			return;
		}

		const now = Date.now();
		const delay = Math.max(
			0,
			this.urlUpdateIntervalMs - (now - this.lastUrlUpdateAt),
		);

		if (delay === 0) {
			this.updateUrlState();
			return;
		}

		this.pendingUrlUpdate = window.setTimeout(() => {
			this.pendingUrlUpdate = undefined;
			this.updateUrlState();
		}, delay);
	}

	private applyUrlState(scene: Scene, state: UrlState | undefined): void {
		if (!state) return;

		scene.current = state.current;
		scene.position = point(state.x, state.y);
		scene.rotation = state.rotation;
		scene.scale = state.scale;
		scene.canvas.factor = state.factor;
		scene.canvas.range = state.range;
		this.setDebug(scene, state.debug);
		scene.handleSnap();
	}

	private restoreLocationState(): void {
		const context = this.requireContext();
		this.loadPlanFromLocation();
		this.scene = this.createScene(context);
		this.applyUrlState(this.scene, this.readUrlState());
		this.recordRenderStats(this.scene.render());
		this.syncControls();
	}

	private loadPlanFromLocation(): void {
		const pathSlug = parsePlanSlug(window.location.pathname);
		const nextSlug = pathSlug ?? defaultPlanSlug;
		const nextPlan = getPlanBySlug(nextSlug);
		if (nextPlan === undefined) {
			this.planSlug = defaultPlanSlug;
			this.plan = defaultPlan;
		} else {
			this.planSlug = nextSlug;
			this.plan = nextPlan;
		}
	}

	private handleControlsClick(event: MouseEvent): void {
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
			this.blurControlsFocus();
			return;
		}

		if (button.dataset.action === "reset") {
			this.resetScene();
			this.blurControlsFocus();
			return;
		}

		const command = button.dataset.command as ControlCommand | undefined;
		if (command) {
			this.applyCommand(this.requireScene(), command);
			this.renderAndSync(true);
			this.blurControlsFocus();
		}
	}

	private handleControlsChange(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}

		if (target instanceof HTMLSelectElement && target.id === "plan-select") {
			this.handlePlanSelection(target.value);
			this.blurControlsFocus();
			return;
		}

		if (target instanceof HTMLInputElement) {
			const field = target.dataset.field as StateField | undefined;
			if (field) {
				this.applyStateField(field, target.value);
				this.renderAndSync(true);
				this.blurControlsFocus();
				return;
			}

			const toggle = target.dataset.toggle as ToggleField | undefined;
			if (toggle) {
				this.applyToggleField(toggle, target.checked);
				this.renderAndSync(true);
				this.blurControlsFocus();
			}
		}
	}

	private handlePlanSelection(slug: string): void {
		if (slug === this.planSlug) {
			return;
		}

		const previousScene = this.requireScene();
		const debug =
			previousScene.showTile &&
			previousScene.showCurrent &&
			previousScene.showSelf;
		const nextPlan = getPlanBySlug(slug);
		if (!nextPlan) {
			this.syncControls();
			return;
		}

		this.planSlug = slug;
		this.plan = nextPlan;
		checkPlan(this.plan);
		this.lastDrag = undefined;
		this.clearHeldCommands();
		this.scene = this.createScene(this.requireContext());
		this.setDebug(this.scene, debug);
		this.recordRenderStats(this.scene.render());
		this.syncControls();
		this.updateUrlState();
	}

	private resetScene(): void {
		this.lastDrag = undefined;
		this.clearHeldCommands();
		this.scene = this.createScene(this.requireContext());
		this.renderAndSync(true);
	}

	private applyStateField(field: StateField, value: string): void {
		const scene = this.requireScene();
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) {
			this.syncControls();
			return;
		}

		switch (field) {
			case "current":
				scene.current = this.clamp(
					Math.round(parsed),
					0,
					this.plan.tiles.length - 1,
				);
				scene.handleSnap();
				break;
			case "x":
				scene.position.x = parsed;
				scene.handleSnap();
				break;
			case "y":
				scene.position.y = parsed;
				scene.handleSnap();
				break;
			case "rotation":
				scene.rotation = parsed;
				break;
			case "scale":
				if (parsed <= 0) {
					this.syncControls();
					return;
				}
				scene.scale = parsed;
				break;
			case "factor":
				if (parsed <= 0) {
					this.syncControls();
					return;
				}
				scene.canvas.factor = parsed;
				break;
			case "range":
				if (parsed <= 0) {
					this.syncControls();
					return;
				}
				scene.canvas.range = parsed;
				break;
		}
	}

	private applyToggleField(field: ToggleField, value: boolean): void {
		const scene = this.requireScene();
		if (field === "debug") {
			this.setDebug(scene, value);
		}
	}

	private syncControls(): void {
		const scene = this.scene;
		const controls = this.controls;
		if (!scene || !controls) {
			return;
		}

		controls.planSelect.value = this.planSlug;
		controls.currentInput.value = String(scene.current);
		controls.currentInput.max = String(this.plan.tiles.length - 1);
		controls.xInput.value = formatStateNumber(scene.position.x);
		controls.yInput.value = formatStateNumber(scene.position.y);
		controls.rotationInput.value = formatStateNumber(scene.rotation);
		controls.scaleInput.value = formatStateNumber(scene.scale);
		controls.factorInput.value = formatStateNumber(scene.canvas.factor);
		controls.rangeInput.value = formatStateNumber(scene.canvas.range);
		controls.debugInput.checked =
			scene.showTile && scene.showCurrent && scene.showSelf;
		controls.tilesOutput.value = String(this.lastRenderStats.tiles);
		controls.depthOutput.value = String(this.lastRenderStats.maxDepth);
		controls.branchesOutput.value = String(this.lastRenderStats.branches);
		controls.fpsOutput.value =
			this.renderFps > 0 ? String(Math.round(this.renderFps)) : "0";
	}

	private populatePlanOptions(): void {
		const controls = this.controls;
		if (!controls) {
			return;
		}

		controls.planSelect.replaceChildren(
			...planSlugs.map((slug) => {
				const option = document.createElement("option");
				option.value = slug;
				option.textContent = titleCase(slug);
				return option;
			}),
		);
	}

	private getControls(): Controls | undefined {
		const panel = getRequiredElement("controls", HTMLElement);
		const planSelect = getRequiredElement("plan-select", HTMLSelectElement);
		const collapseButton = getRequiredElement(
			"controls",
			HTMLElement,
		)?.querySelector("[data-action='toggle-panel']");
		const currentInput = getRequiredElement("state-current", HTMLInputElement);
		const xInput = getRequiredElement("state-x", HTMLInputElement);
		const yInput = getRequiredElement("state-y", HTMLInputElement);
		const rotationInput = getRequiredElement(
			"state-rotation",
			HTMLInputElement,
		);
		const scaleInput = getRequiredElement("state-scale", HTMLInputElement);
		const factorInput = getRequiredElement("state-factor", HTMLInputElement);
		const rangeInput = getRequiredElement("state-range", HTMLInputElement);
		const debugInput = getRequiredElement("toggle-debug", HTMLInputElement);
		const tilesOutput = getRequiredElement("stats-tiles", HTMLInputElement);
		const depthOutput = getRequiredElement("stats-depth", HTMLInputElement);
		const branchesOutput = getRequiredElement(
			"stats-branches",
			HTMLInputElement,
		);
		const fpsOutput = getRequiredElement("stats-fps", HTMLInputElement);

		if (
			!panel ||
			!planSelect ||
			!(collapseButton instanceof HTMLButtonElement) ||
			!currentInput ||
			!xInput ||
			!yInput ||
			!rotationInput ||
			!scaleInput ||
			!factorInput ||
			!rangeInput ||
			!debugInput ||
			!tilesOutput ||
			!depthOutput ||
			!branchesOutput ||
			!fpsOutput
		) {
			return undefined;
		}

		return {
			panel,
			planSelect,
			collapseButton,
			currentInput,
			xInput,
			yInput,
			rotationInput,
			scaleInput,
			factorInput,
			rangeInput,
			debugInput,
			tilesOutput,
			depthOutput,
			branchesOutput,
			fpsOutput,
		};
	}

	private togglePanel(): void {
		const controls = this.controls;
		if (!controls) {
			return;
		}

		const collapsed = controls.panel.classList.toggle("controls--collapsed");
		const icon = controls.collapseButton.querySelector(
			".controls__collapse-icon",
		);
		if (icon) {
			icon.textContent = collapsed ? "▸" : "▾";
		}
		controls.collapseButton.setAttribute("aria-expanded", String(!collapsed));
		controls.collapseButton.setAttribute(
			"aria-label",
			collapsed ? "Expand debug panel" : "Collapse debug panel",
		);
	}

	private recordRenderStats(stats: RenderStats): void {
		this.lastRenderStats = stats;
		const now = performance.now();
		if (this.lastRenderAt !== undefined) {
			const instantFps = 1000 / Math.max(1, now - this.lastRenderAt);
			this.renderFps =
				this.renderFps === 0
					? instantFps
					: this.renderFps * 0.8 + instantFps * 0.2;
		}
		this.lastRenderAt = now;
	}

	private setDebug(scene: Scene, value: boolean): void {
		scene.showTile = value;
		scene.showCurrent = value;
		scene.showSelf = value;
	}

	private toggleDebug(scene: Scene): void {
		const nextValue = !(scene.showTile && scene.showCurrent && scene.showSelf);
		this.setDebug(scene, nextValue);
	}

	private startKeyLoop(): void {
		if (this.keyFrame !== undefined) {
			return;
		}
		this.keyFrame = window.requestAnimationFrame(() => this.stepHeldCommands());
	}

	private stopKeyLoop(): void {
		if (this.keyFrame !== undefined) {
			window.cancelAnimationFrame(this.keyFrame);
			this.keyFrame = undefined;
		}
		this.lastKeyFrameAt = undefined;
	}

	private clearHeldCommands(): void {
		this.heldCodes.clear();
		this.stopKeyLoop();
	}

	private stepHeldCommands(now: number = performance.now()): void {
		this.keyFrame = undefined;
		const scene = this.scene;
		if (!scene || this.heldCodes.size === 0) {
			return;
		}
		const deltaSeconds =
			this.lastKeyFrameAt === undefined
				? 1 / 60
				: Math.min(0.1, (now - this.lastKeyFrameAt) / 1000);
		this.lastKeyFrameAt = now;

		const activeCommands = new Set(
			Array.from(this.heldCodes, (code) => commandByCode[code]).filter(
				(command): command is ControlCommand => command !== undefined,
			),
		);

		for (const command of commandOrder) {
			if (!activeCommands.has(command)) {
				continue;
			}
			if (
				(command === "turn-left" && activeCommands.has("turn-right")) ||
				(command === "turn-right" && activeCommands.has("turn-left")) ||
				(command === "move-forward" && activeCommands.has("move-backward")) ||
				(command === "move-backward" && activeCommands.has("move-forward")) ||
				(command === "move-left" && activeCommands.has("move-right")) ||
				(command === "move-right" && activeCommands.has("move-left")) ||
				(command === "scale-up" && activeCommands.has("scale-down")) ||
				(command === "scale-down" && activeCommands.has("scale-up")) ||
				(command === "zoom-in" && activeCommands.has("zoom-out")) ||
				(command === "zoom-out" && activeCommands.has("zoom-in")) ||
				(command === "warp-in" && activeCommands.has("warp-out")) ||
				(command === "warp-out" && activeCommands.has("warp-in"))
			) {
				continue;
			}
			this.applyHeldCommand(scene, command, deltaSeconds);
		}

		scene.canvas.setMouse(undefined);
		this.renderAndSync(true);
		if (this.heldCodes.size > 0) {
			this.keyFrame = window.requestAnimationFrame((nextNow) =>
				this.stepHeldCommands(nextNow),
			);
		}
	}

	private isControlsTarget(target: EventTarget | null): boolean {
		return (
			target instanceof HTMLElement && target.closest("#controls") !== null
		);
	}

	private blurControlsFocus(): void {
		const activeElement = document.activeElement;
		if (
			activeElement instanceof HTMLElement &&
			this.isControlsTarget(activeElement)
		) {
			activeElement.blur();
		}
	}

	private clamp(value: number, min: number, max: number): number {
		return Math.min(Math.max(value, min), max);
	}

	private requireScene(): Scene {
		if (!this.scene) {
			throw new Error("Scene has not been loaded yet.");
		}
		return this.scene;
	}

	private requireContext(): CanvasRenderingContext2D {
		if (!this.context) {
			throw new Error("Canvas context has not been loaded yet.");
		}
		return this.context;
	}
}
