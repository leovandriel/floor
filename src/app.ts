import Canvas, { color } from "./canvas";
import { checkPlan, planCurl as plan } from "./library";
import * as math from "./math";
import { point } from "./math";
import Scene from "./scene";
import type { MouseAction, Point } from "./types";

export default class App {
	scene: Scene | undefined = undefined;
	context: CanvasRenderingContext2D | undefined = undefined;
	lastDrag: Point | undefined = undefined;

	private readonly onKeyDown = (event: KeyboardEvent): void =>
		this.handleKey(event);
	private readonly onMouseMove = (event: MouseEvent): void =>
		this.handleMouse(event, "move");
	private readonly onMouseOut = (event: MouseEvent): void =>
		this.handleMouse(event, "out");
	private readonly onMouseDown = (event: MouseEvent): void =>
		this.handleMouse(event, "down");
	private readonly onMouseUp = (event: MouseEvent): void =>
		this.handleMouse(event, "up");
	private readonly onResize = (): void => this.handleResize();

	handleKey(event: KeyboardEvent): void {
		const scene = this.requireScene();
		switch (event.code) {
			case "ArrowLeft":
			case "KeyQ":
				scene.handleTurn(-0.05 + math.noise());
				break;
			case "ArrowRight":
			case "KeyE":
				scene.handleTurn(0.05 + math.noise());
				break;
			case "ArrowUp":
			case "KeyW":
				scene.handleMove(point(0 + math.noise(), 1 + math.noise()));
				break;
			case "ArrowDown":
			case "KeyS":
				scene.handleMove(point(0 + math.noise(), -1 + math.noise()));
				break;
			case "KeyA":
				scene.handleMove(point(-1 + math.noise(), 0 + math.noise()));
				break;
			case "KeyD":
				scene.handleMove(point(1 + math.noise(), 0 + math.noise()));
				break;
			case "KeyV":
				scene.showTile = !scene.showTile;
				break;
			case "KeyC":
				scene.showCurrent = !scene.showCurrent;
				break;
			case "KeyX":
				scene.showSelf = !scene.showSelf;
				break;
			case "Equal":
			case "NumpadAdd":
				scene.canvas.warp(1 / 1.1);
				break;
			case "Minus":
			case "NumpadSubtract":
				scene.canvas.warp(1.1);
				break;
			case "Digit0":
			case "Numpad0":
				scene.canvas.zoom(1.1);
				break;
			case "Digit9":
			case "Numpad9":
				scene.canvas.zoom(1 / 1.1);
				break;
			case "Digit8":
			case "Numpad8":
				scene.scale *= 1.1;
				break;
			case "Digit7":
			case "Numpad7":
				scene.scale /= 1.1;
				break;
			default:
				return;
		}
		scene.render();
	}

	handleMouse(event: MouseEvent, action: MouseAction): void {
		const scene = this.requireScene();
		const p = point(event.pageX, event.pageY);
		if (!this.lastDrag && action === "down") {
			this.lastDrag = p;
		} else if (this.lastDrag && action === "up") {
			this.lastDrag = undefined;
		} else if (this.lastDrag && action === "move") {
			const delta = scene.unscale(
				point(this.lastDrag.x - p.x, this.lastDrag.y - p.y),
			);
			scene.handleMove(
				point(delta.x * 0.085 + math.noise(), delta.y * 0.085 + math.noise()),
			);
			this.lastDrag = p;
			action = "drag";
		}
		const mouse = action === "out" ? undefined : p;
		scene.canvas.setMouse(mouse);
		scene.render(action);
	}

	handleResize(): void {
		const scene = this.requireScene();
		const context = this.requireContext();
		const size = this.resizeCanvas(context);
		scene.canvas.setSize(size);
		scene.render();
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
		return new Scene(canvas2, plan);
	}

	attachHandlers(): void {
		document.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("resize", this.onResize);
		document.addEventListener("mousemove", this.onMouseMove);
		document.addEventListener("mouseout", this.onMouseOut);
		document.addEventListener("mousedown", this.onMouseDown);
		document.addEventListener("mouseup", this.onMouseUp);
	}

	start(): void {
		checkPlan(plan);
		const context = this.getContext();
		if (!context) return;
		this.context = context;
		this.scene = this.createScene(context);
		this.scene.render();
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
