import assert from "./assert";
import type Canvas from "./canvas";
import { brightness, color, hsl } from "./color";
import { shiftCorner, shiftPosition, shiftShape } from "./geometry";
import * as math from "./linalg";
import type Physics from "./physics";
import { getAdjacentSides, getSideCorners } from "./topology";
import type { Color, Point, RenderStats, Segment } from "./types";
import { point, segment } from "./types";
import type View from "./view";
import type WebGLRenderer from "./webgl";

export interface TileDraw {
	polygon: Point[];
	color: Color;
	label: string | undefined;
	labelPosition: Point | undefined;
}

export interface WallDraw {
	quad: [Point, Point, Point, Point];
	color: Color;
}

export interface AvatarDraw {
	position: Point;
	faded: boolean;
}

export interface RenderBatch {
	tiles: TileDraw[];
	walls: WallDraw[];
	avatars: AvatarDraw[];
}

function intersectOrigin(a: Point, b: Point, direction: Point): Point {
	const { x: linePosition } = math.intersect(a, b, point(0.0, 0.0), direction);
	return math.interpolate(a, b, linePosition);
}

function isPointInPolygon(target: Point, path: Point[]): boolean {
	let inside = false;
	for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
		const a = path[i];
		const b = path[j];
		const intersects =
			a.y > target.y !== b.y > target.y &&
			target.x < ((b.x - a.x) * (target.y - a.y)) / (b.y - a.y) + a.x;
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

function getWallColor(a: Point, b: Point): Color {
	const nearest = math.nearestOnSegment(a, b, point(0.0, 0.0));
	const orth = math.rotateLeft(math.sub(b, a));
	const facing = math.dot(
		math.div(orth, Math.sqrt(math.lengthSq(orth))),
		math.div(nearest, Math.sqrt(math.lengthSq(nearest))),
	);
	const shade = 0.2 + 0.5 * facing;
	return color(shade, shade, shade);
}

export default class Renderer {
	tileColor: Color = color(0.4, 0.4, 0.8);
	avatarColor: Color = color(0.1, 0.1, 0.1);
	wallColor: Color = color(0, 0, 0);
	backgroundColor: Color = color(0.0, 1.0, 0.0);
	renderStats: RenderStats | undefined = undefined;
	private webglValue = false;
	private lastRenderAt: number | undefined = undefined;

	showCurrent = false;
	showSelf = false;
	showTile = false;

	constructor(
		private readonly physics: Physics,
		private readonly canvasRenderer: Canvas,
		private readonly view: View,
		private readonly webglRenderer: WebGLRenderer | undefined,
	) {}

	get debug(): boolean {
		return this.showTile && this.showCurrent && this.showSelf;
	}

	set debug(value: boolean) {
		this.showTile = value;
		this.showCurrent = value;
		this.showSelf = value;
	}

	get webglAvailable(): boolean {
		return this.webglRenderer !== undefined;
	}

	get avatarRadius(): number {
		return this.physics.avatarRadius;
	}

	get webgl(): boolean {
		return this.webglValue && this.webglAvailable;
	}

	set webgl(value: boolean) {
		this.webglValue = value && this.webglAvailable;
	}

	getCorners(shape: Point): [Point, Point, Point] {
		const sin = Math.sin(this.physics.rotation * Math.PI * 2);
		const cos = Math.cos(this.physics.rotation * Math.PI * 2);
		const leftCorner = point(
			(-(cos * this.physics.position.x + -sin * this.physics.position.y) *
				this.physics.scale) /
				this.view.range,
			(-(sin * this.physics.position.x + cos * this.physics.position.y) *
				this.physics.scale) /
				this.view.range,
		);
		const rightCorner = point(
			(-(
				cos * -(1 - this.physics.position.x) +
				-sin * this.physics.position.y
			) *
				this.physics.scale) /
				this.view.range,
			(-(sin * -(1 - this.physics.position.x) + cos * this.physics.position.y) *
				this.physics.scale) /
				this.view.range,
		);
		const topCorner = shiftCorner(leftCorner, rightCorner, shape);
		return [leftCorner, topCorner, rightCorner];
	}

	pushWall(batch: RenderBatch, edge: Segment, bounds: Segment): void {
		const visibleStart = intersectOrigin(edge.start, edge.end, bounds.start);
		const visibleEnd = intersectOrigin(edge.start, edge.end, bounds.end);
		const scale =
			2 /
			Math.sqrt(math.lineDistanceSq(visibleStart, visibleEnd, point(0.0, 0.0)));
		batch.walls.push({
			quad: [
				visibleStart,
				visibleEnd,
				math.mul(visibleEnd, scale),
				math.mul(visibleStart, scale),
			],
			color: getWallColor(edge.start, edge.end),
		});
	}

	pushTile(
		batch: RenderBatch,
		triangle: [Point, Point, Point],
		stats: RenderStats,
		tileId: number,
		clip: Segment | undefined,
		highlight: boolean,
	): void {
		stats.tiles += 1;
		const [vertexA, vertexB, vertexC] = triangle;
		const triangleCentroid = point(
			(vertexA.x + vertexB.x + vertexC.x) / 3,
			(vertexA.y + vertexB.y + vertexC.y) / 3,
		);
		const tileColor = this.showTile
			? hsl((tileId * 0.61803398875) % 1, 0.5, 0.55)
			: this.tileColor;
		let path: Point[];
		if (!clip) {
			path = triangle;
		} else {
			const { start: clipStart, end: clipEnd } = clip;
			path = [intersectOrigin(vertexA, vertexC, clipStart)];
			if (math.isClockwise(clipStart, vertexB)) {
				path.push(intersectOrigin(vertexA, vertexB, clipStart));
			} else {
				path.push(intersectOrigin(vertexB, vertexC, clipStart));
			}
			if (
				math.isClockwise(clipStart, vertexB) &&
				math.isClockwise(vertexB, clipEnd)
			) {
				path.push(vertexB);
			}
			if (math.isClockwise(vertexB, clipEnd)) {
				path.push(intersectOrigin(vertexC, vertexB, clipEnd));
			} else {
				path.push(intersectOrigin(vertexB, vertexA, clipEnd));
			}
			path.push(intersectOrigin(vertexC, vertexA, clipEnd));
		}
		batch.tiles.push({
			polygon: path,
			color: highlight ? brightness(tileColor, 0.5) : tileColor,
			label:
				this.showTile && (!clip || isPointInPolygon(triangleCentroid, path))
					? String(tileId)
					: undefined,
			labelPosition: triangleCentroid,
		});
	}

	pushBranch(
		batch: RenderBatch,
		stats: RenderStats,
		depth: number,
		tileId: number | undefined,
		sideIndex: number | undefined,
		branchStart: Point,
		branchEnd: Point,
		clipStart: Point | undefined,
		clipEnd: Point | undefined,
	): void {
		stats.branches += 1;
		if (depth > stats.maxDepth) {
			stats.maxDepth = depth;
		}
		if (math.isClockwise(clipEnd ?? branchEnd, clipStart ?? branchStart)) {
			return;
		}
		if (isSegmentOutsideViewport(segment(branchStart, branchEnd))) {
			return;
		}
		if (tileId === undefined) {
			this.pushWall(
				batch,
				segment(branchStart, branchEnd),
				segment(clipStart ?? branchStart, clipEnd ?? branchEnd),
			);
			return;
		}
		assert(sideIndex !== undefined, "Missing side index for tile branch");
		const { shape, sides } = this.physics.plan.get(tileId);
		const shiftedShape = shiftShape(shape, sideIndex);
		const branchCorner = shiftCorner(branchStart, branchEnd, shiftedShape);
		this.pushTile(
			batch,
			[branchStart, branchCorner, branchEnd],
			stats,
			tileId,
			segment(clipStart ?? branchStart, clipEnd ?? branchEnd),
			false,
		);
		if (this.showSelf && tileId === this.physics.currentTileId) {
			const shiftedPosition = shiftPosition(this.physics.position, {
				shape,
				index: sideIndex,
			});
			batch.avatars.push({
				position: shiftCorner(branchStart, branchEnd, shiftedPosition),
				faded: true,
			});
		}
		const [leftSideIndex, rightSideIndex] = getAdjacentSides(sideIndex);
		const leftSide = sides[leftSideIndex];
		const rightSide = sides[rightSideIndex];
		this.pushBranch(
			batch,
			stats,
			depth + 1,
			leftSide?.tileId,
			leftSide?.neighbor,
			branchStart,
			branchCorner,
			clipStart && math.isClockwise(branchStart, clipStart)
				? clipStart
				: undefined,
			math.isClockwise(clipEnd ?? branchEnd, branchCorner)
				? (clipEnd ?? branchEnd)
				: undefined,
		);
		this.pushBranch(
			batch,
			stats,
			depth + 1,
			rightSide?.tileId,
			rightSide?.neighbor,
			branchCorner,
			branchEnd,
			math.isClockwise(branchCorner, clipStart ?? branchStart)
				? (clipStart ?? branchStart)
				: undefined,
			clipEnd && math.isClockwise(clipEnd, branchEnd) ? clipEnd : undefined,
		);
	}

	buildBatch(stats: RenderStats): RenderBatch {
		const batch: RenderBatch = { tiles: [], walls: [], avatars: [] };
		const { shape, sides } = this.physics.plan.get(this.physics.currentTileId);
		const corners = this.getCorners(shape);
		this.pushTile(
			batch,
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
			this.pushBranch(
				batch,
				stats,
				1,
				sides[sideIndex]?.tileId,
				sides[sideIndex]?.neighbor,
				edgeStart,
				edgeEnd,
				undefined,
				undefined,
			);
		}
		batch.avatars.push({ position: point(0.0, 0.0), faded: false });
		return batch;
	}

	render(): RenderStats {
		const now = performance.now();
		const stats: RenderStats = {
			tiles: 0,
			branches: 0,
			maxDepth: 0,
			duration:
				this.lastRenderAt === undefined ? 0 : (now - this.lastRenderAt) / 1000,
		};
		const batch = this.buildBatch(stats);
		if (this.webgl && this.webglRenderer) {
			this.webglRenderer.clear(this.backgroundColor);
			this.webglRenderer.draw(batch, this, this.view);
			this.canvasRenderer.clear();
			this.canvasRenderer.drawLabels(batch, this);
		} else {
			this.canvasRenderer.draw(batch, this);
		}
		this.lastRenderAt = now;
		this.renderStats = stats;
		return stats;
	}
}
