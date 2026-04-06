import assert from "node:assert/strict";
import test from "node:test";

import * as number from "../src/number";

test("naturalToVector maps naturals into a fixed-dimensional integer vector", () => {
	assert.deepEqual(number.naturalToVector(0n, 3), [0n, 0n, 0n]);
	assert.deepEqual(number.naturalToVector(1n, 3), [-1n, 0n, 0n]);
	assert.deepEqual(number.naturalToVector(2n, 3), [0n, -1n, 0n]);
	assert.deepEqual(number.naturalToVector(3n, 3), [-1n, -1n, 0n]);
	assert.deepEqual(number.naturalToVector(4n, 3), [0n, 0n, -1n]);
});

test("vectorToNatural inverts naturalToVector across dimensions", () => {
	for (const dimension of [1, 2, 3, 5]) {
		for (let value = 0; value <= 100; value += 1) {
			const vector = number.naturalToVector(BigInt(value), dimension);
			assert.equal(number.vectorToNatural(vector), BigInt(value));
		}
	}
});

test("naturalToVector inverts vectorToNatural for mixed-sign vectors", () => {
	const vectors = [[0n], [-3n, 4n], [2n, -1n, 5n], [-2n, 0n, 7n, -4n]] as const;

	for (const vector of vectors) {
		const value = number.vectorToNatural(vector);
		assert.deepEqual(number.naturalToVector(value, vector.length), [...vector]);
	}
});

test("natural vector mapping rejects invalid inputs", () => {
	assert.throws(() => number.naturalToVector(-1n, 3), /natural number/);
	assert.throws(() => number.naturalToVector(0n, 0), /positive integer/);
	assert.throws(() => number.vectorToNatural([]), /at least one dimension/);
});
