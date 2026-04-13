import assert from "./assert";
import { naturalToVector, random, vectorToNatural } from "./number";
import { TupleMap, TupleSet } from "./tuple";
import type { Cell, CellId, Face, Plan, Point, Triple } from "./types";
import { cell, face, mapTriple, plan, point, triple } from "./types";

export interface GluePoint {
	getterIndex: number;
	face: Face;
}

export function arrayGetter(cells: Cell[]): (id: CellId) => Cell {
	assert(cells.length > 0, "Plan must include at least one cell");
	return (id: CellId) => {
		assert(id >= 0n, "Invalid cell id", id);
		assert(id < BigInt(cells.length), "Cell id out of range", id);
		return cells[Number(id)];
	};
}

export function glueGetter(
	getters: Array<(id: CellId) => Cell>,
	glues: Array<{ a: GluePoint; b: GluePoint }>,
): (id: CellId) => Cell {
	assert(getters.length > 1, "Glue must include at least two getters");
	const count = BigInt(getters.length);
	const glueMap = new TupleMap<[number, CellId, number], GluePoint>();
	const wallMap = new TupleSet<[number, CellId, number]>();
	for (const { a, b } of glues) {
		assert(
			a.getterIndex >= 0 && a.getterIndex < getters.length,
			"Invalid glue getter index",
			a.getterIndex,
		);
		assert(
			b.getterIndex >= 0 && b.getterIndex < getters.length,
			"Invalid glue getter index",
			b.getterIndex,
		);
		assert(
			!glueMap.has([a.getterIndex, a.face.cellId, a.face.faceIndex]),
			"Duplicate glue point",
			a.getterIndex,
			a.face.cellId,
			a.face.faceIndex,
		);
		assert(
			!glueMap.has([b.getterIndex, b.face.cellId, b.face.faceIndex]),
			"Duplicate glue point",
			b.getterIndex,
			b.face.cellId,
			b.face.faceIndex,
		);
		glueMap.set([a.getterIndex, a.face.cellId, a.face.faceIndex], b);
		glueMap.set([b.getterIndex, b.face.cellId, b.face.faceIndex], a);
		for (const point of [a, b]) {
			const oldFace = getters[point.getterIndex](point.face.cellId).faces[
				point.face.faceIndex
			];
			if (!oldFace) {
				continue;
			}
			wallMap.add([point.getterIndex, oldFace.cellId, oldFace.faceIndex]);
		}
	}

	return (id: CellId) => {
		assert(id >= 0n, "Invalid cell id", id);
		const getterIndex = Number(id % count);
		const innerId = id / count;
		const innerCell = getters[getterIndex](innerId);
		const faces = mapTriple(innerCell.faces, (innerFace, faceIndex) => {
			const glued = glueMap.get([getterIndex, innerId, faceIndex]);
			if (glued) {
				return face(
					glued.face.cellId * count + BigInt(glued.getterIndex),
					glued.face.faceIndex,
				);
			}
			if (!innerFace) {
				return undefined;
			}
			if (wallMap.has([getterIndex, innerId, faceIndex])) {
				return undefined;
			}
			return face(
				innerFace.cellId * count + BigInt(getterIndex),
				innerFace.faceIndex,
			);
		});
		return cell(innerCell.shape, ...faces);
	};
}

function flatMazeGetter(
	shape: Point,
	threshold: number,
	hasInnerWall: boolean,
): (id: CellId) => Cell {
	return (id: CellId) => {
		assert(id >= 0n, "Invalid cell id", id);
		const [x, y] = naturalToVector(id / 2n, 2);
		const getId = (x: bigint, y: bigint): CellId =>
			vectorToNatural([x, y]) * 2n;
		const hasWall = (id: CellId): boolean => random(id + 2n) < threshold;

		if (id % 2n === 0n) {
			const southUpper = getId(x, y - 1n) + 1n;
			const westUpper = getId(x - 1n, y) + 1n;
			return cell(
				shape,
				hasWall(southUpper) ? undefined : face(southUpper, 0),
				hasWall(id) ? undefined : face(westUpper, 1),
				hasInnerWall && hasWall(id * 2n) ? undefined : face(id + 1n, 2),
			);
		} else {
			const northLower = getId(x, y + 1n);
			const eastLower = getId(x + 1n, y);
			return cell(
				shape,
				hasWall(id) ? undefined : face(northLower, 0),
				hasWall(eastLower) ? undefined : face(eastLower, 1),
				hasInnerWall && hasWall((id - 1n) * 2n) ? undefined : face(id - 1n, 2),
			);
		}
	};
}

