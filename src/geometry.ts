import * as math from "./math";
import { epsilon } from "./math";
import { getSideCorners, getTileCorners } from "./topology";
import type { Point, Segment } from "./types";
import { point } from "./types";

export interface ShapeSide {
	shape: Point;
	index: number;
}

export function shiftPosition(
	position: Point,
	{ shape, index }: ShapeSide,
): Point {
	switch (index) {
		case 0:
			return position;
		case 1: {
			const d = shape.x * shape.x + shape.y * shape.y;
			return point(
				1 - (shape.x * position.x + shape.y * position.y) / d,
				(shape.y * position.x - shape.x * position.y) / d,
			);
		}
		case 2: {
			const e = (1 - shape.x) * (1 - shape.x) + shape.y * shape.y;
			return point(
				((1 - shape.x) * (1 - position.x) + shape.y * position.y) / e,
				(shape.y * (1 - position.x) - (1 - shape.x) * position.y) / e,
			);
		}
	}
	return position;
}

export function unshiftPosition(
	position: Point,
	{ shape, index }: ShapeSide,
): Point {
	switch (index) {
		case 0:
			return position;
		case 1:
			return point(
				shape.x * (1 - position.x) + shape.y * position.y,
				shape.y * (1 - position.x) - shape.x * position.y,
			);
		case 2:
			return point(
				1 - (1 - shape.x) * position.x - shape.y * position.y,
				shape.y * position.x - (1 - shape.x) * position.y,
			);
	}
	return position;
}

export function transitionPosition(
	position: Point,
	from: ShapeSide,
	to: ShapeSide,
): Point {
	const shift1 = shiftPosition(position, from);
	const shift2 = point(1 - shift1.x, -shift1.y);
	return unshiftPosition(shift2, to);
}

function shiftDirection(direction: Point, { shape, index }: ShapeSide): Point {
	switch (index) {
		case 0:
			return direction;
		case 1: {
			const d = shape.x * shape.x + shape.y * shape.y;
			return point(
				(-shape.x * direction.x - shape.y * direction.y) / d,
				(shape.y * direction.x - shape.x * direction.y) / d,
			);
		}
		case 2: {
			const e = (1 - shape.x) * (1 - shape.x) + shape.y * shape.y;
			return point(
				(-(1 - shape.x) * direction.x + shape.y * direction.y) / e,
				(-shape.y * direction.x - (1 - shape.x) * direction.y) / e,
			);
		}
	}
	return direction;
}

function unshiftDirection(
	direction: Point,
	{ shape, index }: ShapeSide,
): Point {
	switch (index) {
		case 0:
			return direction;
		case 1:
			return point(
				-shape.x * direction.x + shape.y * direction.y,
				-shape.y * direction.x - shape.x * direction.y,
			);
		case 2:
			return point(
				-(1 - shape.x) * direction.x - shape.y * direction.y,
				shape.y * direction.x - (1 - shape.x) * direction.y,
			);
	}
	return direction;
}

export function transitionDirection(
	direction: Point,
	from: ShapeSide,
	to: ShapeSide,
): Point {
	const shifted = shiftDirection(direction, from);
	return unshiftDirection(point(-shifted.x, -shifted.y), to);
}

export function shiftShape(shape: Point, sideIndex: number): Point {
	switch (sideIndex) {
		case 0:
			return shape;
		case 1: {
			const d = shape.x * shape.x + shape.y * shape.y;
			return point(1 - shape.x / d, shape.y / d);
		}
		case 2: {
			const e = (1 - shape.x) * (1 - shape.x) + shape.y * shape.y;
			return point((1 - shape.x) / e, shape.y / e);
		}
	}
	return shape;
}

export function shiftScale({ shape, index }: ShapeSide): number {
	switch (index) {
		case 0:
			return 1;
		case 1:
			return math.size(shape);
		case 2:
			return math.size(point(1 - shape.x, shape.y));
	}
	return 1;
}

export function transitionScale(from: ShapeSide, to: ShapeSide): number {
	return shiftScale(from) / shiftScale(to);
}

export function shiftRotation(rotation: number, side: ShapeSide): number {
	switch (side.index) {
		case 0:
			return rotation;
		case 1:
			return rotation + math.atan2Turns(side.shape.y, side.shape.x) - 0.5;
		case 2:
			return rotation + 0.5 - math.atan2Turns(side.shape.y, 1 - side.shape.x);
	}
	return rotation;
}

export function unshiftRotation(rotation: number, side: ShapeSide): number {
	switch (side.index) {
		case 0:
			return rotation;
		case 1:
			return rotation - math.atan2Turns(side.shape.y, side.shape.x) + 0.5;
		case 2:
			return rotation - 0.5 + math.atan2Turns(side.shape.y, 1 - side.shape.x);
	}
	return rotation;
}

export function transitionRotation(
	rotation: number,
	from: ShapeSide,
	to: ShapeSide,
): number {
	return unshiftRotation(shiftRotation(rotation, from) + 0.5, to);
}

export function getInwardNormal(
	sideStart: Point,
	sideEnd: Point,
	interiorPoint: Point,
): Point {
	const edge = math.sub(sideEnd, sideStart);
	const length = math.size(edge);
	if (length < epsilon) {
		return point(0.0, 0.0);
	}
	const normalA = point(-edge.y / length, edge.x / length);
	return math.dot(math.sub(interiorPoint, sideStart), normalA) > 0
		? normalA
		: math.mul(normalA, -1);
}

export function getInsetEdge(
	sideStart: Point,
	sideEnd: Point,
	interiorPoint: Point,
	inset: number,
): Segment {
	const inwardNormal = getInwardNormal(sideStart, sideEnd, interiorPoint);
	return {
		start: math.add(sideStart, math.mul(inwardNormal, inset)),
		end: math.add(sideEnd, math.mul(inwardNormal, inset)),
	};
}

export function getSideDirectionAtCorner(
	shape: Point,
	sideIndex: number,
	cornerIndex: number,
): Point {
	const corners = getTileCorners(shape);
	const [sideStartIndex, sideEndIndex] = getSideCorners(sideIndex);
	const sideStart = corners[sideStartIndex];
	const sideEnd = corners[sideEndIndex];
	const otherCorner = cornerIndex === sideStartIndex ? sideEnd : sideStart;
	return point(
		otherCorner.x - corners[cornerIndex].x,
		otherCorner.y - corners[cornerIndex].y,
	);
}

export function isInsideTile(position: Point, shape: Point): boolean {
	if (position.y < -epsilon || position.y > shape.y + epsilon) {
		return false;
	}
	const min = (shape.x * position.y) / shape.y;
	const max = min + 1 - position.y / shape.y;
	return position.x >= min - epsilon && position.x <= max + epsilon;
}
