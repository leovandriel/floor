import assert from "./assert";
import { TupleMap } from "./tuple";

export type CellId = bigint;
export type Triple<T> = [T, T, T];

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

export interface Face {
	cellId: CellId;
	faceIndex: number;
}

export function face(cellId: CellId, faceIndex: number): Face {
	assert(cellId >= 0n, "Invalid face cellId", cellId);
	assert(
		Number.isInteger(faceIndex) && faceIndex >= 0,
		"Invalid face faceIndex",
		faceIndex,
	);
	return { cellId, faceIndex };
}

export interface Cell {
	shape: Point;
	faces: Triple<Face | undefined>;
}

export interface ShapeFace {
	shape: Point;
	index: number;
}

export function cell(
	shape: Point,
	a: Face | undefined,
	b: Face | undefined,
	c: Face | undefined,
): Cell {
	assert(Number.isFinite(shape.x), "Invalid cell shape x", shape.x);
	assert(Number.isFinite(shape.y), "Invalid cell shape y", shape.y);
	assert(shape.y > 0, "Cell shape y must be positive", shape.y);
	return { shape, faces: triple(a, b, c) };
}

export function triple(): Triple<undefined>;
export function triple<T>(a: T, b: T, c: T): Triple<T>;
export function triple<T>(a?: T, b?: T, c?: T): Triple<T | undefined> {
	return [a, b, c];
}

export function mapTriple<T, U>(
	values: Triple<T>,
	mapper: (value: T, index: number) => U,
): Triple<U> {
	return triple(
		mapper(values[0], 0),
		mapper(values[1], 1),
		mapper(values[2], 2),
	);
}

export interface Plan {
	slug: string;
	get(id: CellId): Cell;
	deterministic: boolean;
	vertexWallCache: TupleMap<[CellId, number, number], Point | null>;
}

export interface SupportState {
	cellId: CellId;
	position: Point;
	rotation: number;
	scale: number;
}

export interface CameraState {
	rotation: number;
	offset: Point;
}

export function plan(
	slug: string,
	get: (id: CellId) => Cell,
	deterministic = true,
): Plan {
	assert(slug.length > 0, "Plan slug must not be empty");
	return {
		slug,
		get,
		deterministic,
		vertexWallCache: new TupleMap<[CellId, number, number], Point | null>(),
	};
}

export interface Segment {
	start: Point;
	end: Point;
}

export function segment(start: Point, end: Point): Segment {
	return { start, end };
}

export interface Transform {
	basisX: Point;
	basisY: Point;
	offset: Point;
}

export function transform(
	basisX: Point,
	basisY: Point,
	offset: Point,
): Transform {
	return { basisX, basisY, offset };
}

export interface VertexWall {
	left?: Point;
	right?: Point;
}

export interface RenderStats {
	cells: number;
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
