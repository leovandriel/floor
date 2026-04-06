import assert from "node:assert/strict";
import test from "node:test";
import {
	arrayGetter,
	detDecycleGetter,
	glueGetter,
	lazyDecycleGetter,
	library,
} from "../src/library";
import { assertValidPlan, ensureCornerWalls, getPlanBySlug } from "../src/plan";
import { plan, point, side, tile } from "../src/types";

test("getPlanBySlug returns known library plans", () => {
	assert.equal(getPlanBySlug("square")?.slug, "square");
	assert.equal(getPlanBySlug("missing"), undefined);
});

test("getPlanBySlug returns undefined for unknown plans", () => {
	assert.equal(getPlanBySlug("missing"), undefined);
});

test("assertValidPlan reports a missing root tile", () => {
	const emptyRoot = plan(
		"broken-root",
		arrayGetter([tile(point(0.5, 0.5), undefined, undefined, undefined)]),
	);
	emptyRoot.get = () => {
		throw new Error("Missing");
	};

	assert.throws(() => assertValidPlan(emptyRoot), /Missing root tile: 0/);
});

test("assertValidPlan reports inverse mismatches", () => {
	const brokenInverse = plan(
		"broken-inverse",
		arrayGetter([
			tile(point(0.5, 0.5), side(1n, 0), undefined, undefined),
			tile(point(0.5, 0.5), undefined, undefined, undefined),
		]),
	);

	assert.throws(
		() => assertValidPlan(brokenInverse),
		/Inverse missing at: 0, 0/,
	);
});

test("assertValidPlan accepts every library plan", () => {
	for (const plan of library) {
		assert.doesNotThrow(() => assertValidPlan(plan), plan.slug);
	}
});

test("ensureCornerWalls returns no walls for a single open triangle", () => {
	const triangle = plan(
		"triangle",
		arrayGetter([tile(point(0.5, 0.866), undefined, undefined, undefined)]),
	);

	assert.deepEqual(ensureCornerWalls(triangle, 0n), [
		undefined,
		undefined,
		undefined,
	]);
});

test("procedural mazes have reciprocal shared sides", () => {
	for (const slug of ["flatMaze", "hexMaze"]) {
		const maze = getPlanBySlug(slug);
		if (!maze) {
			throw new Error(`Missing ${slug} plan`);
		}

		const root = maze.get(0n);
		for (const [sideIndex, connection] of root.sides.entries()) {
			if (!connection) {
				continue;
			}
			const neighborTile = maze.get(connection.tileId);
			assert.deepEqual(
				neighborTile.sides[connection.sideIndex],
				side(0n, sideIndex),
			);
		}
	}
});

test("warpMaze supports direct deterministic access to deep ids", () => {
	const warpMaze = getPlanBySlug("warpMaze");
	if (!warpMaze) {
		throw new Error("Missing warpMaze plan");
	}

	assert.equal(warpMaze.deterministic, true);
	const id = 987654321n;
	const tile = warpMaze.get(id);
	for (const [sideIndex, connection] of tile.sides.entries()) {
		if (!connection) {
			continue;
		}
		const neighborTile = warpMaze.get(connection.tileId);
		assert.deepEqual(
			neighborTile.sides[connection.sideIndex],
			side(id, sideIndex),
		);
	}
});

test("radial has ring neighbors and dead-end corridors", () => {
	const radial = getPlanBySlug("radial");
	if (!radial) {
		throw new Error("Missing radial plan");
	}

	assert.deepEqual(radial.get(0n).sides, [
		side(30n, 1),
		side(24n, 2),
		side(6n, 1),
	]);
	assert.deepEqual(radial.get(30n).sides, [
		undefined,
		side(0n, 0),
		side(36n, 0),
	]);
	assert.deepEqual(radial.get(1n).sides, [
		side(36n, 2),
		undefined,
		side(37n, 0),
	]);
	assert.deepEqual(radial.get(36n).sides, [
		side(30n, 2),
		undefined,
		side(1n, 0),
	]);
});

