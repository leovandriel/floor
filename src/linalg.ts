import type { Point } from "./types";
import { point } from "./types";

export function add(a: Point, b: Point): Point {
	return point(a.x + b.x, a.y + b.y);
}

export function sub(a: Point, b: Point): Point {
	return point(a.x - b.x, a.y - b.y);
}

export function mul(a: Point, b: number): Point {
	return point(a.x * b, a.y * b);
}

export function div(a: Point, b: number): Point {
	return point(a.x / b, a.y / b);
}

export function neg(v: Point): Point {
	return point(-v.x, -v.y);
}

export function dot(a: Point, b: Point): number {
	return a.x * b.x + a.y * b.y;
}

export function cross(a: Point, b: Point): number {
	return a.x * b.y - a.y * b.x;
}

export function lengthSq(v: Point): number {
	return dot(v, v);
}

export function normSq(v: Point): Point {
	return div(v, lengthSq(v));
}

export function rotateLeft(v: Point): Point {
	return point(-v.y, v.x);
}

export function rotateRight(v: Point): Point {
	return point(v.y, -v.x);
}

export function isClockwise(a: Point, b: Point): boolean {
	return cross(a, b) < 0;
}

export function isClockwise3(a: Point, b: Point, c: Point): boolean {
	return isClockwise(sub(a, b), sub(c, b));
}

export function lineDistanceSq(a: Point, b: Point, c: Point): number {
	const area = cross(sub(c, a), sub(b, a));
	return (area * area) / lengthSq(sub(a, b));
}

export function interpolate(p: Point, q: Point, t: number): Point {
	return point(p.x * (1 - t) + q.x * t, p.y * (1 - t) + q.y * t);
}

export function clamp(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value;
}

export function nearestOnSegment(a: Point, b: Point, c: Point): Point {
	const ab = sub(b, a);
	const t = dot(sub(c, a), ab) / lengthSq(ab);
	return interpolate(a, b, clamp(t, 0, 1));
}

export function projectOffset(a: Point, b: Point, c: Point): Point {
	const ab = sub(a, b);
	return mul(ab, dot(ab, sub(c, b)) / dot(ab, ab));
}

export function intersect(a: Point, b: Point, c: Point, d: Point): Point {
	const ab = sub(b, a);
	const cd = sub(d, c);
	const ac = sub(c, a);
	const det = cross(ab, cd);
	return point(cross(ac, cd) / det, cross(ac, ab) / det);
}
