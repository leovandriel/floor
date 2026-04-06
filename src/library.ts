import assert from "./assert";
import { naturalToVector, random, vectorToNatural } from "./number";
import type { Plan, Point, Side, Tile, TileId } from "./types";
import { plan, point, side, tile } from "./types";

export interface GluePoint {
	getterIndex: number;
	side: Side;
}

export function arrayGetter(tiles: Tile[]): (id: TileId) => Tile {
	assert(tiles.length > 0, "Plan must include at least one tile");
	return (id: TileId) => {
		assert(id >= 0n, "Invalid tile id", id);
		assert(id < BigInt(tiles.length), "Tile id out of range", id);
		return tiles[Number(id)];
	};
}

export function glueGetter(
	getters: Array<(id: TileId) => Tile>,
	glues: Array<{ a: GluePoint; b: GluePoint }>,
): (id: TileId) => Tile {
	assert(getters.length > 1, "Glue must include at least two getters");
	const count = BigInt(getters.length);
	const glueMap = new Map<string, GluePoint>();
	const wallMap = new Set<string>();
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
			!glueMap.has(`${a.getterIndex}:${a.side.tileId}:${a.side.sideIndex}`),
			"Duplicate glue point",
			a.getterIndex,
			a.side.tileId,
			a.side.sideIndex,
		);
		assert(
			!glueMap.has(`${b.getterIndex}:${b.side.tileId}:${b.side.sideIndex}`),
			"Duplicate glue point",
			b.getterIndex,
			b.side.tileId,
			b.side.sideIndex,
		);
		glueMap.set(`${a.getterIndex}:${a.side.tileId}:${a.side.sideIndex}`, b);
		glueMap.set(`${b.getterIndex}:${b.side.tileId}:${b.side.sideIndex}`, a);
		for (const point of [a, b]) {
			const oldSide = getters[point.getterIndex](point.side.tileId).sides[
				point.side.sideIndex
			];
			if (!oldSide) {
				continue;
			}
			wallMap.add(
				`${point.getterIndex}:${oldSide.tileId}:${oldSide.sideIndex}`,
			);
		}
	}

	return (id: TileId) => {
		assert(id >= 0n, "Invalid tile id", id);
		const getterIndex = Number(id % count);
		const innerId = id / count;
		const innerTile = getters[getterIndex](innerId);
		const sides = innerTile.sides.map((innerSide, sideIndex) => {
			const glued = glueMap.get(`${getterIndex}:${innerId}:${sideIndex}`);
			if (glued) {
				return side(
					glued.side.tileId * count + BigInt(glued.getterIndex),
					glued.side.sideIndex,
				);
			}
			if (!innerSide) {
				return undefined;
			}
			if (wallMap.has(`${getterIndex}:${innerId}:${sideIndex}`)) {
				return undefined;
			}
			return side(
				innerSide.tileId * count + BigInt(getterIndex),
				innerSide.sideIndex,
			);
		}) as [Side | undefined, Side | undefined, Side | undefined];
		return tile(innerTile.shape, ...sides);
	};
}

function flatMazeGetter(
	shape: Point,
	threshold: number,
	hasInnerWall: boolean,
): (id: TileId) => Tile {
	return (id: TileId) => {
		assert(id >= 0n, "Invalid tile id", id);
		const [x, y] = naturalToVector(id / 2n, 2);
		const getId = (x: bigint, y: bigint): TileId =>
			vectorToNatural([x, y]) * 2n;
		const hasWall = (id: TileId): boolean => random(id + 2n) < threshold;

		if (id % 2n === 0n) {
			const southUpper = getId(x, y - 1n) + 1n;
			const westUpper = getId(x - 1n, y) + 1n;
			return tile(
				shape,
				hasWall(southUpper) ? undefined : side(southUpper, 0),
				hasWall(id) ? undefined : side(westUpper, 1),
				hasInnerWall && hasWall(id * 2n) ? undefined : side(id + 1n, 2),
			);
		} else {
			const northLower = getId(x, y + 1n);
			const eastLower = getId(x + 1n, y);
			return tile(
				shape,
				hasWall(id) ? undefined : side(northLower, 0),
				hasWall(eastLower) ? undefined : side(eastLower, 1),
				hasInnerWall && hasWall((id - 1n) * 2n) ? undefined : side(id - 1n, 2),
			);
		}
	};
}

