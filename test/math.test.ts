import assert from "node:assert/strict";
import test from "node:test";

import * as math from "../src/math";

test("pointDistanceSq computes squared distance", () => {
	const a = math.point(0, 0);
	const b = math.point(3, 4);
	assert.equal(math.pointDistanceSq(a, b), 25);
});

test("interpolate returns midpoint at t=0.5", () => {
	const midpoint = math.interpolate(math.point(0, 0), math.point(2, 4), 0.5);
	assert.deepEqual(midpoint, math.point(1, 2));
});

test("segmentDistanceSq clamps past the end of the segment", () => {
	const distanceSq = math.segmentDistanceSq(
		math.point(0, 0),
		math.point(1, 0),
		math.point(3, 0),
	);
	assert.equal(distanceSq, 4);
});

test("intersectOrigin returns the intersection with a ray from the origin", () => {
	const intersection = math.intersectOrigin(
		math.point(1, 0),
		math.point(0, 1),
		math.point(1, 1),
	);
	assert.ok(Math.abs(intersection.x - 0.5) < math.epsilon);
	assert.ok(Math.abs(intersection.y - 0.5) < math.epsilon);
});
