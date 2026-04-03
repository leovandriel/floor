import type { Point } from "./types";
import { point } from "./types";

export default class View {
	size: Point = point(0.0, 0.0);
	factor = 1;
	range = 0.5;

	get scale(): number {
		return (this.factor * Math.max(this.size.x, this.size.y)) / 2;
	}

	zoom(factor: number): void {
		this.factor *= factor;
	}

	warp(range: number): void {
		this.range *= range;
	}

	resizeToWindow(): void {
		this.setSize(point(window.innerWidth, window.innerHeight));
	}

	setSize(size: Point): void {
		this.size = size;
	}
}
