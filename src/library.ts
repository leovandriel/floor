import type { Plan } from "./types";
import { arrayPlan, point, side, tile } from "./types";

export const library: Plan[] = [
	arrayPlan("triangle", [
		tile(point(0.5, 0.866), undefined, undefined, undefined),
	]),
	arrayPlan("square", [
		tile(point(0.5, 0.5), undefined, side(0, 2), side(0, 1)),
	]),
	arrayPlan("hex", [
		tile(point(0.5, 0.866), undefined, side(0, 2), side(0, 1)),
	]),
	arrayPlan("tunnel", [
		tile(point(0.0, 1.0), side(0, 0), undefined, side(0, 2)),
	]),
	arrayPlan("grid", [
		tile(point(0.0, 1.0), side(3, 1), undefined, side(1, 0)),
		tile(point(0.5, 0.5), side(0, 2), side(2, 0), undefined),
		tile(point(0.0, 1.0), side(1, 1), side(4, 0), side(3, 0)),
		tile(point(0.5, 0.5), side(2, 2), side(0, 0), side(5, 2)),
		tile(point(1.0, 1.0), side(2, 1), side(5, 0), undefined),
		tile(point(0.5, 0.5), side(4, 1), undefined, side(3, 2)),
	]),
	arrayPlan("base", [
		tile(point(0.0, 1.0), undefined, undefined, side(1, 0)),
		tile(point(0.0, 1.0), side(0, 2), side(2, 0), undefined),
		tile(point(0.0, 1.0), side(1, 1), side(3, 0), undefined),
		tile(point(0.0, 1.0), side(2, 1), side(4, 0), undefined),
		tile(point(0.5, 0.5), side(3, 1), undefined, undefined),
	]),
	arrayPlan("curl", [
		tile(point(0.0, 1.2), undefined, undefined, side(1, 1)),
		tile(point(0.545, 0.455), undefined, side(0, 2), side(2, 2)),
		tile(point(6.0, 5.0), undefined, side(3, 1), side(1, 2)),
		tile(point(0.545, 0.455), undefined, side(2, 1), side(4, 2)),
		tile(point(6.0, 5.0), undefined, side(5, 1), side(3, 2)),
		tile(point(0.545, 0.455), undefined, side(4, 1), side(6, 1)),
		tile(point(0.455, 0.455), undefined, side(5, 2), side(7, 1)),
		tile(point(1.0, 1.2), undefined, side(6, 2), undefined),
	]),
	arrayPlan("circle", [
		tile(point(-0.25, 0.97), side(1, 0), undefined, side(1, 2)),
		tile(point(0.38, 1.45), side(0, 0), undefined, side(0, 2)),
	]),
	arrayPlan("spiral", [
		tile(point(-0.25, 0.97), side(1, 0), undefined, side(1, 2)),
		tile(point(0.1, 2.0), side(0, 0), undefined, side(0, 2)),
	]),
	arrayPlan("infinite", [
		tile(point(0.5, 0.866), side(0, 0), side(0, 1), side(0, 2)),
	]),
];