function warpMazeGetter(threshold: number): (id: CellId) => Cell {
	function getNeighbor(id: CellId, direction: number): CellId | undefined {
		if (id > 0n && direction === (Number((id - 1n) % 4n) + 2) % 4) {
			return (id - 1n) / 4n;
		}
		return random(id * 8n + BigInt(direction) + 2n) < threshold
			? undefined
			: id * 4n + BigInt(direction) + 1n;
	}

	return (id: CellId): Cell => {
		assert(id >= 0n, "Invalid cell id", id);
		const cellId = id / 2n;
		const half = id % 2n;
		const [a, b] = half === 0n ? [0, 1] : [2, 3];
		const nextHalf = half === 0n ? 1n : 0n;
		const delta = half === 0n ? 1n : -1n;
		const faceA = getNeighbor(cellId, a);
		const faceB = getNeighbor(cellId, b);
		return cell(
			point(0.0, 1.0),
			faceA === undefined ? undefined : face(faceA * 2n + nextHalf, 0),
			faceB === undefined ? undefined : face(faceB * 2n + nextHalf, 1),
			face(id + delta, 2),
		);
	};
}

export function lazyDecycleGetter(
	innerGet: (id: CellId) => Cell,
): (id: CellId) => Cell {
	const nodes = new Map<
		CellId,
		{
			innerId: CellId;
			neighbors: Triple<CellId | undefined>;
		}
	>();
	let nextId = 1n;
	nodes.set(0n, {
		innerId: 0n,
		neighbors: triple(),
	});

	return (id: CellId): Cell => {
		assert(id >= 0n, "Invalid cell id", id);
		const node = nodes.get(id);
		assert(node, "Cell id out of range", id);
		const innerCell = innerGet(node.innerId);
		const faces = mapTriple(innerCell.faces, (innerFace, faceIndex) => {
			if (!innerFace) {
				return undefined;
			}
			let externalId = node.neighbors[faceIndex];
			if (externalId === undefined) {
				externalId = nextId;
				nextId += 1n;
				node.neighbors[faceIndex] = externalId;
				nodes.set(externalId, {
					innerId: innerFace.cellId,
					neighbors: triple(),
				});
				const neighborNode = nodes.get(externalId);
				assert(neighborNode, "Missing cell id", externalId);
				neighborNode.neighbors[innerFace.faceIndex] = id;
			}
			return face(externalId, innerFace.faceIndex);
		});
		return cell(innerCell.shape, ...faces);
	};
}

