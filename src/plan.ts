import assert from "./assert";
import { getCellVertices } from "./geometry";
import { library } from "./library";
import { cross, lengthSq, sub } from "./linalg";
import { triangleFaceIndices } from "./topology";
import type { Cell, CellId, Plan, Point, Triple, VertexWall } from "./types";
import { ensureTriangleVertexWalls } from "./walls";

const maxPlanValidationDepth = 100;
const maxPlanValidationCount = 1000;
const epsilon = 1e-5;

function tryGetCell(plan: Plan, id: CellId): Cell | undefined {
	try {
		return plan.get(id);
	} catch {
		return undefined;
	}
}

function angleSinSq(a: Point, b: Point): number {
	const area = cross(a, b);
	return (area * area) / (lengthSq(a) * lengthSq(b));
}

export function getPlanBySlug(slug: string): Plan | undefined {
	return library.find((plan) => plan.slug === slug);
}

function assertValidCellShape(shape: Point, id: CellId): void {
	assert(shape.y >= 0, "Flipped cell", id);
	const [left, top, right] = getCellVertices(shape);
	assert(
		angleSinSq(sub(right, left), sub(top, left)) >= epsilon,
		"Flat cell",
		id,
	);
	assert(
		angleSinSq(sub(left, top), sub(right, top)) >= epsilon,
		"Flat cell",
		id,
	);
	assert(
		angleSinSq(sub(left, right), sub(top, right)) >= epsilon,
		"Flat cell",
		id,
	);
}

function assertReciprocalFace(
	plan: Plan,
	id: CellId,
	faceIndex: number,
	face: NonNullable<Cell["faces"][number]>,
): void {
	const inverseCell = tryGetCell(plan, face.cellId);
	assert(inverseCell, "Missing cell at", id, faceIndex);
	const inverse = inverseCell.faces[face.faceIndex];
	assert(inverse, "Inverse missing at", id, faceIndex);
	assert(id === inverse.cellId, "Inverse missing at", id, faceIndex);
	assert(faceIndex === inverse.faceIndex, "Inverse offset at", id, faceIndex);
}

export function assertValidPlan(plan: Plan): void {
	const root = tryGetCell(plan, 0n);
	assert(root, "Missing root cell", 0n);
	const visited = new Set<CellId>();
	const frontier: Array<{ id: CellId; depth: number }> = [{ id: 0n, depth: 0 }];
	while (frontier.length > 0) {
		const next = frontier.shift();
		if (!next) {
			break;
		}
		const { id, depth } = next;
		if (visited.has(id)) {
			continue;
		}
		visited.add(id);
		const cell = tryGetCell(plan, id);
		assert(cell, "Missing cell", id);
		const { faces } = cell;
		assertValidCellShape(cell.shape, id);
		for (const j of triangleFaceIndices) {
			const face = faces[j];
			if (!face) {
				continue;
			}
			assertReciprocalFace(plan, id, j, face);
			if (
				depth < maxPlanValidationDepth &&
				visited.size + frontier.length < maxPlanValidationCount
			) {
				frontier.push({ id: face.cellId, depth: depth + 1 });
			}
		}
	}
}

export function ensureVertexWalls(
	plan: Plan,
	cellIndex: CellId,
): Triple<VertexWall | undefined> {
	return ensureTriangleVertexWalls(plan, cellIndex);
}
