import assert from "node:assert/strict";
import test from "node:test";
import {
	getAdjacentFaces,
	getFaceOppositeVertex,
	getFaceVertices,
	getIncidentFaces,
	getOtherIncidentFace,
	getVertexAcrossFace,
	triangleFaceIndices,
	triangleVertexIndices,
} from "../src/topology";

test("getIncidentFaces returns the two faces meeting at each vertex", () => {
	assert.deepEqual(getIncidentFaces(0), [0, 1]);
	assert.deepEqual(getIncidentFaces(1), [1, 2]);
	assert.deepEqual(getIncidentFaces(2), [2, 0]);
});

test("triangle indices enumerate the canonical vertices and faces", () => {
	assert.deepEqual(triangleVertexIndices, [0, 1, 2]);
	assert.deepEqual(triangleFaceIndices, [0, 1, 2]);
});

test("getFaceVertices and getFaceOppositeVertex agree on triangle topology", () => {
	assert.deepEqual(getFaceVertices(0), [2, 0]);
	assert.equal(getFaceOppositeVertex(0), 1);
	assert.deepEqual(getFaceVertices(1), [0, 1]);
	assert.equal(getFaceOppositeVertex(1), 2);
	assert.deepEqual(getFaceVertices(2), [1, 2]);
	assert.equal(getFaceOppositeVertex(2), 0);
});

test("getOtherIncidentFace returns the non-entry face at a vertex", () => {
	assert.equal(getOtherIncidentFace(0, 0), 1);
	assert.equal(getOtherIncidentFace(0, 1), 0);
	assert.equal(getOtherIncidentFace(2, 2), 0);
});

test("getAdjacentFaces returns the two faces other than the given face", () => {
	assert.deepEqual(getAdjacentFaces(0), [1, 2]);
	assert.deepEqual(getAdjacentFaces(1), [2, 0]);
	assert.deepEqual(getAdjacentFaces(2), [0, 1]);
});

test("getVertexAcrossFace maps both face vertices into the faceIndex frame", () => {
	assert.equal(getVertexAcrossFace(2, 0, 1), 1);
	assert.equal(getVertexAcrossFace(0, 0, 1), 0);
	assert.equal(getVertexAcrossFace(0, 1, 2), 2);
	assert.equal(getVertexAcrossFace(1, 1, 2), 1);
});
