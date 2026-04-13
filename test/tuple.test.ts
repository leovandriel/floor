import assert from "node:assert/strict";
import test from "node:test";

import { TupleMap, TupleSet } from "../src/tuple";

test("TupleMap stores values by tuple parts without string encoding", () => {
	const map = new TupleMap<[number, bigint, number], string>();

	map.set([1, 2n, 3], "value");

	assert.equal(map.has([1, 2n, 3]), true);
	assert.equal(map.get([1, 2n, 3]), "value");
	assert.equal(map.get([1, 2n, 4]), undefined);
});

test("TupleMap deletes tuple entries without disturbing siblings", () => {
	const map = new TupleMap<[number, bigint, number], string>();

	map.set([1, 2n, 3], "first");
	map.set([1, 2n, 4], "second");

	assert.equal(map.delete([1, 2n, 3]), true);
	assert.equal(map.get([1, 2n, 3]), undefined);
	assert.equal(map.get([1, 2n, 4]), "second");
});

test("TupleSet tracks membership by full tuple", () => {
	const set = new TupleSet<[bigint, number, number]>();

	set.add([7n, 1, 2]);

	assert.equal(set.has([7n, 1, 2]), true);
	assert.equal(set.has([7n, 2, 1]), false);
});