export function detDecycleGetter(
	innerGet: (id: CellId) => Cell,
): (id: CellId) => Cell {
	function childId(id: CellId, childIndex: number): CellId {
		return id === 0n ? 4n + BigInt(childIndex) : id * 2n + BigInt(childIndex);
	}

	return (id: CellId): Cell => {
		assert(id >= 0n, "Cell id out of range", id);
		let innerId = 0n;
		let parentId: CellId | undefined;
		let parentFace: number | undefined;
		let parentNeighbor: number | undefined;
		let currentId = 0n;
		if (id > 0n) {
			const bits = id.toString(2);
			assert(bits.length >= 3 && bits[0] === "1", "Cell id out of range", id);
			const rootChild = parseInt(bits.slice(1, 3), 2);
			assert(rootChild < 3, "Cell id out of range", id);
			for (const childIndex of [rootChild, ...bits.slice(3)].map(Number)) {
				assert(
					(childIndex >= 0 && childIndex <= 1) || currentId === 0n,
					"Cell id out of range",
					id,
				);
				const faceIndex =
					parentFace === undefined
						? childIndex
						: (parentFace + childIndex + 1) % 3;
				const innerFace = innerGet(innerId).faces[faceIndex];
				assert(innerFace, "Cell id out of range", id);
				parentId = currentId;
				parentNeighbor = faceIndex;
				currentId = childId(currentId, childIndex);
				innerId = innerFace.cellId;
				parentFace = innerFace.faceIndex;
			}
			assert(currentId === id, "Cell id out of range", id);
		}

		const innerCell = innerGet(innerId);
		const faces = mapTriple(innerCell.faces, (innerFace, faceIndex) => {
			if (!innerFace) {
				return undefined;
			}
			if (faceIndex === parentFace) {
				assert(parentId !== undefined, "Cell id out of range", id);
				assert(parentNeighbor !== undefined, "Cell id out of range", id);
				return face(parentId, parentNeighbor);
			}
			const childIndex =
				parentFace === undefined ? faceIndex : (faceIndex - parentFace + 2) % 3;
			return face(childId(id, childIndex), innerFace.faceIndex);
		});
		return cell(innerCell.shape, ...faces);
	};
}

function curlGetter(count: number): (id: CellId) => Cell {
	assert(count >= 2, "Curl count must be at least 2", count);
	const index = BigInt(count * 2);
	const [x, y] = [6 / 11, 5 / 11];
	return (id: CellId): Cell => {
		assert(id >= 0n, "Invalid cell id", id);
		if (id === 0n) {
			return cell(point(0.0, 1.2), undefined, undefined, face(1n, 1));
		} else if (id === index + 1n) {
			return cell(
				point(x, y),
				undefined,
				face(index + 0n, 1),
				face(index + 2n, 1),
			);
		} else if (id === index + 2n) {
			return cell(
				point(y, y),
				undefined,
				face(index + 1n, 2),
				face(index + 3n, 1),
			);
		} else if (id === index + 3n) {
			return cell(point(1.0, 1.2), undefined, face(index + 2n, 2), undefined);
		} else if (id % 2n === 1n) {
			return cell(
				point(x, y),
				undefined,
				face(id - 1n, id === 1n ? 2 : 1),
				face(id + 1n, 2),
			);
		} else if (id % 2n === 0n) {
			return cell(
				point(6.0, 5.0),
				undefined,
				face(id + 1n, 1),
				face(id - 1n, 2),
			);
		}
		assert(false, "Invalid cell id", id);
	};
}

function radialGetter(count: number): (id: CellId) => Cell {
	assert(count >= 3, "Radial count must be at least 3", count);
	const shape = point(0.5, 0.5 / Math.tan(Math.PI / count));
	return (id: CellId): Cell => {
		assert(id >= 0n, "Invalid cell id", id);
		const ring = BigInt(count);
		if (id < ring) {
			const index = Number(id);
			const prev = BigInt((index + count - 1) % count);
			const next = BigInt((index + 1) % count);
			const corridor = ring + id * 2n;
			return cell(shape, face(corridor, 1), face(prev, 2), face(next, 1));
		}
		const corridor = id - ring;
		assert(corridor < ring * 2n, "Cell id out of range", id);
		const branch = corridor / 2n;
		const half = corridor % 2n;
		const hub = branch;
		const end = ring + branch * 2n + 1n;
		if (half === 0n) {
			return cell(point(0.0, 1.0), undefined, face(hub, 0), face(end, 0));
		}
		return cell(
			point(0.5, 0.5),
			face(ring + branch * 2n, 2),
			undefined,
			undefined,
		);
	};
}

const gridGetter = arrayGetter([
	cell(point(0.0, 1.0), face(3n, 1), undefined, face(1n, 0)),
	cell(point(0.5, 0.5), face(0n, 2), face(2n, 0), undefined),
	cell(point(0.0, 1.0), face(1n, 1), face(4n, 0), face(3n, 0)),
	cell(point(0.5, 0.5), face(2n, 2), face(0n, 0), face(5n, 2)),
	cell(point(1.0, 1.0), face(2n, 1), face(5n, 0), undefined),
	cell(point(0.5, 0.5), face(4n, 1), undefined, face(3n, 2)),
]);

