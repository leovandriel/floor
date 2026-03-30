import type Canvas from "./canvas";
import { color, withAlpha } from "./canvas";
import * as math from "./math";
import { epsilon, point } from "./math";
import type {
	Color,
	MouseAction,
	Plan,
	Point,
	RenderStats,
	RenderType,
	Segment,
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

	showCurrent = false;
	showSelf = false;
	showTile = false;

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
		clip?: Segment,
		highlight?: boolean,
	): void {
		stats.tiles += 1;
		const [vertexA, vertexB, vertexC] = triangle;
		if (!clip) {
			this.canvas.setColor(this.tileColor);
			this.canvas.drawPath([vertexA, vertexB, vertexC], true);
			if (highlight) {
				this.canvas.setColor(withAlpha(this.highlightColor, 0.45));
				this.canvas.drawPath([vertexA, vertexB, vertexC], true);
			}
			if (this.showTile) {
				this.canvas.setColor(withAlpha(this.highlightColor, 0.25));
			}
			this.canvas.drawPath([vertexA, vertexB, vertexC], false);
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
		this.renderTile(state, [branchStart, branchCorner, branchEnd], stats, {
			start: clipStart,
			end: clipEnd,
		});
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
		return [leftCorner, rightCorner, topCorner];
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
		this.renderTile(state, corners, stats, undefined, this.showCurrent);
		for (let sideIndex = 0; sideIndex < 3; sideIndex++) {
			const edgeStart = corners[(4 - sideIndex) % 3];
			const edgeEnd = corners[(3 - sideIndex) % 3];
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
		const corners: [Point, Point, Point] = [point(1, 0), point(0, 0), shape];
		for (let sideIndex = 0; sideIndex < 3; sideIndex++) {
			const nextSideIndex = (sideIndex + 1) % 3;
			const sideStart = corners[sideIndex];
			const sideEnd = corners[nextSideIndex];
			if (math.isClockwise3(sideStart, sideEnd, next)) {
				const { x: edgePosition, y: movePosition } = math.intersect(
					sideStart,
					sideEnd,
					this.position,
					next,
				);
				if (
					edgePosition > -epsilon &&
					edgePosition < 1 + epsilon &&
					movePosition > -epsilon &&
					movePosition < 1 + epsilon
				) {
					const { index, offset } = sides[sideIndex];
					if (index < 0) {
						this.position = math.interpolate(
							this.position,
							next,
							movePosition - epsilon,
						);
						const wallIntersection = math.interpolate(
							sideStart,
							sideEnd,
							edgePosition,
						);
						const reflectedDelta = math.project3(
							sideStart,
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

	handleSnap(): void {
		const { shape } = this.plan.tiles[this.current];
		if (this.position.y < 0) this.position.y = 0;
		if (this.position.y > shape.y) this.position.y = shape.y;
		const min = (shape.x * this.position.y) / shape.y;
		if (this.position.x < min) this.position.x = min;
		const max = min + 1 - this.position.y / shape.y;
		if (this.position.x > max) this.position.x = max;
	}

	handleMove(delta: Point): void {
		if (math.isZero(delta)) return;
		const sin = math.sinTurns(this.rotation);
		const cos = math.cosTurns(this.rotation);
		const next = point(
			this.position.x +
				((cos * delta.x + sin * delta.y) * this.step) / this.scale,
			this.position.y +
				((-sin * delta.x + cos * delta.y) * this.step) / this.scale,
		);
		this.handlePhysics(next);
		this.handleSnap();
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
