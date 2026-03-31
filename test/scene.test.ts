import assert from "node:assert/strict";
import test from "node:test";

import { planBase, planBox, planHex, planTunnel } from "../src/library";
import { point } from "../src/math";
import Scene from "../src/scene";

function createScene(plan = planTunnel): Scene {
	const canvasStub = {
		range: 0.5,
		factor: 1,
		background: { r: 0, g: 0, b: 0, a: 1 },
		size: point(100, 100),
		setColor() {},
		drawCircle() {},
		drawDouble() {},
		drawLine() {},
		drawRect() {},
		drawPath() {},
		setWidth() {},
		getMouse() {
			return undefined;
		},
	} as never;

	return new Scene(canvasStub, plan);
}

function assertInsideCurrentTile(scene: Scene): void {
	const { shape } = scene.plan.tiles[scene.current];
	assert.ok(scene.position.y >= -1e-9);
	assert.ok(scene.position.y <= shape.y + 1e-9);
	const min = (shape.x * scene.position.y) / shape.y;
	const max = min + 1 - scene.position.y / shape.y;
	assert.ok(scene.position.x >= min - 1e-9);
	assert.ok(scene.position.x <= max + 1e-9);
}

test("handleTransition maps tunnel side 1 into side 2 coordinates", () => {
	const scene = createScene();
	const transformed = scene.handleTransition(
		point(0.2, 0.3),
		{ shape: point(0.0, 1.0), offset: 1 },
		{ shape: point(0.0, 1.0), offset: 2 },
	);

	assert.ok(Math.abs(transformed.x - 0.9) < 1e-9);
	assert.ok(Math.abs(transformed.y - 0.5) < 1e-9);
});

test("handleMove wraps through the tunnel and preserves heading", () => {
	const scene = createScene();
	scene.position = point(0.95, 0.4);
	scene.step = 0.2;

	scene.handleMove(point(1, 0));

	assert.equal(scene.current, 0);
	assert.ok(Math.abs(scene.position.x - 0.6) < 1e-9);
	assert.ok(Math.abs(scene.position.y - 0.4) < 1e-9);
	assert.equal(scene.rotation, 0);
	assert.equal(scene.scale, 0.2);
});

test("handleSnap clamps the position into the current tile bounds", () => {
	const scene = createScene();
	scene.position = point(-0.1, 10);

	scene.handleSnap();

	assert.ok(Math.abs(scene.position.x - 0) < 1e-9);
	assert.ok(Math.abs(scene.position.y - 1) < 1e-9);
});

test("handleSnap resolves wall pushes that cross a seam edge", () => {
	const scene = createScene(planBox);
	scene.position = point(0.02, 0.02);

	scene.handleSnap();

	assertInsideCurrentTile(scene);
});

test("handleMove reflects off a wall without changing tile or heading", () => {
	const scene = createScene(planBase);
	scene.position = point(0.05, 0.3);
	scene.step = 0.2;

	scene.handleMove(point(-1, 0));

	assert.equal(scene.current, 0);
	assert.ok(Math.abs(scene.position.x - 0.05001) < 1e-9);
	assert.ok(Math.abs(scene.position.y - 0.30000000000000004) < 1e-9);
	assert.equal(scene.rotation, 0);
	assert.equal(scene.scale, 0.2);
});

test("handleMove preserves heading across the box short-edge seam", () => {
	const scene = createScene(planBox);
	scene.position = point(0.06, 0.05);
	scene.step = 0.03;

	scene.handleMove(point(-1, 0));

	assert.equal(scene.current, 0);
	assert.ok(Math.abs(scene.position.x - 0.9499986) < 1e-9);
	assert.ok(Math.abs(scene.position.y - 0.050001399999999994) < 1e-9);
	assert.ok(Math.abs(scene.rotation - -0.25) < 1e-9);
	assert.equal(scene.scale, 0.2);
});

test("handleMove wraps smoothly across the hex side seam", () => {
	const scene = createScene(planHex);
	scene.position = point(0.06, 0.1);
	scene.step = 0.03;

	scene.handleMove(point(-1, 0));

	assert.equal(scene.current, 0);
	assert.ok(Math.abs(scene.position.x - 0.868398908170558) < 1e-9);
	assert.ok(Math.abs(scene.position.y - 0.050001279456296066) < 1e-9);
	assert.ok(Math.abs(scene.rotation - -0.16667070989350627) < 1e-9);
	assert.equal(scene.scale, 0.2);
});
