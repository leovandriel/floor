import * as math from "./math";
import { point } from "./math";
import type { Color, Point, Segment } from "./types";

type GradientCache = Record<string, CanvasGradient>;

function colorString(c: Color): string {
	return (
		"#" +
		[c.r, c.g, c.b, c.a]
			.map((v) => `0${Math.round(v * 255).toString(16)}`.slice(-2))
			.join("")
	);
}

export function color(r: number, g: number, b: number, a = 1): Color {
	return { r, g, b, a };
}

export function withAlpha(c: Color, a: number): Color {
	return color(c.r, c.g, c.b, a);
}

export default class Canvas {
	private sizeValue: Point = point(0, 0);
	private scaleValue = 1;
	private factorValue = 1;
	private rangeValue = 0.5;

	private backgroundValue: Color;
	private context: CanvasRenderingContext2D;
	private mouse: Point | undefined = undefined;

	private gradientCache: GradientCache = {};

	constructor(
		context: CanvasRenderingContext2D,
		size: Point,
		background: Color,
	) {
		this.context = context;
		this.sizeValue = size;
		this.backgroundValue = background;
		this.cache();
	}

	get range(): number {
		return this.rangeValue;
	}
	get size(): Point {
		return this.sizeValue;
	}
	get factor(): number {
		return this.factorValue;
	}
	get background(): Color {
		return this.backgroundValue;
	}

	set factor(factor: number) {
		this.factorValue = factor;
		this.cache();
	}

	set range(range: number) {
		this.rangeValue = range;
	}

	zoom(factor: number): void {
		this.factorValue *= factor;
		this.cache();
	}

	warp(range: number): void {
		this.rangeValue *= range;
	}

	setSize(size: Point): void {
		this.sizeValue = size;
		this.cache();
	}

	setMouse(mouse: Point | undefined): void {
		this.mouse = mouse;
	}

	private cache(): void {
		this.scaleValue =
			(this.factorValue * Math.max(this.sizeValue.x, this.sizeValue.y)) / 2;
		this.gradientCache = {};
	}

	private createGradient(c: Color): CanvasGradient {
		const gradient = this.context.createRadialGradient(
			this.sizeValue.x / 2,
			this.sizeValue.y / 2,
			0,
			this.sizeValue.x / 2,
			this.sizeValue.y / 2,
			this.scaleValue,
		);
		gradient.addColorStop(0, colorString(c));
		gradient.addColorStop(1, colorString(this.backgroundValue));
		return gradient;
	}

	private getGradient(c: Color): CanvasGradient {
		const key = colorString(c);
		const cachedGradient = this.gradientCache[key];
		if (cachedGradient) {
			return cachedGradient;
		}

		const gradient = this.createGradient(c);
		this.gradientCache[key] = gradient;
		return gradient;
	}

	private interpolate(p: Color, q: Color, t: number): Color {
		return color(
			Math.round((p.r * (1 - t) + q.r * t) * 100) / 100,
			Math.round((p.g * (1 - t) + q.g * t) * 100) / 100,
			Math.round((p.b * (1 - t) + q.b * t) * 100) / 100,
			Math.round((p.a * (1 - t) + q.a * t) * 100) / 100,
		);
	}

	setWidth(width: number): void {
		this.context.lineWidth = (width * this.scaleValue) / this.rangeValue / 1000;
	}

	private transform(p: Point): [number, number] {
		return [
			this.sizeValue.x / 2 + p.x * this.scaleValue,
			this.sizeValue.y / 2 - p.y * this.scaleValue,
		];
	}

	setColor(c: Color, vertical?: Point): void {
		if (vertical) {
			const length = Math.min(math.size(vertical), 1);
			const c2 = colorString(this.interpolate(c, this.backgroundValue, length));
			this.context.fillStyle = c2;
			this.context.strokeStyle = c2;
		} else {
			const gradient = this.getGradient(c);
			this.context.fillStyle = gradient;
			this.context.strokeStyle = gradient;
		}
	}

	drawPath(path: Point[], fill?: boolean): void {
		this.context.beginPath();
		this.context.moveTo(...this.transform(path[0]));
		for (let i = 1; i < path.length; i++) {
			this.context.lineTo(...this.transform(path[i]));
		}
		this.context.closePath();
		if (fill) {
			this.context.fill();
		} else {
			this.context.stroke();
		}
	}

	drawLine(a: Point, b: Point): void {
		this.context.beginPath();
		this.context.moveTo(...this.transform(a));
		this.context.lineTo(...this.transform(b));
		this.context.stroke();
	}

	drawDouble(segment: Segment, _width: number): void {
		const { start: a, end: b } = segment;
		this.context.beginPath();
		const length =
			Math.sqrt(math.pointDistanceSq(a, b)) * 300 * this.rangeValue;
		const p = point((b.y - a.y) / length, (a.x - b.x) / length);
		this.context.moveTo(...this.transform(point(a.x + p.x, a.y + p.y)));
		this.context.lineTo(...this.transform(point(a.x - p.x, a.y - p.y)));
		this.context.lineTo(...this.transform(point(b.x - p.x, b.y - p.y)));
		this.context.lineTo(...this.transform(point(b.x + p.x, b.y + p.y)));
		this.context.closePath();
		this.context.stroke();
	}

	drawCircle(a: Point, r: number, fill?: boolean): void {
		this.context.beginPath();
		this.context.arc(
			...this.transform(a),
			(r / this.rangeValue) * this.scaleValue,
			0,
			Math.PI * 2,
		);
		if (fill) {
			this.context.fill();
		} else {
			this.context.stroke();
		}
	}

	drawRect(p: Point, q: Point): void {
		this.context.fillRect(p.x, p.y, q.x, q.y);
	}

	untransform(p: Point): Point {
		return point(
			(p.x - this.sizeValue.x / 2) / this.scaleValue,
			(this.sizeValue.y / 2 - p.y) / this.scaleValue,
		);
	}

	unscale(p: Point): Point {
		return point(p.x / this.scaleValue, p.y / -this.scaleValue);
	}

	getMouse(): Point | undefined {
		if (!this.mouse) return undefined;
		return this.untransform(this.mouse);
	}
}
