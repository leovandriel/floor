import assert from "./assert";

export type TileId = bigint;

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
	tileId: TileId;
	sideIndex: number;
}

export function side(tileId: TileId, sideIndex: number): Side {
	assert(tileId >= 0n, "Invalid side tileId", tileId);
	assert(
		Number.isInteger(sideIndex) && sideIndex >= 0,
		"Invalid side sideIndex",
		sideIndex,
	);
	return { tileId, sideIndex };
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
	get(id: TileId): Tile;
	deterministic: boolean;
	cornerWallCache: Record<
		string,
		Record<number, Record<number, Point | null> | undefined> | undefined
	>;
}

export function plan(
	slug: string,
	get: (id: TileId) => Tile,
	deterministic = true,
): Plan {
	assert(slug.length > 0, "Plan slug must not be empty");
	return { slug, get, deterministic, cornerWallCache: {} };
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

export type TopologyMode = "none" | "lazy" | "det";
export const topologyModes: TopologyMode[] = ["none", "lazy", "det"];

export type RenderMode = "canvas" | "webgl" | "checker" | "light";
export const renderModes: RenderMode[] = [
	"canvas",
	"webgl",
	"checker",
	"light",
];

export type MouseAction = "down" | "up" | "move" | "drag" | "out";
