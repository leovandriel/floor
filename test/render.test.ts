import assert from "node:assert/strict";
import test from "node:test";

import { getCellVertices, projectPoint } from "../src/geometry";
import Physics from "../src/physics";
import { ensureVertexWalls, getPlanBySlug } from "../src/plan";
import Renderer from "../src/render";
import { point, segment } from "../src/types";
import View from "../src/view";

function getRequiredPlan(slug: string) {
	const plan = getPlanBySlug(slug);
	if (!plan) {
		throw new Error(`Missing plan: ${slug}`);
	}
	return plan;
}

function assertPointClose(
	actual: { x: number; y: number },
	expected: { x: number; y: number },
): void {
	assert.ok(Math.abs(actual.x - expected.x) < 1e-9);
	assert.ok(Math.abs(actual.y - expected.y) < 1e-9);
}

function expectedProjectedDirection(
	baseEdge: { start: { x: number; y: number }; end: { x: number; y: number } },
	vertex: { x: number; y: number },
	localVertex: { x: number; y: number },
	direction: { x: number; y: number } | undefined,
): { x: number; y: number } {
	assert(direction);
	const projected = projectPoint(
		baseEdge,
		point(localVertex.x + direction.x, localVertex.y + direction.y),
	);
	return point(projected.x - vertex.x, projected.y - vertex.y);
}

test("getDebugVertexWalls projects wall directions from the cell base edge", () => {
	const plan = getRequiredPlan("square");
	const physics = new Physics(plan);
	const view = new View();
	const renderer = new Renderer(physics, {} as never, view, undefined);
	const { shape } = plan.get(physics.currentCellId);
	const vertices = renderer.getVertices(shape);
	const localVertices = getCellVertices(shape);
	const baseEdge = segment(vertices[0], vertices[2]);
	const walls = ensureVertexWalls(plan, physics.currentCellId);
	const debugWalls = renderer.getDebugVertexWalls();

	assert.ok(debugWalls.some(([, wall]) => wall?.left || wall?.right));

	for (const [index, [vertex, wall]] of debugWalls.entries()) {
		if (!wall) {
			continue;
		}
		if (wall.left) {
			assertPointClose(
				wall.left,
				expectedProjectedDirection(
					baseEdge,
					vertex,
					localVertices[index],
					walls[index]?.left,
				),
			);
		}
		if (wall.right) {
			assertPointClose(
				wall.right,
				expectedProjectedDirection(
					baseEdge,
					vertex,
					localVertices[index],
					walls[index]?.right,
				),
			);
		}
	}
});
