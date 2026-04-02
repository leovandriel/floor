import assert from "./assert";

const INV_UINT32 = 1 / 2 ** 32;

function integerToNatural(value: number): number {
	assert(Number.isSafeInteger(value), "value must be a safe integer", value);
	return value >= 0 ? value * 2 : -value * 2 - 1;
}

function naturalToInteger(value: number): number {
	assert(
		Number.isSafeInteger(value) && value >= 0,
		"value must be natural",
		value,
	);
	return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
}

function mortonDecode(value: number, dimension: number): number[] {
	const vector = Array<number>(dimension).fill(0);
	let plane = 0;
	let remaining = value;

	while (remaining > 0) {
		for (let axis = 0; axis < dimension && remaining > 0; axis += 1) {
			if ((remaining & 1) === 1) {
				vector[axis] += 2 ** plane;
			}
			remaining = Math.floor(remaining / 2);
		}
		plane += 1;
	}

	return vector;
}

function mortonEncode(vector: readonly number[]): number {
	let value = 0;
	let plane = 0;
	let hasBitsRemaining = true;

	while (hasBitsRemaining) {
		hasBitsRemaining = false;

		for (let axis = 0; axis < vector.length; axis += 1) {
			const bit = Math.floor(vector[axis] / 2 ** plane) % 2;
			if (bit === 1) {
				value += 2 ** (plane * vector.length + axis);
			}
			if (Math.floor(vector[axis] / 2 ** (plane + 1)) > 0) {
				hasBitsRemaining = true;
			}
		}

		plane += 1;
	}

	return value;
}

export function naturalToVector(value: number, dimension: number): number[] {
	assert(
		Number.isInteger(dimension) && dimension >= 1,
		"dimension must be a positive integer",
	);
	assert(
		Number.isSafeInteger(value) && value >= 0,
		"value must be a natural number",
		value,
	);
	return mortonDecode(value, dimension).map(naturalToInteger);
}

export function vectorToNatural(vector: readonly number[]): number {
	assert(vector.length > 0, "vector must have at least one dimension");
	vector.forEach((value) => {
		assert(
			Number.isSafeInteger(value),
			"vector value must be a safe integer",
			value,
		);
	});

	return mortonEncode(vector.map(integerToNatural));
}

export function random(seed: number): number {
	assert(Number.isInteger(seed), "seed must be an integer", seed);
	let x = seed | 0;
	x ^= x >>> 16;
	x = Math.imul(x, 0x7feb352d);
	x ^= x >>> 15;
	x = Math.imul(x, 0x846ca68b);
	x ^= x >>> 16;
	return (x >>> 0) * INV_UINT32;
}
