import type Physics from "./physics";
import { getPlanBySlug } from "./plan";
import type Renderer from "./render";
import type { Plan } from "./types";
import { point } from "./types";
import type View from "./view";

export interface UrlQueryState {
	current: number;
	x: number;
	y: number;
	rotation: number;
	scale: number;
	factor: number;
	range: number;
	debug: boolean;
	webgl: boolean;
}

export interface UrlPathState {
	slug: string;
}

export interface UrlState {
	path: UrlPathState;
	query: UrlQueryState;
}

const urlQueryKey = {
	current: "c",
	x: "x",
	y: "y",
	rotation: "r",
	scale: "s",
	factor: "f",
	range: "g",
	debug: "d",
	webgl: "w",
} as const;

const urlUpdateIntervalMs = 100;
const defaultPlanSlug = "square";

const defaultUrlState: UrlState = {
	path: { slug: defaultPlanSlug },
	query: {
		current: 0,
		x: 0.5,
		y: 0.2,
		rotation: 0,
		scale: 0.2,
		factor: 1,
		range: 0.5,
		debug: false,
		webgl: false,
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

function parseIntegerParam(
	params: URLSearchParams,
	key: string,
): number | undefined {
	const parsed = parseNumberParam(params, key);
	return parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined;
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

export function parseUrlQueryState(
	params: URLSearchParams,
	_plan: Plan,
): UrlQueryState | undefined {
	const defaults = defaultUrlState.query;
	const current = Math.max(
		parseIntegerParam(params, urlQueryKey.current) ?? defaults.current,
		0,
	);
	const x = parseNumberParam(params, urlQueryKey.x) ?? defaults.x;
	const y = parseNumberParam(params, urlQueryKey.y) ?? defaults.y;
	const rotation =
		parseNumberParam(params, urlQueryKey.rotation) ?? defaults.rotation;
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
	const debug = parseBooleanParam(params, urlQueryKey.debug);
	const webgl = parseBooleanParam(params, urlQueryKey.webgl);

	return { current, x, y, rotation, scale, factor, range, debug, webgl };
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

export function readUrlPathState(
	pathname: string = window.location.pathname,
): UrlPathState {
	return {
		slug: parsePlanSlug(pathname) ?? defaultPlanSlug,
	};
}

export function readUrlState(
	pathname: string = window.location.pathname,
	search: string = window.location.search,
): UrlState {
	const path = readUrlPathState(pathname);
	const plan = getPlanBySlug(path.slug);
	return {
		path,
		query: (plan && readUrlQueryState(plan, search)) ?? defaultUrlState.query,
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
	) {}

	applyQueryState(query: UrlQueryState): void {
		this.physics.currentTileId = query.current;
		this.physics.position = point(query.x, query.y);
		this.physics.rotation = query.rotation;
		this.physics.scale = query.scale;
		this.view.factor = query.factor;
		this.view.range = query.range;
		this.renderer.debug = query.debug;
		this.renderer.webgl = query.webgl;
		this.physics.simulateSnap();
	}

	updateUrl(): void {
		const defaults = defaultUrlState.query;
		const params = new URLSearchParams(window.location.search);
		const state = this.serializeRuntime();
		const { query } = state;
		if (query.current !== defaults.current) {
			params.set(urlQueryKey.current, String(query.current));
		} else {
			params.delete(urlQueryKey.current);
		}
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
		setBooleanParam(params, urlQueryKey.debug, query.debug);
		setBooleanParam(params, urlQueryKey.webgl, query.webgl);
		const nextSearch = params.toString();
		const nextPath = `/${state.path.slug}`;
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

	private serializeRuntime(): UrlState {
		return {
			path: { slug: this.plan.slug },
			query: {
				current: this.physics.currentTileId,
				x: this.physics.position.x,
				y: this.physics.position.y,
				rotation: this.physics.rotation,
				scale: this.physics.scale,
				factor: this.view.factor,
				range: this.view.range,
				debug: this.renderer.debug,
				webgl: this.renderer.webgl,
			},
		};
	}
}