function warpMazeGetter(threshold: number): (id: TileId) => Tile {
	function getNeighbor(id: TileId, direction: number): TileId | undefined {
		if (id > 0n && direction === (Number((id - 1n) % 4n) + 2) % 4) {
			return (id - 1n) / 4n;
		}
		return random(id * 8n + BigInt(direction) + 2n) < threshold
			? undefined
			: id * 4n + BigInt(direction) + 1n;
	}

	return (id: TileId): Tile => {
		assert(id >= 0n, "Invalid tile id", id);
		const cellId = id / 2n;
		const half = id % 2n;
		const [a, b] = half === 0n ? [0, 1] : [2, 3];
		const nextHalf = half === 0n ? 1n : 0n;
		const delta = half === 0n ? 1n : -1n;
		const sideA = getNeighbor(cellId, a);
		const sideB = getNeighbor(cellId, b);
		return tile(
			point(0.0, 1.0),
			sideA === undefined ? undefined : side(sideA * 2n + nextHalf, 0),
			sideB === undefined ? undefined : side(sideB * 2n + nextHalf, 1),
			side(id + delta, 2),
		);
	};
}

export function lazyDecycleGetter(
	innerGet: (id: TileId) => Tile,
): (id: TileId) => Tile {
	const nodes = new Map<
		TileId,
		{
			innerId: TileId;
			neighbors: [TileId | undefined, TileId | undefined, TileId | undefined];
		}
	>();
	let nextId = 1n;
	nodes.set(0n, {
		innerId: 0n,
		neighbors: [undefined, undefined, undefined],
	});

	return (id: TileId): Tile => {
		assert(id >= 0n, "Invalid tile id", id);
		const node = nodes.get(id);
		assert(node, "Tile id out of range", id);
		const innerTile = innerGet(node.innerId);
		const sides = innerTile.sides.map((innerSide, sideIndex) => {
			if (!innerSide) {
				return undefined;
			}
			let externalId = node.neighbors[sideIndex];
			if (externalId === undefined) {
				externalId = nextId;
				nextId += 1n;
				node.neighbors[sideIndex] = externalId;
				nodes.set(externalId, {
					innerId: innerSide.tileId,
					neighbors: [undefined, undefined, undefined],
				});
				const neighborNode = nodes.get(externalId);
				assert(neighborNode, "Missing tile id", externalId);
				neighborNode.neighbors[innerSide.sideIndex] = id;
			}
			return side(externalId, innerSide.sideIndex);
		}) as [Side | undefined, Side | undefined, Side | undefined];
		return tile(innerTile.shape, ...sides);
	};
}

