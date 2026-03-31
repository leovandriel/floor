import type Canvas from "./canvas";
import { color, withAlpha } from "./canvas";
import * as math from "./math";
import { epsilon, point } from "./math";
import type {
	Color,
	CornerWall,
	MouseAction,
	Plan,
	Point,
	RenderStats,
	RenderType,
	Segment,
	Tile,
} from "./types";

interface ShapeOffset {
	shape: Point;
	offset: number;
}

class RenderState {
	distanceSq: number = -1;
	type: RenderType = "none";
	mouse: Point | undefined = undefined;
	points: Point[] = [];
	offsetSq: number = 1;

	constructor(mouse: Point | undefined, offset: number) {
		this.mouse = mouse;
		this.offsetSq = offset * offset;
	}

	wall(a: Point, b: Point): void {
		if (!this.mouse) return;
		const distanceSq = math.segmentDistanceSq(a, b, this.mouse);
		this.add(distanceSq + this.offsetSq / 2, "wall", [a, b]);
	}

	corner(a: Point): void {
		if (!this.mouse) return;
		const distanceSq = math.pointDistanceSq(a, this.mouse);
		this.add(distanceSq, "corner", [a]);
	}

	add(distanceSq: number, type: RenderType, points: Point[]): void {
		if (
			distanceSq < this.offsetSq &&
			(this.distanceSq < 0 || this.distanceSq > distanceSq)
		) {
			this.distanceSq = distanceSq;
			this.type = type;
			this.points = points;
		}
	}
}

export default class Scene {
	tileColor: Color = color(0.4, 0.4, 0.8);
	highlightColor: Color = color(0.5, 0.5, 0.9);
	avatarColor: Color = color(0.1, 0.1, 0.1);
	wallColor: Color = color(0, 0, 0);
	mouseColor: Color = color(1, 1, 0);
	cornerWallColor: Color = color(1, 1, 1);

	showCurrent = false;
	showSelf = false;
	showTile = false;
	showCornerWall = false;

	current = 0;
	position = point(0.5, 0.2);
	rotation = 0;
	scale = 0.2;
	step = 0.03;
	avatarRadius = 0.01;
	plan: Plan;

	canvas: Canvas;

	constructor(canvas: Canvas, plan: Plan) {
		this.canvas = canvas;
		this.plan = plan;
		this.populateCornerWalls();
	}

	shiftShape(shape: Point, offset: number): Point {
		switch (offset) {
			case 0:
				return shape;
			case 1: {
				const d = shape.x * shape.x + shape.y * shape.y;
				return point(1 - shape.x / d, shape.y / d);
			}
			case 2: {
				const e = (1 - shape.x) * (1 - shape.x) + shape.y * shape.y;
				return point((1 - shape.x) / e, shape.y / e);
			}
		}
		return shape;
	}

	shiftCorner(p: Point, q: Point, a: Point): Point {
		const edgeDelta = point(q.x - p.x, q.y - p.y);
		return point(
			p.x + a.x * edgeDelta.x - a.y * edgeDelta.y,
			p.y + a.x * edgeDelta.y + a.y * edgeDelta.x,
		);
	}

	drawCurrentCornerWalls(): void {
		const { shape, cornerWalls } = this.plan.tiles[this.current];
		if (!cornerWalls) {
			return;
		}
		const corners = this.getCorners(shape);
		const triangle: [Point, Point, Point] = corners;
		const [vertexA, _vertexB, vertexC] = triangle;
		const localCorners = this.getTileCorners(shape);
		this.canvas.setColor(withAlpha(this.cornerWallColor, 0.45));
		for (let cornerIndex = 0; cornerIndex < 3; cornerIndex++) {
			const cornerWall = cornerWalls[cornerIndex];
			if (!cornerWall) {
				continue;
			}
			const cornerStart = this.shiftCorner(
				vertexA,
				vertexC,
				localCorners[cornerIndex],
			);
			for (const direction of cornerWall) {
				if (!direction) {
					continue;
				}
				const cornerEnd = this.shiftCorner(
					vertexA,
					vertexC,
					math.add(localCorners[cornerIndex], direction),
				);
				this.canvas.drawLine(cornerStart, cornerEnd);
			}
		}
	}

	getAvatarRadiusWorld(): number {
		return this.avatarRadius / this.scale;
	}