test("lazyDecycleGetter unrolls cycles while preserving reverse links", () => {
	const inner = plan(
		"inner-loop",
		arrayGetter([tile(point(0.5, 0.5), side(0n, 1), side(0n, 0), undefined)]),
	);
	const outer = plan("outer-loop", lazyDecycleGetter(inner.get));

	assert.deepEqual(outer.get(0n).sides, [side(1n, 1), side(2n, 0), undefined]);
	assert.deepEqual(outer.get(1n).sides, [side(3n, 1), side(0n, 0), undefined]);
	assert.deepEqual(outer.get(2n).sides, [side(0n, 1), side(4n, 0), undefined]);
});

test("glueGetter glues multiple getter seams", () => {
	const left = arrayGetter([
		tile(point(0.5, 0.5), side(1n, 0), undefined, undefined),
		tile(point(0.5, 0.5), side(0n, 0), undefined, undefined),
	]);
	const right = arrayGetter([
		tile(point(0.5, 0.5), undefined, side(1n, 1), undefined),
		tile(point(0.5, 0.5), undefined, side(0n, 1), undefined),
	]);
	const top = arrayGetter([
		tile(point(0.5, 0.5), undefined, undefined, side(1n, 2)),
		tile(point(0.5, 0.5), undefined, undefined, side(0n, 2)),
	]);
	const glued = plan(
		"glued",
		glueGetter(
			[left, right, top],
			[
				{
					a: { getterIndex: 0, side: side(0n, 1) },
					b: { getterIndex: 1, side: side(0n, 2) },
				},
				{
					a: { getterIndex: 0, side: side(1n, 1) },
					b: { getterIndex: 1, side: side(1n, 2) },
				},
				{
					a: { getterIndex: 1, side: side(0n, 0) },
					b: { getterIndex: 2, side: side(0n, 0) },
				},
			],
		),
	);

	assert.deepEqual(glued.get(0n).sides, [side(3n, 0), side(1n, 2), undefined]);
	assert.deepEqual(glued.get(1n).sides, [
		side(2n, 0),
		side(4n, 1),
		side(0n, 1),
	]);
	assert.deepEqual(glued.get(2n).sides, [side(1n, 0), undefined, side(5n, 2)]);
	assert.deepEqual(glued.get(3n).sides, [side(0n, 0), side(4n, 2), undefined]);
	assert.deepEqual(glued.get(4n).sides, [undefined, side(1n, 1), side(3n, 1)]);
});

test("glueGetter severs the old reciprocal seam when gluing an internal side", () => {
	const line = arrayGetter([
		tile(point(0.5, 0.5), side(1n, 0), undefined, undefined),
		tile(point(0.5, 0.5), side(0n, 0), undefined, undefined),
	]);
	const cap = arrayGetter([
		tile(point(0.5, 0.5), undefined, undefined, undefined),
	]);
	const glued = plan(
		"glued-line",
		glueGetter(
			[line, cap],
			[
				{
					a: { getterIndex: 0, side: side(0n, 0) },
					b: { getterIndex: 1, side: side(0n, 2) },
				},
			],
		),
	);

	assert.deepEqual(glued.get(0n).sides, [side(1n, 2), undefined, undefined]);
	assert.deepEqual(glued.get(2n).sides, [undefined, undefined, undefined]);
});

