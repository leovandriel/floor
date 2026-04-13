import {
	getCellBounds,
	getCellVertices,
	getFaceSegment,
	getInsetEdge,
	getInwardNormal,
	isInsideCell,
	rotateScale,
	transitionPosition,
	transitionRotation,
	transitionScale,
} from "./geometry";
import * as math from "./linalg";
import { ensureVertexWalls } from "./plan";
import { triangleFaceIndices, triangleVertexIndices } from "./topology";
import type {
	CameraState,
	CellId,
	Plan,
	Point,
	ShapeFace,
	SupportState,
} from "./types";
import { point, segment } from "./types";

export { transitionPosition } from "./geometry";

const epsilon = 1e-5;

export default class Physics {
	private readonly supportState: SupportState = {
		cellId: 0n,
		position: point(0.5, 0.25),
		rotation: 0,
		scale: 0.2,
	};
	private readonly cameraState: CameraState = {
		rotation: 0,
		offset: point(0.0, 0.0),
	};
	avatarRadius = 0.01;
	plan: Plan;

	constructor(plan: Plan) {
		this.plan = plan;
		this.resetWorld();
	}

	get support(): SupportState {
		return this.supportState;
	}

	get camera(): CameraState {
		return this.cameraState;
	}

	get currentCellId(): CellId {
		return this.supportState.cellId;
	}

	set currentCellId(value: CellId) {
		this.supportState.cellId = value;
	}

	get position(): Point {
		return this.supportState.position;
	}

	set position(value: Point) {
		this.supportState.position = value;
	}

	get rotation(): number {
		return this.supportState.rotation;
	}

	set rotation(value: number) {
		this.supportState.rotation = value;
	}

	get scale(): number {
		return this.supportState.scale;
	}

	set scale(value: number) {
		this.supportState.scale = value;
	}

	get worldRotation(): number {
		return this.cameraState.rotation;
	}

	set worldRotation(value: number) {
		this.cameraState.rotation = value;
	}

	get worldOffset(): Point {
		return this.cameraState.offset;
	}

	set worldOffset(value: Point) {
		this.cameraState.offset = value;
	}

	private worldDelta(position: Point): Point {
		return rotateScale(
			position,
			-this.cameraState.rotation,
			this.supportState.scale,
		);
	}

	getWorldPoint(position: Point): Point {
		return math.sub(this.worldOffset, this.worldDelta(position));
	}

	private setWorldPoint(position: Point, worldPosition: Point): void {
		this.cameraState.offset = math.add(
			worldPosition,
			this.worldDelta(position),
		);
	}

	resetWorld(): void {
		this.cameraState.rotation = this.supportState.rotation;
		this.setWorldPoint(this.supportState.position, point(0.0, 0.0));
	}

	private transport(from: ShapeFace, to: ShapeFace): void {
		const turn = transitionRotation(from, to);
		const worldPosition = this.getWorldPoint(this.supportState.position);
		this.supportState.rotation += turn;
		this.cameraState.rotation += turn;
		this.supportState.position = transitionPosition(
			this.supportState.position,
			from,
			to,
		);
		this.supportState.scale *= transitionScale(from, to);
		this.setWorldPoint(this.supportState.position, worldPosition);
	}

