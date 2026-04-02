import assert from "./assert";
import { getSideDirectionAtCorner, transitionDirection } from "./geometry";
import { library } from "./library";
import { epsilon } from "./math";
import {
	getCornerAcrossSide,
	getIncidentSides,
	getOtherIncidentSide,
} from "./topology";
import type { CornerWall, Plan, Point, Tile } from "./types";

const maxPlanValidationDepth = 100;
const maxPlanValidationCount = 1000;
const maxCornerWallDepth = 10;

function tryGetTile(plan: Plan, id: number): Tile | undefined {
	try {
		return plan.get(id);
	} catch {
		return undefined;
	}
}

export function getPlanBySlug(slug: string): Plan | undefined {
	return library.find((plan) => plan.slug === slug);
}

export function getValidPlan(slug: string): Plan | undefined {
	const plan = getPlanBySlug(slug);
	if (!plan) {
		return undefined;
	}
	checkPlan(plan);
	return plan;
}

export function checkPlan(plan: Plan): void {
	const root = tryGetTile(plan, 0);
	assert(root, "Missing root tile", 0);
	const visited = new Set<number>();
	const frontier: Array<{ id: number; depth: number }> = [{ id: 0, depth: 0 }];
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
		const tile = tryGetTile(plan, id);
		assert(tile, "Missing tile", id);
		const { shape, sides } = tile;
		assert(shape.y >= -1e-5, "Flipped tile", id);
		assert(shape.y >= 1e-5, "Flat tile", id);
		for (let j = 0; j < 3; j++) {
			const side = sides[j];
			if (!side) {
				continue;
			}
			const { tileId, neighbor } = side;
			const inverseTile = tryGetTile(plan, tileId);
			assert(inverseTile, "Missing tile at", id, j);
			const inverse = inverseTile.sides[neighbor];
			assert(inverse, "Inverse missing at", id, j);
			assert(id === inverse.tileId, "Inverse missing at", id, j);
			assert(j === inverse.neighbor, "Inverse offset at", id, j);
			if (
				depth < maxPlanValidationDepth &&
				visited.size + frontier.length < maxPlanValidationCount
			) {
				frontier.push({ id: tileId, depth: depth + 1 });
			}
		}
	}
}

function ensureCornerWallDirections(
	plan: Plan,
	tileIndex: number,
	cornerIndex: number,
): Record<number, Point | null> {
	let tileDirections = plan.cornerWallCache[tileIndex];
	if (!tileDirections) {
		tileDirections = {};
		plan.cornerWallCache[tileIndex] = tileDirections;
	}
	let cornerDirections = tileDirections[cornerIndex];
	if (!cornerDirections) {
		cornerDirections = {};
		tileDirections[cornerIndex] = cornerDirections;
	}
	return cornerDirections;
}

function getCornerWallDirection(
	plan: Plan,
	tileIndex: number,
	cornerIndex: number,
	sideIndex: number,
	visiting: Set<string>,
	depth = 0,
): Point | undefined {
	assert(
		depth < maxCornerWallDepth,
		"Corner wall recursion limit reached",
		tileIndex,
		cornerIndex,
		sideIndex,
	);
	const key = `${tileIndex}:${cornerIndex}:${sideIndex}`;
	const cached = plan.cornerWallCache[tileIndex]?.[cornerIndex]?.[sideIndex];
	if (cached !== undefined) {
		return cached ?? undefined;
	}
	let wallDirection: Point | undefined;
	// Abort recursive corner cycles by caching the missing direction.
	if (visiting.has(key)) {
		wallDirection = undefined;
	} else {
		visiting.add(key);

		const { shape, sides } = plan.get(tileIndex);
		const side = sides[sideIndex];
		if (!side) {
			// A missing neighbor means the wall direction is just the local edge ray.
			wallDirection = getSideDirectionAtCorner(shape, sideIndex, cornerIndex);
		} else {
			const { tileId, neighbor } = side;
			const nextTile = plan.get(tileId);
			const nextCornerIndex = getCornerAcrossSide(
				cornerIndex,
				sideIndex,
				neighbor,
			);
			const nextSideIndex = getOtherIncidentSide(nextCornerIndex, neighbor);
			// Trace through the seam until we reach a boundary edge.
			const nextWallDirection = getCornerWallDirection(
				plan,
				tileId,
				nextCornerIndex,
				nextSideIndex,
				visiting,
				depth + 1,
			);
			if (nextWallDirection) {
				// Bring the traced wall direction back into this tile's local frame.
				wallDirection = transitionDirection(
					nextWallDirection,
					{ shape: nextTile.shape, index: neighbor },
					{ shape, index: sideIndex },
				);
			}
		}

		visiting.delete(key);
	}
	const cornerDirections = ensureCornerWallDirections(
		plan,
		tileIndex,
		cornerIndex,
	);
	cornerDirections[sideIndex] = wallDirection ?? null;
	return wallDirection;
}

export function ensureCornerWalls(
	plan: Plan,
	tileIndex: number,
): [CornerWall | undefined, CornerWall | undefined, CornerWall | undefined] {
	const tile = plan.get(tileIndex);
	const walls: [
		CornerWall | undefined,
		CornerWall | undefined,
		CornerWall | undefined,
	] = [undefined, undefined, undefined];
	for (let cornerIndex = 0; cornerIndex < 3; cornerIndex++) {
		const [leftSide, rightSide] = getIncidentSides(cornerIndex);
		const directions: [Point | undefined, Point | undefined] = [
			undefined,
			undefined,
		];
		// Resolve each incident wall direction independently, then assemble the pair.
		for (const [directionIndex, sideIndex] of [leftSide, rightSide].entries()) {
			if (tile.sides[sideIndex] === undefined) {
				continue;
			}
			directions[directionIndex] = getCornerWallDirection(
				plan,
				tileIndex,
				cornerIndex,
				sideIndex,
				new Set<string>(),
			);
		}
		const [left, right] = directions;
		if (
			(left || right) &&
			(!left ||
				!right ||
				Math.abs(left.x * right.y - left.y * right.x) > epsilon)
		) {
			walls[cornerIndex] = { left, right };
		}
	}
	return walls;
}
