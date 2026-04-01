function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

export interface Point {
	x: number;
	y: number;
}

export function point(x: number, y: number): Point {
	assert(typeof x === "number", `Invalid point x: ${x}`);
	assert(typeof y === "number", `Invalid point y: ${y}`);
	return { x, y };
}

export interface Color {
	r: number;
	g: number;
	b: number;
	a: number;
}

export function color(r: number, g: number, b: number, a = 1): Color {
	assert(Number.isFinite(r) && r >= 0 && r <= 1, `Invalid color r: ${r}`);
	assert(Number.isFinite(g) && g >= 0 && g <= 1, `Invalid color g: ${g}`);
	assert(Number.isFinite(b) && b >= 0 && b <= 1, `Invalid color b: ${b}`);
	assert(Number.isFinite(a) && a >= 0 && a <= 1, `Invalid color a: ${a}`);
	return { r, g, b, a };
}

export interface Side {
	tileId: number;
	neighbor: number;
}

export function side(tileId: number, neighbor: number): Side {
	assert(
		Number.isInteger(tileId) && tileId >= 0,
		`Invalid side tileId: ${tileId}`,
	);
	assert(
		Number.isInteger(neighbor) && neighbor >= 0,
		`Invalid side neighbor: ${neighbor}`,
	);
	return { tileId, neighbor };
}

export interface Tile {
	shape: Point;
	sides: [Side | undefined, Side | undefined, Side | undefined];
}

export function tile(
	shape: Point,
	a: Side | undefined,
	b: Side | undefined,
	c: Side | undefined,
): Tile {
	assert(Number.isFinite(shape.x), `Invalid tile shape x: ${shape.x}`);
	assert(Number.isFinite(shape.y), `Invalid tile shape y: ${shape.y}`);
	assert(shape.y > 0, `Tile shape y must be positive: ${shape.y}`);
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

export function arrayPlan(slug: string, tiles: Tile[]): Plan {
	assert(tiles.length > 0, `Plan "${slug}" must include at least one tile`);
	return plan(slug, (id: number): Tile => {
		assert(Number.isInteger(id), `Invalid tile id: ${id}`);
		assert(id >= 0 && id < tiles.length, `Tile id out of range: ${id}`);
		return tiles[id];
	});
}

export interface Segment {
	start: Point;
	end: Point;
}

export interface CornerWall {
	left?: Point;
	right?: Point;
}

export interface RenderStats {
	tiles: number;
	branches: number;
	avatars: number;
	maxDepth: number;
	renderDuration: number;
}

export type MouseAction = "down" | "up" | "move" | "drag" | "out";
export type RenderType = "none" | "wall" | "corner";
