import * as math from "./linalg";
import type Physics from "./physics";
import type Renderer from "./render";
import type { Plan, Point, RenderMode, TileId, TopologyMode } from "./types";
import { point } from "./types";
import type View from "./view";

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
	| "set-x"
	| "set-y"
	| "set-rotation"
	| "set-scale"
	| "set-factor"
	| "set-range";

export type ControlAction =
	| { type: ControlCommand; deltaSeconds?: number }
	| { type: "drag-mouse"; delta: Point }
	| { type: "set-current"; value: TileId }
	| { type: SetNumberCommand; value: number }
	| { type: "set-debug"; value: boolean }
	| { type: "set-render-mode"; value: RenderMode }
	| { type: "set-topology-mode"; value: TopologyMode };

export type Command =
	| ControlAction
	| { type: "batch"; commands: ControlAction[] }
	| { type: "reset" }
	| { type: "select-prev-plan" }
	| { type: "select-next-plan" }
	| { type: "set-plan"; slug: string };

const linearVelocity = 0.3;
const angularVelocity = 0.3;

export type ControlResult = "render" | "render-and-sync" | "unhandled";

function noise(): number {
	return (2 * Math.random() - 1) * 1e-3;
}

export default class Control {
	constructor(
		private readonly view: View,
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
				return "render-and-sync";
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
			case "set-render-mode":
				this.renderer.renderMode = command.value;
				return "render-and-sync";
			case "set-topology-mode":
				return "unhandled";
		}
	}

	private applyControlCommand(
		command: ControlCommand,
		deltaSeconds = 1 / 60,
	): void {
		switch (command) {
			case "turn-left":
				this.physics.simulateTurn(
					(-1 + noise()) * angularVelocity * deltaSeconds,
				);
				break;
			case "turn-right":
				this.physics.simulateTurn(
					(1 + noise()) * angularVelocity * deltaSeconds,
				);
				break;
			case "move-forward":
				this.physics.simulateMove(
					math.mul(point(noise(), 1 + noise()), linearVelocity * deltaSeconds),
				);
				break;
			case "move-backward":
				this.physics.simulateMove(
					math.mul(point(noise(), -1 + noise()), linearVelocity * deltaSeconds),
				);
				break;
			case "move-left":
				this.physics.simulateMove(
					math.mul(point(-1 + noise(), noise()), linearVelocity * deltaSeconds),
				);
				break;
			case "move-right":
				this.physics.simulateMove(
					math.mul(point(1 + noise(), noise()), linearVelocity * deltaSeconds),
				);
				break;
			case "scale-up":
				this.physics.scale *= 2 ** deltaSeconds;
				break;
			case "scale-down":
				this.physics.scale /= 2 ** deltaSeconds;
				break;
			case "zoom-in":
				this.view.zoom(2 ** deltaSeconds);
				break;
			case "zoom-out":
				this.view.zoom(1 / 2 ** deltaSeconds);
				break;
			case "warp-in":
				this.view.warp(1 / 2 ** deltaSeconds);
				break;
			case "warp-out":
				this.view.warp(2 ** deltaSeconds);
				break;
		}
	}

	private applyStateCommand(
		command: Extract<
			ControlAction,
			{ type: "set-current" } | { type: SetNumberCommand }
		>,
	): ControlResult {
		switch (command.type) {
			case "set-current":
				this.physics.currentTileId = command.value;
				this.physics.simulateSnap();
				this.physics.resetWorld();
				return "render-and-sync";
			case "set-x":
				this.physics.position.x = command.value;
				this.physics.simulateSnap();
				this.physics.resetWorld();
				return "render-and-sync";
			case "set-y":
				this.physics.position.y = command.value;
				this.physics.simulateSnap();
				this.physics.resetWorld();
				return "render-and-sync";
			case "set-rotation":
				this.physics.simulateTurn(command.value - this.physics.rotation);
				return "render-and-sync";
			case "set-scale":
				if (command.value <= 0) {
					return "render-and-sync";
				}
				this.physics.scale = command.value;
				this.physics.resetWorld();
				return "render-and-sync";
			case "set-factor":
				if (command.value <= 0) {
					return "render-and-sync";
				}
				this.view.factor = command.value;
				return "render-and-sync";
			case "set-range":
				if (command.value <= 0) {
					return "render-and-sync";
				}
				this.view.range = command.value;
				return "render-and-sync";
		}
	}
}
