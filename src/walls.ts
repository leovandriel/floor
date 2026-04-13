import {
	getFaceDirectionAtVertex,
	pointAngle,
	transitionDirection,
} from "./geometry";
import {
	getIncidentFaces,
	getOtherIncidentFace,
	getVertexAcrossFace,
	triangleVertexIndices,
} from "./topology";
import { TupleSet } from "./tuple";
import type { CellId, Plan, Point, Triple, VertexWall } from "./types";
import { triple } from "./types";

function getVertexWallDirection(
	plan: Plan,
	cellIndex: CellId,
	vertexIndex: number,
	faceIndex: number,
	visiting: TupleSet<[CellId, number, number]>,
	accumulatedTurn = 0,
): Point | undefined {
	if (accumulatedTurn > 0.5) {
		return undefined;
	}
	if (accumulatedTurn === 0) {
		const cached = plan.vertexWallCache.get([
			cellIndex,
			vertexIndex,
			faceIndex,
		]);
		if (cached !== undefined) {
			return cached ?? undefined;
		}
	}
	let wallDirection: Point | undefined;
	if (visiting.has([cellIndex, vertexIndex, faceIndex])) {
		wallDirection = undefined;
	} else {
		visiting.add([cellIndex, vertexIndex, faceIndex]);

		const { shape, faces } = plan.get(cellIndex);
		const face = faces[faceIndex];
		if (!face) {
			wallDirection = getFaceDirectionAtVertex(shape, faceIndex, vertexIndex);
		} else {
			const { cellId, faceIndex: neighborFaceIndex } = face;
			const neighborCell = plan.get(cellId);
			const neighborVertexIndex = getVertexAcrossFace(
				vertexIndex,
				faceIndex,
				neighborFaceIndex,
			);
			const neighborExitFaceIndex = getOtherIncidentFace(
				neighborVertexIndex,
				neighborFaceIndex,
			);
			const direction = getFaceDirectionAtVertex(shape, faceIndex, vertexIndex);
			const neighborDirection = transitionDirection(
				getFaceDirectionAtVertex(
					neighborCell.shape,
					neighborExitFaceIndex,
					neighborVertexIndex,
				),
				{ shape: neighborCell.shape, index: neighborFaceIndex },
				{ shape, index: faceIndex },
			);
			const deltaTurn =
				((pointAngle(neighborDirection) - pointAngle(direction) + 0.5 + 1) %
					1) -
				0.5;
			const neighborWallDirection = getVertexWallDirection(
				plan,
				cellId,
				neighborVertexIndex,
				neighborExitFaceIndex,
				visiting,
				accumulatedTurn + Math.abs(deltaTurn),
			);
			if (neighborWallDirection) {
				wallDirection = transitionDirection(
					neighborWallDirection,
					{ shape: neighborCell.shape, index: neighborFaceIndex },
					{ shape, index: faceIndex },
				);
			}
		}

		visiting.delete([cellIndex, vertexIndex, faceIndex]);
	}
	if (accumulatedTurn === 0) {
		plan.vertexWallCache.set(
			[cellIndex, vertexIndex, faceIndex],
			wallDirection ?? null,
		);
	}
	return wallDirection;
}

export function ensureTriangleVertexWalls(
	plan: Plan,
	cellIndex: CellId,
): Triple<VertexWall | undefined> {
	const cell = plan.get(cellIndex);
	const walls: Triple<VertexWall | undefined> = triple();
	for (const vertexIndex of triangleVertexIndices) {
		const [leftFace, rightFace] = getIncidentFaces(vertexIndex);
		const directions: [Point | undefined, Point | undefined] = [
			undefined,
			undefined,
		];
		for (const [directionIndex, faceIndex] of [leftFace, rightFace].entries()) {
			if (cell.faces[faceIndex] === undefined) {
				continue;
			}
			directions[directionIndex] = getVertexWallDirection(
				plan,
				cellIndex,
				vertexIndex,
				faceIndex,
				new TupleSet<[CellId, number, number]>(),
			);
		}
		const [left, right] = directions;
		if (left || right) {
			walls[vertexIndex] = { left, right };
		}
	}
	return walls;
}
