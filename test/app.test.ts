import assert from "node:assert/strict";
import test from "node:test";

import App from "../src/app";
import Control from "../src/control";
import Input from "../src/input";
import { library } from "../src/library";
import { getPlanBySlug } from "../src/plan";
import { point } from "../src/types";

const defaultPlanSlug = "grid";

class FakeElement {}

globalThis.HTMLElement = FakeElement as unknown as typeof HTMLElement;
globalThis.window = {
	innerWidth: 800,
	innerHeight: 600,
} as Window & typeof globalThis;

function createMouseEvent(overrides: Partial<MouseEvent> = {}): MouseEvent {
	return {
		buttons: 0,
		clientX: 0,
		clientY: 0,
		pageX: 0,
		pageY: 0,
		target: null,
		...overrides,
	} as MouseEvent;
}

function createContext(): CanvasRenderingContext2D {
	return {
		canvas: {
			width: 0,
			height: 0,
			style: {},
		},
		setTransform() {},
	} as unknown as CanvasRenderingContext2D;
}

function createAppHarness() {
	const plan = getPlanBySlug(defaultPlanSlug);
	if (!plan) {
		throw new Error(`Missing default plan: ${defaultPlanSlug}`);
	}
	const app = new App(createContext(), plan, undefined, undefined);
	const appHarness = app as unknown as {
		input: {
			handleMouse(
				event: MouseEvent,
				action: "move" | "down" | "up" | "out",
			): void;
			lastDrag: { x: number; y: number } | undefined;
		};
		recordRenderStats: () => void;
		syncControls: () => void;
		scheduleUrlStateUpdate: () => void;
	};
	const moves: Array<{ x: number; y: number }> = [];
	app.physics = {
		simulateMove(delta: { x: number; y: number }) {
			moves.push({ x: delta.x, y: delta.y });
		},
	} as never;
	app.renderer = {
		render() {
			return {
				cells: 0,
				branches: 0,
				maxDepth: 0,
				duration: 0,
			};
		},
	} as never;
	app.canvasRenderer = {} as never;
	app.view = {
		range: 2,
		scale: 1,
	} as never;
	app.input = new Input(app.view, app.renderer, (command) =>
		(app as unknown as { applyCommand(command: unknown): void }).applyCommand(
			command,
		),
	);
	app.control = new Control(app.view, app.physics, app.renderer, plan);
	appHarness.recordRenderStats = () => {};
	appHarness.syncControls = () => {};
	appHarness.scheduleUrlStateUpdate = () => {};

	return { app, moves };
}

test("handleMouse ignores move events when not dragging", () => {
	const { app, moves } = createAppHarness();
	const { input } = app as unknown as {
		input: {
			handleMouse(
				event: MouseEvent,
				action: "move" | "down" | "up" | "out",
			): void;
		};
	};

	input.handleMouse(
		createMouseEvent({
			clientX: 25,
			clientY: 40,
			pageX: 125,
			pageY: 240,
		}),
		"move",
	);

	assert.deepEqual(moves, []);
});

test("handleMouse clears stale drag state when buttons are released", () => {
	const { app, moves } = createAppHarness();
	const { input } = app as unknown as {
		input: {
			handleMouse(
				event: MouseEvent,
				action: "move" | "down" | "up" | "out",
			): void;
			lastDrag: { x: number; y: number } | undefined;
		};
	};

	input.lastDrag = point(10.0, 10.0);
	input.handleMouse(
		createMouseEvent({
			clientX: 30,
			clientY: 50,
			buttons: 0,
		}),
		"move",
	);

	assert.equal(input.lastDrag, undefined);
	assert.equal(moves.length, 0);
});

test("handleMouse emits drag-mouse even when a vertex is hovered", () => {
	const commands: unknown[] = [];
	const input = new Input(
		{
			range: 2,
			scale: 1,
		} as never,
		{
			hoveredVertex: {
				cellIndex: 3,
				vertexIndex: 1,
			},
		} as never,
		(command) => commands.push(command),
	);

	input.handleMouse(createMouseEvent({ clientX: 10, clientY: 20 }), "down");
	input.handleMouse(
		createMouseEvent({
			clientX: 16,
			clientY: 14,
			buttons: 1,
		}),
		"move",
	);

	assert.deepEqual(commands[commands.length - 1], {
		type: "drag-mouse",
		delta: point(-12.0, -12.0),
	});
});

function createKeyEvent(code: string): KeyboardEvent {
	return {
		code,
		target: null,
		metaKey: false,
		ctrlKey: false,
		altKey: false,
		shiftKey: false,
		repeat: false,
	} as KeyboardEvent;
}

test("KeyG selects the next plan with wraparound", () => {
	const commands: unknown[] = [];
	const input = new Input({} as never, {} as never, (command) =>
		commands.push(command),
	);
	const lastPlan = library[library.length - 1];
	if (!lastPlan) {
		throw new Error("Expected at least one plan");
	}
	const app = new App(createContext(), lastPlan, undefined, undefined);
	const appPrivate = app as unknown as {
		applyCommand(command: unknown): void;
		handlePlanSelection(slug: string): void;
	};
	const selectedSlugs: string[] = [];
	appPrivate.handlePlanSelection = (slug: string) => {
		selectedSlugs.push(slug);
	};

	input.handleKeyDown(createKeyEvent("KeyG"));

	assert.deepEqual(commands, [{ type: "select-next-plan" }]);
	appPrivate.applyCommand(commands[0]);
	assert.deepEqual(selectedSlugs, [library[0].slug]);
});

test("KeyF selects the previous plan with wraparound", () => {
	const commands: unknown[] = [];
	const input = new Input({} as never, {} as never, (command) =>
		commands.push(command),
	);
	const firstPlan = library[0];
	const lastPlan = library[library.length - 1];
	if (!lastPlan) {
		throw new Error("Expected at least one plan");
	}
	const app = new App(createContext(), firstPlan, undefined, undefined);
	const appPrivate = app as unknown as {
		applyCommand(command: unknown): void;
		handlePlanSelection(slug: string): void;
	};
	const selectedSlugs: string[] = [];
	appPrivate.handlePlanSelection = (slug: string) => {
		selectedSlugs.push(slug);
	};

	input.handleKeyDown(createKeyEvent("KeyF"));

	assert.deepEqual(commands, [{ type: "select-prev-plan" }]);
	appPrivate.applyCommand(commands[0]);
	assert.deepEqual(selectedSlugs, [lastPlan.slug]);
});
