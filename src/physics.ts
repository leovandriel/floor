import {
	getInsetEdge,
	getInwardNormal,
	isInsideTile,
	type ShapeSide,
	transitionPosition,
	transitionRotation,
	transitionScale,
} from "./geometry";
import * as math from "./math";
import { epsilon } from "./math";
import { ensureCornerWalls } from "./plan";
import {
	getSideCorners,
	getSideOppositeCorner,
	getTileCorners,
} from "./topology";
import type { Plan, Point } from "./types";
import { point } from "./types";

export { transitionPosition } from "./geometry";

export default class Physics {
	currentTileId = 0;
	position = point(0.5, 0.2);
	rotation = 0;
	scale = 0.2;
	avatarRadius = 0.01;
	plan: Plan;

	constructor(plan: Plan) {
		this.plan = plan;
	}

	simulatePhysics(next: Point, wallCount = 0): Point {
		if (wallCount >= 2) return this.position;
		const { shape, sides } = this.plan.get(this.currentTileId);
		const avatarRadiusWorld = this.avatarRadius / this.scale;
		const corners = getTileCorners(shape);
		for (let sideIndex = 0; sideIndex < 3; sideIndex++) {
			const [sideStartIndex, sideEndIndex] = getSideCorners(sideIndex);
			const sideStart = corners[sideStartIndex];
			const sideEnd = corners[sideEndIndex];
			const side = sides[sideIndex];
			const collisionEdge =
				side === undefined
					? getInsetEdge(
							sideStart,
							sideEnd,
							corners[getSideOppositeCorner(sideIndex)],
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
					if (!side) {
						// Reflect off solid walls by rewinding to the hit point first.
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
						const { tileId, neighbor } = side;
						const { shape: nextShape } = this.plan.get(tileId);
						const from: ShapeSide = { shape, index: sideIndex };
						const to: ShapeSide = { shape: nextShape, index: neighbor };
						// Seam crossings transport position, heading, and scale together.
						this.position = math.interpolate(this.position, next, movePosition);
						this.rotation = transitionRotation(this.rotation, from, to);
						this.position = transitionPosition(this.position, from, to);
						const shiftedNext = transitionPosition(next, from, to);
						this.scale *= transitionScale(from, to);
						this.currentTileId = tileId;
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
		const { shape, sides } = this.plan.get(this.currentTileId);
		// Clamp into the triangle's axis-aligned envelope first.
		if (this.position.y < 0) this.position.y = 0;
		if (this.position.y > shape.y) this.position.y = shape.y;
		const min = (shape.x * this.position.y) / shape.y;
		if (this.position.x < min) this.position.x = min;
		const max = min + 1 - this.position.y / shape.y;
		if (this.position.x > max) this.position.x = max;

		const avatarRadiusWorld = this.avatarRadius / this.scale;
		const corners = getTileCorners(shape);
		// Push away from closed edges using inset collision lines.
		for (let sideIndex = 0; sideIndex < 3; sideIndex++) {
			if (sides[sideIndex] !== undefined) {
				continue;
			}
			const [sideStartIndex, sideEndIndex] = getSideCorners(sideIndex);
			const sideStart = corners[sideStartIndex];
			const sideEnd = corners[sideEndIndex];
			const inwardNormal = getInwardNormal(
				sideStart,
				sideEnd,
				corners[getSideOppositeCorner(sideIndex)],
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
		// Resolve corner walls after the broad edge push to avoid tunneling into wedges.
		const cornerWalls = ensureCornerWalls(this.plan, this.currentTileId);
		for (let cornerIndex = 0; cornerIndex < 3; cornerIndex++) {
			const cornerWall = cornerWalls[cornerIndex];
			if (!cornerWall) {
				continue;
			}
			const corner = corners[cornerIndex];
			const delta = math.sub(this.position, corner);
			const distance = math.size(delta);
			if (distance < epsilon) {
				const outward = point(0.0, 1.0);
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
			for (const wallDirection of [cornerWall.left, cornerWall.right]) {
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
		// If we still ended up across a seam, transport into the neighboring tile and retry.
		for (let sideIndex = 0; sideIndex < 3; sideIndex++) {
			const side = sides[sideIndex];
			if (!side) {
				continue;
			}
			const { tileId, neighbor } = side;
			const [sideStartIndex, sideEndIndex] = getSideCorners(sideIndex);
			const sideStart = corners[sideStartIndex];
			const sideEnd = corners[sideEndIndex];
			if (!math.isClockwise3(sideStart, sideEnd, this.position)) {
				continue;
			}
			const { shape: nextShape } = this.plan.get(tileId);
			const from: ShapeSide = { shape, index: sideIndex };
			const to: ShapeSide = { shape: nextShape, index: neighbor };
			this.rotation = transitionRotation(this.rotation, from, to);
			this.position = transitionPosition(this.position, from, to);
			this.scale *= transitionScale(from, to);
			this.currentTileId = tileId;
			return this.simulateSnap(depth + 1);
		}
		return false;
	}

	simulateMove(delta: Point): void {
		if (math.isZero(delta)) return;
		const previousCurrentTileId = this.currentTileId;
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
			this.currentTileId = previousCurrentTileId;
			this.position = previousPosition;
			this.rotation = previousRotation;
			this.scale = previousScale;
		}
	}

	simulateTurn(delta: number): void {
		this.rotation += delta;
	}
}
