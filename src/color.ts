import assert from "./assert";
import type { Color } from "./types";

export function color(r: number, g: number, b: number, a = 1): Color {
	assert(Number.isFinite(r) && r >= 0 && r <= 1, "Invalid color r", r);
	assert(Number.isFinite(g) && g >= 0 && g <= 1, "Invalid color g", g);
	assert(Number.isFinite(b) && b >= 0 && b <= 1, "Invalid color b", b);
	assert(Number.isFinite(a) && a >= 0 && a <= 1, "Invalid color a", a);
	return { r, g, b, a };
}

export function withAlpha(c: Color, a: number): Color {
	return color(c.r, c.g, c.b, a);
}

export function colorString(c: Color): string {
	return (
		"#" +
		[c.r, c.g, c.b, c.a]
			.map((v) => `0${Math.round(v * 255).toString(16)}`.slice(-2))
			.join("")
	);
}

function hue2rgb(p: number, q: number, t: number): number {
	if (t < 0) t += 1;
	if (t > 1) t -= 1;
	if (t < 1 / 6) return p + (q - p) * 6 * t;
	if (t < 1 / 2) return q;
	if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
	return p;
}

export function hsl(h: number, s: number, l: number): Color {
	if (s === 0) {
		return color(l, l, l);
	}
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	return color(
		hue2rgb(p, q, h + 1 / 3),
		hue2rgb(p, q, h),
		hue2rgb(p, q, h - 1 / 3),
	);
}

export function brightness(c: Color, amount: number): Color {
	return color(
		c.r * (1 - amount) + amount,
		c.g * (1 - amount) + amount,
		c.b * (1 - amount) + amount,
		c.a,
	);
}
