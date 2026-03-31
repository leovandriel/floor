import * as math from "./math";
import { epsilon, point } from "./math";
import type { CornerWall, Plan, Point, Segment } from "./types";

interface ShapeOffset {
	shape: Point;
	offset: number;
}

function getInwardNormal(
	sideStart: Point,
	sideEnd: Point,
	interiorPoint: Point,
): Point {
	const edge = math.sub(sideEnd, sideStart);
	const length = math.size(edge);
	if (length < epsilon) {
		return point(0, 0);
	}
	const normalA = point(-edge.y / length, edge.x / length);
	return math.dot(math.sub(interiorPoint, sideStart), normalA) > 0
		? normalA
		: math.mul(normalA, -1);
}

function isInsideTile(position: Point, shape: Point): boolean {
	if (position.y < -epsilon || position.y > shape.y + epsilon) {
		return false;
	}
	const min = (shape.x * position.y) / shape.y;
	const max = min + 1 - position.y / shape.y;
	return position.x >= min - epsilon && position.x <= max + epsilon;
}

export function getTileCorners(shape: Point): [Point, Point, Point] {
	return [point(0, 0), shape, point(1, 0)];
}

function getIncidentSides(cornerIndex: number): [number, number] {
	return [cornerIndex, (cornerIndex + 1) % 3];
}

function getCornerAcrossSide(
	cornerIndex: number,
	sideIndex: number,
	offset: number,
): number {
	return cornerIndex === (sideIndex + 2) % 3 ? offset : (offset + 2) % 3;
}

export function shiftPosition(
	{ shape, offset }: ShapeOffset,
	position: Point,
): Point {
	switch (offset) {
		case 0:
			return position;
		case 1: {
			const d = shape.x * shape.x + shape.y * shape.y;
			return point(
				1 - (shape.x * position.x + shape.y * position.y) / d,
				(shape.y * position.x - shape.x * position.y) / d,
			);
		}
		case 2: {
			const e = (1 - shape.x) * (1 - shape.x) + shape.y * shape.y;
			return point(
				((1 - shape.x) * (1 - position.x) + shape.y * position.y) / e,
				(shape.y * (1 - position.x) - (1 - shape.x) * position.y) / e,
			);
		}
	}
	return position;
}

function unshiftPosition(
	{ shape, offset }: ShapeOffset,
	position: Point,
): Point {
	switch (offset) {
		case 0:
			return position;
		case 1:
			return point(
				shape.x * (1 - position.x) + shape.y * position.y,
				shape.y * (1 - position.x) - shape.x * position.y,
			);
		case 2:
			return point(
				1 - (1 - shape.x) * position.x - shape.y * position.y,
				shape.y * position.x - (1 - shape.x) * position.y,
			);
	}
	return position;
}

function shiftScale({ shape, offset }: ShapeOffset): number {
	switch (offset) {
		case 0:
			return 1;
		case 1:
			return math.size(shape);
		case 2:
			return math.size(point(1 - shape.x, shape.y));
	}
	return 1;
}

function getInsetEdge(
	sideStart: Point,
	sideEnd: Point,
	interiorPoint: Point,
	inset: number,
): Segment {
	const inwardNormal = getInwardNormal(sideStart, sideEnd, interiorPoint);
	return {
		start: math.add(sideStart, math.mul(inwardNormal, inset)),
		end: math.add(sideEnd, math.mul(inwardNormal, inset)),
	};
}

export function handleTransition(
	position: Point,
	from: ShapeOffset,
	to: ShapeOffset,
): Point {
	const shift1 = shiftPosition(from, position);
	const shift2 = point(1 - shift1.x, -shift1.y);
	return unshiftPosition(to, shift2);
}

function transitionRotation(
	position: Point,
	rotation: number,
	from: ShapeOffset,
	to: ShapeOffset,
): number {
	const delta = 1e-6;
	const forwardPoint = point(
		position.x + math.sinTurns(rotation) * delta,
		position.y + math.cosTurns(rotation) * delta,
	);
	const shiftedPosition = handleTransition(position, from, to);
	const shiftedForward = handleTransition(forwardPoint, from, to);
	return math.atan2Turns(
		shiftedForward.x - shiftedPosition.x,
		shiftedForward.y - shiftedPosition.y,
	);
}

export default class Physics {
	current = 0;
	position = point(0.5, 0.2);
	rotation = 0;
	scale = 0.2;
	avatarRadius = 0.01;
	plan: Plan;

	constructor(plan: Plan) {
		this.plan = plan;
		this.populateCornerWalls();
	}

