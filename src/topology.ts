import type { Point } from "./types";
import { point } from "./types";

export function getTileCorners(shape: Point): [Point, Point, Point] {
	return [point(0.0, 0.0), shape, point(1.0, 0.0)];
}

export function getIncidentSides(cornerIndex: number): [number, number] {
	return [cornerIndex, (cornerIndex + 1) % 3];
}

export function getSideCorners(sideIndex: number): [number, number] {
	return [(sideIndex + 2) % 3, sideIndex];
}

export function getSideOppositeCorner(sideIndex: number): number {
	return (sideIndex + 1) % 3;
}

export function getOtherIncidentSide(
	cornerIndex: number,
	sideIndex: number,
): number {
	const [a, b] = getIncidentSides(cornerIndex);
	return a === sideIndex ? b : a;
}

export function getAdjacentSides(sideIndex: number): [number, number] {
	return [(sideIndex + 1) % 3, (sideIndex + 2) % 3];
}

export function getCornerAcrossSide(
	cornerIndex: number,
	sideIndex: number,
	otherSideIndex: number,
): number {
	const [startCornerIndex] = getSideCorners(sideIndex);
	return cornerIndex === startCornerIndex
		? otherSideIndex
		: (otherSideIndex + 2) % 3;
}
