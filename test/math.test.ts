import assert from "node:assert/strict";
import test from "node:test";

import * as math from "../src/math";
import { point } from "../src/types";

test("pointDistanceSq computes squared distance", () => {
	const a = point(0.0, 0.0);
	const b = point(3.0, 4.0);
	assert.equal(math.pointDistanceSq(a, b), 25);
});

test("interpolate returns midpoint at t=0.5", () => {
	const midpoint = math.interpolate(point(0.0, 0.0), point(2.0, 4.0), 0.5);
	assert.deepEqual(midpoint, point(1.0, 2.0));
});

test("segmentDistanceSq clamps past the end of the segment", () => {
	const distanceSq = math.segmentDistanceSq(
		point(0.0, 0.0),
		point(1.0, 0.0),
		point(3.0, 0.0),
	);
	assert.equal(distanceSq, 4);
});

test("intersectOrigin returns the intersection with a ray from the origin", () => {
	const intersection = math.intersectOrigin(
		point(1.0, 0.0),
		point(0.0, 1.0),
		point(1.0, 1.0),
	);
	assert.ok(Math.abs(intersection.x - 0.5) < math.epsilon);
	assert.ok(Math.abs(intersection.y - 0.5) < math.epsilon);
});

test("dotCross returns dot and cross together", () => {
	assert.deepEqual(
		math.dotCross(point(2.0, 3.0), point(4.0, 5.0)),
		point(23.0, -2.0),
	);
});

test("reflect helpers mirror the expected axis", () => {
	assert.deepEqual(math.reflect1X(point(0.2, 0.3)), point(0.8, 0.3));
	assert.deepEqual(math.reflectY(point(0.2, 0.3)), point(0.2, -0.3));
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

test("project projects one vector onto another", () => {
	assert.deepEqual(
		math.project(point(2.0, 0.0), point(1.0, 1.0)),
		point(1.0, 0.0),
	);
});

test("project3 projects a point onto a line through another point", () => {
	assert.deepEqual(
		math.project3(point(2.0, 0.0), point(1.0, 0.0), point(3.0, 1.0)),
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