	traceCornerWallDirection(
		startTileIndex: number,
		startCornerIndex: number,
		startSideIndex: number,
	): Point | undefined {
		const visited = new Set<string>();
		const transitions: Array<{ from: ShapeOffset; to: ShapeOffset }> = [];
		let tileIndex = startTileIndex;
		let cornerIndex = startCornerIndex;
		let sideIndex = startSideIndex;
		while (true) {
			const key = `${tileIndex}:${cornerIndex}:${sideIndex}`;
			if (visited.has(key)) {
				return undefined;
			}
			visited.add(key);
			const { shape, sides } = this.plan.tiles[tileIndex];
			const { index, offset } = sides[sideIndex];
			if (index < 0) {
				const corners = getTileCorners(shape);
				const sideStart = corners[(sideIndex + 2) % 3];
				const sideEnd = corners[sideIndex];
				const otherCorner =
					cornerIndex === (sideIndex + 2) % 3 ? sideEnd : sideStart;
				let wallCorner = corners[cornerIndex];
				let wallEnd = otherCorner;
				for (let i = transitions.length - 1; i >= 0; i--) {
					const { from, to } = transitions[i];
					wallCorner = handleTransition(wallCorner, to, from);
					wallEnd = handleTransition(wallEnd, to, from);
				}
				const direction = math.sub(wallEnd, wallCorner);
				if (math.size(direction) < epsilon) {
					return undefined;
				}
				return direction;
			}
			const nextCornerIndex = getCornerAcrossSide(
				cornerIndex,
				sideIndex,
				offset,
			);
			const [a, b] = getIncidentSides(nextCornerIndex);
			transitions.push({
				from: { shape, offset: sideIndex },
				to: { shape: this.plan.tiles[index].shape, offset },
			});
			tileIndex = index;
			cornerIndex = nextCornerIndex;
			sideIndex = a === offset ? b : a;
		}
	}

	populateCornerWalls(): void {
		for (let tileIndex = 0; tileIndex < this.plan.tiles.length; tileIndex++) {
			const walls: [
				CornerWall | undefined,
				CornerWall | undefined,
				CornerWall | undefined,
			] = [undefined, undefined, undefined];
			for (let cornerIndex = 0; cornerIndex < 3; cornerIndex++) {
				const [a, b] = getIncidentSides(cornerIndex);
				const wallA =
					this.plan.tiles[tileIndex].sides[a].index < 0
						? undefined
						: this.traceCornerWallDirection(tileIndex, cornerIndex, a);
				const wallB =
					this.plan.tiles[tileIndex].sides[b].index < 0
						? undefined
						: this.traceCornerWallDirection(tileIndex, cornerIndex, b);
				if (
					(wallA || wallB) &&
					(!wallA ||
						!wallB ||
						Math.abs(wallA.x * wallB.y - wallA.y * wallB.x) > epsilon)
				) {
					walls[cornerIndex] = [wallA, wallB];
				}
			}
			this.plan.tiles[tileIndex].cornerWalls = walls;
		}
	}

	simulatePhysics(next: Point, wallCount = 0): Point {
		if (wallCount >= 2) return this.position;
		const { shape, sides } = this.plan.tiles[this.current];
		const avatarRadiusWorld = this.avatarRadius / this.scale;
		const corners: [Point, Point, Point] = [point(0, 0), shape, point(1, 0)];
		for (let sideIndex = 0; sideIndex < 3; sideIndex++) {
			const sideStart = corners[(sideIndex + 2) % 3];
			const sideEnd = corners[sideIndex];
			const { index, offset } = sides[sideIndex];
			const collisionEdge =
				index < 0
					? getInsetEdge(
							sideStart,
							sideEnd,
							corners[(sideIndex + 1) % 3],
							avatarRadiusWorld,
						)
					: { start: sideStart, end: sideEnd };
			if (math.isClockwise3(collisionEdge.start, collisionEdge.end, next)) {
				const { x: edgePosition, y: movePosition } = math.intersect(
					collisionEdge.start,
					collisionEdge.end,
					this.position,
					next,
				);
				if (
					edgePosition > -epsilon &&
					edgePosition < 1 + epsilon &&
					movePosition > -epsilon &&
					movePosition < 1 + epsilon
				) {
					if (index < 0) {
						this.position = math.interpolate(
							this.position,
							next,
							movePosition - epsilon,
						);
						const wallIntersection = math.interpolate(
							collisionEdge.start,
							collisionEdge.end,
							edgePosition,
						);
						const reflectedDelta = math.project3(
							collisionEdge.start,
							wallIntersection,
							next,
						);
						const reflectedNext = math.add(reflectedDelta, this.position);
						this.simulatePhysics(reflectedNext, wallCount + 1);
					} else {
						const { shape: nextShape } = this.plan.tiles[index];
						const from = { shape, offset: sideIndex };
						const to = { shape: nextShape, offset };
						this.position = math.interpolate(this.position, next, movePosition);
						this.rotation = transitionRotation(
							this.position,
							this.rotation,
							from,
							to,
						);
						this.position = handleTransition(this.position, from, to);
						const shiftedNext = handleTransition(next, from, to);
						this.scale *= shiftScale(from) / shiftScale(to);
						this.current = index;
						this.simulatePhysics(shiftedNext, wallCount);
					}
					return this.position;
				}
			}
		}
		this.position = next;
		return this.position;
	}

