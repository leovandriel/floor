import type Canvas from "./canvas";
import { withAlpha } from "./canvas";
import { shiftPosition, shiftShape } from "./geometry";
import * as math from "./math";
import { epsilon } from "./math";
import type Physics from "./physics";
import { ensureCornerWalls } from "./plan";
import { getAdjacentSides, getSideCorners, getTileCorners } from "./topology";
import type { Color, Point, RenderStats, RenderType, Segment } from "./types";
import { color, point } from "./types";

class RenderTrace {
	distanceSq: number = -1;
	type: RenderType = "none";
	mouse: Point | undefined;
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

function shiftCorner(p: Point, q: Point, a: Point): Point {
	const edgeDelta = point(q.x - p.x, q.y - p.y);
	return point(
		p.x + a.x * edgeDelta.x - a.y * edgeDelta.y,
		p.y + a.x * edgeDelta.y + a.y * edgeDelta.x,
	);
}

function isPointInPolygon(target: Point, path: Point[]): boolean {
	let inside = false;
	for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
		const a = path[i];
		const b = path[j];
		const intersects =
			a.y > target.y !== b.y > target.y &&
			target.x < ((b.x - a.x) * (target.y - a.y)) / (b.y - a.y + epsilon) + a.x;
		if (intersects) {
			inside = !inside;
		}
	}
	return inside;
}

function isSegmentOutsideViewport({ start: p, end: q }: Segment): boolean {
	return (
		(p.x < -1 && q.x < -1) ||
		(p.y < -1 && q.y < -1) ||
		(p.x > 1 && q.x > 1) ||
		(p.y > 1 && q.y > 1)
	);
}

export default class Renderer {
	tileColor: Color = color(0.4, 0.4, 0.8);
	highlightColor: Color = color(0.5, 0.5, 0.9);
	avatarColor: Color = color(0.1, 0.1, 0.1);
	wallColor: Color = color(0, 0, 0);
	mouseColor: Color = color(1, 1, 0);
	cornerWallColor: Color = color(1, 1, 1);
	renderStats: RenderStats | undefined = undefined;

	showCurrent = false;
	showSelf = false;
	showTile = false;
	showCornerWall = false;

	constructor(
		private readonly physics: Physics,
		private readonly canvas: Canvas,
	) {}

	get debug(): boolean {
		return (
			this.showTile && this.showCurrent && this.showSelf && this.showCornerWall
		);
	}

	set debug(value: boolean) {
		this.showTile = value;
		this.showCurrent = value;
		this.showSelf = value;
		this.showCornerWall = value;
	}

	getCorners(shape: Point): [Point, Point, Point] {
		const sin = math.sinTurns(this.physics.rotation);
		const cos = math.cosTurns(this.physics.rotation);
		const leftCorner = point(
			(-(cos * this.physics.position.x + -sin * this.physics.position.y) *
				this.physics.scale) /
				this.canvas.range,
			(-(sin * this.physics.position.x + cos * this.physics.position.y) *
				this.physics.scale) /
				this.canvas.range,
		);
		const rightCorner = point(
			(-(
				cos * -(1 - this.physics.position.x) +
				-sin * this.physics.position.y
			) *
				this.physics.scale) /
				this.canvas.range,
			(-(sin * -(1 - this.physics.position.x) + cos * this.physics.position.y) *
				this.physics.scale) /
				this.canvas.range,
		);
		const topCorner = shiftCorner(leftCorner, rightCorner, shape);
		return [leftCorner, topCorner, rightCorner];
	}

	renderCornerWalls(): void {
		const { shape } = this.physics.plan.get(this.physics.currentTileId);
		const cornerWalls = ensureCornerWalls(
			this.physics.plan,
			this.physics.currentTileId,
		);
		const corners = this.getCorners(shape);
		const triangle: [Point, Point, Point] = corners;
		const [vertexA, _vertexB, vertexC] = triangle;
		const localCorners = getTileCorners(shape);
		this.canvas.setColor(withAlpha(this.cornerWallColor, 0.45));
		for (let cornerIndex = 0; cornerIndex < 3; cornerIndex++) {
			const cornerWall = cornerWalls[cornerIndex];
			if (!cornerWall) {
				continue;
			}
			const cornerStart = shiftCorner(
				vertexA,
				vertexC,
				localCorners[cornerIndex],
			);
			for (const direction of [cornerWall.left, cornerWall.right]) {
				if (!direction) {
					continue;
				}
				const cornerEnd = shiftCorner(
					vertexA,
					vertexC,
					math.add(localCorners[cornerIndex], direction),
				);
				this.canvas.drawLine(cornerStart, cornerEnd);
			}
		}
	}

	renderAvatar(a: Point, faded = false): void {
		this.canvas.setColor(
			faded ? withAlpha(this.avatarColor, 0.35) : this.avatarColor,
		);
		this.canvas.drawCircle(a, this.physics.avatarRadius, !faded);
	}

	renderMouse(trace: RenderTrace): void {
		this.canvas.setColor(this.mouseColor);
		if (trace.type === "wall") {
			this.canvas.drawDouble(
				{ start: trace.points[0], end: trace.points[1] },
				4,
			);
		} else if (trace.type === "corner") {
			this.canvas.drawCircle(trace.points[0], 0.01);
		}
	}

