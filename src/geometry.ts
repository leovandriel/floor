import {
	add,
	cross,
	div,
	dot,
	lengthSq,
	mul,
	normSq,
	rotateRight,
	sub,
} from "./linalg";
import { getFaceVertices } from "./topology";
import type { Point, Segment, ShapeFace, Transform, Triple } from "./types";
import { point, segment, transform, triple } from "./types";

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

export function applyTransformPoint(value: Transform, position: Point): Point {
	return add(applyTransformVector(value, position), value.offset);
}

export function applyTransformVector(
	value: Transform,
	direction: Point,
): Point {
	return add(mul(value.basisX, direction.x), mul(value.basisY, direction.y));
}

export function projectPoint(edge: Segment, position: Point): Point {
	return add(
		edge.start,
		dotCross(reflectY(position), sub(edge.end, edge.start)),
	);
}

export function getCellVertices(shape: Point): [Point, Point, Point] {
	return [point(0.0, 0.0), shape, point(1.0, 0.0)];
}

export function getCellBounds(shape: Point, y: number): [number, number] {
	const min = (shape.x * y) / shape.y;
	return [min, min + 1 - y / shape.y];
}

export function getFaceSegment(
	vertices: Triple<Point>,
	faceIndex: number,
): Segment {
	const [startVertexIndex, endVertexIndex] = getFaceVertices(faceIndex);
	return segment(vertices[startVertexIndex], vertices[endVertexIndex]);
}

export function isInsideCell(
	position: Point,
	shape: Point,
	tolerance = 0,
): boolean {
	if (position.y < -tolerance || position.y > shape.y + tolerance) {
		return false;
	}
	const [min, max] = getCellBounds(shape, position.y);
	return position.x >= min - tolerance && position.x <= max + tolerance;
}

export function projectTriangle(edge: Segment, shape: Point): Triple<Point> {
	return triple(edge.start, projectPoint(edge, shape), edge.end);
}

export function projectVertexOffset(
	edge: Segment,
	vertex: Point,
	offset: Point,
): Point {
	return projectPoint(edge, add(vertex, offset));
}

export function projectViewTriangle(
	shape: Point,
	position: Point,
	rotation: number,
	scale: number,
): Triple<Point> {
	const leftVertex = rotateScale(position, rotation, scale);
	const rightVertex = rotateScale(
		point(position.x - 1, position.y),
		rotation,
		scale,
	);
	return projectTriangle(segment(leftVertex, rightVertex), shape);
}

export function shiftSeam(position: Point, { shape, index }: ShapeFace): Point {
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

export function unshiftSeam(
	position: Point,
	{ shape, index }: ShapeFace,
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

function transformSeam(position: Point, from: ShapeFace, to: ShapeFace): Point {
	return unshiftSeam(reflectY(reflect1X(shiftSeam(position, from))), to);
}

export function getSeamTransform(from: ShapeFace, to: ShapeFace): Transform {
	const offset = transformSeam(point(0.0, 0.0), from, to);
	return transform(
		sub(transformSeam(point(1.0, 0.0), from, to), offset),
		sub(transformSeam(point(0.0, 1.0), from, to), offset),
		offset,
	);
}

export function transitionPosition(
	position: Point,
	from: ShapeFace,
	to: ShapeFace,
): Point {
	return applyTransformPoint(getSeamTransform(from, to), position);
}

export function transitionDirection(
	direction: Point,
	from: ShapeFace,
	to: ShapeFace,
): Point {
	return applyTransformVector(getSeamTransform(from, to), direction);
}

export function transitionScale(from: ShapeFace, to: ShapeFace): number {
	return Math.sqrt(
		lengthSq(applyTransformVector(getSeamTransform(to, from), point(1.0, 0.0))),
	);
}

export function transitionRotation(from: ShapeFace, to: ShapeFace): number {
	return pointAngle(
		applyTransformVector(getSeamTransform(to, from), point(1.0, 0.0)),
	);
}

export function seamShape(shape: Point, faceIndex: number): Point {
	switch (faceIndex) {
		case 0:
			return shape;
		case 1:
			return reflect1X(normSq(shape));
		case 2:
			return normSq(reflect1X(shape));
	}
	return shape;
}

export function projectSeamTriangle(
	edge: Segment,
	shape: Point,
	faceIndex: number,
): Triple<Point> {
	return projectTriangle(edge, seamShape(shape, faceIndex));
}

export function projectBranchTriangles(
	screenEdge: Segment,
	worldEdge: Segment,
	shape: Point,
	faceIndex: number,
): [Triple<Point>, Triple<Point>] {
	return [
		projectSeamTriangle(screenEdge, shape, faceIndex),
		projectSeamTriangle(worldEdge, shape, faceIndex),
	];
}

export function getInwardNormal(faceStart: Point, faceEnd: Point): Point {
	const edge = sub(faceEnd, faceStart);
	return rotateRight(div(edge, Math.sqrt(lengthSq(edge))));
}

export function getInsetEdge(
	faceStart: Point,
	faceEnd: Point,
	inset: number,
): Segment {
	const insetDelta = mul(getInwardNormal(faceStart, faceEnd), inset);
	return {
		start: add(faceStart, insetDelta),
		end: add(faceEnd, insetDelta),
	};
}

export function getFaceDirectionAtVertex(
	shape: Point,
	faceIndex: number,
	vertexIndex: number,
): Point {
	const vertices = getCellVertices(shape);
	const { start: faceStart, end: faceEnd } = getFaceSegment(
		vertices,
		faceIndex,
	);
	const [faceStartIndex] = getFaceVertices(faceIndex);
	const otherVertex = vertexIndex === faceStartIndex ? faceEnd : faceStart;
	return sub(otherVertex, vertices[vertexIndex]);
}
