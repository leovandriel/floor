import assert from "node:assert/strict";
import test from "node:test";
import {
	applyTransformPoint,
	applyTransformVector,
	getCellBounds,
	getCellVertices,
	getFaceSegment,
	getInsetEdge,
	getInwardNormal,
	getSeamTransform,
	pointAngle,
	projectBranchTriangles,
	projectPoint,
	projectSeamTriangle,
	projectTriangle,
	projectVertexOffset,
	projectViewTriangle,
	reflect1X,
	reflectY,
	seamShape,
	shiftSeam,
	transitionDirection,
	transitionPosition,
	transitionRotation,
	transitionScale,
	unshiftSeam,
} from "../src/geometry";
import * as math from "../src/linalg";
import { point, segment } from "../src/types";

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

function wrappedAngleDiff(a: number, b: number): number {
	return a - b - Math.round(a - b);
}

test("transitionPosition maps tunnel face 1 into face 2 coordinates", () => {
	const transformed = transitionPosition(
		point(0.2, 0.3),
		{ shape: point(0.0, 1.0), index: 1 },
		{ shape: point(0.0, 1.0), index: 2 },
	);

	assert.ok(Math.abs(transformed.x - 0.9) < 1e-9);
	assert.ok(Math.abs(transformed.y - 0.5) < 1e-9);
});

test("transitionRotation maps tunnel face 1 into face 2 with the expected turn", () => {
	assert.ok(
		Math.abs(
			transitionRotation(
				{ shape: point(0.0, 1.0), index: 1 },
				{ shape: point(0.0, 1.0), index: 2 },
			) + 0.125,
		) < 1e-9,
	);
});

test("transitionScale maps tunnel face 1 into face 2 with the expected ratio", () => {
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

test("shiftSeam and unshiftSeam round-trip each face frame", () => {
	const position = point(0.3, 0.2);
	const faces = [
		{ shape: point(0.5, 0.5), index: 0 as const },
		{ shape: point(0.5, 0.5), index: 1 as const },
		{ shape: point(0.5, 0.5), index: 2 as const },
	];

	for (const face of faces) {
		assertPointClose(unshiftSeam(shiftSeam(position, face), face), position);
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

test("getSeamTransform reproduces point and vector transitions", () => {
	const from = { shape: point(0.5, 0.5), index: 1 as const };
	const to = { shape: point(0.0, 1.0), index: 2 as const };
	const transform = getSeamTransform(from, to);
	const position = point(0.2, 0.3);
	const direction = point(-0.1, 0.4);

	assertPointClose(
		applyTransformPoint(transform, position),
		transitionPosition(position, from, to),
	);
	assertPointClose(
		applyTransformVector(transform, direction),
		transitionDirection(direction, from, to),
	);
	assertPointClose(
		applyTransformPoint(
			getSeamTransform(to, from),
			transitionPosition(position, from, to),
		),
		position,
	);
	assertPointClose(
		applyTransformVector(
			getSeamTransform(to, from),
			transitionDirection(direction, from, to),
		),
		direction,
	);
});

test("transition scale and rotation come from the reverse seam transform", () => {
	const from = { shape: point(0.0, 1.0), index: 1 as const };
	const to = { shape: point(0.5, 0.5), index: 2 as const };
	const reverseXAxis = applyTransformVector(
		getSeamTransform(to, from),
		point(1.0, 0.0),
	);

	assert.ok(
		Math.abs(
			Math.sqrt(math.lengthSq(reverseXAxis)) - transitionScale(from, to),
		) < 1e-9,
	);
	assert.ok(
		Math.abs(
			wrappedAngleDiff(pointAngle(reverseXAxis), transitionRotation(from, to)),
		) < 1e-9,
	);
});

test("getCellVertices returns the canonical triangle vertices", () => {
	assert.deepEqual(getCellVertices(point(0.5, 0.5)), [
		point(0.0, 0.0),
		point(0.5, 0.5),
		point(1.0, 0.0),
	]);
});

test("getCellBounds returns the horizontal span at a given height", () => {
	assert.deepEqual(getCellBounds(point(0.5, 0.5), 0.0), [0.0, 1.0]);
	assert.deepEqual(getCellBounds(point(0.5, 0.5), 0.25), [0.25, 0.75]);
	assert.deepEqual(getCellBounds(point(0.5, 0.5), 0.5), [0.5, 0.5]);
});

test("getFaceSegment returns the face endpoints for each triangle face", () => {
	const vertices = getCellVertices(point(0.5, 0.5));
	assert.deepEqual(
		getFaceSegment(vertices, 0),
		segment(vertices[2], vertices[0]),
	);
	assert.deepEqual(
		getFaceSegment(vertices, 1),
		segment(vertices[0], vertices[1]),
	);
	assert.deepEqual(
		getFaceSegment(vertices, 2),
		segment(vertices[1], vertices[2]),
	);
});

test("seamShape returns the expected seam-relative shapes", () => {
	assertPointClose(seamShape(point(0.5, 0.5), 0), point(0.5, 0.5));
	assertPointClose(seamShape(point(0.5, 0.5), 1), point(0.0, 1.0));
	assertPointClose(seamShape(point(0.5, 0.5), 2), point(1.0, 1.0));
});

test("projectTriangle and projectSeamTriangle build the expected triangle", () => {
	const edge = { start: point(0.0, 0.0), end: point(1.0, 0.0) };

	assert.deepEqual(projectPoint(edge, point(0.5, 0.5)), point(0.5, 0.5));
	assert.deepEqual(projectTriangle(edge, point(0.5, 0.5)), [
		point(0.0, 0.0),
		point(0.5, 0.5),
		point(1.0, 0.0),
	]);
	assert.deepEqual(projectSeamTriangle(edge, point(0.5, 0.5), 1), [
		point(0.0, 0.0),
		point(0.0, 1.0),
		point(1.0, 0.0),
	]);
	assert.deepEqual(
		projectVertexOffset(edge, point(0.5, 0.5), point(0.0, 0.25)),
		point(0.5, 0.75),
	);
});

test("projectViewTriangle builds the current screen-space triangle frame", () => {
	assert.deepEqual(
		projectViewTriangle(point(0.5, 0.5), point(0.0, 0.0), 0.0, 1.0),
		[point(0.0, 0.0), point(-0.5, -0.5), point(-1.0, 0.0)],
	);
});

test("projectBranchTriangles projects matching screen and world seam triangles", () => {
	assert.deepEqual(
		projectBranchTriangles(
			segment(point(0.0, 0.0), point(1.0, 0.0)),
			segment(point(2.0, 0.0), point(4.0, 0.0)),
			point(0.5, 0.5),
			1,
		),
		[
			[point(0.0, 0.0), point(0.0, 1.0), point(1.0, 0.0)],
			[point(2.0, 0.0), point(2.0, 2.0), point(4.0, 0.0)],
		],
	);
});

test("getInwardNormal points into the cell interior", () => {
	const faceStart = point(1.0, 0.0);
	const faceEnd = point(0.0, 0.0);
	const inwardNormal = getInwardNormal(faceStart, faceEnd);

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
