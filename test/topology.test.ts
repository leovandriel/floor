import assert from "node:assert/strict";
import test from "node:test";
import {
	getAdjacentSides,
	getCornerAcrossSide,
	getIncidentSides,
	getOtherIncidentSide,
	getSideCorners,
	getSideOppositeCorner,
	getTileCorners,
} from "../src/topology";
import { point } from "../src/types";

test("getTileCorners returns the canonical triangle corners", () => {
	assert.deepEqual(getTileCorners(point(0.5, 0.5)), [
		point(0.0, 0.0),
		point(0.5, 0.5),
		point(1.0, 0.0),
	]);
});

test("getIncidentSides returns the two sides meeting at each corner", () => {
	assert.deepEqual(getIncidentSides(0), [0, 1]);
	assert.deepEqual(getIncidentSides(1), [1, 2]);
	assert.deepEqual(getIncidentSides(2), [2, 0]);
});

test("getSideCorners and getSideOppositeCorner agree on triangle topology", () => {
	assert.deepEqual(getSideCorners(0), [2, 0]);
	assert.equal(getSideOppositeCorner(0), 1);
	assert.deepEqual(getSideCorners(1), [0, 1]);
	assert.equal(getSideOppositeCorner(1), 2);
	assert.deepEqual(getSideCorners(2), [1, 2]);
	assert.equal(getSideOppositeCorner(2), 0);
});

test("getOtherIncidentSide returns the non-entry side at a corner", () => {
	assert.equal(getOtherIncidentSide(0, 0), 1);
	assert.equal(getOtherIncidentSide(0, 1), 0);
	assert.equal(getOtherIncidentSide(2, 2), 0);
});

test("getAdjacentSides returns the two sides other than the given side", () => {
	assert.deepEqual(getAdjacentSides(0), [1, 2]);
	assert.deepEqual(getAdjacentSides(1), [2, 0]);
	assert.deepEqual(getAdjacentSides(2), [0, 1]);
});

test("getCornerAcrossSide maps both side corners into the sideIndex frame", () => {
	assert.equal(getCornerAcrossSide(2, 0, 1), 1);
	assert.equal(getCornerAcrossSide(0, 0, 1), 0);
	assert.equal(getCornerAcrossSide(0, 1, 2), 2);
	assert.equal(getCornerAcrossSide(1, 1, 2), 1);
});
