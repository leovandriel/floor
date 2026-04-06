import {
	add,
	cross,
	div,
	dot,
	lengthSq,
	mul,
	neg,
	normSq,
	rotateRight,
	sub,
} from "./linalg";
import { getSideCorners, getTileCorners } from "./topology";
import type { Point, Segment, ShapeSide } from "./types";
import { point } from "./types";

export function dotCross(a: Point, b: Point): Point {
	return point(dot(a, b), cross(a, b));
}

export function anglePoint(angle: number): Point {
	return point(Math.cos(angle * Math.PI * 2), Math.sin(angle * Math.PI * 2));
}

export function pointAngle(point: Point): number {
	return Math.atan2(point.y, point.x) / (Math.PI * 2);
}

export function reflect1X(v: Point): Point {
	return point(1 - v.x, v.y);
}

export function reflectY(v: Point): Point {
	return point(v.x, -v.y);
}

export function rotateScale(
	position: Point,
	rotation: number,
	scale: number,
): Point {
	return mul(dotCross(anglePoint(rotation), position), scale);
}

export function shiftCorner(p: Point, q: Point, shape: Point): Point {
	return add(p, dotCross(reflectY(shape), sub(q, p)));
}

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
			return Math.sqrt(lengthSq(shape));
		case 2:
			return Math.sqrt(lengthSq(reflect1X(shape)));
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
			return pointAngle(side.shape) - 0.5;
		case 2:
			return -pointAngle(reflect1X(side.shape)) + 0.5;
	}
	return 0;
}

export function unshiftRotation(side: ShapeSide): number {
	switch (side.index) {
		case 0:
			return 0;
		case 1:
			return -pointAngle(side.shape) + 0.5;
		case 2:
			return pointAngle(reflect1X(side.shape)) - 0.5;
	}
	return 0;
}

export function transitionRotation(from: ShapeSide, to: ShapeSide): number {
	return shiftRotation(from) + unshiftRotation(to) + 0.5;
}

export function getInwardNormal(sideStart: Point, sideEnd: Point): Point {
	const edge = sub(sideEnd, sideStart);
	return rotateRight(div(edge, Math.sqrt(lengthSq(edge))));
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