	getInsetEdge(
		sideStart: Point,
		sideEnd: Point,
		interiorPoint: Point,
		inset: number,
	): Segment {
		const inwardNormal = this.getInwardNormal(
			sideStart,
			sideEnd,
			interiorPoint,
		);
		return {
			start: math.add(sideStart, math.mul(inwardNormal, inset)),
			end: math.add(sideEnd, math.mul(inwardNormal, inset)),
		};
	}

	getInwardNormal(
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

	isInsideTile(position: Point, shape: Point): boolean {
		if (position.y < -epsilon || position.y > shape.y + epsilon) {
			return false;
		}
		const min = (shape.x * position.y) / shape.y;
		const max = min + 1 - position.y / shape.y;
		return position.x >= min - epsilon && position.x <= max + epsilon;
	}

	getTileCorners(shape: Point): [Point, Point, Point] {
		return [point(0, 0), shape, point(1, 0)];
	}

	getIncidentSides(cornerIndex: number): [number, number] {
		return [cornerIndex, (cornerIndex + 1) % 3];
	}

	getCornerAcrossSide(
		cornerIndex: number,
		sideIndex: number,
		offset: number,
	): number {
		return cornerIndex === (sideIndex + 2) % 3 ? offset : (offset + 2) % 3;
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
				const corners = this.getTileCorners(shape);
				const sideStart = corners[(sideIndex + 2) % 3];
				const sideEnd = corners[sideIndex];
				const otherCorner =
					cornerIndex === (sideIndex + 2) % 3 ? sideEnd : sideStart;
				let wallCorner = corners[cornerIndex];
				let wallEnd = otherCorner;
				for (let i = transitions.length - 1; i >= 0; i--) {
					const { from, to } = transitions[i];
					wallCorner = this.handleTransition(wallCorner, to, from);
					wallEnd = this.handleTransition(wallEnd, to, from);
				}
				const direction = math.sub(wallEnd, wallCorner);
				if (math.size(direction) < epsilon) {
					return undefined;
				}
				return direction;
			}
			const nextCornerIndex = this.getCornerAcrossSide(
				cornerIndex,
				sideIndex,
				offset,
			);
			const [a, b] = this.getIncidentSides(nextCornerIndex);
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
				const [a, b] = this.getIncidentSides(cornerIndex);
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

	isPointInPolygon(target: Point, path: Point[]): boolean {
		let inside = false;
		for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
			const a = path[i];
			const b = path[j];
			const intersects =
				a.y > target.y !== b.y > target.y &&
				target.x <
					((b.x - a.x) * (target.y - a.y)) / (b.y - a.y + epsilon) + a.x;
			if (intersects) {
				inside = !inside;
			}
		}
		return inside;
	}

	renderAvatar(_state: RenderState, a: Point, faded = false): void {
		this.canvas.setColor(
			faded ? withAlpha(this.avatarColor, 0.35) : this.avatarColor,
		);
		this.canvas.drawCircle(a, this.avatarRadius, !faded);
	}

	renderMouse(state: RenderState): void {
		this.canvas.setColor(this.mouseColor);
		if (state.type === "wall") {
			this.canvas.drawDouble(
				{ start: state.points[0], end: state.points[1] },
				4,
			);
		} else if (state.type === "corner") {
			this.canvas.drawCircle(state.points[0], 0.01);
		}
	}

	renderWall(state: RenderState, edge: Segment, bounds: Segment): void {
		const { start: wallStart, end: wallEnd } = edge;
		const { start: clipStart, end: clipEnd } = bounds;
		const visibleStart = math.intersectOrigin(wallStart, wallEnd, clipStart);
		const visibleEnd = math.intersectOrigin(wallStart, wallEnd, clipEnd);
		if (state.mouse) {
			state.wall(visibleStart, visibleEnd);
		}
		if (math.isClose(visibleStart, wallStart)) {
			if (state.mouse) {
				state.corner(wallStart);
			}
			const f =
				this.canvas.factor < 1
					? this.canvas.range * 10
					: 2 / math.size(wallStart);
			this.canvas.setColor(withAlpha(this.wallColor, 0.2), wallStart);
			this.canvas.drawLine(wallStart, point(wallStart.x * f, wallStart.y * f));
		}
		if (math.isClose(visibleEnd, wallEnd)) {
			if (state.mouse) {
				state.corner(wallEnd);
			}
			const f =
				this.canvas.factor < 1
					? this.canvas.range * 10
					: 2 / math.size(wallEnd);
			this.canvas.setColor(withAlpha(this.wallColor, 0.2), wallEnd);
			this.canvas.drawLine(wallEnd, point(wallEnd.x * f, wallEnd.y * f));
		}
		this.canvas.setColor(this.wallColor);
		this.canvas.drawLine(visibleStart, visibleEnd);
	}

