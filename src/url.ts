import { rotateScale } from "./geometry";
import type Physics from "./physics";
import { getPlanBySlug } from "./plan";
import type Renderer from "./render";
import type { CellId, Plan, Point, RenderMode, TopologyMode } from "./types";
import { point, renderModes, topologyModes } from "./types";
import type View from "./view";

export interface UrlQueryState {
	x: number;
	y: number;
	rotation: number;
	worldRotation: number | undefined;
	worldPosition: Point | undefined;
	scale: number;
	factor: number;
	range: number;
	topologyMode: TopologyMode;
	debug: boolean;
	renderMode: RenderMode;
}

export interface UrlPathState {
	slug: string;
	current: CellId;
}

export interface UrlState {
	path: UrlPathState;
	query: UrlQueryState;
}

const urlQueryKey = {
	x: "x",
	y: "y",
	rotation: "r",
	worldRotation: "k",
	worldX: "u",
	worldY: "v",
	scale: "s",
	factor: "f",
	range: "g",
	topologyMode: "n",
	debug: "d",
	renderMode: "m",
} as const;

const urlUpdateIntervalMs = 100;
const defaultPlanSlug = "grid";

const defaultUrlState: UrlState = {
	path: { slug: defaultPlanSlug, current: 0n },
	query: {
		x: 0.5,
		y: 0.2,
		rotation: 0,
		worldRotation: undefined,
		worldPosition: undefined,
		scale: 0.2,
		factor: 1,
		range: 0.5,
		topologyMode: "none",
		debug: false,
		renderMode: "canvas",
	},
};

