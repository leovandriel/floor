import type { Command, ControlCommand } from "./control";
import type Renderer from "./render";
import type { MouseAction, Point } from "./types";
import { point } from "./types";
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
			case "KeyO":
				this.onCommand({ type: "select-prev-plan" });
				return;
			case "KeyP":
				this.onCommand({ type: "select-next-plan" });
				return;
			case "KeyX":
				this.onCommand({
					type: "set-debug",
					value: !this.renderer.debug,
				});
				return;
			case "KeyG":
				this.onCommand({
					type: "set-webgl",
					value: !this.renderer.webgl,
				});
				return;
			case "KeyR":
				this.onCommand({ type: "reset" });
				return;
			case "Digit0":
			case "Numpad0":
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

		for (const command of commandOrder) {
			if (!activeCommands.has(command)) {
				continue;
			}
			if (activeCommands.has(oppositeCommand[command])) {
				continue;
			}
			this.onCommand({
				type: command,
				deltaSeconds,
			});
		}

		if (this.heldCodes.size > 0) {
			this.keyFrame = window.requestAnimationFrame((nextNow) =>
				this.step(nextNow),
			);
		}
	}
}