	renderBackground(_state: RenderState): void {
		this.canvas.setColor(this.canvas.background);
		this.canvas.drawRect(point(0, 0), this.canvas.size);
	}

	renderTile(
		_state: RenderState,
		triangle: [Point, Point, Point],
		stats: RenderStats,
		index: number,
		clip?: Segment,
		highlight?: boolean,
	): void {
		stats.tiles += 1;
		const [vertexA, vertexB, vertexC] = triangle;
		const trianglePath: [Point, Point, Point] = [vertexA, vertexB, vertexC];
		const triangleCentroid = point(
			(vertexA.x + vertexB.x + vertexC.x) / 3,
			(vertexA.y + vertexB.y + vertexC.y) / 3,
		);
		if (!clip) {
			this.canvas.setColor(this.tileColor);
			this.canvas.drawPath(trianglePath, true);
			if (highlight) {
				this.canvas.setColor(withAlpha(this.highlightColor, 0.45));
				this.canvas.drawPath(trianglePath, true);
			}
			if (this.showTile) {
				this.canvas.setColor(withAlpha(this.wallColor, 0.45));
				this.canvas.drawText(triangleCentroid, String(index));
			}
			if (this.showTile) {
				this.canvas.setColor(withAlpha(this.highlightColor, 0.25));
			}
			this.canvas.drawPath(trianglePath, false);
			return;
		}
		const { start: clipStart, end: clipEnd } = clip;
		const path: Point[] = [];
		path.push(math.intersectOrigin(vertexA, vertexC, clipStart));
		if (math.isClockwise(clipStart, vertexB)) {
			path.push(math.intersectOrigin(vertexA, vertexB, clipStart));
		} else {
			path.push(math.intersectOrigin(vertexB, vertexC, clipStart));
		}
		if (
			math.isClockwise(clipStart, vertexB) &&
			math.isClockwise(vertexB, clipEnd)
		) {
			path.push(vertexB);
		}
		if (math.isClockwise(vertexB, clipEnd)) {
			path.push(math.intersectOrigin(vertexC, vertexB, clipEnd));
		} else {
			path.push(math.intersectOrigin(vertexB, vertexA, clipEnd));
		}
		path.push(math.intersectOrigin(vertexC, vertexA, clipEnd));
		this.canvas.setColor(this.tileColor);
		this.canvas.drawPath(path, true);
		if (highlight) {
			this.canvas.setColor(withAlpha(this.highlightColor, 0.45));
			this.canvas.drawPath(path, true);
		}
		this.canvas.drawPath(path, false);
		if (this.showTile && this.isPointInPolygon(triangleCentroid, path)) {
			this.canvas.setColor(withAlpha(this.wallColor, 0.45));
			this.canvas.drawText(triangleCentroid, String(index));
		}
		if (this.showTile) {
			const clippedBaseStart = math.intersectOrigin(
				vertexA,
				vertexC,
				clipStart,
			);
			const clippedBaseEnd = math.intersectOrigin(vertexC, vertexA, clipEnd);
			this.canvas.setColor(withAlpha(this.highlightColor, 0.25));
			this.canvas.drawLine(clippedBaseEnd, clippedBaseStart);
		}
	}

