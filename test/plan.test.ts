import assert from "node:assert/strict";
import test from "node:test";
import { arrayPlan } from "../src/library";
import {
	checkPlan,
	ensureCornerWalls,
	getPlanBySlug,
	getValidPlan,
} from "../src/plan";
import { plan, point, side, tile } from "../src/types";

test("getPlanBySlug returns known library plans", () => {
	assert.equal(getPlanBySlug("square")?.slug, "square");
	assert.equal(getPlanBySlug("missing"), undefined);
});

test("getValidPlan returns undefined for unknown plans", () => {
	assert.equal(getValidPlan("missing"), undefined);
});

test("checkPlan reports a missing root tile", () => {
	const emptyRoot = arrayPlan("broken-root", [
		tile(point(0.5, 0.5), undefined, undefined, undefined),
	]);
	emptyRoot.get = () => {
		throw new Error("Missing");
	};

	assert.throws(() => checkPlan(emptyRoot), /Missing root tile: 0/);
});

test("checkPlan reports inverse mismatches", () => {
	const brokenInverse = arrayPlan("broken-inverse", [
		tile(point(0.5, 0.5), side(1, 0), undefined, undefined),
		tile(point(0.5, 0.5), undefined, undefined, undefined),
	]);

	assert.throws(() => checkPlan(brokenInverse), /Inverse missing at: 0, 0/);
});

test("checkPlan accepts a valid library plan", () => {
	const square = getPlanBySlug("square");
	if (!square) {
		throw new Error("Missing square plan");
	}
	assert.doesNotThrow(() => checkPlan(square));
});

test("getValidPlan accepts the infinite maze", () => {
	assert.equal(getValidPlan("maze"), getPlanBySlug("maze"));
});

test("ensureCornerWalls returns no walls for a single open triangle", () => {
	const triangle = arrayPlan("triangle", [
		tile(point(0.5, 0.866), undefined, undefined, undefined),
	]);

	assert.deepEqual(ensureCornerWalls(triangle, 0), [
		undefined,
		undefined,
		undefined,
	]);
});

test("procedural mazes have reciprocal shared sides", () => {
	for (const slug of ["maze", "hexMaze"]) {
		const maze = getPlanBySlug(slug);
		if (!maze) {
			throw new Error(`Missing ${slug} plan`);
		}

		const root = maze.get(0);
		for (const [sideIndex, connection] of root.sides.entries()) {
			if (!connection) {
				continue;
			}
			const neighborTile = maze.get(connection.tileId);
			assert.deepEqual(
				neighborTile.sides[connection.neighbor],
				side(0, sideIndex),
			);
		}
	}
});

test("checkPlan stops when validation depth is reached", () => {
	const tiles = Array.from({ length: 102 }, (_, index) =>
		tile(
			point(0.5, 0.5),
			index + 1 < 102 ? side(index + 1, 1) : undefined,
			index > 0 ? side(index - 1, 0) : undefined,
			undefined,
		),
	);
	const deepPlan = arrayPlan("deep", tiles);

	assert.doesNotThrow(() => checkPlan(deepPlan));
});

test("ensureCornerWalls populates the corner wall cache", () => {
	const square = getPlanBySlug("square");
	if (!square) {
		throw new Error("Missing square plan");
	}

	const first = ensureCornerWalls(square, 0);
	const second = ensureCornerWalls(square, 0);

	assert.deepEqual(second, first);
	assert.ok(Object.keys(square.cornerWallCache).length > 0);
});

test("ensureCornerWalls terminates on a closed corner cycle", () => {
	const looping = plan("loop", () =>
		tile(point(0.5, 0.5), side(0, 2), side(0, 0), side(0, 1)),
	);

	assert.deepEqual(ensureCornerWalls(looping, 0), [
		undefined,
		undefined,
		undefined,
	]);
});

test("ensureCornerWalls throws when recursion exceeds the depth limit", () => {
	const deepCorner = plan("deep-corner", (id) =>
		tile(point(0.5, 0.5), side(id + 1, 1), undefined, undefined),
	);

	assert.throws(
		() => ensureCornerWalls(deepCorner, 0),
		/Corner wall recursion limit reached/,
	);
});