	simulatePhysics(next: Point, wallCount = 0): Point {
		if (wallCount >= 2) return this.position;
		const { shape, faces } = this.plan.get(this.currentCellId);
		const avatarRadiusWorld = this.avatarRadius / this.scale;
		const vertices = getCellVertices(shape);
		for (const faceIndex of triangleFaceIndices) {
			const { start: faceStart, end: faceEnd } = getFaceSegment(
				vertices,
				faceIndex,
			);
			const face = faces[faceIndex];
			const collisionEdge =
				face === undefined
					? getInsetEdge(faceStart, faceEnd, avatarRadiusWorld)
					: segment(faceStart, faceEnd);
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
					if (!face) {
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
						const reflectedDelta = math.projectOffset(
							collisionEdge.start,
							wallIntersection,
							next,
						);
						const reflectedNext = math.add(reflectedDelta, this.position);
						this.simulatePhysics(reflectedNext, wallCount + 1);
					} else {
						const { cellId, faceIndex: neighborFaceIndex } = face;
						const { shape: nextShape } = this.plan.get(cellId);
						const from: ShapeFace = { shape, index: faceIndex };
						const to: ShapeFace = {
							shape: nextShape,
							index: neighborFaceIndex,
						};
						// Seam crossings transport position, heading, and scale together.
						this.position = math.interpolate(this.position, next, movePosition);
						this.transport(from, to);
						const shiftedNext = transitionPosition(next, from, to);
						this.currentCellId = cellId;
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
		const { shape, faces } = this.plan.get(this.currentCellId);
		// Clamp into the triangle's axis-aligned envelope first.
		if (this.position.y < 0) this.position.y = 0;
		if (this.position.y > shape.y) this.position.y = shape.y;
		const [min, max] = getCellBounds(shape, this.position.y);
		if (this.position.x < min) this.position.x = min;
		if (this.position.x > max) this.position.x = max;

		const avatarRadiusWorld = this.avatarRadius / this.scale;
		const vertices = getCellVertices(shape);
		// Push away from closed edges using inset collision lines.
		for (const faceIndex of triangleFaceIndices) {
			if (faces[faceIndex] !== undefined) {
				continue;
			}
			const { start: faceStart, end: faceEnd } = getFaceSegment(
				vertices,
				faceIndex,
			);
			const inwardNormal = getInwardNormal(faceStart, faceEnd);
			const signedDistance = math.dot(
				math.sub(this.position, faceStart),
				inwardNormal,
			);
			if (signedDistance < avatarRadiusWorld) {
				this.position = math.add(
					this.position,
					math.mul(inwardNormal, avatarRadiusWorld - signedDistance + epsilon),
				);
			}
		}
		// Resolve vertex walls after the broad edge push to avoid tunneling into wedges.
		const vertexWalls = ensureVertexWalls(this.plan, this.currentCellId);
		for (const vertexIndex of triangleVertexIndices) {
			const vertexWall = vertexWalls[vertexIndex];
			if (!vertexWall) {
				continue;
			}
			const vertex = vertices[vertexIndex];
			let delta = math.sub(this.position, vertex);
			const distance = Math.sqrt(math.lengthSq(delta));
			if (distance < epsilon) {
				const outward = point(0.0, 1.0);
				this.position = math.add(
					vertex,
					math.mul(outward, avatarRadiusWorld + epsilon),
				);
				continue;
			}
			if (distance < avatarRadiusWorld) {
				this.position = math.add(
					vertex,
					math.mul(delta, (avatarRadiusWorld + epsilon) / distance),
				);
				delta = math.sub(this.position, vertex);
			}
			for (const wallDirection of [vertexWall.left, vertexWall.right]) {
				if (!wallDirection) {
					continue;
				}
				const wallRayEnd = math.add(vertex, wallDirection);
				const wallDistanceSq = math.lineDistanceSq(
					vertex,
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
				const inwardNormal = getInwardNormal(vertex, wallRayEnd);
				const signedDistance = math.dot(delta, inwardNormal);
				if (
					signedDistance > -avatarRadiusWorld &&
					signedDistance < avatarRadiusWorld
				) {
					const push = avatarRadiusWorld - signedDistance + epsilon;
					this.position = math.add(this.position, math.mul(inwardNormal, push));
					delta = math.sub(this.position, vertex);
				}
			}
		}
		if (isInsideCell(this.position, shape, epsilon)) {
			return true;
		}
		// If we still ended up across a seam, transport into the neighboring cell and retry.
		for (const faceIndex of triangleFaceIndices) {
			const face = faces[faceIndex];
			if (!face) {
				continue;
			}
			const { cellId, faceIndex: neighborFaceIndex } = face;
			const { start: faceStart, end: faceEnd } = getFaceSegment(
				vertices,
				faceIndex,
			);
			if (!math.isClockwise3(faceStart, faceEnd, this.position)) {
				continue;
			}
			const { shape: nextShape } = this.plan.get(cellId);
			const from: ShapeFace = { shape, index: faceIndex };
			const to: ShapeFace = { shape: nextShape, index: neighborFaceIndex };
			this.transport(from, to);
			this.currentCellId = cellId;
			return this.simulateSnap(depth + 1);
		}
		return false;
	}

	simulateMove(delta: Point): void {
		const previousCurrentCellId = this.currentCellId;
		const previousPosition = point(this.position.x, this.position.y);
		const previousRotation = this.rotation;
		const previousWorldRotation = this.worldRotation;
		const previousScale = this.scale;
		const previousWorldOffset = point(this.worldOffset.x, this.worldOffset.y);
		const next = math.add(
			this.position,
			rotateScale(delta, this.rotation, 1 / this.scale),
		);
		this.simulatePhysics(next);
		if (!this.simulateSnap()) {
			this.supportState.cellId = previousCurrentCellId;
			this.supportState.position = previousPosition;
			this.supportState.rotation = previousRotation;
			this.cameraState.rotation = previousWorldRotation;
			this.supportState.scale = previousScale;
			this.cameraState.offset = previousWorldOffset;
		}
	}

	simulateTurn(delta: number): void {
		this.supportState.rotation += delta;
	}
}
