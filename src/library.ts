import assert from "./assert";
import { naturalToVector, random, vectorToNatural } from "./number";
import type { Plan, Point, Tile } from "./types";
import { plan, point, side, tile } from "./types";

export function arrayPlan(slug: string, tiles: Tile[]): Plan {
	assert(tiles.length > 0, "Plan must include at least one tile", slug);
	return plan(slug, (id: number) => {
		assert(Number.isInteger(id), "Invalid tile id", id);
		assert(id >= 0 && id < tiles.length, "Tile id out of range", id);
		return tiles[id];
	});
}

function mazePlan(
	slug: string,
	shape: Point,
	threshold: number,
	hasInnerWall: boolean,
): Plan {
	return plan(slug, (id: number) => {
		const [x, y] = naturalToVector(Math.floor(id / 2), 2);
		const getId = (x: number, y: number): number => vectorToNatural([x, y]) * 2;
		const hasWall = (id: number): boolean => random(id + 2) < threshold;

		if (id % 2 === 0) {
			const southUpper = getId(x, y - 1) + 1;
			const westUpper = getId(x - 1, y) + 1;
			return tile(
				shape,
				hasWall(southUpper) ? undefined : side(southUpper, 0),
				hasWall(id) ? undefined : side(westUpper, 1),
				hasInnerWall && hasWall(id * 2) ? undefined : side(id + 1, 2),
			);
		} else {
			const northLower = getId(x, y + 1);
			const eastLower = getId(x + 1, y);
			return tile(
				shape,
				hasWall(id) ? undefined : side(northLower, 0),
				hasWall(eastLower) ? undefined : side(eastLower, 1),
				hasInnerWall && hasWall((id - 1) * 2) ? undefined : side(id - 1, 2),
			);
		}
	});
}

function curlPlan(slug: string, count: number): Plan {
	assert(count >= 2, "Curl count must be at least 2", count);
	const index = count * 2;
	const [x, y] = [6 / 11, 5 / 11];
	return plan(slug, (id: number): Tile => {
		assert(Number.isInteger(id), "Invalid tile id", id);
		if (id === 0) {
			return tile(point(0.0, 1.2), undefined, undefined, side(1, 1));
		} else if (id === index + 1) {
			return tile(
				point(x, y),
				undefined,
				side(index + 0, 1),
				side(index + 2, 1),
			);
		} else if (id === index + 2) {
			return tile(
				point(y, y),
				undefined,
				side(index + 1, 2),
				side(index + 3, 1),
			);
		} else if (id === index + 3) {
			return tile(point(1.0, 1.2), undefined, side(index + 2, 2), undefined);
		} else if (id % 2 === 1) {
			return tile(
				point(x, y),
				undefined,
				side(id - 1, id === 1 ? 2 : 1),
				side(id + 1, 2),
			);
		} else if (id % 2 === 0) {
			return tile(point(6.0, 5.0), undefined, side(id + 1, 1), side(id - 1, 2));
		}
		assert(false, "Invalid tile id", id);
	});
}

export const library: Plan[] = [
	arrayPlan("triangle", [
		tile(point(0.5, 0.866), undefined, undefined, undefined),
	]),
	arrayPlan("square", [
		tile(point(0.5, 0.5), undefined, side(0, 2), side(0, 1)),
	]),
	arrayPlan("hex", [
		tile(point(0.5, 0.866), undefined, side(0, 2), side(0, 1)),
	]),
	arrayPlan("tunnel", [
		tile(point(0.0, 1.0), side(0, 0), undefined, side(0, 2)),
	]),
	arrayPlan("grid", [
		tile(point(0.0, 1.0), side(3, 1), undefined, side(1, 0)),
		tile(point(0.5, 0.5), side(0, 2), side(2, 0), undefined),
		tile(point(0.0, 1.0), side(1, 1), side(4, 0), side(3, 0)),
		tile(point(0.5, 0.5), side(2, 2), side(0, 0), side(5, 2)),
		tile(point(1.0, 1.0), side(2, 1), side(5, 0), undefined),
		tile(point(0.5, 0.5), side(4, 1), undefined, side(3, 2)),
	]),
	arrayPlan("base", [
		tile(point(0.0, 1.2), undefined, undefined, side(1, 1)),
		tile(point(0.545, 0.455), undefined, side(0, 2), side(2, 2)),
		tile(point(6.0, 5.0), undefined, side(3, 1), side(1, 2)),
		tile(point(0.545, 0.455), undefined, side(2, 1), side(4, 1)),
		tile(point(0.455, 0.455), undefined, side(3, 2), side(5, 1)),
		tile(point(1.0, 1.2), undefined, side(4, 2), undefined),
	]),
	curlPlan("curl", 2),
	arrayPlan("circle", [
		tile(point(-0.25, 0.97), side(1, 0), undefined, side(1, 2)),
		tile(point(0.38, 1.45), side(0, 0), undefined, side(0, 2)),
	]),
	arrayPlan("spiral", [
		tile(point(-0.25, 0.97), side(1, 0), undefined, side(1, 2)),
		tile(point(0.1, 2.0), side(0, 0), undefined, side(0, 2)),
	]),
	arrayPlan("plane", [
		tile(point(0.5, 0.866), side(0, 0), side(0, 1), side(0, 2)),
	]),
	mazePlan("maze", point(0.0, 1.0), 0.5, false),
	mazePlan("hexMaze", point(0.5, 0.866), 0.33, true),
	plan("morton", (id: number) => {
		const [x, y] = naturalToVector(Math.floor(id / 2), 2);
		const getId = (x: number, y: number): number => vectorToNatural([x, y]) * 2;
		const half = id % 2;
		const offset = half * 2 - 1;
		return tile(
			point(0.5, 0.866),
			side(getId(x, y + offset) - half + 1, 0),
			side(getId(x + offset, y) - half + 1, 1),
			side(id - offset, 2),
		);
	}),
];
