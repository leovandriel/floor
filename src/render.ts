import type Canvas from "./canvas";
import { brightness, color, hsl } from "./color";
import {
	getCellVertices,
	getFaceSegment,
	projectBranchTriangles,
	projectPoint,
	projectVertexOffset,
	projectViewTriangle,
	shiftSeam,
} from "./geometry";
import * as math from "./linalg";
import type Physics from "./physics";
import { ensureVertexWalls } from "./plan";
import { getAdjacentFaces, triangleFaceIndices } from "./topology";
import type {
	CellId,
	Color,
	Face,
	Point,
	RenderMode,
	RenderStats,
	Segment,
	TopologyMode,
	VertexWall,
} from "./types";
import { point, segment } from "./types";
import type View from "./view";
import type WebGLRenderer from "./webgl";

export interface CellDraw {
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
	cells: CellDraw[];
	walls: WallDraw[];
	avatars: AvatarDraw[];
}

interface VisibleBranch {
	depth: number;
	connection: Face | undefined;
	screenEdge: Segment;
	worldEdge: Segment;
	clip: Segment | undefined;
}

type ConnectedVisibleBranch = VisibleBranch & { connection: Face };

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

function clipTriangle(
	triangle: [Point, Point, Point],
	clip: Segment | undefined,
): Point[] {
	const [vertexA, vertexB, vertexC] = triangle;
	if (!clip) {
		return clipPolygonToViewport(triangle);
	}
	const { start: clipStart, end: clipEnd } = clip;
	const clipStartsLeft = math.isClockwise(clipStart, vertexB);
	const clipEndsRight = math.isClockwise(vertexB, clipEnd);
	const path = [intersectOrigin(vertexA, vertexC, clipStart)];
	path.push(
		clipStartsLeft
			? intersectOrigin(vertexA, vertexB, clipStart)
			: intersectOrigin(vertexB, vertexC, clipStart),
	);
	if (clipStartsLeft && clipEndsRight) {
		path.push(vertexB);
	}
	path.push(
		clipEndsRight
			? intersectOrigin(vertexC, vertexB, clipEnd)
			: intersectOrigin(vertexB, vertexA, clipEnd),
	);
	path.push(intersectOrigin(vertexC, vertexA, clipEnd));
	return clipPolygonToViewport(path);
}

