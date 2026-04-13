import assert from "node:assert/strict";
import test from "node:test";
import { arrayGetter } from "../src/library";
import { cell, face, plan, point } from "../src/types";

test("face rejects negative ids and neighbors", () => {
	assert.throws(() => face(-1n, 0), /Invalid face cellId/);
	assert.throws(() => face(0n, -1), /Invalid face faceIndex/);
});

test("cell rejects non-positive heights", () => {
	assert.throws(
		() => cell(point(0.5, 0.0), undefined, undefined, undefined),
		/Cell shape y must be positive/,
	);
});

test("plan rejects an empty slug", () => {
	assert.throws(
		() =>
			plan("", () => cell(point(0.5, 0.5), undefined, undefined, undefined)),
		/Plan slug must not be empty/,
	);
});

test("arrayGetter rejects empty cell lists", () => {
	assert.throws(() => arrayGetter([]), /must include at least one cell/);
});

test("arrayGetter rejects invalid ids", () => {
	const single = arrayGetter([
		cell(point(0.5, 0.5), undefined, undefined, undefined),
	]);

	assert.throws(() => single(-1n), /Invalid cell id/);
	assert.throws(() => single(1n), /Cell id out of range/);
});
