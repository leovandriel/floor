import assert from "node:assert/strict";
import test from "node:test";
import {
	getInsetEdge,
	getInwardNormal,
	reflect1X,
	reflectY,
	shiftPosition,
	shiftRotation,
	shiftScale,
	shiftShape,
	transitionDirection,
	transitionPosition,
	transitionRotation,
	transitionScale,
	unshiftPosition,
	unshiftRotation,
} from "../src/geometry";
import * as math from "../src/linalg";
import { point } from "../src/types";

function assertPointClose(
	actual: { x: number; y: number },
	expected: {
		x: number;
		y: number;
	},
): void {
	assert.ok(Math.abs(actual.x - expected.x) < 1e-9);
	assert.ok(Math.abs(actual.y - expected.y) < 1e-9);
}

test("transitionPosition maps tunnel side 1 into side 2 coordinates", () => {
	const transformed = transitionPosition(
		point(0.2, 0.3),
		{ shape: point(0.0, 1.0), index: 1 },
		{ shape: point(0.0, 1.0), index: 2 },
	);

	assert.ok(Math.abs(transformed.x - 0.9) < 1e-9);
	assert.ok(Math.abs(transformed.y - 0.5) < 1e-9);
});

test("transitionRotation maps tunnel side 1 into side 2 with the expected turn", () => {
	assert.ok(
		Math.abs(
			transitionRotation(
				{ shape: point(0.0, 1.0), index: 1 },
				{ shape: point(0.0, 1.0), index: 2 },
			) + 0.125,
		) < 1e-9,
	);
});

test("transitionScale maps tunnel side 1 into side 2 with the expected ratio", () => {
	assert.ok(
		Math.abs(
			transitionScale(
				{ shape: point(0.0, 1.0), index: 1 },
				{ shape: point(0.0, 1.0), index: 2 },
			) -
				1 / Math.sqrt(2),
		) < 1e-9,
	);
});

test("shiftRotation leaves offset 0 unchanged", () => {
	assert.ok(
		Math.abs(shiftRotation({ shape: point(0.0, 1.0), index: 0 })) < 1e-9,
	);
});

test("unshiftRotation inverts shiftRotation for offset 1", () => {
	const side = { shape: point(0.5, 0.5), index: 1 as const };
	const shifted = shiftRotation(side);
	const unshifted = unshiftRotation(side);
	assert.ok(Math.abs(shifted + unshifted) < 1e-9);
});

test("unshiftRotation inverts shiftRotation for offset 2", () => {
	const side = { shape: point(0.5, 0.866), index: 2 as const };
	const shifted = shiftRotation(side);
	const unshifted = unshiftRotation(side);
	assert.ok(Math.abs(shifted + unshifted) < 1e-9);
});

test("shiftPosition and unshiftPosition round-trip each side frame", () => {
	const position = point(0.3, 0.2);
	const sides = [
		{ shape: point(0.5, 0.5), index: 0 as const },
		{ shape: point(0.5, 0.5), index: 1 as const },
		{ shape: point(0.5, 0.5), index: 2 as const },
	];

	for (const side of sides) {
		assertPointClose(
			unshiftPosition(shiftPosition(position, side), side),
			position,
		);
	}
});

test("transitionDirection matches the transformed displacement across a seam", () => {
	const direction = point(0.0, 1.0);
	const from = { shape: point(0.0, 1.0), index: 1 as const };
	const to = { shape: point(0.0, 1.0), index: 2 as const };
	const start = point(0.2, 0.3);
	const delta = 1e-6;
	const transformed = transitionDirection(direction, from, to);
	const displaced = transitionPosition(
		point(start.x + direction.x * delta, start.y + direction.y * delta),
		from,
		to,
	);
	const transformedStart = transitionPosition(start, from, to);

	assert.ok(
		Math.abs(transformed.x - (displaced.x - transformedStart.x) / delta) < 1e-6,
	);
	assert.ok(
		Math.abs(transformed.y - (displaced.y - transformedStart.y) / delta) < 1e-6,
	);
});

test("transitionScale is the ratio of shifted scales", () => {
	const from = { shape: point(0.5, 0.5), index: 1 as const };
	const to = { shape: point(0.5, 0.5), index: 2 as const };

	assert.ok(
		Math.abs(transitionScale(from, to) - shiftScale(from) / shiftScale(to)) <
			1e-9,
	);
});

test("shiftShape returns the expected seam-relative shapes", () => {
	assertPointClose(shiftShape(point(0.5, 0.5), 0), point(0.5, 0.5));
	assertPointClose(shiftShape(point(0.5, 0.5), 1), point(0.0, 1.0));
	assertPointClose(shiftShape(point(0.5, 0.5), 2), point(1.0, 1.0));
});

test("transitionRotation adds the seam flip on top of shift and unshift", () => {
	const from = { shape: point(0.5, 0.5), index: 1 as const };
	const to = { shape: point(0.5, 0.5), index: 2 as const };

	assert.ok(
		Math.abs(
			transitionRotation(from, to) -
				(shiftRotation(from) + unshiftRotation(to) + 0.5),
		) < 1e-9,
	);
});

test("getInwardNormal points into the tile interior", () => {
	const sideStart = point(1.0, 0.0);
	const sideEnd = point(0.0, 0.0);
	const inwardNormal = getInwardNormal(sideStart, sideEnd);

	assert.ok(math.dot(inwardNormal, point(0.5, 0.5)) > 0);
	assert.ok(Math.abs(Math.sqrt(math.lengthSq(inwardNormal)) - 1.0) < 1e-9);
});

test("getInsetEdge moves an edge inward by the requested distance", () => {
	const insetEdge = getInsetEdge(point(1.0, 0.0), point(0.0, 0.0), 0.1);

	assertPointClose(insetEdge.start, point(1.0, 0.1));
	assertPointClose(insetEdge.end, point(0.0, 0.1));
});

test("reflect helpers mirror the expected axis", () => {
	assert.deepEqual(reflect1X(point(0.2, 0.3)), point(0.8, 0.3));
	assert.deepEqual(reflectY(point(0.2, 0.3)), point(0.2, -0.3));
});