function getTriangleCentroid([a, b, c]: [Point, Point, Point]): Point {
	return point((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
}

function shouldLabelTriangle(
	labelPosition: Point,
	polygon: Point[],
	clip: Segment | undefined,
	showLabel: boolean,
): boolean {
	return showLabel && (!clip || isPointInPolygon(labelPosition, polygon));
}

function splitTriangleBranch(
	branch: ConnectedVisibleBranch,
	branchVertex: Point,
	worldVertex: Point,
	leftConnection: Face | undefined,
	rightConnection: Face | undefined,
): [VisibleBranch, VisibleBranch] {
	return [
		{
			depth: branch.depth + 1,
			connection: leftConnection,
			screenEdge: segment(branch.screenEdge.start, branchVertex),
			worldEdge: segment(branch.worldEdge.start, worldVertex),
			clip: segment(
				branch.clip &&
					math.isClockwise(branch.screenEdge.start, branch.clip.start)
					? branch.clip.start
					: branch.screenEdge.start,
				math.isClockwise(
					branch.clip?.end ?? branch.screenEdge.end,
					branchVertex,
				)
					? (branch.clip?.end ?? branch.screenEdge.end)
					: branchVertex,
			),
		},
		{
			depth: branch.depth + 1,
			connection: rightConnection,
			screenEdge: segment(branchVertex, branch.screenEdge.end),
			worldEdge: segment(worldVertex, branch.worldEdge.end),
			clip: segment(
				math.isClockwise(
					branchVertex,
					branch.clip?.start ?? branch.screenEdge.start,
				)
					? (branch.clip?.start ?? branch.screenEdge.start)
					: branchVertex,
				branch.clip && math.isClockwise(branch.clip.end, branch.screenEdge.end)
					? branch.clip.end
					: branch.screenEdge.end,
			),
		},
	];
}

function createCellDraw(
	triangle: [Point, Point, Point],
	worldTriangle: [Point, Point, Point],
	cellId: CellId,
	clip: Segment | undefined,
	color: Color,
	showLabel: boolean,
): CellDraw | undefined {
	const polygon = clipTriangle(triangle, clip);
	if (polygon.length < 3) {
		return undefined;
	}
	const labelPosition = getTriangleCentroid(triangle);
	return {
		polygon,
		start: triangle[0],
		end: triangle[2],
		worldStart: worldTriangle[0],
		worldEnd: worldTriangle[2],
		color,
		label: shouldLabelTriangle(labelPosition, polygon, clip, showLabel)
			? String(cellId)
			: undefined,
		labelPosition,
	};
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
	cellColor: Color = color(0.4, 0.4, 0.8);
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
	showCell = false;

	constructor(
		private readonly physics: Physics,
		private readonly canvasRenderer: Canvas,
		private readonly view: View,
		private readonly webglRenderer: WebGLRenderer | undefined,
	) {}

	get debug(): boolean {
		return this.showCell && this.showCurrent && this.showSelf;
	}

	set debug(value: boolean) {
		this.showCell = value;
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

	getDebugVertexWalls(): Array<[Point, VertexWall | undefined]> {
		const { shape } = this.physics.plan.get(this.physics.currentCellId);
		const vertices = this.getVertices(shape);
		const localVertices = getCellVertices(shape);
		const baseEdge = segment(vertices[0], vertices[2]);
		const walls = ensureVertexWalls(
			this.physics.plan,
			this.physics.currentCellId,
		);
		return vertices.map((vertex, index) => [
			vertex,
			walls[index] && {
				left:
					walls[index]?.left &&
					math.sub(
						projectVertexOffset(
							baseEdge,
							localVertices[index],
							walls[index].left,
						),
						vertex,
					),
				right:
					walls[index]?.right &&
					math.sub(
						projectVertexOffset(
							baseEdge,
							localVertices[index],
							walls[index].right,
						),
						vertex,
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

	getVertices(shape: Point): [Point, Point, Point] {
		return projectViewTriangle(
			shape,
			this.physics.position,
			0.5 - this.physics.rotation,
			this.physics.scale / this.view.range,
		);
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

	pushCell(
		batch: RenderBatch,
		triangle: [Point, Point, Point],
		worldTriangle: [Point, Point, Point],
		stats: RenderStats,
		cellId: CellId,
		clip: Segment | undefined,
		highlight: boolean,
	): void {
		stats.cells += 1;
		const cellColor = this.showCell
			? hsl((Number(cellId % 1000000n) * 0.61803398875) % 1, 0.5, 0.55)
			: this.cellColor;
		const cell = createCellDraw(
			triangle,
			worldTriangle,
			cellId,
			clip,
			highlight ? brightness(cellColor, 0.5) : cellColor,
			this.showCell,
		);
		if (!cell) {
			return;
		}
		batch.cells.push(cell);
	}

	private visitVisibleBranch(
		batch: RenderBatch,
		stats: RenderStats,
		branch: VisibleBranch,
	): void {
		stats.branches += 1;
		if (branch.depth > stats.maxDepth) {
			stats.maxDepth = branch.depth;
		}
		const clip = branch.clip ?? branch.screenEdge;
		if (math.isClockwise(clip.end, clip.start)) {
			return;
		}
		if (isSegmentOutsideViewport(branch.screenEdge)) {
			return;
		}
		if (!branch.connection) {
			this.pushWall(batch, branch.screenEdge, branch.worldEdge, clip);
			return;
		}
		this.expandTriangleBranch(batch, stats, branch as ConnectedVisibleBranch);
	}

	private expandTriangleBranch(
		batch: RenderBatch,
		stats: RenderStats,
		branch: ConnectedVisibleBranch,
	): void {
		const { cellId, faceIndex } = branch.connection;
		const { shape, faces } = this.physics.plan.get(cellId);
		const [
			[screenStart, branchVertex, screenEnd],
			[worldStart, worldVertex, worldEnd],
		] = projectBranchTriangles(
			branch.screenEdge,
			branch.worldEdge,
			shape,
			faceIndex,
		);
		this.pushCell(
			batch,
			[screenStart, branchVertex, screenEnd],
			[worldStart, worldVertex, worldEnd],
			stats,
			cellId,
			branch.clip ?? branch.screenEdge,
			false,
		);
		if (this.showSelf && cellId === this.physics.currentCellId) {
			const shiftedPosition = shiftSeam(this.physics.position, {
				shape,
				index: faceIndex,
			});
			batch.avatars.push({
				position: projectPoint(branch.screenEdge, shiftedPosition),
				faded: true,
			});
		}
		const [leftFaceIndex, rightFaceIndex] = getAdjacentFaces(faceIndex);
		const [leftBranch, rightBranch] = splitTriangleBranch(
			branch,
			branchVertex,
			worldVertex,
			faces[leftFaceIndex],
			faces[rightFaceIndex],
		);
		this.visitVisibleBranch(batch, stats, leftBranch);
		this.visitVisibleBranch(batch, stats, rightBranch);
	}

	buildBatch(stats: RenderStats): RenderBatch {
		const batch: RenderBatch = { cells: [], walls: [], avatars: [] };
		const { shape, faces } = this.physics.plan.get(this.physics.currentCellId);
		const vertices = this.getVertices(shape);
		const worldVertices = getCellVertices(shape).map((vertex) =>
			this.physics.getWorldPoint(vertex),
		) as [Point, Point, Point];
		this.pushCell(
			batch,
			vertices,
			worldVertices,
			stats,
			this.physics.currentCellId,
			undefined,
			this.showCurrent,
		);
		for (const faceIndex of triangleFaceIndices) {
			const screenEdge = getFaceSegment(vertices, faceIndex);
			const worldEdge = getFaceSegment(worldVertices, faceIndex);
			this.visitVisibleBranch(batch, stats, {
				depth: 1,
				connection: faces[faceIndex],
				screenEdge,
				worldEdge,
				clip: undefined,
			});
		}
		batch.avatars.push({ position: point(0.0, 0.0), faded: false });
		return batch;
	}

	render(): RenderStats {
		const now = performance.now();
		const stats: RenderStats = {
			cells: 0,
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
			this.canvasRenderer.drawVertexWalls(this);
		} else {
			this.canvasRenderer.draw(batch, this);
		}
		this.lastRenderAt = now;
		this.renderStats = stats;
		return stats;
	}
}
