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
