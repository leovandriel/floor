import Canvas, { color } from "./canvas";
import Control, { type Command } from "./control";
import Input from "./input";
import { getValidPlan } from "./library";
import Physics from "./physics";
import Renderer from "./render";
import type { Plan } from "./types";
import UI, { getCanvas, renderError } from "./ui";
import { readUrlState, type UrlState, UrlStateTracker } from "./url";

declare const __DEV__: boolean;

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

export default class App {
	context: CanvasRenderingContext2D;
	canvas!: Canvas;
	physics!: Physics;
	renderer!: Renderer;
	plan: Plan;
	urlState!: UrlStateTracker;
	control!: Control;
	input!: Input;
	private readonly ui = new UI(isDev);

	constructor(context: CanvasRenderingContext2D, plan: Plan) {
		this.context = context;
		this.plan = plan;
	}

	static load(): void {
		const canvasElement = getCanvas();
		if (!canvasElement) return;
		const context = canvasElement.getContext?.("2d");
		if (!context) {
			canvasElement.remove();
			renderError(["Your browser does not support canvas rendering."]);
			return;
		}
		const urlState = readUrlState();
		const { plan, warnings } = getValidPlan(urlState.path.slug);
		if (!plan) {
			renderError(warnings);
			return;
		}
		const app = new App(context, plan);
		app.resetSceneState();
		app.applyUrlState(urlState);
		app.ui.init((command) => app.applyCommand(command));
		app.renderer.render();
		app.syncControls();
		app.attachHandlers();
	}

	static init(): void {
		if (document.readyState === "complete") {
			App.load();
		} else {
			window.addEventListener("load", () => App.load(), { once: true });
		}
	}

	handleResize(): void {
		this.canvas.resizeToWindow();
		this.renderer.render();
		this.syncControls();
	}

	attachHandlers(): void {
		document.addEventListener("keydown", (event) =>
			this.input.handleKeyDown(event),
		);
		document.addEventListener("keyup", (event) =>
			this.input.handleKeyUp(event),
		);
		document.addEventListener("mousemove", (event) =>
			this.input.handleMouse(event, "move"),
		);
		document.addEventListener("mouseout", (event) =>
			this.input.handleMouse(event, "out"),
		);
		document.addEventListener("mousedown", (event) =>
			this.input.handleMouse(event, "down"),
		);
		document.addEventListener("mouseup", (event) =>
			this.input.handleMouse(event, "up"),
		);
		window.addEventListener("blur", () => this.input.clear());
		window.addEventListener("resize", () => this.handleResize());
		window.addEventListener("popstate", () => this.restoreLocationState());
	}

	private applyCommand(command: Command): void {
		switch (command.type) {
			case "reset":
				this.resetScene();
				return;
			case "set-plan":
				this.handlePlanSelection(command.slug);
				return;
			default:
				switch (this.control.applyCommand(command)) {
					case "render":
						this.renderer.render();
						return;
					case "render-and-sync":
						this.renderAndSync(true);
						return;
					case "unhandled":
						return;
				}
		}
	}

	private renderAndSync(scheduleUrlUpdate = false): void {
		this.renderer.render();
		this.syncControls();
		if (scheduleUrlUpdate) {
			this.scheduleUrlStateUpdate();
		}
	}

	private scheduleUrlStateUpdate(): void {
		this.urlState.scheduleUpdate();
	}

	private restoreLocationState(): void {
		this.applyUrlState(readUrlState());
		this.renderer.render();
		this.syncControls();
	}

	private handlePlanSelection(slug: string): void {
		if (slug === this.plan.slug) {
			return;
		}

		const debug = this.renderer.debug;
		const { plan: nextPlan, warnings } = getValidPlan(slug);
		if (!nextPlan) {
			renderError(warnings);
			this.syncControls();
			return;
		}

		this.plan = nextPlan;
		this.input.clear();
		this.resetSceneState();
		this.renderer.debug = debug;
		this.renderer.render();
		this.syncControls();
		this.urlState.updateUrl();
	}

	private resetScene(): void {
		this.input.clear();
		this.resetSceneState();
		this.renderAndSync(true);
	}

	private resetSceneState(): void {
		this.canvas = new Canvas(this.context, color(0.8, 0.8, 0.8));
		this.canvas.resizeToWindow();
		this.physics = new Physics(this.plan);
		this.renderer = new Renderer(this.physics, this.canvas);
		this.input = new Input(this.canvas, this.renderer, (command) =>
			this.applyCommand(command),
		);
		this.control = new Control(
			this.canvas,
			this.physics,
			this.renderer,
			this.plan,
		);
		this.urlState = new UrlStateTracker(
			this.plan,
			this.canvas,
			this.physics,
			this.renderer,
		);
	}

	private applyUrlState(state: UrlState): void {
		const { plan, warnings } = getValidPlan(state.path.slug);
		if (!plan) {
			renderError(warnings);
			return;
		}
		if (plan !== this.plan) {
			this.plan = plan;
			this.resetSceneState();
		}
		this.urlState.applyQueryState(state.query);
	}

	private syncControls(): void {
		this.ui.sync(
			this.canvas,
			this.physics,
			this.renderer,
			this.plan,
			this.renderer.renderStats,
		);
	}
}