	simulateSnap(depth = 0): boolean {
		if (depth > 8) {
			return false;
		}
		const { shape, sides } = this.plan.tiles[this.current];
		if (this.position.y < 0) this.position.y = 0;
		if (this.position.y > shape.y) this.position.y = shape.y;
		const min = (shape.x * this.position.y) / shape.y;
		if (this.position.x < min) this.position.x = min;
		const max = min + 1 - this.position.y / shape.y;
		if (this.position.x > max) this.position.x = max;

		const avatarRadiusWorld = this.avatarRadius / this.scale;
		const corners: [Point, Point, Point] = [point(0, 0), shape, point(1, 0)];
		for (let sideIndex = 0; sideIndex < 3; sideIndex++) {
			if (sides[sideIndex].index >= 0) {
				continue;
			}
			const sideStart = corners[(sideIndex + 2) % 3];
			const sideEnd = corners[sideIndex];
			const inwardNormal = getInwardNormal(
				sideStart,
				sideEnd,
				corners[(sideIndex + 1) % 3],
			);
			const signedDistance = math.dot(
				math.sub(this.position, sideStart),
				inwardNormal,
			);
			if (signedDistance < avatarRadiusWorld) {
				this.position = math.add(
					this.position,
					math.mul(inwardNormal, avatarRadiusWorld - signedDistance + epsilon),
				);
			}
		}
		for (let cornerIndex = 0; cornerIndex < 3; cornerIndex++) {
			const cornerWall =
				this.plan.tiles[this.current].cornerWalls?.[cornerIndex];
			if (!cornerWall) {
				continue;
			}
			const corner = corners[cornerIndex];
			const delta = math.sub(this.position, corner);
			const distance = math.size(delta);
			if (distance < epsilon) {
				const outward = point(0, 1);
				this.position = math.add(
					corner,
					math.mul(outward, avatarRadiusWorld + epsilon),
				);
				continue;
			}
			if (distance < avatarRadiusWorld) {
				this.position = math.add(
					corner,
					math.mul(delta, (avatarRadiusWorld + epsilon) / distance),
				);
			}
			for (const wallDirection of cornerWall) {
				if (!wallDirection) {
					continue;
				}
				const wallRayEnd = math.add(corner, wallDirection);
				const wallDistanceSq = math.lineDistanceSq(
					corner,
					wallRayEnd,
					this.position,
				);
				const wallOffset = math.dot(delta, wallDirection);
				if (
					wallOffset < 0 ||
					wallDistanceSq >= avatarRadiusWorld * avatarRadiusWorld
				) {
					continue;
				}
				const inwardNormal = getInwardNormal(corner, wallRayEnd, this.position);
				const signedDistance = math.dot(
					math.sub(this.position, corner),
					inwardNormal,
				);
				if (signedDistance < avatarRadiusWorld) {
					this.position = math.add(
						this.position,
						math.mul(
							inwardNormal,
							avatarRadiusWorld - signedDistance + epsilon,
						),
					);
				}
			}
		}
		if (isInsideTile(this.position, shape)) {
			return true;
		}
		for (let sideIndex = 0; sideIndex < 3; sideIndex++) {
			const { index, offset } = sides[sideIndex];
			if (index < 0) {
				continue;
			}
			const sideStart = corners[(sideIndex + 2) % 3];
			const sideEnd = corners[sideIndex];
			if (!math.isClockwise3(sideStart, sideEnd, this.position)) {
				continue;
			}
			const { shape: nextShape } = this.plan.tiles[index];
			const from = { shape, offset: sideIndex };
			const to = { shape: nextShape, offset };
			this.rotation = transitionRotation(
				this.position,
				this.rotation,
				from,
				to,
			);
			this.position = handleTransition(this.position, from, to);
			this.scale *= shiftScale(from) / shiftScale(to);
			this.current = index;
			return this.simulateSnap(depth + 1);
		}
		return false;
	}

	simulateMove(delta: Point): void {
		if (math.isZero(delta)) return;
		const previousCurrent = this.current;
		const previousPosition = point(this.position.x, this.position.y);
		const previousRotation = this.rotation;
		const previousScale = this.scale;
		const sin = math.sinTurns(this.rotation);
		const cos = math.cosTurns(this.rotation);
		const next = point(
			this.position.x + (cos * delta.x + sin * delta.y) / this.scale,
			this.position.y + (-sin * delta.x + cos * delta.y) / this.scale,
		);
		this.simulatePhysics(next);
		if (!this.simulateSnap()) {
			this.current = previousCurrent;
			this.position = previousPosition;
			this.rotation = previousRotation;
			this.scale = previousScale;
		}
	}

	simulateTurn(delta: number): void {
		this.rotation += delta;
	}
}