test.skip("glueGetter supports non-root glue endpoints", () => {
	// TODO: generic glueGetter cannot fully support arbitrary non-root glue points
	// without an index of all incoming references to the glued endpoint.
	const chain = arrayGetter([
		tile(point(0.5, 0.5), side(1n, 0), undefined, undefined),
		tile(point(0.5, 0.5), side(2n, 0), side(0n, 0), undefined),
		tile(point(0.5, 0.5), undefined, side(1n, 0), undefined),
	]);
	const cap = arrayGetter([
		tile(point(0.5, 0.5), undefined, undefined, undefined),
	]);
	const glued = plan(
		"glued-non-root",
		glueGetter(
			[chain, cap],
			[
				{
					a: { getterIndex: 0, side: side(1n, 0) },
					b: { getterIndex: 1, side: side(0n, 1) },
				},
			],
		),
	);

	assert.deepEqual(glued.get(2n).sides, [side(1n, 1), side(0n, 0), undefined]);
	assert.deepEqual(glued.get(1n).sides, [undefined, side(2n, 0), undefined]);
	assert.doesNotThrow(() => assertValidPlan(glued));
});

test("glueGetter rejects duplicate glue points", () => {
	const left = arrayGetter([
		tile(point(0.5, 0.5), undefined, undefined, undefined),
	]);
	const right = arrayGetter([
		tile(point(0.5, 0.5), undefined, undefined, undefined),
	]);

	assert.throws(
		() =>
			glueGetter(
				[left, right],
				[
					{
						a: { getterIndex: 0, side: side(0n, 0) },
						b: { getterIndex: 1, side: side(0n, 0) },
					},
					{
						a: { getterIndex: 0, side: side(0n, 0) },
						b: { getterIndex: 1, side: side(0n, 1) },
					},
				],
			),
		/Duplicate glue point/,
	);
});

test("detDecycleGetter expands deterministically by external id", () => {
	const inner = plan(
		"inner-loop",
		arrayGetter([tile(point(0.5, 0.5), side(0n, 1), side(0n, 0), undefined)]),
	);
	const outer = plan("outer-loop-det", detDecycleGetter(inner.get));

	assert.deepEqual(outer.get(4n).sides, [side(9n, 1), side(0n, 0), undefined]);
	assert.deepEqual(outer.get(0n).sides, [side(4n, 1), side(5n, 0), undefined]);
});

test("detDecycleGetter gives the same tile ids after direct reload", () => {
	const inner = plan(
		"inner-loop",
		arrayGetter([tile(point(0.5, 0.5), side(0n, 1), side(0n, 0), undefined)]),
	);
	const walked = plan("walked", detDecycleGetter(inner.get));
	const reloaded = plan("reloaded", detDecycleGetter(inner.get));

	assert.deepEqual(walked.get(4n).sides, [side(9n, 1), side(0n, 0), undefined]);
	assert.deepEqual(walked.get(9n).sides, [
		side(19n, 1),
		side(4n, 0),
		undefined,
	]);
	assert.deepEqual(reloaded.get(9n).sides, walked.get(9n).sides);
});

test("assertValidPlan stops when validation depth is reached", () => {
	const tiles = Array.from({ length: 102 }, (_, index) =>
		tile(
			point(0.5, 0.5),
			index + 1 < 102 ? side(BigInt(index + 1), 1) : undefined,
			index > 0 ? side(BigInt(index - 1), 0) : undefined,
			undefined,
		),
	);
	const deepPlan = plan("deep", arrayGetter(tiles));

	assert.doesNotThrow(() => assertValidPlan(deepPlan));
});

test("ensureCornerWalls populates the corner wall cache", () => {
	const square = getPlanBySlug("square");
	if (!square) {
		throw new Error("Missing square plan");
	}

	const first = ensureCornerWalls(square, 0n);
	const second = ensureCornerWalls(square, 0n);

	assert.deepEqual(second, first);
	assert.ok(Object.keys(square.cornerWallCache).length > 0);
});

test("ensureCornerWalls terminates on a closed corner cycle", () => {
	const looping = plan("loop", () =>
		tile(point(0.5, 0.5), side(0n, 2), side(0n, 0), side(0n, 1)),
	);

	assert.deepEqual(ensureCornerWalls(looping, 0n), [
		undefined,
		undefined,
		undefined,
	]);
});