	renderWall(trace: RenderTrace, edge: Segment, bounds: Segment): void {
		const { start: wallStart, end: wallEnd } = edge;
		const { start: clipStart, end: clipEnd } = bounds;
		const visibleStart = math.intersectOrigin(wallStart, wallEnd, clipStart);
		const visibleEnd = math.intersectOrigin(wallStart, wallEnd, clipEnd);
		if (trace.mouse) {
			trace.wall(visibleStart, visibleEnd);
		}
		if (math.isClose(visibleStart, wallStart)) {
			if (trace.mouse) {
				trace.corner(wallStart);
			}
			const f =
				this.canvas.factor < 1
					? this.canvas.range * 10
					: 2 / math.size(wallStart);
			this.canvas.setColor(withAlpha(this.wallColor, 0.2), wallStart);
			this.canvas.drawLine(wallStart, point(wallStart.x * f, wallStart.y * f));
		}
		if (math.isClose(visibleEnd, wallEnd)) {
			if (trace.mouse) {
				trace.corner(wallEnd);
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

	renderBackground(): void {
		this.canvas.setColor(this.canvas.background);
		this.canvas.drawRect(point(0.0, 0.0), this.canvas.size);
	}

	renderTile(
		triangle: [Point, Point, Point],
		stats: RenderStats,
		tileId: number,
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
				this.canvas.drawText(triangleCentroid, String(tileId));
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
		if (this.showTile && isPointInPolygon(triangleCentroid, path)) {
			this.canvas.setColor(withAlpha(this.wallColor, 0.45));
			this.canvas.drawText(triangleCentroid, String(tileId));
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
		trace: RenderTrace,
		stats: RenderStats,
		depth: number,
		id: number,
		sideIndex: number,
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
		if (isSegmentOutsideViewport({ start: branchStart, end: branchEnd })) {
			return;
		}
		if (id < 0) {
			walls.push({ start: branchStart, end: branchEnd });
			wallBounds.push({ start: clipStart, end: clipEnd });
			return;
		}
		const { shape, sides } = this.physics.plan.get(id);
		const shiftedShape = shiftShape(shape, sideIndex);
		const branchCorner = shiftCorner(branchStart, branchEnd, shiftedShape);
		this.renderTile([branchStart, branchCorner, branchEnd], stats, id, {
			start: clipStart,
			end: clipEnd,
		});
		if (this.showSelf && id === this.physics.currentTileId) {
			const shiftedPosition = shiftPosition(this.physics.position, {
				shape,
				index: sideIndex,
			});
			avatars.push(shiftCorner(branchStart, branchEnd, shiftedPosition));
		}
		const [leftSideIndex, rightSideIndex] = getAdjacentSides(sideIndex);
		const leftSide = sides[leftSideIndex];
		const rightSide = sides[rightSideIndex];
		this.renderBranch(
			trace,
			stats,
			depth + 1,
			leftSide?.tileId ?? -1,
			leftSide?.neighbor ?? 0,
			branchStart,
			branchCorner,
			math.isClockwise(branchStart, clipStart) ? clipStart : branchStart,
			math.isClockwise(clipEnd, branchCorner) ? clipEnd : branchCorner,
			avatars,
			walls,
			wallBounds,
		);
		this.renderBranch(
			trace,
			stats,
			depth + 1,
			rightSide?.tileId ?? -1,
			rightSide?.neighbor ?? 0,
			branchCorner,
			branchEnd,
			math.isClockwise(branchCorner, clipStart) ? clipStart : branchCorner,
			math.isClockwise(clipEnd, branchEnd) ? clipEnd : branchEnd,
			avatars,
			walls,
			wallBounds,
		);
	}

	renderTrunc(
		trace: RenderTrace,
		stats: RenderStats,
		avatars: Point[],
		walls: Segment[],
		wallBounds: Segment[],
	): void {
		const { shape, sides } = this.physics.plan.get(this.physics.currentTileId);
		const corners = this.getCorners(shape);
		this.renderTile(
			corners,
			stats,
			this.physics.currentTileId,
			undefined,
			this.showCurrent,
		);
		for (let sideIndex = 0; sideIndex < 3; sideIndex++) {
			const [edgeStartIndex, edgeEndIndex] = getSideCorners(sideIndex);
			const edgeStart = corners[edgeStartIndex];
			const edgeEnd = corners[edgeEndIndex];
			this.renderBranch(
				trace,
				stats,
				1,
				sides[sideIndex]?.tileId ?? -1,
				sides[sideIndex]?.neighbor ?? 0,
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

	render(): RenderStats {
		const startedAt = performance.now();
		const trace = new RenderTrace(
			this.canvas.getMouse(),
			this.physics.scale / this.canvas.range / 10,
		);
		const stats: RenderStats = {
			tiles: 0,
			branches: 0,
			avatars: 0,
			maxDepth: 0,
			renderDuration: 0,
		};
		const avatars: Point[] = [];
		const walls: Segment[] = [];
		const wallBounds: Segment[] = [];
		this.canvas.setWidth(4);
		this.renderBackground();
		this.renderTrunc(trace, stats, avatars, walls, wallBounds);
		stats.avatars = avatars.length;
		for (const avatar of avatars) {
			this.renderAvatar(avatar, true);
		}
		for (let i = 0; i < walls.length; i++) {
			this.renderWall(trace, walls[i], wallBounds[i]);
		}
		this.renderAvatar(point(0.0, 0.0));
		if (this.showCornerWall) {
			this.renderCornerWalls();
		}
		this.canvas.setWidth(2);
		this.renderMouse(trace);
		stats.renderDuration = (performance.now() - startedAt) / 1000;
		this.renderStats = stats;
		return stats;
	}
}
