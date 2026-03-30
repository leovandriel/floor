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
}

export interface Plan {
	tiles: Tile[];
}

export interface Segment {
	start: Point;
	end: Point;
}

export type MouseAction = "down" | "up" | "move" | "drag" | "out";
export type RenderType = "none" | "wall" | "corner";
