import assert from "./assert";
import {
	getSideDirectionAtCorner,
	pointAngle,
	transitionDirection,
} from "./geometry";
import { library } from "./library";
import { cross, lengthSq, sub } from "./linalg";
import {
	getCornerAcrossSide,
	getIncidentSides,
	getOtherIncidentSide,
	getTileCorners,
} from "./topology";
import type { CornerWall, Plan, Point, Tile, TileId } from "./types";

const maxPlanValidationDepth = 100;
const maxPlanValidationCount = 1000;
const epsilon = 1e-5;

function tryGetTile(plan: Plan, id: TileId): Tile | undefined {
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

export function assertValidPlan(plan: Plan): void {
	const root = tryGetTile(plan, 0n);
	assert(root, "Missing root tile", 0n);
	const visited = new Set<TileId>();
	const frontier: Array<{ id: TileId; depth: number }> = [{ id: 0n, depth: 0 }];
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
		assert(shape.y >= 0, "Flipped tile", id);
		const [left, top, right] = getTileCorners(shape);
		assert(
			angleSinSq(sub(right, left), sub(top, left)) >= epsilon,
			"Flat tile",
			id,
		);
		assert(
			angleSinSq(sub(left, top), sub(right, top)) >= epsilon,
			"Flat tile",
			id,
		);
		assert(
			angleSinSq(sub(left, right), sub(top, right)) >= epsilon,
			"Flat tile",
			id,
		);
		for (let j = 0; j < 3; j++) {
			const side = sides[j];
			if (!side) {
				continue;
			}
			const { tileId, sideIndex } = side;
			const inverseTile = tryGetTile(plan, tileId);
			assert(inverseTile, "Missing tile at", id, j);
			const inverse = inverseTile.sides[sideIndex];
			assert(inverse, "Inverse missing at", id, j);
			assert(id === inverse.tileId, "Inverse missing at", id, j);
			assert(j === inverse.sideIndex, "Inverse offset at", id, j);
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
	tileIndex: TileId,
	cornerIndex: number,
): Record<number, Point | null> {
	let tileDirections = plan.cornerWallCache[tileIndex.toString()];
	if (!tileDirections) {
		tileDirections = {};
		plan.cornerWallCache[tileIndex.toString()] = tileDirections;
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
	tileIndex: TileId,
	cornerIndex: number,
	sideIndex: number,
	visiting: Set<string>,
	accumulatedTurn = 0,
): Point | undefined {
	if (accumulatedTurn > 0.5) {
		return undefined;
	}
	const key = `${tileIndex}:${cornerIndex}:${sideIndex}`;
	if (accumulatedTurn === 0) {
		const cached =
			plan.cornerWallCache[tileIndex.toString()]?.[cornerIndex]?.[sideIndex];
		if (cached !== undefined) {
			return cached ?? undefined;
		}
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
			// A missing sideIndex means the wall direction is just the local edge ray.
			wallDirection = getSideDirectionAtCorner(shape, sideIndex, cornerIndex);
		} else {
			const { tileId, sideIndex: neighborSideIndex } = side;
			const nextTile = plan.get(tileId);
			const nextCornerIndex = getCornerAcrossSide(
				cornerIndex,
				sideIndex,
				neighborSideIndex,
			);
			const nextSideIndex = getOtherIncidentSide(
				nextCornerIndex,
				neighborSideIndex,
			);
			const direction = getSideDirectionAtCorner(shape, sideIndex, cornerIndex);
			const nextDirection = transitionDirection(
				getSideDirectionAtCorner(
					nextTile.shape,
					nextSideIndex,
					nextCornerIndex,
				),
				{ shape: nextTile.shape, index: neighborSideIndex },
				{ shape, index: sideIndex },
			);
			const deltaTurn =
				((pointAngle(nextDirection) - pointAngle(direction) + 0.5 + 1) % 1) -
				0.5;
			// Trace through the seam until we reach a boundary edge.
			const nextWallDirection = getCornerWallDirection(
				plan,
				tileId,
				nextCornerIndex,
				nextSideIndex,
				visiting,
				accumulatedTurn + Math.abs(deltaTurn),
			);
			if (nextWallDirection) {
				// Bring the traced wall direction back into this tile's local frame.
				wallDirection = transitionDirection(
					nextWallDirection,
					{ shape: nextTile.shape, index: neighborSideIndex },
					{ shape, index: sideIndex },
				);
			}
		}

		visiting.delete(key);
	}
	if (accumulatedTurn === 0) {
		const cornerDirections = ensureCornerWallDirections(
			plan,
			tileIndex,
			cornerIndex,
		);
		cornerDirections[sideIndex] = wallDirection ?? null;
	}
	return wallDirection;
}

export function ensureCornerWalls(
	plan: Plan,
	tileIndex: TileId,
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
		if (left || right) {
			walls[cornerIndex] = { left, right };
		}
	}
	return walls;
}
