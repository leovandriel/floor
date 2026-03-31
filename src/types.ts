export interface Point {
	x: number;
	y: number;
}

export interface Color {
	r: number;
	g: number;
	b: number;
	a: number;
}

export interface Side {
	index: number;
	offset: number;
}

export interface Tile {
	shape: Point;
	sides: [Side, Side, Side];
	cornerWalls?: [
		CornerWall | undefined,
		CornerWall | undefined,
		CornerWall | undefined,
	];
}

export interface Plan {
	tiles: Tile[];
}

export interface Segment {
	start: Point;
	end: Point;
}

export type CornerWall = [Point | undefined, Point | undefined];

export interface RenderStats {
	tiles: number;
	branches: number;
	avatars: number;
	maxDepth: number;
}

export type MouseAction = "down" | "up" | "move" | "drag" | "out";
export type RenderType = "none" | "wall" | "corner";