function parseNumberParam(
	params: URLSearchParams,
	key: string,
): number | undefined {
	const value = params.get(key);
	if (value === null) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseModeIndex(value: string | null): number | undefined {
	if (value === null || !/^\d+$/.test(value)) {
		return undefined;
	}
	return Number(value);
}

function parseBooleanParam(params: URLSearchParams, key: string): boolean {
	return params.get(key) === "1";
}

function setBooleanParam(
	params: URLSearchParams,
	key: string,
	value: boolean,
): void {
	if (value) {
		params.set(key, "1");
	} else {
		params.delete(key);
	}
}

export function formatStateNumber(value: number): string {
	return value.toFixed(6).replace(/\.?0+$/, "");
}

function getDefaultWorldState(
	query: Pick<UrlQueryState, "x" | "y" | "rotation" | "scale">,
): {
	worldRotation: number;
	worldPosition: Point;
} {
	const delta = rotateScale(query, -query.rotation, query.scale);
	return {
		worldRotation: query.rotation,
		worldPosition: delta,
	};
}

export function parseUrlQueryState(
	params: URLSearchParams,
	_plan: Plan,
): UrlQueryState | undefined {
	const defaults = defaultUrlState.query;
	const x = parseNumberParam(params, urlQueryKey.x) ?? defaults.x;
	const y = parseNumberParam(params, urlQueryKey.y) ?? defaults.y;
	const rotation =
		parseNumberParam(params, urlQueryKey.rotation) ?? defaults.rotation;
	const worldRotation = parseNumberParam(params, urlQueryKey.worldRotation);
	const worldX = parseNumberParam(params, urlQueryKey.worldX);
	const worldY = parseNumberParam(params, urlQueryKey.worldY);
	const scale = Math.max(
		parseNumberParam(params, urlQueryKey.scale) ?? defaults.scale,
		defaults.scale,
	);
	const factor = Math.max(
		parseNumberParam(params, urlQueryKey.factor) ?? defaults.factor,
		defaults.factor,
	);
	const range = Math.max(
		parseNumberParam(params, urlQueryKey.range) ?? defaults.range,
		defaults.range,
	);
	const topologyMode =
		parseTopologyModeParam(params.get(urlQueryKey.topologyMode)) ??
		defaults.topologyMode;
	const debug = parseBooleanParam(params, urlQueryKey.debug);
	const renderMode =
		parseRenderModeParam(params.get(urlQueryKey.renderMode)) ??
		(parseBooleanParam(params, "w") ? "checker" : defaults.renderMode);

	return {
		x,
		y,
		rotation,
		worldRotation,
		worldPosition:
			worldX !== undefined && worldY !== undefined
				? point(worldX, worldY)
				: undefined,
		scale,
		factor,
		range,
		topologyMode,
		debug,
		renderMode,
	};
}

export function readUrlQueryState(
	plan: Plan,
	search: string = window.location.search,
): UrlQueryState | undefined {
	const params = new URLSearchParams(search);
	return parseUrlQueryState(params, plan);
}

export function parsePlanSlug(pathname: string): string | undefined {
	return pathname.split("/").filter(Boolean)[0];
}

function parsePathCellId(pathname: string): CellId | undefined {
	const value = pathname.split("/").filter(Boolean)[1];
	return value && /^\d+$/.test(value) ? BigInt(value) : undefined;
}

export function readUrlPathState(
	pathname: string = window.location.pathname,
): UrlPathState {
	return {
		slug: parsePlanSlug(pathname) ?? defaultPlanSlug,
		current: parsePathCellId(pathname) ?? defaultUrlState.path.current,
	};
}

export function readUrlState(
	pathname: string = window.location.pathname,
	search: string = window.location.search,
): UrlState {
	const path = readUrlPathState(pathname);
	const legacyTopologyMode =
		path.slug === "treeMaze"
			? "lazy"
			: path.slug === "detMaze"
				? "det"
				: undefined;
	const slug = legacyTopologyMode ? "flatMaze" : path.slug;
	const plan = getPlanBySlug(slug);
	const query =
		(plan && readUrlQueryState(plan, search)) ?? defaultUrlState.query;
	return {
		path: { slug, current: path.current },
		query:
			legacyTopologyMode &&
			query.topologyMode === defaultUrlState.query.topologyMode
				? { ...query, topologyMode: legacyTopologyMode }
				: query,
	};
}

export class UrlStateTracker {
	private lastUrlUpdateAt = 0;
	private pendingUrlUpdate: number | undefined = undefined;

	constructor(
		private readonly plan: Plan,
		private readonly view: View,
		private readonly physics: Physics,
		private readonly renderer: Renderer,
		private readonly topologyMode: TopologyMode,
	) {}

	applyQueryState(query: UrlQueryState): void {
		this.physics.position = point(query.x, query.y);
		this.physics.rotation = query.rotation;
		this.physics.scale = query.scale;
		if (
			query.worldRotation !== undefined &&
			query.worldPosition !== undefined
		) {
			this.physics.worldRotation = query.worldRotation;
			this.physics.worldOffset = query.worldPosition;
		} else {
			this.physics.resetWorld();
		}
		this.view.factor = query.factor;
		this.view.range = query.range;
		this.renderer.debug = query.debug;
		this.renderer.renderMode = query.renderMode;
		this.physics.simulateSnap();
	}

	updateUrl(): void {
		const defaults = defaultUrlState.query;
		const params = new URLSearchParams(window.location.search);
		const state = this.serializeState();
		const { query } = state;
		if (query.x !== defaults.x) {
			params.set(urlQueryKey.x, formatStateNumber(query.x));
		} else {
			params.delete(urlQueryKey.x);
		}
		if (query.y !== defaults.y) {
			params.set(urlQueryKey.y, formatStateNumber(query.y));
		} else {
			params.delete(urlQueryKey.y);
		}
		if (query.rotation !== defaults.rotation) {
			params.set(urlQueryKey.rotation, formatStateNumber(query.rotation));
		} else {
			params.delete(urlQueryKey.rotation);
		}
		const worldDefaults = getDefaultWorldState(query);
		const worldRotation = query.worldRotation ?? worldDefaults.worldRotation;
		const worldPosition = query.worldPosition ?? worldDefaults.worldPosition;
		if (worldRotation !== worldDefaults.worldRotation) {
			params.set(urlQueryKey.worldRotation, formatStateNumber(worldRotation));
		} else {
			params.delete(urlQueryKey.worldRotation);
		}
		if (worldPosition.x !== worldDefaults.worldPosition.x) {
			params.set(urlQueryKey.worldX, formatStateNumber(worldPosition.x));
		} else {
			params.delete(urlQueryKey.worldX);
		}
		if (worldPosition.y !== worldDefaults.worldPosition.y) {
			params.set(urlQueryKey.worldY, formatStateNumber(worldPosition.y));
		} else {
			params.delete(urlQueryKey.worldY);
		}
		if (query.scale !== defaults.scale) {
			params.set(urlQueryKey.scale, formatStateNumber(query.scale));
		} else {
			params.delete(urlQueryKey.scale);
		}
		if (query.factor !== defaults.factor) {
			params.set(urlQueryKey.factor, formatStateNumber(query.factor));
		} else {
			params.delete(urlQueryKey.factor);
		}
		if (query.range !== defaults.range) {
			params.set(urlQueryKey.range, formatStateNumber(query.range));
		} else {
			params.delete(urlQueryKey.range);
		}
		if (query.topologyMode !== defaults.topologyMode) {
			params.set(
				urlQueryKey.topologyMode,
				String(topologyModes.indexOf(query.topologyMode)),
			);
		} else {
			params.delete(urlQueryKey.topologyMode);
		}
		setBooleanParam(params, urlQueryKey.debug, query.debug);
		if (query.renderMode !== defaults.renderMode) {
			params.set(
				urlQueryKey.renderMode,
				String(renderModes.indexOf(query.renderMode)),
			);
		} else {
			params.delete(urlQueryKey.renderMode);
		}
		params.delete("w");
		const nextSearch = params.toString();
		const nextPath =
			state.path.current === defaultUrlState.path.current
				? `/${state.path.slug}`
				: `/${state.path.slug}/${state.path.current}`;
		const nextUrl = `${nextPath}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
		try {
			window.history.replaceState(null, "", nextUrl);
			this.lastUrlUpdateAt = Date.now();
		} catch {
			// Browsers may reject excessively frequent history updates.
		}
	}

	scheduleUpdate(): void {
		if (this.pendingUrlUpdate !== undefined) {
			return;
		}

		const now = Date.now();
		const delay = Math.max(
			0,
			urlUpdateIntervalMs - (now - this.lastUrlUpdateAt),
		);

		if (delay === 0) {
			this.updateUrl();
			return;
		}

		this.pendingUrlUpdate = window.setTimeout(() => {
			this.pendingUrlUpdate = undefined;
			this.updateUrl();
		}, delay);
	}

	private serializeState(): UrlState {
		return {
			path: {
				slug: this.plan.slug,
				current: this.physics.currentCellId,
			},
			query: {
				x: this.physics.position.x,
				y: this.physics.position.y,
				rotation: this.physics.rotation,
				worldRotation: this.physics.worldRotation,
				worldPosition: this.physics.worldOffset,
				scale: this.physics.scale,
				factor: this.view.factor,
				range: this.view.range,
				topologyMode: this.topologyMode,
				debug: this.renderer.debug,
				renderMode: this.renderer.renderMode,
			},
		};
	}
}
function parseTopologyModeParam(
	value: string | null,
): TopologyMode | undefined {
	const index = parseModeIndex(value);
	if (index !== undefined) {
		return topologyModes[index];
	}
	switch (value) {
		case "none":
		case "lazy":
		case "det":
			return value;
		default:
			return undefined;
	}
}

function parseRenderModeParam(value: string | null): RenderMode | undefined {
	const index = parseModeIndex(value);
	if (index !== undefined) {
		return renderModes[index];
	}
	switch (value) {
		case "canvas":
		case "webgl":
		case "checker":
		case "light":
			return value;
		default:
			return undefined;
	}
}
