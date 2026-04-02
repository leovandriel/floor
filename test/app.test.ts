import assert from "node:assert/strict";
import test from "node:test";

import App from "../src/app";
import Control from "../src/control";
import Input from "../src/input";
import { library } from "../src/library";
import { getPlanBySlug } from "../src/plan";
import { point } from "../src/types";

const defaultPlanSlug = "square";

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
	const app = new App(createContext(), plan);
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
	let lastMouse = point(NaN, NaN);
	const moves: Array<{ x: number; y: number }> = [];
	app.physics = {
		simulateMove(delta: { x: number; y: number }) {
			moves.push({ x: delta.x, y: delta.y });
		},
	} as never;
	app.renderer = {
		render() {
			return {
				tiles: 0,
				branches: 0,
				avatars: 0,
				maxDepth: 0,
				renderDuration: 0,
			};
		},
	} as never;
	app.canvas = {
		range: 2,
		unscale(delta: { x: number; y: number }) {
			return delta;
		},
		setMouse(mouse: { x: number; y: number } | undefined) {
			lastMouse = mouse ? point(mouse.x, mouse.y) : point(NaN, NaN);
		},
	} as never;
	app.input = new Input(app.canvas, app.renderer, (command) =>
		(app as unknown as { applyCommand(command: unknown): void }).applyCommand(
			command,
		),
	);
	app.control = new Control(app.canvas, app.physics, app.renderer, plan);
	appHarness.recordRenderStats = () => {};
	appHarness.syncControls = () => {};
	appHarness.scheduleUrlStateUpdate = () => {};

	return { app, moves, getLastMouse: () => lastMouse };
}

test("handleMouse uses client coordinates for hover state", () => {
	const { app, getLastMouse } = createAppHarness();
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

	assert.deepEqual(getLastMouse(), point(25.0, 40.0));
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

test("handleMouse emits drag-mouse even when a corner is hovered", () => {
	const commands: unknown[] = [];
	const input = new Input(
		{
			range: 2,
			unscale(delta: { x: number; y: number }) {
				return delta;
			},
		} as never,
		{
			hoveredCorner: {
				tileIndex: 3,
				cornerIndex: 1,
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
		delta: point(-12.0, 12.0),
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

test("KeyP selects the next plan with wraparound", () => {
	const commands: unknown[] = [];
	const input = new Input({} as never, {} as never, (command) =>
		commands.push(command),
	);
	const lastPlan = library[library.length - 1];
	if (!lastPlan) {
		throw new Error("Expected at least one plan");
	}
	const app = new App(createContext(), lastPlan);
	const appPrivate = app as unknown as {
		applyCommand(command: unknown): void;
		handlePlanSelection(slug: string): void;
	};
	const selectedSlugs: string[] = [];
	appPrivate.handlePlanSelection = (slug: string) => {
		selectedSlugs.push(slug);
	};

	input.handleKeyDown(createKeyEvent("KeyP"));

	assert.deepEqual(commands, [{ type: "select-next-plan" }]);
	appPrivate.applyCommand(commands[0]);
	assert.deepEqual(selectedSlugs, [library[0].slug]);
});

test("KeyO selects the previous plan with wraparound", () => {
	const commands: unknown[] = [];
	const input = new Input({} as never, {} as never, (command) =>
		commands.push(command),
	);
	const firstPlan = library[0];
	const lastPlan = library[library.length - 1];
	if (!lastPlan) {
		throw new Error("Expected at least one plan");
	}
	const app = new App(createContext(), firstPlan);
	const appPrivate = app as unknown as {
		applyCommand(command: unknown): void;
		handlePlanSelection(slug: string): void;
	};
	const selectedSlugs: string[] = [];
	appPrivate.handlePlanSelection = (slug: string) => {
		selectedSlugs.push(slug);
	};

	input.handleKeyDown(createKeyEvent("KeyO"));

	assert.deepEqual(commands, [{ type: "select-prev-plan" }]);
	appPrivate.applyCommand(commands[0]);
	assert.deepEqual(selectedSlugs, [lastPlan.slug]);
});
