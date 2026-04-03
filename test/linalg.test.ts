import assert from "node:assert/strict";
import test from "node:test";

import * as math from "../src/linalg";
import { point } from "../src/types";

const epsilon = 1e-5;

test("lengthSq and sub compute squared distance", () => {
	const a = point(0.0, 0.0);
	const b = point(3.0, 4.0);
	assert.equal(math.lengthSq(math.sub(a, b)), 25);
});

test("interpolate returns midpoint at t=0.5", () => {
	const midpoint = math.interpolate(point(0.0, 0.0), point(2.0, 4.0), 0.5);
	assert.deepEqual(midpoint, point(1.0, 2.0));
});

test("intersect and interpolate find the intersection with a ray from the origin", () => {
	const { x: linePosition } = math.intersect(
		point(1.0, 0.0),
		point(0.0, 1.0),
		point(0.0, 0.0),
		point(1.0, 1.0),
	);
	const intersection = math.interpolate(
		point(1.0, 0.0),
		point(0.0, 1.0),
		linePosition,
	);
	assert.ok(Math.abs(intersection.x - 0.5) < epsilon);
	assert.ok(Math.abs(intersection.y - 0.5) < epsilon);
});

test("rotate helpers are inverse quarter turns", () => {
	const vector = point(2.0, 3.0);

	assert.deepEqual(math.rotateLeft(vector), point(-3.0, 2.0));
	assert.deepEqual(math.rotateRight(vector), point(3.0, -2.0));
	assert.deepEqual(math.rotateRight(math.rotateLeft(vector)), vector);
});

test("lineDistanceSq computes squared distance to an infinite line", () => {
	const distanceSq = math.lineDistanceSq(
		point(0.0, 0.0),
		point(1.0, 0.0),
		point(0.0, 2.0),
	);

	assert.equal(distanceSq, 4);
});

test("projectOffset projects a point onto a line through another point", () => {
	assert.deepEqual(
		math.projectOffset(point(2.0, 0.0), point(1.0, 0.0), point(3.0, 1.0)),
		point(2.0, 0.0),
	);
});

test("intersect returns the line parameters at the crossing point", () => {
	assert.deepEqual(
		math.intersect(
			point(0.0, 0.0),
			point(1.0, 1.0),
			point(0.0, 1.0),
			point(1.0, 0.0),
		),
		point(0.5, 0.5),
	);
});
