import assert from "node:assert/strict";
import test from "node:test";
import { arrayGetter } from "../src/library";
import { plan, point, side, tile } from "../src/types";

test("side rejects negative ids and neighbors", () => {
	assert.throws(() => side(-1n, 0), /Invalid side tileId/);
	assert.throws(() => side(0n, -1), /Invalid side sideIndex/);
});

test("tile rejects non-positive heights", () => {
	assert.throws(
		() => tile(point(0.5, 0.0), undefined, undefined, undefined),
		/Tile shape y must be positive/,
	);
});

test("plan rejects an empty slug", () => {
	assert.throws(
		() =>
			plan("", () => tile(point(0.5, 0.5), undefined, undefined, undefined)),
		/Plan slug must not be empty/,
	);
});

test("arrayGetter rejects empty tile lists", () => {
	assert.throws(() => arrayGetter([]), /must include at least one tile/);
});

test("arrayGetter rejects invalid ids", () => {
	const single = arrayGetter([
		tile(point(0.5, 0.5), undefined, undefined, undefined),
	]);

	assert.throws(() => single(-1n), /Invalid tile id/);
	assert.throws(() => single(1n), /Tile id out of range/);
});
