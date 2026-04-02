import assert from "node:assert/strict";
import test from "node:test";
import { arrayPlan } from "../src/library";
import { plan, point, side, tile } from "../src/types";

test("side rejects negative ids and neighbors", () => {
	assert.throws(() => side(-1, 0), /Invalid side tileId/);
	assert.throws(() => side(0, -1), /Invalid side neighbor/);
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

test("arrayPlan rejects empty tile lists", () => {
	assert.throws(() => arrayPlan("empty", []), /must include at least one tile/);
});

test("arrayPlan get rejects invalid ids", () => {
	const single = arrayPlan("single", [
		tile(point(0.5, 0.5), undefined, undefined, undefined),
	]);

	assert.throws(() => single.get(-1), /Tile id out of range/);
	assert.throws(() => single.get(1.5), /Invalid tile id/);
	assert.throws(() => single.get(1), /Tile id out of range/);
});
