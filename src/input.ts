import type { Command, ControlAction, ControlCommand } from "./control";
import type Renderer from "./render";
import type { MouseAction, Point } from "./types";
import { point, renderModes, topologyModes } from "./types";
import { isControlsTarget } from "./ui";
import type View from "./view";

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
	Digit1: "warp-in",
	Numpad1: "warp-in",
	Digit2: "warp-out",
	Numpad2: "warp-out",
	Digit4: "zoom-in",
	Numpad4: "zoom-in",
	Digit3: "zoom-out",
	Numpad3: "zoom-out",
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

const oppositeCommand: Record<ControlCommand, ControlCommand> = {
	"turn-left": "turn-right",
	"turn-right": "turn-left",
	"move-forward": "move-backward",
	"move-backward": "move-forward",
	"move-left": "move-right",
	"move-right": "move-left",
	"scale-up": "scale-down",
	"scale-down": "scale-up",
	"zoom-in": "zoom-out",
	"zoom-out": "zoom-in",
	"warp-in": "warp-out",
	"warp-out": "warp-in",
};

export default class Input {
	private readonly heldCodes = new Set<string>();
	private keyFrame: number | undefined = undefined;
	private lastKeyFrameAt: number | undefined = undefined;
	private lastDrag: Point | undefined = undefined;

	constructor(
		private readonly view: View,
		private readonly renderer: Renderer,
		private readonly onCommand: (command: Command) => void,
	) {}

	clear(): void {
		this.heldCodes.clear();
		this.lastDrag = undefined;
		this.stopKeyLoop();
	}

	handleKeyDown(event: KeyboardEvent): void {
		this.handleKey(event);
	}

	handleKeyUp(event: KeyboardEvent): void {
		this.heldCodes.delete(event.code);
		if (this.heldCodes.size === 0) {
			this.stopKeyLoop();
		}
	}

	handleMouse(event: MouseEvent, action: MouseAction): void {
		if (isControlsTarget(event.target)) {
			return;
		}

		const p = point(event.clientX, event.clientY);
		if (this.lastDrag && action === "move" && event.buttons === 0) {
			this.lastDrag = undefined;
		}
		if (!this.lastDrag && action === "down") {
			this.lastDrag = p;
		} else if (this.lastDrag && action === "up") {
			this.lastDrag = undefined;
		} else if (this.lastDrag && action === "move") {
			const delta = point(
				(this.lastDrag.x - p.x) / this.view.scale,
				(p.y - this.lastDrag.y) / this.view.scale,
			);
			this.lastDrag = p;
			this.onCommand({
				type: "drag-mouse",
				delta: point(delta.x * this.view.range, delta.y * this.view.range),
			});
		}
	}

	private handleKey(event: KeyboardEvent): void {
		if (isControlsTarget(event.target)) {
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

		switch (event.code) {
			case "KeyF":
				this.onCommand({ type: "select-prev-plan" });
				return;
			case "KeyG":
				this.onCommand({ type: "select-next-plan" });
				return;
			case "KeyX":
				this.onCommand({
					type: "set-debug",
					value: !this.renderer.debug,
				});
				return;
			case "KeyZ": {
				const index = renderModes.indexOf(this.renderer.renderMode);
				this.onCommand({
					type: "set-render-mode",
					value: renderModes[(index + 1) % renderModes.length],
				});
				return;
			}
			case "KeyC": {
				const index = topologyModes.indexOf(this.renderer.topologyMode);
				this.onCommand({
					type: "set-topology-mode",
					value: topologyModes[(index + 1) % topologyModes.length],
				});
				return;
			}
			case "KeyR":
				this.onCommand({ type: "reset" });
				return;
			case "Digit1":
			case "Numpad1":
				this.onCommand({ type: "warp-in" });
				return;
			default:
				return;
		}
	}

	private startKeyLoop(): void {
		if (this.keyFrame !== undefined) {
			return;
		}
		this.keyFrame = window.requestAnimationFrame(() => this.step());
	}

	private stopKeyLoop(): void {
		if (this.keyFrame !== undefined) {
			window.cancelAnimationFrame(this.keyFrame);
			this.keyFrame = undefined;
		}
		this.lastKeyFrameAt = undefined;
	}

	private step(now: number = performance.now()): void {
		this.keyFrame = undefined;
		if (this.heldCodes.size === 0) {
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

		const commands: ControlAction[] = [];
		for (const command of commandOrder) {
			if (!activeCommands.has(command)) {
				continue;
			}
			if (activeCommands.has(oppositeCommand[command])) {
				continue;
			}
			commands.push({
				type: command,
				deltaSeconds,
			});
		}
		if (commands.length === 1) {
			this.onCommand(commands[0]);
		} else if (commands.length > 1) {
			this.onCommand({ type: "batch", commands });
		}

		if (this.heldCodes.size > 0) {
			this.keyFrame = window.requestAnimationFrame((nextNow) =>
				this.step(nextNow),
			);
		}
	}
}
