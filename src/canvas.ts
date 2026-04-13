import { color, colorString, withAlpha } from "./color";
import type Renderer from "./render";
import type { RenderBatch } from "./render";
import { getWallColor } from "./render";
import type { Color, Point } from "./types";
import { point } from "./types";
import type View from "./view";

type DrawMode = "fill" | "stroke" | "both";
const cellStrokePixels = 0.5;

export default class Canvas {
	private readonly context: CanvasRenderingContext2D;

	constructor(
		context: CanvasRenderingContext2D,
		private readonly view: View,
	) {
		this.context = context;
	}

	resize(size: Point): void {
		this.context.canvas.width = size.x * 2;
		this.context.canvas.height = size.y * 2;
		this.context.canvas.style.width = `${size.x}px`;
		this.context.canvas.style.height = `${size.y}px`;
		this.context.setTransform(2, 0, 0, 2, 0, 0);
	}

	setWidth(width: number): void {
		this.context.lineWidth = (width * this.view.scale) / this.view.range / 1000;
	}

	setPixelWidth(width: number): void {
		this.context.lineWidth = width;
	}

	private transform(p: Point): [number, number] {
		return [
			this.view.size.x / 2 + p.x * this.view.scale,
			this.view.size.y / 2 - p.y * this.view.scale,
		];
	}

	setColor(c: Color): void {
		const c2 = colorString(c);
		this.context.fillStyle = c2;
		this.context.strokeStyle = c2;
	}

	drawPath(path: Point[], mode: DrawMode): void {
		this.context.beginPath();
		this.context.moveTo(...this.transform(path[0]));
		for (let i = 1; i < path.length; i++) {
			this.context.lineTo(...this.transform(path[i]));
		}
		this.context.closePath();
		if (mode === "fill" || mode === "both") {
			this.context.fill();
		}
		if (mode === "stroke" || mode === "both") {
			this.context.stroke();
		}
	}

	drawCircle(a: Point, r: number, mode: DrawMode): void {
		this.context.beginPath();
		this.context.arc(
			...this.transform(a),
			(r / this.view.range) * this.view.scale,
			0,
			Math.PI * 2,
		);
		if (mode === "fill" || mode === "both") {
			this.context.fill();
		}
		if (mode === "stroke" || mode === "both") {
			this.context.stroke();
		}
	}

	drawText(a: Point, text: string): void {
		this.context.save();
		this.context.font = `${Math.max(this.view.scale / 54, 8)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace`;
		this.context.textAlign = "center";
		this.context.textBaseline = "middle";
		this.context.fillText(text, ...this.transform(a));
		this.context.restore();
	}

	drawRect(p: Point, q: Point): void {
		this.context.fillRect(p.x, p.y, q.x, q.y);
	}

	drawSegment(a: Point, b: Point): void {
		this.context.beginPath();
		this.context.moveTo(...this.transform(a));
		this.context.lineTo(...this.transform(b));
		this.context.stroke();
	}

	clear(): void {
		this.context.clearRect(
			0,
			0,
			this.context.canvas.width,
			this.context.canvas.height,
		);
	}

	drawBackground(c: Color): void {
		this.setColor(c);
		this.drawRect(point(0.0, 0.0), this.view.size);
	}

	draw(batch: RenderBatch, renderer: Renderer): void {
		this.drawBackground(renderer.backgroundColor);
		this.drawCells(batch);
		this.drawWalls(batch);
		this.drawAvatars(batch, renderer);
		this.drawLabels(batch, renderer);
		this.drawVertexWalls(renderer);
	}

	drawCells(batch: RenderBatch): void {
		for (const cell of batch.cells) {
			this.setColor(cell.color);
			this.setPixelWidth(cellStrokePixels);
			this.drawPath(cell.polygon, "both");
		}
	}

	drawWalls(batch: RenderBatch): void {
		for (const wall of batch.walls) {
			this.setColor(getWallColor(wall.start, wall.end));
			this.setPixelWidth(cellStrokePixels);
			this.drawPath(wall.polygon, "both");
		}
	}

	drawAvatars(batch: RenderBatch, renderer: Renderer): void {
		for (const avatar of batch.avatars) {
			this.setColor(avatar.faded ? color(0.6, 0.6, 0.6) : renderer.avatarColor);
			this.drawCircle(avatar.position, renderer.avatarRadius, "fill");
		}
	}

	drawLabels(batch: RenderBatch, renderer: Renderer): void {
		for (const cell of batch.cells) {
			if (!cell.label || !cell.labelPosition) {
				continue;
			}
			this.setColor(withAlpha(renderer.wallColor, 0.45));
			this.drawText(cell.labelPosition, cell.label);
		}
	}

	drawVertexWalls(renderer: Renderer): void {
		if (!renderer.debug) {
			return;
		}
		for (const [vertex, wall] of renderer.getDebugVertexWalls()) {
			if (!wall) {
				continue;
			}
			for (const [index, direction] of [wall.left, wall.right].entries()) {
				if (!direction) {
					continue;
				}
				this.setColor(
					index === 0 ? color(1.0, 0.2, 0.2) : color(0.2, 1.0, 0.2),
				);
				this.setPixelWidth(1);
				this.drawSegment(
					vertex,
					point(vertex.x + direction.x, vertex.y + direction.y),
				);
			}
		}
	}
}