	renderBranch(
		state: RenderState,
		stats: RenderStats,
		depth: number,
		index: number,
		offset: number,
		branchStart: Point,
		branchEnd: Point,
		clipStart: Point,
		clipEnd: Point,
		avatars: Point[],
		walls: Segment[],
		wallBounds: Segment[],
	): void {
		stats.branches += 1;
		if (depth > stats.maxDepth) {
			stats.maxDepth = depth;
		}
		if (math.isClockwise(clipEnd, clipStart)) {
			return;
		}
		if (this.isSegmentOutsideViewport({ start: branchStart, end: branchEnd })) {
			return;
		}
		if (index < 0) {
			walls.push({ start: branchStart, end: branchEnd });
			wallBounds.push({ start: clipStart, end: clipEnd });
			return;
		}
		const { shape, sides } = this.plan.tiles[index];
		const shiftedShape = this.shiftShape(shape, offset);
		const branchCorner = this.shiftCorner(branchStart, branchEnd, shiftedShape);
		this.renderTile(
			state,
			[branchStart, branchCorner, branchEnd],
			stats,
			index,
			{ start: clipStart, end: clipEnd },
		);
		if (this.showSelf && index === this.current) {
			const shiftedPosition = this.shiftPosition(
				{ shape, offset },
				this.position,
			);
			avatars.push(this.shiftCorner(branchStart, branchEnd, shiftedPosition));
		}
		const leftSide = sides[(offset + 1) % 3];
		const rightSide = sides[(offset + 2) % 3];
		this.renderBranch(
			state,
			stats,
			depth + 1,
			leftSide.index,
			leftSide.offset,
			branchStart,
			branchCorner,
			math.isClockwise(branchStart, clipStart) ? clipStart : branchStart,
			math.isClockwise(clipEnd, branchCorner) ? clipEnd : branchCorner,
			avatars,
			walls,
			wallBounds,
		);
		this.renderBranch(
			state,
			stats,
			depth + 1,
			rightSide.index,
			rightSide.offset,
			branchCorner,
			branchEnd,
			math.isClockwise(branchCorner, clipStart) ? clipStart : branchCorner,
			math.isClockwise(clipEnd, branchEnd) ? clipEnd : branchEnd,
			avatars,
			walls,
			wallBounds,
		);
	}

	getCorners(shape: Point): [Point, Point, Point] {
		const sin = math.sinTurns(this.rotation);
		const cos = math.cosTurns(this.rotation);
		const leftCorner = point(
			(-(cos * this.position.x + -sin * this.position.y) * this.scale) /
				this.canvas.range,
			(-(sin * this.position.x + cos * this.position.y) * this.scale) /
				this.canvas.range,
		);
		const rightCorner = point(
			(-(cos * -(1 - this.position.x) + -sin * this.position.y) * this.scale) /
				this.canvas.range,
			(-(sin * -(1 - this.position.x) + cos * this.position.y) * this.scale) /
				this.canvas.range,
		);
		const topCorner = this.shiftCorner(leftCorner, rightCorner, shape);
		return [leftCorner, topCorner, rightCorner];
	}

	renderTrunc(
		state: RenderState,
		stats: RenderStats,
		avatars: Point[],
		walls: Segment[],
		wallBounds: Segment[],
	): void {
		const { shape, sides } = this.plan.tiles[this.current];
		const corners = this.getCorners(shape);
		this.renderTile(
			state,
			corners,
			stats,
			this.current,
			undefined,
			this.showCurrent,
		);
		for (let sideIndex = 0; sideIndex < 3; sideIndex++) {
			const edgeStart = corners[(sideIndex + 2) % 3];
			const edgeEnd = corners[sideIndex];
			this.renderBranch(
				state,
				stats,
				1,
				sides[sideIndex].index,
				sides[sideIndex].offset,
				edgeStart,
				edgeEnd,
				edgeStart,
				edgeEnd,
				avatars,
				walls,
				wallBounds,
			);
		}
	}

	render(_action?: MouseAction): RenderStats {
		const state = new RenderState(
			this.canvas.getMouse(),
			this.scale / this.canvas.range / 10,
		);
		const stats: RenderStats = {
			tiles: 0,
			branches: 0,
			avatars: 0,
			maxDepth: 0,
		};
		const avatars: Point[] = [];
		const walls: Segment[] = [];
		const wallBounds: Segment[] = [];
		this.canvas.setWidth(4);
		this.renderBackground(state);
		this.renderTrunc(state, stats, avatars, walls, wallBounds);
		stats.avatars = avatars.length;
		for (const avatar of avatars) {
			this.renderAvatar(state, avatar, true);
		}
		for (let i = 0; i < walls.length; i++) {
			this.renderWall(state, walls[i], wallBounds[i]);
		}
		this.renderAvatar(state, point(0, 0));
		if (this.showCornerWall) {
			this.drawCurrentCornerWalls();
		}
		this.canvas.setWidth(2);
		this.renderMouse(state);
		return stats;
	}

