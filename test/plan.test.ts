import assert from "node:assert/strict";
import test from "node:test";
import {
	arrayGetter,
	detDecycleGetter,
	glueGetter,
	lazyDecycleGetter,
	library,
} from "../src/library";
import { assertValidPlan, ensureVertexWalls, getPlanBySlug } from "../src/plan";
import { cell, face, plan, point } from "../src/types";

test("getPlanBySlug returns known library plans", () => {
	assert.equal(getPlanBySlug("square")?.slug, "square");
	assert.equal(getPlanBySlug("missing"), undefined);
});

test("getPlanBySlug returns undefined for unknown plans", () => {
	assert.equal(getPlanBySlug("missing"), undefined);
});

test("assertValidPlan reports a missing root cell", () => {
	const emptyRoot = plan(
		"broken-root",
		arrayGetter([cell(point(0.5, 0.5), undefined, undefined, undefined)]),
	);
	emptyRoot.get = () => {
		throw new Error("Missing");
	};

	assert.throws(() => assertValidPlan(emptyRoot), /Missing root cell: 0/);
});

test("assertValidPlan reports inverse mismatches", () => {
	const brokenInverse = plan(
		"broken-inverse",
		arrayGetter([
			cell(point(0.5, 0.5), face(1n, 0), undefined, undefined),
			cell(point(0.5, 0.5), undefined, undefined, undefined),
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

test("ensureVertexWalls returns no walls for a single open triangle", () => {
	const triangle = plan(
		"triangle",
		arrayGetter([cell(point(0.5, 0.866), undefined, undefined, undefined)]),
	);

	assert.deepEqual(ensureVertexWalls(triangle, 0n), [
		undefined,
		undefined,
		undefined,
	]);
});

test("procedural mazes have reciprocal shared faces", () => {
	for (const slug of ["flatMaze", "hexMaze"]) {
		const maze = getPlanBySlug(slug);
		if (!maze) {
			throw new Error(`Missing ${slug} plan`);
		}

		const root = maze.get(0n);
		for (const [faceIndex, connection] of root.faces.entries()) {
			if (!connection) {
				continue;
			}
			const neighborCell = maze.get(connection.cellId);
			assert.deepEqual(
				neighborCell.faces[connection.faceIndex],
				face(0n, faceIndex),
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
	const cell = warpMaze.get(id);
	for (const [faceIndex, connection] of cell.faces.entries()) {
		if (!connection) {
			continue;
		}
		const neighborCell = warpMaze.get(connection.cellId);
		assert.deepEqual(
			neighborCell.faces[connection.faceIndex],
			face(id, faceIndex),
		);
	}
});

test("radial has ring neighbors and dead-end corridors", () => {
	const radial = getPlanBySlug("radial");
	if (!radial) {
		throw new Error("Missing radial plan");
	}

	assert.deepEqual(radial.get(0n).faces, [
		face(30n, 1),
		face(24n, 2),
		face(6n, 1),
	]);
	assert.deepEqual(radial.get(30n).faces, [
		undefined,
		face(0n, 0),
		face(36n, 0),
	]);
	assert.deepEqual(radial.get(1n).faces, [
		face(36n, 2),
		undefined,
		face(37n, 0),
	]);
	assert.deepEqual(radial.get(36n).faces, [
		face(30n, 2),
		undefined,
		face(1n, 0),
	]);
});

test("lazyDecycleGetter unrolls cycles while preserving reverse links", () => {
	const inner = plan(
		"inner-loop",
		arrayGetter([cell(point(0.5, 0.5), face(0n, 1), face(0n, 0), undefined)]),
	);
	const outer = plan("outer-loop", lazyDecycleGetter(inner.get));

	assert.deepEqual(outer.get(0n).faces, [face(1n, 1), face(2n, 0), undefined]);
	assert.deepEqual(outer.get(1n).faces, [face(3n, 1), face(0n, 0), undefined]);
	assert.deepEqual(outer.get(2n).faces, [face(0n, 1), face(4n, 0), undefined]);
});

test("glueGetter glues multiple getter seams", () => {
	const left = arrayGetter([
		cell(point(0.5, 0.5), face(1n, 0), undefined, undefined),
		cell(point(0.5, 0.5), face(0n, 0), undefined, undefined),
	]);
	const right = arrayGetter([
		cell(point(0.5, 0.5), undefined, face(1n, 1), undefined),
		cell(point(0.5, 0.5), undefined, face(0n, 1), undefined),
	]);
	const top = arrayGetter([
		cell(point(0.5, 0.5), undefined, undefined, face(1n, 2)),
		cell(point(0.5, 0.5), undefined, undefined, face(0n, 2)),
	]);
	const glued = plan(
		"glued",
		glueGetter(
			[left, right, top],
			[
				{
					a: { getterIndex: 0, face: face(0n, 1) },
					b: { getterIndex: 1, face: face(0n, 2) },
				},
				{
					a: { getterIndex: 0, face: face(1n, 1) },
					b: { getterIndex: 1, face: face(1n, 2) },
				},
				{
					a: { getterIndex: 1, face: face(0n, 0) },
					b: { getterIndex: 2, face: face(0n, 0) },
				},
			],
		),
	);

	assert.deepEqual(glued.get(0n).faces, [face(3n, 0), face(1n, 2), undefined]);
	assert.deepEqual(glued.get(1n).faces, [
		face(2n, 0),
		face(4n, 1),
		face(0n, 1),
	]);
	assert.deepEqual(glued.get(2n).faces, [face(1n, 0), undefined, face(5n, 2)]);
	assert.deepEqual(glued.get(3n).faces, [face(0n, 0), face(4n, 2), undefined]);
	assert.deepEqual(glued.get(4n).faces, [undefined, face(1n, 1), face(3n, 1)]);
});

test("glueGetter severs the old reciprocal seam when gluing an internal face", () => {
	const line = arrayGetter([
		cell(point(0.5, 0.5), face(1n, 0), undefined, undefined),
		cell(point(0.5, 0.5), face(0n, 0), undefined, undefined),
	]);
	const cap = arrayGetter([
		cell(point(0.5, 0.5), undefined, undefined, undefined),
	]);
	const glued = plan(
		"glued-line",
		glueGetter(
			[line, cap],
			[
				{
					a: { getterIndex: 0, face: face(0n, 0) },
					b: { getterIndex: 1, face: face(0n, 2) },
				},
			],
		),
	);

	assert.deepEqual(glued.get(0n).faces, [face(1n, 2), undefined, undefined]);
	assert.deepEqual(glued.get(2n).faces, [undefined, undefined, undefined]);
});

test.skip("glueGetter supports non-root glue endpoints", () => {
	// TODO: generic glueGetter cannot fully support arbitrary non-root glue points
	// without an index of all incoming references to the glued endpoint.
	const chain = arrayGetter([
		cell(point(0.5, 0.5), face(1n, 0), undefined, undefined),
		cell(point(0.5, 0.5), face(2n, 0), face(0n, 0), undefined),
		cell(point(0.5, 0.5), undefined, face(1n, 0), undefined),
	]);
	const cap = arrayGetter([
		cell(point(0.5, 0.5), undefined, undefined, undefined),
	]);
	const glued = plan(
		"glued-non-root",
		glueGetter(
			[chain, cap],
			[
				{
					a: { getterIndex: 0, face: face(1n, 0) },
					b: { getterIndex: 1, face: face(0n, 1) },
				},
			],
		),
	);

	assert.deepEqual(glued.get(2n).faces, [face(1n, 1), face(0n, 0), undefined]);
	assert.deepEqual(glued.get(1n).faces, [undefined, face(2n, 0), undefined]);
	assert.doesNotThrow(() => assertValidPlan(glued));
});

test("glueGetter rejects duplicate glue points", () => {
	const left = arrayGetter([
		cell(point(0.5, 0.5), undefined, undefined, undefined),
	]);
	const right = arrayGetter([
		cell(point(0.5, 0.5), undefined, undefined, undefined),
	]);

	assert.throws(
		() =>
			glueGetter(
				[left, right],
				[
					{
						a: { getterIndex: 0, face: face(0n, 0) },
						b: { getterIndex: 1, face: face(0n, 0) },
					},
					{
						a: { getterIndex: 0, face: face(0n, 0) },
						b: { getterIndex: 1, face: face(0n, 1) },
					},
				],
			),
		/Duplicate glue point/,
	);
});

test("detDecycleGetter expands deterministically by external id", () => {
	const inner = plan(
		"inner-loop",
		arrayGetter([cell(point(0.5, 0.5), face(0n, 1), face(0n, 0), undefined)]),
	);
	const outer = plan("outer-loop-det", detDecycleGetter(inner.get));

	assert.deepEqual(outer.get(4n).faces, [face(9n, 1), face(0n, 0), undefined]);
	assert.deepEqual(outer.get(0n).faces, [face(4n, 1), face(5n, 0), undefined]);
});

test("detDecycleGetter gives the same cell ids after direct reload", () => {
	const inner = plan(
		"inner-loop",
		arrayGetter([cell(point(0.5, 0.5), face(0n, 1), face(0n, 0), undefined)]),
	);
	const walked = plan("walked", detDecycleGetter(inner.get));
	const reloaded = plan("reloaded", detDecycleGetter(inner.get));

	assert.deepEqual(walked.get(4n).faces, [face(9n, 1), face(0n, 0), undefined]);
	assert.deepEqual(walked.get(9n).faces, [
		face(19n, 1),
		face(4n, 0),
		undefined,
	]);
	assert.deepEqual(reloaded.get(9n).faces, walked.get(9n).faces);
});

test("assertValidPlan stops when validation depth is reached", () => {
	const cells = Array.from({ length: 102 }, (_, index) =>
		cell(
			point(0.5, 0.5),
			index + 1 < 102 ? face(BigInt(index + 1), 1) : undefined,
			index > 0 ? face(BigInt(index - 1), 0) : undefined,
			undefined,
		),
	);
	const deepPlan = plan("deep", arrayGetter(cells));

	assert.doesNotThrow(() => assertValidPlan(deepPlan));
});

test("ensureVertexWalls populates the vertex wall cache", () => {
	const square = getPlanBySlug("square");
	if (!square) {
		throw new Error("Missing square plan");
	}

	const first = ensureVertexWalls(square, 0n);
	const second = ensureVertexWalls(square, 0n);

	assert.deepEqual(second, first);
	assert.equal(square.vertexWallCache.has([0n, 0, 1]), true);
});

test("ensureVertexWalls terminates on a closed vertex cycle", () => {
	const looping = plan("loop", () =>
		cell(point(0.5, 0.5), face(0n, 2), face(0n, 0), face(0n, 1)),
	);

	assert.deepEqual(ensureVertexWalls(looping, 0n), [
		undefined,
		undefined,
		undefined,
	]);
});
