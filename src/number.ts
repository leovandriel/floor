import assert from "./assert";

const INV_UINT32 = 1 / 2 ** 32;

function integerToNatural(value: bigint): bigint {
	return value >= 0n ? value * 2n : -value * 2n - 1n;
}

function naturalToInteger(value: bigint): bigint {
	assert(value >= 0n, "value must be natural", value);
	return value % 2n === 0n ? value / 2n : -(value + 1n) / 2n;
}

function mortonDecode(value: bigint, dimension: number): bigint[] {
	const vector = Array<bigint>(dimension).fill(0n);
	let plane = 0;
	let remaining = value;

	while (remaining > 0n) {
		for (let axis = 0; axis < dimension && remaining > 0n; axis += 1) {
			if ((remaining & 1n) === 1n) {
				vector[axis] += 1n << BigInt(plane);
			}
			remaining /= 2n;
		}
		plane += 1;
	}

	return vector;
}

function mortonEncode(vector: readonly bigint[]): bigint {
	let value = 0n;
	let plane = 0;
	let hasBitsRemaining = true;

	while (hasBitsRemaining) {
		hasBitsRemaining = false;

		for (let axis = 0; axis < vector.length; axis += 1) {
			const bit = (vector[axis] >> BigInt(plane)) & 1n;
			if (bit === 1n) {
				value += 1n << BigInt(plane * vector.length + axis);
			}
			if (vector[axis] >> BigInt(plane + 1) > 0n) {
				hasBitsRemaining = true;
			}
		}

		plane += 1;
	}

	return value;
}

export function naturalToVector(value: bigint, dimension: number): bigint[] {
	assert(
		Number.isInteger(dimension) && dimension >= 1,
		"dimension must be a positive integer",
	);
	assert(value >= 0n, "value must be a natural number", value);
	return mortonDecode(value, dimension).map(naturalToInteger);
}

export function vectorToNatural(vector: readonly bigint[]): bigint {
	assert(vector.length > 0, "vector must have at least one dimension");
	return mortonEncode(vector.map(integerToNatural));
}

export function random(seed: bigint): number {
	let x = Number(BigInt.asUintN(32, seed));
	x ^= x >>> 16;
	x = Math.imul(x, 0x7feb352d);
	x ^= x >>> 15;
	x = Math.imul(x, 0x846ca68b);
	x ^= x >>> 16;
	return (x >>> 0) * INV_UINT32;
}
