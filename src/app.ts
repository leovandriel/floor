import Canvas from "./canvas";
import Control, { type Command } from "./control";
import Input from "./input";
import { library } from "./library";
import Physics from "./physics";
import { getPlanBySlug } from "./plan";
import Renderer from "./render";
import type { Plan } from "./types";
import UI, { getCanvas, renderError } from "./ui";
import { readUrlState, type UrlState, UrlStateTracker } from "./url";
import View from "./view";
import WebGLRenderer from "./webgl";

declare const __DEV__: boolean;

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

export default class App {
	context: CanvasRenderingContext2D;
	private readonly webglCanvasElement: HTMLCanvasElement | undefined;
	private readonly webglRenderer: WebGLRenderer | undefined;
	view!: View;
	canvasRenderer!: Canvas;
	physics!: Physics;
	renderer!: Renderer;
	plan: Plan;
	urlState!: UrlStateTracker;
	control!: Control;
	input!: Input;
	private readonly ui = new UI(isDev);

	constructor(
		context: CanvasRenderingContext2D,
		plan: Plan,
		webglCanvasElement: HTMLCanvasElement | undefined,
		webglRenderer: WebGLRenderer | undefined,
	) {
		this.context = context;
		this.plan = plan;
		this.webglCanvasElement = webglCanvasElement;
		this.webglRenderer = webglRenderer;
	}

	static load(): void {
		const canvasElement = getCanvas();
		if (!canvasElement) return;
		const webglCanvasElement = getCanvas("canvas-webgl");
		if (!webglCanvasElement) return;
		const context = canvasElement.getContext?.("2d");
		if (!context) {
			canvasElement.remove();
			renderError(["Your browser does not support canvas rendering."]);
			return;
		}
		const webglContext = webglCanvasElement.getContext("webgl2") ?? undefined;
		const urlState = readUrlState();
		const plan = getPlanBySlug(urlState.path.slug);
		if (!plan) {
			renderError([`Unknown plan: ${urlState.path.slug}`]);
			return;
		}
		const app = new App(
			context,
			plan,
			webglCanvasElement,
			webglContext ? new WebGLRenderer(webglContext) : undefined,
		);
		app.initializeState();
		app.applyUrlState(urlState);
		app.ui.init((command) => app.applyCommand(command));
		app.syncRendererBackend();
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
		this.view.resizeToWindow();
		this.canvasRenderer.resize(this.view.size);
		this.resizeWebGLCanvas();
		this.syncRendererBackend();
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
				this.resetPlan();
				return;
			case "select-prev-plan":
				this.selectRelativePlan(-1);
				return;
			case "select-next-plan":
				this.selectRelativePlan(1);
				return;
			case "set-plan":
				this.handlePlanSelection(command.slug);
				return;
			default:
				switch (this.control.applyCommand(command)) {
					case "render":
						this.syncRendererBackend();
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
		this.syncRendererBackend();
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
		this.syncRendererBackend();
		this.renderer.render();
		this.syncControls();
	}

	private selectRelativePlan(offset: number): void {
		const currentIndex = library.findIndex(
			({ slug }) => slug === this.plan.slug,
		);
		if (currentIndex < 0) {
			return;
		}
		const nextIndex = (currentIndex + offset + library.length) % library.length;
		const nextPlan = library[nextIndex];
		this.handlePlanSelection(nextPlan.slug);
	}

	private handlePlanSelection(slug: string): void {
		if (slug === this.plan.slug) {
			return;
		}
		const nextPlan = getPlanBySlug(slug);
		if (!nextPlan) {
			renderError([`Unknown plan: ${slug}`]);
			this.syncControls();
			return;
		}

		this.plan = nextPlan;
		this.input.clear();
		this.initializeState();
		this.syncRendererBackend();
		this.renderer.render();
		this.syncControls();
		this.urlState.updateUrl();
	}

	private resetPlan(): void {
		this.input.clear();
		this.initializeState();
		this.renderAndSync(true);
	}

	private initializeState(): void {
		const debug = this.renderer?.debug ?? false;
		const webgl = this.renderer?.webgl ?? false;
		this.view = new View();
		this.view.resizeToWindow();
		this.canvasRenderer = new Canvas(this.context, this.view);
		this.canvasRenderer.resize(this.view.size);
		this.resizeWebGLCanvas();
		this.physics = new Physics(this.plan);
		this.renderer = new Renderer(
			this.physics,
			this.canvasRenderer,
			this.view,
			this.webglRenderer,
		);
		this.renderer.debug = debug;
		this.renderer.webgl = webgl;
		this.syncRendererBackend();
		this.input = new Input(this.view, this.renderer, (command) =>
			this.applyCommand(command),
		);
		this.control = new Control(
			this.view,
			this.physics,
			this.renderer,
			this.plan,
		);
		this.urlState = new UrlStateTracker(
			this.plan,
			this.view,
			this.physics,
			this.renderer,
		);
	}

	private applyUrlState(state: UrlState): void {
		const plan = getPlanBySlug(state.path.slug);
		if (!plan) {
			renderError([`Unknown plan: ${state.path.slug}`]);
			return;
		}
		if (plan !== this.plan) {
			this.plan = plan;
			this.initializeState();
		}
		this.urlState.applyQueryState(state.query);
	}

	private syncControls(): void {
		this.ui.sync(
			this.view,
			this.physics,
			this.renderer,
			this.plan,
			this.renderer.renderStats,
		);
	}

	private resizeWebGLCanvas(): void {
		if (!this.webglCanvasElement || !this.webglRenderer) {
			return;
		}
		const size = this.view.size;
		this.webglCanvasElement.width = size.x * 2;
		this.webglCanvasElement.height = size.y * 2;
		this.webglCanvasElement.style.width = `${size.x}px`;
		this.webglCanvasElement.style.height = `${size.y}px`;
		this.webglRenderer.resize(
			this.webglCanvasElement.width,
			this.webglCanvasElement.height,
		);
	}

	private syncRendererBackend(): void {
		if (!this.webglCanvasElement) {
			return;
		}
		this.context.canvas.hidden = false;
		this.context.canvas.style.display = "block";
		this.webglCanvasElement.hidden = !this.renderer.webgl;
		this.webglCanvasElement.style.display = this.renderer.webgl
			? "block"
			: "none";
		if (this.renderer.webgl) {
			this.canvasRenderer.clear();
		} else if (this.webglRenderer) {
			this.webglRenderer.clear(this.renderer.backgroundColor);
		}
	}
}
