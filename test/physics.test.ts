import assert from "node:assert/strict";
import test from "node:test";
import Physics, { isInsideTile } from "../src/physics";
import { getPlanBySlug } from "../src/plan";
import { point } from "../src/types";

const linearVelocity = 0.03;

const planTunnel = getRequiredPlan("tunnel");
const planSquare = getRequiredPlan("square");
const planBase = getRequiredPlan("base");
const planHex = getRequiredPlan("hex");

function getRequiredPlan(slug: string) {
	const plan = getPlanBySlug(slug);
	if (!plan) {
		throw new Error(`Missing plan: ${slug}`);
	}
	return plan;
}

function createPhysics(plan = planTunnel): Physics {
	return new Physics(plan);
}

function assertInsideCurrentTile(physics: Physics): void {
	const { shape } = physics.plan.get(physics.currentTileId);
	assert.ok(physics.position.y >= -1e-9);
	assert.ok(physics.position.y <= shape.y + 1e-9);
	const min = (shape.x * physics.position.y) / shape.y;
	const max = min + 1 - physics.position.y / shape.y;
	assert.ok(physics.position.x >= min - 1e-9);
	assert.ok(physics.position.x <= max + 1e-9);
}

test("handleMove wraps through the tunnel and preserves heading", () => {
	const physics = createPhysics();
	physics.position = point(0.95, 0.4);

	physics.simulateMove(point(0.2, 0.0));

	assert.equal(physics.currentTileId, 0n);
	assert.ok(Math.abs(physics.position.x - 0.6) < 1e-9);
	assert.ok(Math.abs(physics.position.y - 0.4) < 1e-9);
	assert.equal(physics.rotation, 0);
	assert.equal(physics.scale, 0.2);
});

test("handleSnap clamps the position into the current tile bounds", () => {
	const physics = createPhysics();
	physics.position = point(-0.1, 10.0);

	physics.simulateSnap();

	assert.ok(Math.abs(physics.position.x - 0.9499900000000001) < 1e-9);
	assert.ok(Math.abs(physics.position.y - 0) < 1e-9);
	assert.equal(physics.rotation, 0.5);
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

	physics.simulateMove(point(-0.2, 0.0));

	assert.equal(physics.currentTileId, 0n);
	assert.ok(Math.abs(physics.position.x - 0.05001) < 1e-9);
	assert.ok(Math.abs(physics.position.y - 0.30000000000000004) < 1e-9);
	assert.equal(physics.rotation, 0);
	assert.equal(physics.scale, 0.2);
});

test("handleMove preserves heading across the square short-edge seam", () => {
	const physics = createPhysics(planSquare);
	physics.position = point(0.06, 0.05);

	physics.simulateMove(point(-linearVelocity, 0));

	assert.equal(physics.currentTileId, 0n);
	assert.ok(Math.abs(physics.position.x - 0.9499986) < 1e-9);
	assert.ok(Math.abs(physics.position.y - 0.050001399999999994) < 1e-9);
	assert.ok(Math.abs(physics.rotation - -0.25) < 1e-9);
	assert.equal(physics.scale, 0.2);
});

test("handleMove wraps smoothly across the hex side seam", () => {
	const physics = createPhysics(planHex);
	physics.position = point(0.06, 0.1);

	physics.simulateMove(point(-linearVelocity, 0));

	assert.equal(physics.currentTileId, 0n);
	assert.ok(Math.abs(physics.position.x - 0.868398908170558) < 1e-9);
	assert.ok(Math.abs(physics.position.y - 0.050001279456296066) < 1e-9);
	assert.ok(Math.abs(physics.rotation - -0.16667070989350627) < 1e-9);
	assert.equal(physics.scale, 0.2);
});

test("isInsideTile accepts interior points and rejects exterior points", () => {
	const shape = point(0.5, 0.5);

	assert.equal(isInsideTile(point(0.5, 0.1), shape), true);
	assert.equal(isInsideTile(point(-0.1, 0.1), shape), false);
	assert.equal(isInsideTile(point(0.5, 0.6), shape), false);
});

test("simulateTurn preserves world-space points on the current tile", () => {
	const physics = createPhysics(planHex);
	const before = physics.getWorldPoint(point(1.0, 0.0));

	physics.simulateTurn(0.25);

	const after = physics.getWorldPoint(point(1.0, 0.0));
	assert.ok(Math.abs(after.x - before.x) < 1e-9);
	assert.ok(Math.abs(after.y - before.y) < 1e-9);
});

test("simulateSnap preserves world-space points across seam transport", () => {
	const physics = createPhysics(planSquare);
	physics.position = point(-0.02, 0.05);
	const before = physics.getWorldPoint(point(1.0, 0.0));

	physics.simulateSnap();

	const after = physics.getWorldPoint(point(1.0, 0.0));
	assert.ok(Math.abs(after.x - before.x) < 1e-9);
	assert.ok(Math.abs(after.y - before.y) < 1e-9);
});
