import assert from "node:assert/strict";
import test from "node:test";

import * as number from "../src/number";

test("naturalToVector maps naturals into a fixed-dimensional integer vector", () => {
	assert.deepEqual(number.naturalToVector(0, 3), [0, 0, 0]);
	assert.deepEqual(number.naturalToVector(1, 3), [-1, 0, 0]);
	assert.deepEqual(number.naturalToVector(2, 3), [0, -1, 0]);
	assert.deepEqual(number.naturalToVector(3, 3), [-1, -1, 0]);
	assert.deepEqual(number.naturalToVector(4, 3), [0, 0, -1]);
});

test("vectorToNatural inverts naturalToVector across dimensions", () => {
	for (const dimension of [1, 2, 3, 5]) {
		for (let value = 0; value <= 100; value += 1) {
			const vector = number.naturalToVector(value, dimension);
			assert.equal(number.vectorToNatural(vector), value);
		}
	}
});

test("naturalToVector inverts vectorToNatural for mixed-sign vectors", () => {
	const vectors = [[0], [-3, 4], [2, -1, 5], [-2, 0, 7, -4]] as const;

	for (const vector of vectors) {
		const value = number.vectorToNatural(vector);
		assert.deepEqual(number.naturalToVector(value, vector.length), [...vector]);
	}
});

test("natural vector mapping rejects invalid inputs", () => {
	assert.throws(() => number.naturalToVector(-1, 3), /natural number/);
	assert.throws(() => number.naturalToVector(0, 0), /positive integer/);
	assert.throws(() => number.vectorToNatural([]), /at least one dimension/);
});
