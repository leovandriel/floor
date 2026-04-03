import assert from "./assert";

export interface Point {
	x: number;
	y: number;
}

export function point(x: number, y: number): Point {
	assert(typeof x === "number", "Invalid point x", x);
	assert(typeof y === "number", "Invalid point y", y);
	return { x, y };
}

export interface Color {
	r: number;
	g: number;
	b: number;
	a: number;
}

export interface Side {
	tileId: number;
	neighbor: number;
}

export function side(tileId: number, neighbor: number): Side {
	assert(
		Number.isInteger(tileId) && tileId >= 0,
		"Invalid side tileId",
		tileId,
	);
	assert(
		Number.isInteger(neighbor) && neighbor >= 0,
		"Invalid side neighbor",
		neighbor,
	);
	return { tileId, neighbor };
}

export interface Tile {
	shape: Point;
	sides: [Side | undefined, Side | undefined, Side | undefined];
}

export interface ShapeSide {
	shape: Point;
	index: number;
}

export function tile(
	shape: Point,
	a: Side | undefined,
	b: Side | undefined,
	c: Side | undefined,
): Tile {
	assert(Number.isFinite(shape.x), "Invalid tile shape x", shape.x);
	assert(Number.isFinite(shape.y), "Invalid tile shape y", shape.y);
	assert(shape.y > 0, "Tile shape y must be positive", shape.y);
	return { shape, sides: [a, b, c] };
}

export interface Plan {
	slug: string;
	get(id: number): Tile;
	cornerWallCache: Record<
		number,
		Record<number, Record<number, Point | null> | undefined> | undefined
	>;
}

export function plan(slug: string, get: (id: number) => Tile): Plan {
	assert(slug.length > 0, "Plan slug must not be empty");
	return { slug, get, cornerWallCache: {} };
}

export interface Segment {
	start: Point;
	end: Point;
}

export function segment(start: Point, end: Point): Segment {
	return { start, end };
}

export interface CornerWall {
	left?: Point;
	right?: Point;
}

export interface RenderStats {
	tiles: number;
	branches: number;
	maxDepth: number;
	duration: number;
}

export type MouseAction = "down" | "up" | "move" | "drag" | "out";
