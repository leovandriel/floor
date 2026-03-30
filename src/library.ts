import { point } from "./math";
import type { Plan, Point, Side, Tile } from "./types";

function side(index: number, offset: number): Side {
	return { index, offset };
}

function tile(shape: Point, a: Side, b: Side, c: Side): Tile {
	return { shape, sides: [a, b, c] };
}

export const planBox: Plan = {
	tiles: [tile(point(0.5, 0.5), side(-1, 0), side(0, 2), side(0, 1))],
};

export const planBase: Plan = {
	tiles: [
		tile(point(0, 1), side(-1, 0), side(-1, 0), side(1, 0)),
		tile(point(0, 1), side(0, 2), side(2, 0), side(-1, 0)),
		tile(point(0, 1), side(1, 1), side(3, 0), side(-1, 0)),
		tile(point(0, 1), side(2, 1), side(4, 0), side(-1, 0)),
		tile(point(0.5, 0.5), side(3, 1), side(-1, 0), side(-1, 0)),
	],
};

export const planTunnel: Plan = {
	tiles: [tile(point(0, 1), side(-1, 0), side(0, 1), side(0, 2))],
};

export const planHex: Plan = {
	tiles: [tile(point(0.5, 0.866), side(-1, 0), side(0, 2), side(0, 1))],
};

export const planCurl: Plan = {
	tiles: [
		tile(point(0, 1), side(-1, 0), side(-1, 0), side(1, 0)),
		tile(point(-0.082, 0.9016), side(0, 2), side(2, 0), side(-1, 0)),
		tile(point(-0.1, 0.1), side(1, 1), side(-1, 0), side(3, 0)),
		tile(point(-0.082, 0.9016), side(2, 2), side(4, 0), side(-1, 0)),
		tile(point(-0.1, 0.1), side(3, 1), side(-1, 0), side(5, 0)),
		tile(point(-0.082, 0.9016), side(4, 2), side(6, 0), side(-1, 0)),
		tile(point(-0.1, 1.1), side(5, 1), side(7, 0), side(-1, 0)),
		tile(point(0.5902, 0.4918), side(6, 1), side(-1, 0), side(-1, 0)),
	],
};

export const planGrid: Plan = {
	tiles: [
		tile(point(0, 1), side(3, 1), side(-1, 0), side(1, 0)),
		tile(point(0.5, 0.5), side(0, 2), side(2, 0), side(-1, 0)),
		tile(point(0, 1), side(1, 1), side(4, 0), side(3, 0)),
		tile(point(0.5, 0.5), side(2, 2), side(0, 0), side(5, 2)),
		tile(point(1, 1), side(2, 1), side(5, 0), side(-1, 0)),
		tile(point(0.5, 0.5), side(4, 1), side(-1, 0), side(3, 2)),
	],
};

export const planInfinite: Plan = {
	tiles: [tile(point(0.5, 0.5), side(0, 0), side(0, 1), side(0, 2))],
};

export const planCircle: Plan = {
	tiles: [
		tile(point(-0.25, 0.97), side(1, 0), side(-1, 0), side(1, 2)),
		tile(point(0.38, 1.45), side(0, 0), side(-1, 0), side(0, 2)),
	],
};

export const planSpiral: Plan = {
	tiles: [
		tile(point(-0.25, 0.97), side(1, 0), side(-1, 0), side(1, 2)),
		tile(point(0.1, 2), side(0, 0), side(-1, 0), side(0, 2)),
	],
};

export const defaultPlanSlug = "box";

export const plansBySlug: Record<string, Plan> = {
	box: planBox,
	base: planBase,
	tunnel: planTunnel,
	hex: planHex,
	curl: planCurl,
	grid: planGrid,
	infinite: planInfinite,
	circle: planCircle,
	spiral: planSpiral,
};

export const planSlugs = Object.keys(plansBySlug);

export function getPlanBySlug(slug: string): Plan | undefined {
	return plansBySlug[slug];
}

export function checkPlan(plan: Plan): void {
	const { tiles } = plan;
	for (let i = 0; i < tiles.length; i++) {
		const { shape, sides } = tiles[i];
		if (shape.y < -1e-5) {
			console.warn(`Flipped tile at ${i}`);
		} else if (shape.y < 1e-5) {
			console.warn(`Flat tile at ${i}`);
		}
		for (let j = 0; j < 3; j++) {
			const { index, offset } = sides[j];
			if (index >= 0) {
				const { index: inverseIndex, offset: inverseOffset } =
					tiles[index].sides[offset];
				if (i !== inverseIndex) {
					console.warn(`Inverse missing at ${i}:${j}`);
				}
				if (j !== inverseOffset) {
					console.warn(`Inverse offset at ${i}:${j}`);
				}
			}
		}
	}
}
