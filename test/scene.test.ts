import assert from "node:assert/strict";
import test from "node:test";

import { planBase, planHex, planSquare, planTunnel } from "../src/library";
import { point } from "../src/math";
import Physics, { handleTransition } from "../src/physics";

const linearVelocity = 0.03;

function createPhysics(plan = planTunnel): Physics {
	return new Physics(plan);
}

function assertInsideCurrentTile(physics: Physics): void {
	const { shape } = physics.plan.tiles[physics.current];
	assert.ok(physics.position.y >= -1e-9);
	assert.ok(physics.position.y <= shape.y + 1e-9);
	const min = (shape.x * physics.position.y) / shape.y;
	const max = min + 1 - physics.position.y / shape.y;
	assert.ok(physics.position.x >= min - 1e-9);
	assert.ok(physics.position.x <= max + 1e-9);
}

test("handleTransition maps tunnel side 1 into side 2 coordinates", () => {
	const transformed = handleTransition(
		point(0.2, 0.3),
		{ shape: point(0.0, 1.0), offset: 1 },
		{ shape: point(0.0, 1.0), offset: 2 },
	);

	assert.ok(Math.abs(transformed.x - 0.9) < 1e-9);
	assert.ok(Math.abs(transformed.y - 0.5) < 1e-9);
});

test("handleMove wraps through the tunnel and preserves heading", () => {
	const physics = createPhysics();
	physics.position = point(0.95, 0.4);

	physics.simulateMove(point(0.2, 0));

	assert.equal(physics.current, 0);
	assert.ok(Math.abs(physics.position.x - 0.6) < 1e-9);
	assert.ok(Math.abs(physics.position.y - 0.4) < 1e-9);
	assert.equal(physics.rotation, 0);
	assert.equal(physics.scale, 0.2);
});

test("handleSnap clamps the position into the current tile bounds", () => {
	const physics = createPhysics();
	physics.position = point(-0.1, 10);

	physics.simulateSnap();

	assert.ok(Math.abs(physics.position.x - 0) < 1e-9);
	assert.ok(Math.abs(physics.position.y - 1) < 1e-9);
});

test("handleSnap resolves wall pushes that cross a seam edge", () => {
	const physics = createPhysics(planSquare);
	physics.position = point(0.02, 0.02);

	physics.simulateSnap();

	assertInsideCurrentTile(physics);
});

test("handleMove reflects off a wall without changing tile or heading", () => {
	const physics = createPhysics(planBase);
	physics.position = point(0.05, 0.3);

	physics.simulateMove(point(-0.2, 0));

	assert.equal(physics.current, 0);
	assert.ok(Math.abs(physics.position.x - 0.05001) < 1e-9);
	assert.ok(Math.abs(physics.position.y - 0.30000000000000004) < 1e-9);
	assert.equal(physics.rotation, 0);
	assert.equal(physics.scale, 0.2);
});

test("handleMove preserves heading across the square short-edge seam", () => {
	const physics = createPhysics(planSquare);
	physics.position = point(0.06, 0.05);

	physics.simulateMove(point(-linearVelocity, 0));

	assert.equal(physics.current, 0);
	assert.ok(Math.abs(physics.position.x - 0.9499986) < 1e-9);
	assert.ok(Math.abs(physics.position.y - 0.050001399999999994) < 1e-9);
	assert.ok(Math.abs(physics.rotation - -0.25) < 1e-9);
	assert.equal(physics.scale, 0.2);
});

test("handleMove wraps smoothly across the hex side seam", () => {
	const physics = createPhysics(planHex);
	physics.position = point(0.06, 0.1);

	physics.simulateMove(point(-linearVelocity, 0));

	assert.equal(physics.current, 0);
	assert.ok(Math.abs(physics.position.x - 0.868398908170558) < 1e-9);
	assert.ok(Math.abs(physics.position.y - 0.050001279456296066) < 1e-9);
	assert.ok(Math.abs(physics.rotation - -0.16667070989350627) < 1e-9);
	assert.equal(physics.scale, 0.2);
});
