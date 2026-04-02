import {
	add,
	atan2Turns,
	dotCross,
	epsilon,
	mul,
	neg,
	norm,
	normSq,
	reflect1X,
	reflectY,
	rotateRight,
	size,
	sub,
} from "./math";
import { getSideCorners, getTileCorners } from "./topology";
import type { Point, Segment, ShapeSide } from "./types";

export function shiftPosition(
	position: Point,
	{ shape, index }: ShapeSide,
): Point {
	switch (index) {
		case 0:
			return position;
		case 1:
			return reflect1X(dotCross(position, normSq(shape)));
		case 2:
			return dotCross(reflect1X(position), normSq(reflect1X(shape)));
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
			return dotCross(reflect1X(position), shape);
		case 2:
			return reflect1X(dotCross(position, reflect1X(shape)));
	}
	return position;
}

export function transitionPosition(
	position: Point,
	from: ShapeSide,
	to: ShapeSide,
): Point {
	return unshiftPosition(
		reflectY(reflect1X(shiftPosition(position, from))),
		to,
	);
}

function shiftDirection(direction: Point, { shape, index }: ShapeSide): Point {
	switch (index) {
		case 0:
			return direction;
		case 1:
			return neg(dotCross(normSq(shape), direction));
		case 2:
			return neg(dotCross(reflectY(direction), normSq(reflect1X(shape))));
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
			return neg(dotCross(reflectY(direction), shape));
		case 2:
			return neg(dotCross(reflect1X(shape), direction));
	}
	return direction;
}

export function transitionDirection(
	direction: Point,
	from: ShapeSide,
	to: ShapeSide,
): Point {
	return unshiftDirection(neg(shiftDirection(direction, from)), to);
}

export function shiftShape(shape: Point, sideIndex: number): Point {
	switch (sideIndex) {
		case 0:
			return shape;
		case 1:
			return reflect1X(normSq(shape));
		case 2:
			return normSq(reflect1X(shape));
	}
	return shape;
}

export function shiftScale({ shape, index }: ShapeSide): number {
	switch (index) {
		case 0:
			return 1;
		case 1:
			return size(shape);
		case 2:
			return size(reflect1X(shape));
	}
	return 1;
}

export function transitionScale(from: ShapeSide, to: ShapeSide): number {
	return shiftScale(from) / shiftScale(to);
}

export function shiftRotation(side: ShapeSide): number {
	switch (side.index) {
		case 0:
			return 0;
		case 1:
			return atan2Turns(side.shape) - 0.5;
		case 2:
			return -atan2Turns(reflect1X(side.shape)) + 0.5;
	}
	return 0;
}

export function unshiftRotation(side: ShapeSide): number {
	switch (side.index) {
		case 0:
			return 0;
		case 1:
			return -atan2Turns(side.shape) + 0.5;
		case 2:
			return atan2Turns(reflect1X(side.shape)) - 0.5;
	}
	return 0;
}

export function transitionRotation(from: ShapeSide, to: ShapeSide): number {
	return shiftRotation(from) + unshiftRotation(to) + 0.5;
}

export function getInwardNormal(sideStart: Point, sideEnd: Point): Point {
	return rotateRight(norm(sub(sideEnd, sideStart)));
}

export function getInsetEdge(
	sideStart: Point,
	sideEnd: Point,
	inset: number,
): Segment {
	const insetDelta = mul(getInwardNormal(sideStart, sideEnd), inset);
	return {
		start: add(sideStart, insetDelta),
		end: add(sideEnd, insetDelta),
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
	return sub(otherCorner, corners[cornerIndex]);
}

export function isInsideTile(position: Point, shape: Point): boolean {
	if (position.y < -epsilon || position.y > shape.y + epsilon) {
		return false;
	}
	const min = (shape.x * position.y) / shape.y;
	const max = min + 1 - position.y / shape.y;
	return position.x >= min - epsilon && position.x <= max + epsilon;
}