export function detDecycleGetter(
	innerGet: (id: TileId) => Tile,
): (id: TileId) => Tile {
	function childId(id: TileId, childIndex: number): TileId {
		return id === 0n ? 4n + BigInt(childIndex) : id * 2n + BigInt(childIndex);
	}

	return (id: TileId): Tile => {
		assert(id >= 0n, "Tile id out of range", id);
		let innerId = 0n;
		let parentId: TileId | undefined;
		let parentSide: number | undefined;
		let parentNeighbor: number | undefined;
		let currentId = 0n;
		if (id > 0n) {
			const bits = id.toString(2);
			assert(bits.length >= 3 && bits[0] === "1", "Tile id out of range", id);
			const rootChild = parseInt(bits.slice(1, 3), 2);
			assert(rootChild < 3, "Tile id out of range", id);
			for (const childIndex of [rootChild, ...bits.slice(3)].map(Number)) {
				assert(
					(childIndex >= 0 && childIndex <= 1) || currentId === 0n,
					"Tile id out of range",
					id,
				);
				const sideIndex =
					parentSide === undefined
						? childIndex
						: (parentSide + childIndex + 1) % 3;
				const innerSide = innerGet(innerId).sides[sideIndex];
				assert(innerSide, "Tile id out of range", id);
				parentId = currentId;
				parentNeighbor = sideIndex;
				currentId = childId(currentId, childIndex);
				innerId = innerSide.tileId;
				parentSide = innerSide.sideIndex;
			}
			assert(currentId === id, "Tile id out of range", id);
		}

		const innerTile = innerGet(innerId);
		const sides = innerTile.sides.map((innerSide, sideIndex) => {
			if (!innerSide) {
				return undefined;
			}
			if (sideIndex === parentSide) {
				assert(parentId !== undefined, "Tile id out of range", id);
				assert(parentNeighbor !== undefined, "Tile id out of range", id);
				return side(parentId, parentNeighbor);
			}
			const childIndex =
				parentSide === undefined ? sideIndex : (sideIndex - parentSide + 2) % 3;
			return side(childId(id, childIndex), innerSide.sideIndex);
		}) as [Side | undefined, Side | undefined, Side | undefined];
		return tile(innerTile.shape, ...sides);
	};
}

function curlGetter(count: number): (id: TileId) => Tile {
	assert(count >= 2, "Curl count must be at least 2", count);
	const index = BigInt(count * 2);
	const [x, y] = [6 / 11, 5 / 11];
	return (id: TileId): Tile => {
		assert(id >= 0n, "Invalid tile id", id);
		if (id === 0n) {
			return tile(point(0.0, 1.2), undefined, undefined, side(1n, 1));
		} else if (id === index + 1n) {
			return tile(
				point(x, y),
				undefined,
				side(index + 0n, 1),
				side(index + 2n, 1),
			);
		} else if (id === index + 2n) {
			return tile(
				point(y, y),
				undefined,
				side(index + 1n, 2),
				side(index + 3n, 1),
			);
		} else if (id === index + 3n) {
			return tile(point(1.0, 1.2), undefined, side(index + 2n, 2), undefined);
		} else if (id % 2n === 1n) {
			return tile(
				point(x, y),
				undefined,
				side(id - 1n, id === 1n ? 2 : 1),
				side(id + 1n, 2),
			);
		} else if (id % 2n === 0n) {
			return tile(
				point(6.0, 5.0),
				undefined,
				side(id + 1n, 1),
				side(id - 1n, 2),
			);
		}
		assert(false, "Invalid tile id", id);
	};
}

function radialGetter(count: number): (id: TileId) => Tile {
	assert(count >= 3, "Radial count must be at least 3", count);
	const shape = point(0.5, 0.5 / Math.tan(Math.PI / count));
	return (id: TileId): Tile => {
		assert(id >= 0n, "Invalid tile id", id);
		const ring = BigInt(count);
		if (id < ring) {
			const index = Number(id);
			const prev = BigInt((index + count - 1) % count);
			const next = BigInt((index + 1) % count);
			const corridor = ring + id * 2n;
			return tile(shape, side(corridor, 1), side(prev, 2), side(next, 1));
		}
		const corridor = id - ring;
		assert(corridor < ring * 2n, "Tile id out of range", id);
		const branch = corridor / 2n;
		const half = corridor % 2n;
		const hub = branch;
		const end = ring + branch * 2n + 1n;
		if (half === 0n) {
			return tile(point(0.0, 1.0), undefined, side(hub, 0), side(end, 0));
		}
		return tile(
			point(0.5, 0.5),
			side(ring + branch * 2n, 2),
			undefined,
			undefined,
		);
	};
}

