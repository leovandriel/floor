import { point } from "./math";
import type { Plan, Point, Side, Tile } from "./types";

function side(index: number, offset: number): Side {
	return { index, offset };
}

function tile(shape: Point, a: Side, b: Side, c: Side): Tile {
	return { shape, sides: [a, b, c] };
}

function plan(slug: string, tiles: Tile[]): Plan {
	return { slug, tiles };
}

export const planSquare: Plan = plan("square", [
	tile(point(0.5, 0.5), side(-1, 0), side(0, 2), side(0, 1)),
]);

export const planBase: Plan = plan("base", [
	tile(point(0, 1), side(-1, 0), side(-1, 0), side(1, 0)),
	tile(point(0, 1), side(0, 2), side(2, 0), side(-1, 0)),
	tile(point(0, 1), side(1, 1), side(3, 0), side(-1, 0)),
	tile(point(0, 1), side(2, 1), side(4, 0), side(-1, 0)),
	tile(point(0.5, 0.5), side(3, 1), side(-1, 0), side(-1, 0)),
]);

export const planTunnel: Plan = plan("tunnel", [
	tile(point(0, 1), side(-1, 0), side(0, 1), side(0, 2)),
]);

export const planHex: Plan = plan("hex", [
	tile(point(0.5, 0.866), side(-1, 0), side(0, 2), side(0, 1)),
]);

export const planTriangle: Plan = plan("triangle", [
	tile(point(0.5, 0.866), side(-1, 0), side(-1, 0), side(-1, 0)),
]);

export const planCurl: Plan = plan("curl", [
	tile(point(0, 1), side(-1, 0), side(-1, 0), side(1, 0)),
	tile(point(-0.082, 0.9016), side(0, 2), side(2, 0), side(-1, 0)),
	tile(point(-0.1, 0.1), side(1, 1), side(-1, 0), side(3, 0)),
	tile(point(-0.082, 0.9016), side(2, 2), side(4, 0), side(-1, 0)),
	tile(point(-0.1, 0.1), side(3, 1), side(-1, 0), side(5, 0)),
	tile(point(-0.082, 0.9016), side(4, 2), side(6, 0), side(-1, 0)),
	tile(point(-0.1, 1.1), side(5, 1), side(7, 0), side(-1, 0)),
	tile(point(0.5902, 0.4918), side(6, 1), side(-1, 0), side(-1, 0)),
]);

export const planGrid: Plan = plan("grid", [
	tile(point(0, 1), side(3, 1), side(-1, 0), side(1, 0)),
	tile(point(0.5, 0.5), side(0, 2), side(2, 0), side(-1, 0)),
	tile(point(0, 1), side(1, 1), side(4, 0), side(3, 0)),
	tile(point(0.5, 0.5), side(2, 2), side(0, 0), side(5, 2)),
	tile(point(1, 1), side(2, 1), side(5, 0), side(-1, 0)),
	tile(point(0.5, 0.5), side(4, 1), side(-1, 0), side(3, 2)),
]);

export const planInfinite: Plan = plan("infinite", [
	tile(point(0.5, 0.5), side(0, 0), side(0, 1), side(0, 2)),
]);

export const planCircle: Plan = plan("circle", [
	tile(point(-0.25, 0.97), side(1, 0), side(-1, 0), side(1, 2)),
	tile(point(0.38, 1.45), side(0, 0), side(-1, 0), side(0, 2)),
]);

export const planSpiral: Plan = plan("spiral", [
	tile(point(-0.25, 0.97), side(1, 0), side(-1, 0), side(1, 2)),
	tile(point(0.1, 2), side(0, 0), side(-1, 0), side(0, 2)),
]);

export const defaultPlan = planSquare;
export const defaultPlanSlug = defaultPlan.slug;

export const plans: Plan[] = [
	planSquare,
	planTriangle,
	planHex,
	planBase,
	planTunnel,
	planGrid,
	planCurl,
	planCircle,
	planSpiral,
	planInfinite,
];

export const planSlugs = plans.map((plan) => plan.slug);

export function getPlanBySlug(slug: string): Plan | undefined {
	return plans.find((plan) => plan.slug === slug);
}

export function getValidPlan(slug: string): {
	plan: Plan | undefined;
	warnings: string[];
} {
	const plan = getPlanBySlug(slug);
	if (!plan) {
		return { plan: undefined, warnings: [`Unknown plan: ${slug}`] };
	}

	const warnings = checkPlan(plan);
	return warnings.length > 0
		? { plan: undefined, warnings }
		: { plan, warnings };
}

export function checkPlan(plan: Plan): string[] {
	const warnings: string[] = [];
	const { tiles } = plan;
	for (let i = 0; i < tiles.length; i++) {
		const { shape, sides } = tiles[i];
		if (shape.y < -1e-5) {
			warnings.push(`Flipped tile at ${i}`);
		} else if (shape.y < 1e-5) {
			warnings.push(`Flat tile at ${i}`);
		}
		for (let j = 0; j < 3; j++) {
			const { index, offset } = sides[j];
			if (index >= 0) {
				const { index: inverseIndex, offset: inverseOffset } =
					tiles[index].sides[offset];
				if (i !== inverseIndex) {
					warnings.push(`Inverse missing at ${i}:${j}`);
				}
				if (j !== inverseOffset) {
					warnings.push(`Inverse offset at ${i}:${j}`);
				}
			}
		}
	}
	return warnings;
}
