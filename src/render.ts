import assert from "./assert";
import type Canvas from "./canvas";
import { brightness, color, hsl } from "./color";
import {
	rotateScale,
	shiftCorner,
	shiftPosition,
	shiftShape,
} from "./geometry";
import * as math from "./linalg";
import type Physics from "./physics";
import { ensureCornerWalls } from "./plan";
import { getAdjacentSides, getSideCorners, getTileCorners } from "./topology";
import type {
	Color,
	CornerWall,
	Point,
	RenderMode,
	RenderStats,
	Segment,
	TileId,
	TopologyMode,
} from "./types";
import { point, segment } from "./types";
import type View from "./view";
import type WebGLRenderer from "./webgl";

export interface TileDraw {
	polygon: Point[];
	start: Point;
	end: Point;
	worldStart: Point;
	worldEnd: Point;
	color: Color;
	label: string | undefined;
	labelPosition: Point | undefined;
}

export interface WallDraw {
	polygon: Point[];
	start: Point;
	end: Point;
	worldStart: Point;
	worldEnd: Point;
	scale: number;
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

function clipPolygonHalfSpace(
	polygon: Point[],
	isInside: (point: Point) => boolean,
	intersect: (a: Point, b: Point) => Point,
): Point[] {
	const clipped: Point[] = [];
	for (let i = 0; i < polygon.length; i++) {
		const a = polygon[i];
		const b = polygon[(i + 1) % polygon.length];
		const insideA = isInside(a);
		const insideB = isInside(b);
		if (insideA && insideB) {
			clipped.push(b);
		} else if (insideA && !insideB) {
			clipped.push(intersect(a, b));
		} else if (!insideA && insideB) {
			clipped.push(intersect(a, b), b);
		}
	}
	return clipped;
}

function clipPolygonToViewport(polygon: Point[]): Point[] {
	let clipped = polygon;
	clipped = clipPolygonHalfSpace(
		clipped,
		(point) => point.x >= -1,
		(a, b) => math.interpolate(a, b, (-1 - a.x) / (b.x - a.x)),
	);
	clipped = clipPolygonHalfSpace(
		clipped,
		(point) => point.x <= 1,
		(a, b) => math.interpolate(a, b, (1 - a.x) / (b.x - a.x)),
	);
	clipped = clipPolygonHalfSpace(
		clipped,
		(point) => point.y >= -1,
		(a, b) => math.interpolate(a, b, (-1 - a.y) / (b.y - a.y)),
	);
	return clipPolygonHalfSpace(
		clipped,
		(point) => point.y <= 1,
		(a, b) => math.interpolate(a, b, (1 - a.y) / (b.y - a.y)),
	);
}

export function getWallColor(a: Point, b: Point): Color {
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
	backgroundColor: Color = color(0.0, 0.0, 0.0);
	cameraHeight = 10;
	wallHeight: number | undefined = 1.0;
	renderStats: RenderStats | undefined = undefined;
	private renderModeValue: RenderMode = "canvas";
	topologyMode: TopologyMode = "none";
	lastRenderAt: number | undefined = undefined;

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

	get avatarWorldPosition(): Point {
		return this.physics.getWorldPoint(this.physics.position);
	}

	getDebugCornerWalls(): Array<[Point, CornerWall | undefined]> {
		const { shape } = this.physics.plan.get(this.physics.currentTileId);
		const corners = this.getCorners(shape);
		const localCorners = getTileCorners(shape);
		const walls = ensureCornerWalls(
			this.physics.plan,
			this.physics.currentTileId,
		);
		return corners.map((corner, index) => [
			corner,
			walls[index] && {
				left:
					walls[index]?.left &&
					math.sub(
						shiftCorner(
							corners[0],
							corners[2],
							math.add(localCorners[index], walls[index].left),
						),
						corner,
					),
				right:
					walls[index]?.right &&
					math.sub(
						shiftCorner(
							corners[0],
							corners[2],
							math.add(localCorners[index], walls[index].right),
						),
						corner,
					),
			},
		]);
	}

	get renderMode(): RenderMode {
		return this.renderModeValue === "canvas" || this.webglAvailable
			? this.renderModeValue
			: "canvas";
	}

	set renderMode(value: RenderMode) {
		this.renderModeValue =
			value === "canvas" || this.webglAvailable ? value : "canvas";
	}

	get usesWebGL(): boolean {
		return this.renderMode !== "canvas";
	}

	getCorners(shape: Point): [Point, Point, Point] {
		const scale = this.physics.scale / this.view.range;
		const rotation = 0.5 - this.physics.rotation;
		const leftCorner = rotateScale(this.physics.position, rotation, scale);
		const rightCorner = rotateScale(
			point(this.physics.position.x - 1, this.physics.position.y),
			rotation,
			scale,
		);
		const topCorner = shiftCorner(leftCorner, rightCorner, shape);
		return [leftCorner, topCorner, rightCorner];
	}

	pushWall(
		batch: RenderBatch,
		edge: Segment,
		worldEdge: Segment,
		bounds: Segment,
	): void {
		const visibleStart = intersectOrigin(edge.start, edge.end, bounds.start);
		const visibleEnd = intersectOrigin(edge.start, edge.end, bounds.end);
		const scale =
			this.wallHeight === undefined
				? 2 /
					Math.sqrt(
						math.lineDistanceSq(visibleStart, visibleEnd, point(0.0, 0.0)),
					)
				: this.cameraHeight / (this.cameraHeight - this.wallHeight);
		const polygon = clipPolygonToViewport([
			visibleStart,
			visibleEnd,
			math.mul(visibleEnd, scale),
			math.mul(visibleStart, scale),
		]);
		if (polygon.length < 3) {
			return;
		}
		batch.walls.push({
			polygon,
			start: edge.start,
			end: edge.end,
			worldStart: worldEdge.start,
			worldEnd: worldEdge.end,
			scale,
		});
	}

	pushTile(
		batch: RenderBatch,
		triangle: [Point, Point, Point],
		worldTriangle: [Point, Point, Point],
		stats: RenderStats,
		tileId: TileId,
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
			? hsl((Number(tileId % 1000000n) * 0.61803398875) % 1, 0.5, 0.55)
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
		path = clipPolygonToViewport(path);
		if (path.length < 3) {
			return;
		}
		batch.tiles.push({
			polygon: path,
			start: triangle[0],
			end: triangle[2],
			worldStart: worldTriangle[0],
			worldEnd: worldTriangle[2],
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
		tileId: TileId | undefined,
		sideIndex: number | undefined,
		branchStart: Point,
		branchEnd: Point,
		worldStart: Point,
		worldEnd: Point,
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
				segment(worldStart, worldEnd),
				segment(clipStart ?? branchStart, clipEnd ?? branchEnd),
			);
			return;
		}
		assert(sideIndex !== undefined, "Missing side index for tile branch");
		const { shape, sides } = this.physics.plan.get(tileId);
		const shiftedShape = shiftShape(shape, sideIndex);
		const branchCorner = shiftCorner(branchStart, branchEnd, shiftedShape);
		const worldCorner = shiftCorner(worldStart, worldEnd, shiftedShape);
		this.pushTile(
			batch,
			[branchStart, branchCorner, branchEnd],
			[worldStart, worldCorner, worldEnd],
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
			leftSide?.sideIndex,
			branchStart,
			branchCorner,
			worldStart,
			worldCorner,
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
			rightSide?.sideIndex,
			branchCorner,
			branchEnd,
			worldCorner,
			worldEnd,
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
		const worldCorners = getTileCorners(shape).map((corner) =>
			this.physics.getWorldPoint(corner),
		) as [Point, Point, Point];
		this.pushTile(
			batch,
			corners,
			worldCorners,
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
				sides[sideIndex]?.sideIndex,
				edgeStart,
				edgeEnd,
				worldCorners[edgeStartIndex],
				worldCorners[edgeEndIndex],
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
		if (this.usesWebGL && this.webglRenderer) {
			this.webglRenderer.clear(this.backgroundColor);
			this.webglRenderer.draw(batch, this, this.view);
			this.canvasRenderer.clear();
			this.canvasRenderer.drawLabels(batch, this);
			this.canvasRenderer.drawCornerWalls(this);
		} else {
			this.canvasRenderer.draw(batch, this);
		}
		this.lastRenderAt = now;
		this.renderStats = stats;
		return stats;
	}
}