const circleGetter = arrayGetter([
	cell(point(-0.25, 0.97), face(1n, 0), undefined, face(1n, 2)),
	cell(point(0.38, 1.45), face(0n, 0), undefined, face(0n, 2)),
]);

const radialBase = radialGetter(5);
const radialGrid = detDecycleGetter(gridGetter);
const radialCircle = detDecycleGetter(circleGetter);
const flatMaze = flatMazeGetter(point(0.0, 1.0), 0.5, false);
const warpMaze = warpMazeGetter(0.5);
const hexMaze = flatMazeGetter(point(0.5, 0.866), 0.33, true);
const radial = glueGetter(
	[radialBase, radialGrid, radialCircle, flatMaze, warpMaze, hexMaze],
	[
		{
			a: { getterIndex: 0, face: face(6n, 2) },
			b: { getterIndex: 1, face: face(0n, 0) },
		},
		{
			a: { getterIndex: 0, face: face(8n, 2) },
			b: { getterIndex: 2, face: face(0n, 0) },
		},
		{
			a: { getterIndex: 0, face: face(10n, 2) },
			b: { getterIndex: 3, face: face(0n, 0) },
		},
		{
			a: { getterIndex: 0, face: face(12n, 2) },
			b: { getterIndex: 4, face: face(0n, 0) },
		},
		{
			a: { getterIndex: 0, face: face(14n, 2) },
			b: { getterIndex: 5, face: face(0n, 0) },
		},
	],
);

export const library: Plan[] = [
	plan(
		"triangle",
		arrayGetter([cell(point(0.5, 0.866), undefined, undefined, undefined)]),
	),
	plan(
		"square",
		arrayGetter([cell(point(0.5, 0.5), undefined, face(0n, 2), face(0n, 1))]),
	),
	plan(
		"hex",
		arrayGetter([cell(point(0.5, 0.866), undefined, face(0n, 2), face(0n, 1))]),
	),
	plan(
		"tunnel",
		arrayGetter([cell(point(0.0, 1.0), face(0n, 0), undefined, face(0n, 2))]),
	),
	plan("grid", gridGetter),
	plan(
		"base",
		arrayGetter([
			cell(point(0.0, 1.2), undefined, undefined, face(1n, 1)),
			cell(point(0.545, 0.455), undefined, face(0n, 2), face(2n, 2)),
			cell(point(6.0, 5.0), undefined, face(3n, 1), face(1n, 2)),
			cell(point(0.545, 0.455), undefined, face(2n, 1), face(4n, 1)),
			cell(point(0.455, 0.455), undefined, face(3n, 2), face(5n, 1)),
			cell(point(1.0, 1.2), undefined, face(4n, 2), undefined),
		]),
	),
	plan("curl", curlGetter(2)),
	plan("circle", circleGetter),
	plan(
		"spiral",
		arrayGetter([
			cell(point(-0.25, 0.97), face(1n, 0), undefined, face(1n, 2)),
			cell(point(0.1, 2.0), face(0n, 0), undefined, face(0n, 2)),
		]),
	),
	plan("flatMaze", flatMaze),
	plan("warpMaze", warpMaze),
	plan("hexMaze", hexMaze),
	plan(
		"cellPlane",
		arrayGetter([
			cell(point(0.5, 0.866), face(0n, 0), face(0n, 1), face(0n, 2)),
		]),
	),
	plan("mortonPlane", (id: CellId) => {
		assert(id >= 0n, "Invalid cell id", id);
		const [x, y] = naturalToVector(id / 2n, 2);
		const getId = (x: bigint, y: bigint): CellId =>
			vectorToNatural([x, y]) * 2n;
		const half = id % 2n;
		const offset = half * 2n - 1n;
		return cell(
			point(0.5, 0.866),
			face(getId(x, y + offset) - half + 1n, 0),
			face(getId(x + offset, y) - half + 1n, 1),
			face(id - offset, 2),
		);
	}),
	plan("radial", radial),
];
