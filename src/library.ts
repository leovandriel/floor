import { point } from "./math";
import type { Plan, Side } from "./types";

function side(index: number, offset: number): Side {
	return { index, offset };
}

export const planBox: Plan = {
	tiles: [
		{ shape: point(0.5, 0.5), sides: [side(-1, 0), side(0, 2), side(0, 1)] },
	],
};

export const planBase: Plan = {
	tiles: [
		{ shape: point(0, 1), sides: [side(-1, 0), side(-1, 0), side(1, 0)] },
		{ shape: point(0, 1), sides: [side(0, 2), side(2, 0), side(-1, 0)] },
		{ shape: point(0, 1), sides: [side(1, 1), side(3, 0), side(-1, 0)] },
		{ shape: point(0, 1), sides: [side(2, 1), side(4, 0), side(-1, 0)] },
		{ shape: point(0.5, 0.5), sides: [side(3, 1), side(-1, 0), side(-1, 0)] },
	],
};

export const planTunnel: Plan = {
	tiles: [
		{ shape: point(0.5, 0.5), sides: [side(-1, 0), side(0, 1), side(0, 2)] },
	],
};

export const planCurl: Plan = {
	tiles: [
		{ shape: point(0, 1), sides: [side(-1, 0), side(-1, 0), side(1, 0)] },
		{
			shape: point(-0.082, 0.9016),
			sides: [side(0, 2), side(2, 0), side(-1, 0)],
		},
		{ shape: point(-0.1, 0.1), sides: [side(1, 1), side(-1, 0), side(3, 0)] },
		{
			shape: point(-0.082, 0.9016),
			sides: [side(2, 2), side(4, 0), side(-1, 0)],
		},
		{ shape: point(-0.1, 0.1), sides: [side(3, 1), side(-1, 0), side(5, 0)] },
		{
			shape: point(-0.082, 0.9016),
			sides: [side(4, 2), side(6, 0), side(-1, 0)],
		},
		{ shape: point(-0.1, 1.1), sides: [side(5, 1), side(7, 0), side(-1, 0)] },
		{
			shape: point(0.5902, 0.4918),
			sides: [side(6, 1), side(-1, 0), side(-1, 0)],
		},
	],
};

export const planGrid: Plan = {
	tiles: [
		{ shape: point(0, 1), sides: [side(3, 1), side(-1, 0), side(1, 0)] },
		{ shape: point(0.5, 0.5), sides: [side(0, 2), side(2, 0), side(-1, 0)] },
		{ shape: point(0, 1), sides: [side(1, 1), side(4, 0), side(3, 0)] },
		{ shape: point(0.5, 0.5), sides: [side(2, 2), side(0, 0), side(5, 2)] },
		{ shape: point(1, 1), sides: [side(2, 1), side(5, 0), side(-1, 0)] },
		{ shape: point(0.5, 0.5), sides: [side(4, 1), side(-1, 0), side(3, 2)] },
	],
};

export const planInfinite: Plan = {
	tiles: [
		{ shape: point(0.5, 0.5), sides: [side(0, 0), side(0, 1), side(0, 2)] },
	],
};

export const planCircle: Plan = {
	tiles: [
		{ shape: point(-0.25, 0.97), sides: [side(1, 0), side(-1, 0), side(1, 2)] },
		{ shape: point(0.38, 1.45), sides: [side(0, 0), side(-1, 0), side(0, 2)] },
	],
};

export const planSpiral: Plan = {
	tiles: [
		{ shape: point(-0.25, 0.97), sides: [side(1, 0), side(-1, 0), side(1, 2)] },
		{ shape: point(0.1, 2.0), sides: [side(0, 0), side(-1, 0), side(0, 2)] },
	],
};

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