	shiftPosition({ shape, offset }: ShapeOffset, position: Point): Point {
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

	unshiftPosition({ shape, offset }: ShapeOffset, position: Point): Point {
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

	shiftScale({ shape, offset }: ShapeOffset): number {
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

	transitionRotation(
		position: Point,
		rotation: number,
		from: ShapeOffset,
		to: ShapeOffset,
	): number {
		// Revisit this probe step if we replace the finite-difference estimate
		// with an analytic direction transform across the seam.
		const delta = 1e-6;
		const forwardPoint = point(
			position.x + math.sinTurns(rotation) * delta,
			position.y + math.cosTurns(rotation) * delta,
		);
		const shiftedPosition = this.handleTransition(position, from, to);
		const shiftedForward = this.handleTransition(forwardPoint, from, to);
		return math.atan2Turns(
			shiftedForward.x - shiftedPosition.x,
			shiftedForward.y - shiftedPosition.y,
		);
	}

	handleTransition(position: Point, from: ShapeOffset, to: ShapeOffset): Point {
		const shift1 = this.shiftPosition(from, position);
		const shift2 = point(1 - shift1.x, -shift1.y);
		return this.unshiftPosition(to, shift2);
	}

	handlePhysics(next: Point, wallCount = 0): Point {
		if (wallCount >= 2) return this.position;
		const { shape, sides } = this.plan.tiles[this.current];
		const avatarRadiusWorld = this.getAvatarRadiusWorld();
		const corners: [Point, Point, Point] = [point(0, 0), shape, point(1, 0)];
		for (let sideIndex = 0; sideIndex < 3; sideIndex++) {
			const sideStart = corners[(sideIndex + 2) % 3];
			const sideEnd = corners[sideIndex];
			const { index, offset } = sides[sideIndex];
			const collisionEdge =
				index < 0
					? this.getInsetEdge(
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
						this.handlePhysics(reflectedNext, wallCount + 1);
					} else {
						const { shape: nextShape } = this.plan.tiles[index];
						const from = { shape, offset: sideIndex };
						const to = { shape: nextShape, offset };
						this.position = math.interpolate(this.position, next, movePosition);
						this.rotation = this.transitionRotation(
							this.position,
							this.rotation,
							from,
							to,
						);
						this.position = this.handleTransition(this.position, from, to);
						const shiftedNext = this.handleTransition(next, from, to);
						this.scale *= this.shiftScale(from) / this.shiftScale(to);
						this.current = index;
						this.handlePhysics(shiftedNext, wallCount);
					}
					return this.position;
				}
			}
		}
		this.position = next;
		return this.position;
	}

	handleSnap(depth = 0): boolean {
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

		const avatarRadiusWorld = this.getAvatarRadiusWorld();
		const corners: [Point, Point, Point] = [point(0, 0), shape, point(1, 0)];
		for (let sideIndex = 0; sideIndex < 3; sideIndex++) {
			if (sides[sideIndex].index >= 0) {
				continue;
			}
			const sideStart = corners[(sideIndex + 2) % 3];
			const sideEnd = corners[sideIndex];
			const inwardNormal = this.getInwardNormal(
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
				const inwardNormal = this.getInwardNormal(
					corner,
					wallRayEnd,
					this.position,
				);
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
		if (this.isInsideTile(this.position, shape)) {
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
			this.rotation = this.transitionRotation(
				this.position,
				this.rotation,
				from,
				to,
			);
			this.position = this.handleTransition(this.position, from, to);
			this.scale *= this.shiftScale(from) / this.shiftScale(to);
			this.current = index;
			return this.handleSnap(depth + 1);
		}
		return false;
	}

	handleMove(delta: Point): void {
		if (math.isZero(delta)) return;
		const previousCurrent = this.current;
		const previousPosition = point(this.position.x, this.position.y);
		const previousRotation = this.rotation;
		const previousScale = this.scale;
		const sin = math.sinTurns(this.rotation);
		const cos = math.cosTurns(this.rotation);
		const next = point(
			this.position.x +
				((cos * delta.x + sin * delta.y) * this.step) / this.scale,
			this.position.y +
				((-sin * delta.x + cos * delta.y) * this.step) / this.scale,
		);
		this.handlePhysics(next);
		if (!this.handleSnap()) {
			this.current = previousCurrent;
			this.position = previousPosition;
			this.rotation = previousRotation;
			this.scale = previousScale;
		}
	}

	private isSegmentOutsideViewport({ start: p, end: q }: Segment): boolean {
		return (
			(p.x < -1 && q.x < -1) ||
			(p.y < -1 && q.y < -1) ||
			(p.x > 1 && q.x > 1) ||
			(p.y > 1 && q.y > 1)
		);
	}

	handleTurn(delta: number): void {
		this.rotation += delta;
	}

	unscale(p: Point): Point {
		return point(
			(p.x * this.canvas.range) / this.canvas.factor,
			(p.y * -this.canvas.range) / this.canvas.factor,
		);
	}
}
