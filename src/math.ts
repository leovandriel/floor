import type { Point } from "./types";

export function point(x: number, y: number): Point {
	return { x, y };
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export const epsilon = 1e-5;

export function size(v: Point): number {
	return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function pointDistanceSq(a: Point, b: Point): number {
	return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
}

export function lineDistanceSq(a: Point, b: Point, c: Point): number {
	const n = (b.y - a.y) * c.x - (b.x - a.x) * c.y + b.x * a.y + b.y * a.x;
	return (n * n) / pointDistanceSq(a, b);
}

export function interpolate(p: Point, q: Point, t: number): Point {
	return point(p.x * (1 - t) + q.x * t, p.y * (1 - t) + q.y * t);
}

export function segmentDistanceSq(a: Point, b: Point, c: Point): number {
	const p =
		((c.x - a.x) * (b.x - a.x) + (c.y - a.y) * (b.y - a.y)) /
		pointDistanceSq(a, b);
	const q = interpolate(a, b, Math.max(0, Math.min(1, p)));
	return pointDistanceSq(q, c);
}

export function sub(a: Point, b: Point): Point {
	return point(a.x - b.x, a.y - b.y);
}

export function isZero(a: Point): boolean {
	return Math.abs(a.x) < epsilon && Math.abs(a.y) < epsilon;
}

export function isClose(a: Point, b: Point): boolean {
	return isZero(sub(a, b));
}

export function sinTurns(v: number): number {
	return Math.sin(v * Math.PI * 2);
}

export function cosTurns(v: number): number {
	return Math.cos(v * Math.PI * 2);
}

export function atan2Turns(y: number, x: number): number {
	return Math.atan2(y, x) / Math.PI / 2;
}

export function noise(): number {
	return (2 * Math.random() - 1) * 1e-3;
}

export function isClockwise(a: Point, b: Point): boolean {
	return a.x * b.y < a.y * b.x;
}

export function isClockwise3(a: Point, b: Point, c: Point): boolean {
	return (a.x - b.x) * (c.y - b.y) < (a.y - b.y) * (c.x - b.x);
}

export function add(a: Point, b: Point): Point {
	return point(a.x + b.x, a.y + b.y);
}

export function dot(a: Point, b: Point): number {
	return a.x * b.x + a.y * b.y;
}

export function mul(a: Point, b: number): Point {
	return point(a.x * b, a.y * b);
}

export function project(a: Point, b: Point): Point {
	return mul(a, dot(a, b) / dot(a, a));
}

export function project3(a: Point, b: Point, c: Point): Point {
	return project(sub(a, b), sub(c, b));
}

export function intersect(a: Point, b: Point, c: Point, d: Point): Point {
	const e = (a.x - b.x) * (c.y - d.y) - (c.x - d.x) * (a.y - b.y);
	return point(
		((a.x - c.x) * (c.y - d.y) - (c.x - d.x) * (a.y - c.y)) / e,
		((a.x - c.x) * (a.y - b.y) - (a.x - b.x) * (a.y - c.y)) / e,
	);
}

export function intersectOrigin(a: Point, b: Point, direction: Point): Point {
	const { x: linePosition } = intersect(a, b, point(0, 0), direction);
	return interpolate(a, b, linePosition);
}
