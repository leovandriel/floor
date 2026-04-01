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

export function getValidPlan(slug: string): {
	plan: Plan | undefined;
	warnings: string[];
} {
	const plan = getPlanBySlug(slug);
	if (!plan) {
		return { plan: undefined, warnings: [`Unknown plan: ${slug}`] };
	}

	const warnings = checkPlan(plan);
	return warnings.length > 0
		? { plan: undefined, warnings }
		: { plan, warnings };
}

export function checkPlan(plan: Plan): string[] {
	const warnings: string[] = [];
	const root = tryGetTile(plan, 0);
	if (!root) {
		return ["Missing root tile: 0"];
	}

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
		if (!tile) {
			warnings.push(`Missing tile: ${id}`);
			continue;
		}
		const { shape, sides } = tile;
		if (shape.y < -1e-5) {
			warnings.push(`Flipped tile at ${id}`);
		} else if (shape.y < 1e-5) {
			warnings.push(`Flat tile at ${id}`);
		}
		for (let j = 0; j < 3; j++) {
			const side = sides[j];
			if (!side) {
				continue;
			}
			const { tileId, neighbor } = side;
			const inverseTile = tryGetTile(plan, tileId);
			if (!inverseTile) {
				warnings.push(`Missing tile at ${id}:${j}`);
				continue;
			}
			const inverse = inverseTile.sides[neighbor];
			if (!inverse) {
				warnings.push(`Inverse missing at ${id}:${j}`);
				continue;
			}
			if (id !== inverse.tileId) {
				warnings.push(`Inverse missing at ${id}:${j}`);
			}
			if (j !== inverse.neighbor) {
				warnings.push(`Inverse offset at ${id}:${j}`);
			}
			if (
				depth < maxPlanValidationDepth &&
				visited.size + frontier.length < maxPlanValidationCount
			) {
				frontier.push({ id: tileId, depth: depth + 1 });
			}
		}
	}
	if (frontier.length > 0) {
		warnings.push("Plan validation limit reached");
	}
	return warnings;
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
	if (depth >= maxCornerWallDepth) {
		throw new Error(
			`Corner wall recursion limit reached at ${tileIndex}:${cornerIndex}:${sideIndex}`,
		);
	}
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
