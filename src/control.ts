import type Canvas from "./canvas";
import * as math from "./math";
import { point } from "./math";
import type Physics from "./physics";
import type Renderer from "./render";
import type { Plan, Point } from "./types";

export type ControlCommand =
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

export type SetNumberCommand =
	| "set-current"
	| "set-x"
	| "set-y"
	| "set-rotation"
	| "set-scale"
	| "set-factor"
	| "set-range";

export type ControlAction =
	| { type: ControlCommand; deltaSeconds?: number }
	| { type: "drag-mouse"; delta: Point }
	| { type: "move-mouse"; mouse: Point | undefined }
	| { type: SetNumberCommand; value: number }
	| { type: "set-debug"; value: boolean };

export type Command =
	| ControlAction
	| { type: "reset" }
	| { type: "set-plan"; slug: string };

const linearVelocity = 0.2;
const angularVelocity = 0.3;

export type ControlResult = "render" | "render-and-sync" | "unhandled";

export default class Control {
	constructor(
		private readonly canvas: Canvas,
		private readonly physics: Physics,
		private readonly renderer: Renderer,
		private readonly plan: Plan,
	) {}

	applyCommand(command: ControlAction): ControlResult {
		switch (command.type) {
			case "turn-left":
			case "turn-right":
			case "move-forward":
			case "move-backward":
			case "move-left":
			case "move-right":
			case "scale-up":
			case "scale-down":
			case "zoom-in":
			case "zoom-out":
			case "warp-in":
			case "warp-out":
				this.applyControlCommand(command.type, command.deltaSeconds);
				return "render-and-sync";
			case "drag-mouse":
				this.physics.simulateMove(command.delta);
				this.canvas.setMouse(undefined);
				return "render-and-sync";
			case "move-mouse":
				this.canvas.setMouse(command.mouse);
				return "render";
			case "set-current":
			case "set-x":
			case "set-y":
			case "set-rotation":
			case "set-scale":
			case "set-factor":
			case "set-range":
				return this.applyStateCommand(command);
			case "set-debug":
				this.renderer.debug = command.value;
				return "render-and-sync";
		}
	}

	private applyControlCommand(
		command: ControlCommand,
		deltaSeconds = 1 / 60,
	): void {
		switch (command) {
			case "turn-left":
				this.physics.simulateTurn(
					(-1 + math.noise()) * angularVelocity * deltaSeconds,
				);
				break;
			case "turn-right":
				this.physics.simulateTurn(
					(1 + math.noise()) * angularVelocity * deltaSeconds,
				);
				break;
			case "move-forward":
				this.physics.simulateMove(
					math.mul(
						point(math.noise(), 1 + math.noise()),
						linearVelocity * deltaSeconds,
					),
				);
				break;
			case "move-backward":
				this.physics.simulateMove(
					math.mul(
						point(math.noise(), -1 + math.noise()),
						linearVelocity * deltaSeconds,
					),
				);
				break;
			case "move-left":
				this.physics.simulateMove(
					math.mul(
						point(-1 + math.noise(), math.noise()),
						linearVelocity * deltaSeconds,
					),
				);
				break;
			case "move-right":
				this.physics.simulateMove(
					math.mul(
						point(1 + math.noise(), math.noise()),
						linearVelocity * deltaSeconds,
					),
				);
				break;
			case "scale-up":
				this.physics.scale *= 2 ** deltaSeconds;
				break;
			case "scale-down":
				this.physics.scale /= 2 ** deltaSeconds;
				break;
			case "zoom-in":
				this.canvas.zoom(2 ** deltaSeconds);
				break;
			case "zoom-out":
				this.canvas.zoom(1 / 2 ** deltaSeconds);
				break;
			case "warp-in":
				this.canvas.warp(1 / 2 ** deltaSeconds);
				break;
			case "warp-out":
				this.canvas.warp(2 ** deltaSeconds);
				break;
		}
	}

	private applyStateCommand(
		command: Extract<ControlAction, { type: SetNumberCommand }>,
	): ControlResult {
		switch (command.type) {
			case "set-current":
				this.physics.current = math.clamp(
					Math.round(command.value),
					0,
					this.plan.tiles.length - 1,
				);
				this.physics.simulateSnap();
				return "render-and-sync";
			case "set-x":
				this.physics.position.x = command.value;
				this.physics.simulateSnap();
				return "render-and-sync";
			case "set-y":
				this.physics.position.y = command.value;
				this.physics.simulateSnap();
				return "render-and-sync";
			case "set-rotation":
				this.physics.rotation = command.value;
				return "render-and-sync";
			case "set-scale":
				if (command.value <= 0) {
					return "render-and-sync";
				}
				this.physics.scale = command.value;
				return "render-and-sync";
			case "set-factor":
				if (command.value <= 0) {
					return "render-and-sync";
				}
				this.canvas.factor = command.value;
				return "render-and-sync";
			case "set-range":
				if (command.value <= 0) {
					return "render-and-sync";
				}
				this.canvas.range = command.value;
				return "render-and-sync";
		}
	}
}
