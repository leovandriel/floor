export const triangleVertexIndices = [0, 1, 2] as const;
export const triangleFaceIndices = [0, 1, 2] as const;

export function getIncidentFaces(vertexIndex: number): [number, number] {
	return [vertexIndex, (vertexIndex + 1) % 3];
}

export function getFaceVertices(faceIndex: number): [number, number] {
	return [(faceIndex + 2) % 3, faceIndex];
}

export function getFaceOppositeVertex(faceIndex: number): number {
	return (faceIndex + 1) % 3;
}

export function getOtherIncidentFace(
	vertexIndex: number,
	faceIndex: number,
): number {
	const [a, b] = getIncidentFaces(vertexIndex);
	return a === faceIndex ? b : a;
}

export function getAdjacentFaces(faceIndex: number): [number, number] {
	return [(faceIndex + 1) % 3, (faceIndex + 2) % 3];
}

export function getVertexAcrossFace(
	vertexIndex: number,
	faceIndex: number,
	otherFaceIndex: number,
): number {
	const [startVertexIndex] = getFaceVertices(faceIndex);
	return vertexIndex === startVertexIndex
		? otherFaceIndex
		: (otherFaceIndex + 2) % 3;
}