const gridGetter = arrayGetter([
	tile(point(0.0, 1.0), side(3n, 1), undefined, side(1n, 0)),
	tile(point(0.5, 0.5), side(0n, 2), side(2n, 0), undefined),
	tile(point(0.0, 1.0), side(1n, 1), side(4n, 0), side(3n, 0)),
	tile(point(0.5, 0.5), side(2n, 2), side(0n, 0), side(5n, 2)),
	tile(point(1.0, 1.0), side(2n, 1), side(5n, 0), undefined),
	tile(point(0.5, 0.5), side(4n, 1), undefined, side(3n, 2)),
]);

const circleGetter = arrayGetter([
	tile(point(-0.25, 0.97), side(1n, 0), undefined, side(1n, 2)),
	tile(point(0.38, 1.45), side(0n, 0), undefined, side(0n, 2)),
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
			a: { getterIndex: 0, side: side(6n, 2) },
			b: { getterIndex: 1, side: side(0n, 0) },
		},
		{
			a: { getterIndex: 0, side: side(8n, 2) },
			b: { getterIndex: 2, side: side(0n, 0) },
		},
		{
			a: { getterIndex: 0, side: side(10n, 2) },
			b: { getterIndex: 3, side: side(0n, 0) },
		},
		{
			a: { getterIndex: 0, side: side(12n, 2) },
			b: { getterIndex: 4, side: side(0n, 0) },
		},
		{
			a: { getterIndex: 0, side: side(14n, 2) },
			b: { getterIndex: 5, side: side(0n, 0) },
		},
	],
);

export const library: Plan[] = [
	plan(
		"triangle",
		arrayGetter([tile(point(0.5, 0.866), undefined, undefined, undefined)]),
	),
	plan(
		"square",
		arrayGetter([tile(point(0.5, 0.5), undefined, side(0n, 2), side(0n, 1))]),
	),
	plan(
		"hex",
		arrayGetter([tile(point(0.5, 0.866), undefined, side(0n, 2), side(0n, 1))]),
	),
	plan(
		"tunnel",
		arrayGetter([tile(point(0.0, 1.0), side(0n, 0), undefined, side(0n, 2))]),
	),
	plan("grid", gridGetter),
	plan(
		"base",
		arrayGetter([
			tile(point(0.0, 1.2), undefined, undefined, side(1n, 1)),
			tile(point(0.545, 0.455), undefined, side(0n, 2), side(2n, 2)),
			tile(point(6.0, 5.0), undefined, side(3n, 1), side(1n, 2)),
			tile(point(0.545, 0.455), undefined, side(2n, 1), side(4n, 1)),
			tile(point(0.455, 0.455), undefined, side(3n, 2), side(5n, 1)),
			tile(point(1.0, 1.2), undefined, side(4n, 2), undefined),
		]),
	),
	plan("curl", curlGetter(2)),
	plan("circle", circleGetter),
	plan(
		"spiral",
		arrayGetter([
			tile(point(-0.25, 0.97), side(1n, 0), undefined, side(1n, 2)),
			tile(point(0.1, 2.0), side(0n, 0), undefined, side(0n, 2)),
		]),
	),
	plan("flatMaze", flatMaze),
	plan("warpMaze", warpMaze),
	plan("hexMaze", hexMaze),
	plan(
		"tilePlane",
		arrayGetter([
			tile(point(0.5, 0.866), side(0n, 0), side(0n, 1), side(0n, 2)),
		]),
	),
	plan("mortonPlane", (id: TileId) => {
		assert(id >= 0n, "Invalid tile id", id);
		const [x, y] = naturalToVector(id / 2n, 2);
		const getId = (x: bigint, y: bigint): TileId =>
			vectorToNatural([x, y]) * 2n;
		const half = id % 2n;
		const offset = half * 2n - 1n;
		return tile(
			point(0.5, 0.866),
			side(getId(x, y + offset) - half + 1n, 0),
			side(getId(x + offset, y) - half + 1n, 1),
			side(id - offset, 2),
		);
	}),
	plan("radial", radial),
];
