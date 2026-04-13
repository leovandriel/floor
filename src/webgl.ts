import { color } from "./color";
import * as math from "./linalg";
import type Renderer from "./render";
import { getWallColor, type RenderBatch } from "./render";
import { type Color, type Point, renderModes } from "./types";
import type View from "./view";

const cellVertexSource = `#version 300 es
in vec2 a_position;
in vec2 a_world;
in vec4 a_color;

out vec2 v_world;
out vec4 v_color;

uniform vec2 u_scale;

void main() {
	gl_Position = vec4(a_position * u_scale, 0.0, 1.0);
	v_world = a_world;
	v_color = a_color;
}
`;

const cellFragmentSource = `#version 300 es
precision highp float;

in vec2 v_world;
in vec4 v_color;

out vec4 outColor;

uniform int u_mode;
uniform vec2 u_light;
uniform float u_wallHeight;

float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 345.45));
	p += dot(p, p + 34.345);
	return fract(p.x * p.y);
}

float noise21(vec2 p) {
	vec2 cell = floor(p);
	vec2 local = fract(p);
	vec2 weight = local * local * (3.0 - 2.0 * local);
	float a = hash21(cell);
	float b = hash21(cell + vec2(1.0, 0.0));
	float c = hash21(cell + vec2(0.0, 1.0));
	float d = hash21(cell + vec2(1.0, 1.0));
	return mix(mix(a, b, weight.x), mix(c, d, weight.x), weight.y);
}

float stoneHeight(vec2 p) {
	float height = 0.0;
	float amplitude = 0.5;
	height += amplitude * noise21(p);
	p *= 2.03;
	amplitude *= 0.5;
	height += amplitude * noise21(p);
	p *= 2.01;
	amplitude *= 0.5;
	height += amplitude * noise21(p);
	p *= 2.07;
	amplitude *= 0.5;
	height += amplitude * noise21(p);
	return height;
}

vec3 stoneNormal(vec3 position, vec3 baseNormal, float strength) {
	float height = stoneHeight(position.xy);
	vec3 dpdx = dFdx(position);
	vec3 dpdy = dFdy(position);
	float dhdx = dFdx(height);
	float dhdy = dFdy(height);
	return normalize(baseNormal - strength * (dhdx * dpdx + dhdy * dpdy));
}

void main() {
	float shade = 1.0;
	if (u_mode == 1) {
		float world = mod(floor(v_world.x * 20.0) + floor(v_world.y * 20.0), 2.0);
		shade *= world < 1.0 ? 0.92 : 1.08;
	} else if (u_mode == 2) {
		float lightHeight = 0.35;
		vec2 light = v_world - u_light;
		float lightDistance = dot(light, light) + lightHeight * lightHeight;
		vec3 normal = stoneNormal(vec3(v_world * 200.0, 0.0), vec3(0.0, 0.0, 1.0), 0.35);
		vec3 light3 = normalize(vec3(-light, lightHeight));
		float diffuse = max(0.0, dot(normal, light3));
		shade *= 0.2 + 0.8 * diffuse * lightHeight / sqrt(lightDistance);
	}
	if (u_mode == 2) {
		float grain = 0.97 + 0.05 * noise21(v_world * 400.0);
		outColor = vec4(v_color.rgb * shade * grain, v_color.a);
	} else {
		outColor = vec4(v_color.rgb * shade, v_color.a);
	}
}
`;

const wallVertexSource = `#version 300 es
in vec2 a_position;
in vec2 a_start;
in vec2 a_end;
in vec2 a_worldStart;
in vec2 a_worldEnd;
in float a_wallScale;
in vec4 a_color;

out vec2 v_position;
flat out vec2 v_start;
flat out vec2 v_end;
flat out vec2 v_worldStart;
flat out vec2 v_worldEnd;
flat out float v_wallScale;
out vec4 v_color;

uniform vec2 u_scale;

void main() {
	gl_Position = vec4(a_position * u_scale, 0.0, 1.0);
	v_position = a_position;
	v_start = a_start;
	v_end = a_end;
	v_worldStart = a_worldStart;
	v_worldEnd = a_worldEnd;
	v_wallScale = a_wallScale;
	v_color = a_color;
}
`;

const wallFragmentSource = `#version 300 es
precision highp float;

in vec2 v_position;
flat in vec2 v_start;
flat in vec2 v_end;
flat in vec2 v_worldStart;
flat in vec2 v_worldEnd;
flat in float v_wallScale;
in vec4 v_color;

out vec4 outColor;

uniform int u_mode;
uniform vec2 u_light;
uniform float u_wallHeight;

float cross2(vec2 a, vec2 b) {
	return a.x * b.y - a.y * b.x;
}

float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 345.45));
	p += dot(p, p + 34.345);
	return fract(p.x * p.y);
}

float noise21(vec2 p) {
	vec2 cell = floor(p);
	vec2 local = fract(p);
	vec2 weight = local * local * (3.0 - 2.0 * local);
	float a = hash21(cell);
	float b = hash21(cell + vec2(1.0, 0.0));
	float c = hash21(cell + vec2(0.0, 1.0));
	float d = hash21(cell + vec2(1.0, 1.0));
	return mix(mix(a, b, weight.x), mix(c, d, weight.x), weight.y);
}

float stoneHeight(vec2 p) {
	float height = 0.0;
	float amplitude = 0.5;
	height += amplitude * noise21(p);
	p *= 2.03;
	amplitude *= 0.5;
	height += amplitude * noise21(p);
	p *= 2.01;
	amplitude *= 0.5;
	height += amplitude * noise21(p);
	p *= 2.07;
	amplitude *= 0.5;
	height += amplitude * noise21(p);
	return height;
}

vec3 stoneNormal(vec3 position, vec3 baseNormal, float strength) {
	float height = stoneHeight(position.xy);
	vec3 dpdx = dFdx(position);
	vec3 dpdy = dFdy(position);
	float dhdx = dFdx(height);
	float dhdy = dFdy(height);
	return normalize(baseNormal - strength * (dhdx * dpdx + dhdy * dpdy));
}

void main() {
	vec2 edge = v_end - v_start;
	float t = -cross2(v_start, v_position) / cross2(edge, v_position);
	vec2 q = mix(v_start, v_end, t);
	vec2 world = mix(v_worldStart, v_worldEnd, t);
	vec2 tangent = normalize(v_worldEnd - v_worldStart);
	float lambda = dot(v_position, q) / dot(q, q);
	float vertical = (1.0 - 1.0 / lambda) / (1.0 - 1.0 / v_wallScale);
	float height = vertical * u_wallHeight;
	float shade = 1.0;
	if (u_mode == 1) {
		float along = dot(world, tangent);
		float wall = mod(floor(along * 20.0) + height, 2.0);
		shade *= wall < 1.0 ? 0.92 : 1.08;
	} else if (u_mode == 2) {
		vec2 normal = vec2(-tangent.y, tangent.x);
		vec2 light = u_light - world;
		if (dot(normal, light) < 0.0) {
			normal = -normal;
		}
		vec3 surfaceNormal = stoneNormal(
			vec3(dot(world, tangent) * 200.0, height * 2.0, 0.0),
			vec3(normalize(normal), 0.0),
			0.35
		);
		vec3 light3 = normalize(vec3(light, 0.35 - height));
		float diffuse = 0.5 + 0.5 * max(0.0, dot(surfaceNormal, light3));
		float distance = dot(light, light) + height * height + 0.35 * 0.35;
		shade *= 0.35 + 0.65 * diffuse * 0.35 / sqrt(distance);
	}
	if (u_mode == 2) {
		float grain = 0.97 + 0.05 * noise21(vec2(dot(world, tangent), height) * 400.0);
		outColor = vec4(v_color.rgb * shade * grain, v_color.a);
	} else {
		outColor = vec4(v_color.rgb * shade, v_color.a);
	}
}
`;

const avatarVertexSource = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
in vec4 a_color;

out vec2 v_uv;
out vec4 v_color;

uniform vec2 u_scale;

void main() {
	gl_Position = vec4(a_position * u_scale, 0.0, 1.0);
	v_uv = a_uv;
	v_color = a_color;
}
`;

const avatarFragmentSource = `#version 300 es
precision highp float;

in vec2 v_uv;
in vec4 v_color;

out vec4 outColor;

void main() {
	if (dot(v_uv, v_uv) > 1.0) {
		discard;
	}
	outColor = v_color;
}
`;

function createShader(
	gl: WebGL2RenderingContext,
	type: number,
	source: string,
): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) {
		throw new Error("Failed to create shader");
	}
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader) ?? "Unknown shader compile error";
		gl.deleteShader(shader);
		throw new Error(log);
	}
	return shader;
}

function createProgram(
	gl: WebGL2RenderingContext,
	vertex: string,
	fragment: string,
): WebGLProgram {
	const program = gl.createProgram();
	if (!program) {
		throw new Error("Failed to create program");
	}
	const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertex);
	const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragment);
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(program) ?? "Unknown program link error";
		gl.deleteProgram(program);
		throw new Error(log);
	}
	return program;
}

function pushWallTriangle(
	buffer: number[],
	a: Point,
	b: Point,
	c: Point,
	start: Point,
	end: Point,
	worldStart: Point,
	worldEnd: Point,
	scale: number,
	color: Color,
): void {
	buffer.push(
		a.x,
		a.y,
		start.x,
		start.y,
		end.x,
		end.y,
		worldStart.x,
		worldStart.y,
		worldEnd.x,
		worldEnd.y,
		scale,
		color.r,
		color.g,
		color.b,
		color.a,
	);
	buffer.push(
		b.x,
		b.y,
		start.x,
		start.y,
		end.x,
		end.y,
		worldStart.x,
		worldStart.y,
		worldEnd.x,
		worldEnd.y,
		scale,
		color.r,
		color.g,
		color.b,
		color.a,
	);
	buffer.push(
		c.x,
		c.y,
		start.x,
		start.y,
		end.x,
		end.y,
		worldStart.x,
		worldStart.y,
		worldEnd.x,
		worldEnd.y,
		scale,
		color.r,
		color.g,
		color.b,
		color.a,
	);
}

function pushWallPolygon(
	buffer: number[],
	wall: RenderBatch["walls"][number],
	color: Color,
): void {
	for (let index = 1; index < wall.polygon.length - 1; index++) {
		pushWallTriangle(
			buffer,
			wall.polygon[0],
			wall.polygon[index],
			wall.polygon[index + 1],
			wall.start,
			wall.end,
			wall.worldStart,
			wall.worldEnd,
			wall.scale,
			color,
		);
	}
}

function pushCellTriangle(
	buffer: number[],
	a: Point,
	b: Point,
	c: Point,
	worldA: Point,
	worldB: Point,
	worldC: Point,
	color: Color,
): void {
	buffer.push(a.x, a.y, worldA.x, worldA.y, color.r, color.g, color.b, color.a);
	buffer.push(b.x, b.y, worldB.x, worldB.y, color.r, color.g, color.b, color.a);
	buffer.push(c.x, c.y, worldC.x, worldC.y, color.r, color.g, color.b, color.a);
}

function getWorldPoint(
	position: Point,
	start: Point,
	end: Point,
	worldStart: Point,
	worldEnd: Point,
): Point {
	const offset = math.sub(position, start);
	const basis = math.sub(end, start);
	const worldBasis = math.sub(worldEnd, worldStart);
	const inv = 1 / math.lengthSq(basis);
	return math.add(
		worldStart,
		math.add(
			math.mul(worldBasis, math.dot(offset, basis) * inv),
			math.mul(math.rotateLeft(worldBasis), -math.cross(offset, basis) * inv),
		),
	);
}

function pushCellPolygon(
	buffer: number[],
	polygon: Point[],
	start: Point,
	end: Point,
	worldStart: Point,
	worldEnd: Point,
	color: Color,
): void {
	for (let index = 1; index < polygon.length - 1; index++) {
		pushCellTriangle(
			buffer,
			polygon[0],
			polygon[index],
			polygon[index + 1],
			getWorldPoint(polygon[0], start, end, worldStart, worldEnd),
			getWorldPoint(polygon[index], start, end, worldStart, worldEnd),
			getWorldPoint(polygon[index + 1], start, end, worldStart, worldEnd),
			color,
		);
	}
}

function pushCircleQuad(
	buffer: number[],
	center: Point,
	radius: number,
	color: Color,
): void {
	const left = center.x - radius;
	const right = center.x + radius;
	const bottom = center.y - radius;
	const top = center.y + radius;
	buffer.push(left, bottom, -1, -1, color.r, color.g, color.b, color.a);
	buffer.push(right, bottom, 1, -1, color.r, color.g, color.b, color.a);
	buffer.push(right, top, 1, 1, color.r, color.g, color.b, color.a);
	buffer.push(left, bottom, -1, -1, color.r, color.g, color.b, color.a);
	buffer.push(right, top, 1, 1, color.r, color.g, color.b, color.a);
	buffer.push(left, top, -1, 1, color.r, color.g, color.b, color.a);
}

export default class WebGLRenderer {
	private readonly gl: WebGL2RenderingContext;
	private readonly cellProgram: WebGLProgram;
	private readonly wallProgram: WebGLProgram;
	private readonly avatarProgram: WebGLProgram;
	private readonly cellPositionLocation: number;
	private readonly cellWorldLocation: number;
	private readonly cellColorLocation: number;
	private readonly wallPositionLocation: number;
	private readonly wallStartLocation: number;
	private readonly wallEndLocation: number;
	private readonly wallWorldStartLocation: number;
	private readonly wallWorldEndLocation: number;
	private readonly wallScaleAttributeLocation: number;
	private readonly wallColorLocation: number;
	private readonly avatarPositionLocation: number;
	private readonly avatarUvLocation: number;
	private readonly avatarColorLocation: number;
	private readonly cellScaleLocation: WebGLUniformLocation;
	private readonly cellModeLocation: WebGLUniformLocation;
	private readonly cellLightLocation: WebGLUniformLocation;
	private readonly wallScaleLocation: WebGLUniformLocation;
	private readonly wallModeLocation: WebGLUniformLocation;
	private readonly wallLightLocation: WebGLUniformLocation;
	private readonly wallHeightLocation: WebGLUniformLocation;
	private readonly avatarScaleLocation: WebGLUniformLocation;
	private readonly cellVertexBuffer: WebGLBuffer;
	private readonly wallVertexBuffer: WebGLBuffer;
	private readonly avatarVertexBuffer: WebGLBuffer;
	private scale = { x: 1, y: 1 };

	constructor(context: WebGL2RenderingContext) {
		this.gl = context;
		this.cellProgram = createProgram(
			context,
			cellVertexSource,
			cellFragmentSource,
		);
		this.wallProgram = createProgram(
			context,
			wallVertexSource,
			wallFragmentSource,
		);
		this.avatarProgram = createProgram(
			context,
			avatarVertexSource,
			avatarFragmentSource,
		);
		this.cellPositionLocation = context.getAttribLocation(
			this.cellProgram,
			"a_position",
		);
		this.cellWorldLocation = context.getAttribLocation(
			this.cellProgram,
			"a_world",
		);
		this.cellColorLocation = context.getAttribLocation(
			this.cellProgram,
			"a_color",
		);
		this.wallPositionLocation = context.getAttribLocation(
			this.wallProgram,
			"a_position",
		);
		this.wallStartLocation = context.getAttribLocation(
			this.wallProgram,
			"a_start",
		);
		this.wallEndLocation = context.getAttribLocation(this.wallProgram, "a_end");
		this.wallWorldStartLocation = context.getAttribLocation(
			this.wallProgram,
			"a_worldStart",
		);
		this.wallWorldEndLocation = context.getAttribLocation(
			this.wallProgram,
			"a_worldEnd",
		);
		this.wallScaleAttributeLocation = context.getAttribLocation(
			this.wallProgram,
			"a_wallScale",
		);
		this.wallColorLocation = context.getAttribLocation(
			this.wallProgram,
			"a_color",
		);
		this.avatarPositionLocation = context.getAttribLocation(
			this.avatarProgram,
			"a_position",
		);
		this.avatarUvLocation = context.getAttribLocation(
			this.avatarProgram,
			"a_uv",
		);
		this.avatarColorLocation = context.getAttribLocation(
			this.avatarProgram,
			"a_color",
		);
		const cellScaleLocation = context.getUniformLocation(
			this.cellProgram,
			"u_scale",
		);
		if (!cellScaleLocation) {
			throw new Error("Failed to find cell scale uniform");
		}
		this.cellScaleLocation = cellScaleLocation;
		const cellModeLocation = context.getUniformLocation(
			this.cellProgram,
			"u_mode",
		);
		if (!cellModeLocation) {
			throw new Error("Failed to find cell mode uniform");
		}
		this.cellModeLocation = cellModeLocation;
		const cellLightLocation = context.getUniformLocation(
			this.cellProgram,
			"u_light",
		);
		if (!cellLightLocation) {
			throw new Error("Failed to find cell light uniform");
		}
		this.cellLightLocation = cellLightLocation;
		const wallScaleLocation = context.getUniformLocation(
			this.wallProgram,
			"u_scale",
		);
		if (!wallScaleLocation) {
			throw new Error("Failed to find wall scale uniform");
		}
		this.wallScaleLocation = wallScaleLocation;
		const wallModeLocation = context.getUniformLocation(
			this.wallProgram,
			"u_mode",
		);
		if (!wallModeLocation) {
			throw new Error("Failed to find wall mode uniform");
		}
		this.wallModeLocation = wallModeLocation;
		const wallLightLocation = context.getUniformLocation(
			this.wallProgram,
			"u_light",
		);
		if (!wallLightLocation) {
			throw new Error("Failed to find wall light uniform");
		}
		this.wallLightLocation = wallLightLocation;
		const wallHeightLocation = context.getUniformLocation(
			this.wallProgram,
			"u_wallHeight",
		);
		if (!wallHeightLocation) {
			throw new Error("Failed to find wall height uniform");
		}
		this.wallHeightLocation = wallHeightLocation;
		const avatarScaleLocation = context.getUniformLocation(
			this.avatarProgram,
			"u_scale",
		);
		if (!avatarScaleLocation) {
			throw new Error("Failed to find avatar scale uniform");
		}
		this.avatarScaleLocation = avatarScaleLocation;
		const cellVertexBuffer = context.createBuffer();
		if (!cellVertexBuffer) {
			throw new Error("Failed to create cell vertex buffer");
		}
		this.cellVertexBuffer = cellVertexBuffer;
		const wallVertexBuffer = context.createBuffer();
		if (!wallVertexBuffer) {
			throw new Error("Failed to create wall vertex buffer");
		}
		this.wallVertexBuffer = wallVertexBuffer;
		const avatarVertexBuffer = context.createBuffer();
		if (!avatarVertexBuffer) {
			throw new Error("Failed to create avatar vertex buffer");
		}
		this.avatarVertexBuffer = avatarVertexBuffer;
		context.enable(context.BLEND);
		context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA);
	}

	resize(width: number, height: number): void {
		this.gl.viewport(0, 0, width, height);
		const max = Math.max(width, height);
		this.scale = { x: max / width, y: max / height };
	}

	clear(color: Color): void {
		this.gl.clearColor(color.r, color.g, color.b, color.a);
		this.gl.clear(this.gl.COLOR_BUFFER_BIT);
	}

	draw(batch: RenderBatch, renderer: Renderer, view: View): void {
		const mode = renderModes.indexOf(renderer.renderMode) - 1;
		const light = renderer.avatarWorldPosition;
		const cellVertices: number[] = [];
		const wallVertices: number[] = [];
		const avatarVertices: number[] = [];
		for (const cell of batch.cells) {
			pushCellPolygon(
				cellVertices,
				cell.polygon,
				cell.start,
				cell.end,
				cell.worldStart,
				cell.worldEnd,
				cell.color,
			);
		}
		for (const wall of batch.walls) {
			pushWallPolygon(
				wallVertices,
				wall,
				mode === 0 ? getWallColor(wall.start, wall.end) : color(0.7, 0.7, 0.7),
			);
		}
		for (const avatar of batch.avatars) {
			pushCircleQuad(
				avatarVertices,
				avatar.position,
				renderer.avatarRadius / view.range,
				avatar.faded ? color(0.6, 0.6, 0.6) : renderer.avatarColor,
			);
		}

		this.gl.useProgram(this.cellProgram);
		this.gl.uniform2f(
			this.cellScaleLocation,
			this.scale.x * view.factor,
			this.scale.y * view.factor,
		);
		this.gl.uniform1i(this.cellModeLocation, mode);
		this.gl.uniform2f(this.cellLightLocation, light.x, light.y);
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.cellVertexBuffer);
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER,
			new Float32Array(cellVertices),
			this.gl.DYNAMIC_DRAW,
		);
		this.gl.enableVertexAttribArray(this.cellPositionLocation);
		this.gl.vertexAttribPointer(
			this.cellPositionLocation,
			2,
			this.gl.FLOAT,
			false,
			8 * Float32Array.BYTES_PER_ELEMENT,
			0,
		);
		this.gl.enableVertexAttribArray(this.cellWorldLocation);
		this.gl.vertexAttribPointer(
			this.cellWorldLocation,
			2,
			this.gl.FLOAT,
			false,
			8 * Float32Array.BYTES_PER_ELEMENT,
			2 * Float32Array.BYTES_PER_ELEMENT,
		);
		this.gl.enableVertexAttribArray(this.cellColorLocation);
		this.gl.vertexAttribPointer(
			this.cellColorLocation,
			4,
			this.gl.FLOAT,
			false,
			8 * Float32Array.BYTES_PER_ELEMENT,
			4 * Float32Array.BYTES_PER_ELEMENT,
		);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, cellVertices.length / 8);

		this.gl.useProgram(this.wallProgram);
		this.gl.uniform2f(
			this.wallScaleLocation,
			this.scale.x * view.factor,
			this.scale.y * view.factor,
		);
		this.gl.uniform1i(this.wallModeLocation, mode);
		this.gl.uniform2f(this.wallLightLocation, light.x, light.y);
		this.gl.uniform1f(this.wallHeightLocation, renderer.wallHeight ?? 1);
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.wallVertexBuffer);
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER,
			new Float32Array(wallVertices),
			this.gl.DYNAMIC_DRAW,
		);
		this.gl.enableVertexAttribArray(this.wallPositionLocation);
		this.gl.vertexAttribPointer(
			this.wallPositionLocation,
			2,
			this.gl.FLOAT,
			false,
			15 * Float32Array.BYTES_PER_ELEMENT,
			0,
		);
		this.gl.enableVertexAttribArray(this.wallStartLocation);
		this.gl.vertexAttribPointer(
			this.wallStartLocation,
			2,
			this.gl.FLOAT,
			false,
			15 * Float32Array.BYTES_PER_ELEMENT,
			2 * Float32Array.BYTES_PER_ELEMENT,
		);
		this.gl.enableVertexAttribArray(this.wallEndLocation);
		this.gl.vertexAttribPointer(
			this.wallEndLocation,
			2,
			this.gl.FLOAT,
			false,
			15 * Float32Array.BYTES_PER_ELEMENT,
			4 * Float32Array.BYTES_PER_ELEMENT,
		);
		this.gl.enableVertexAttribArray(this.wallWorldStartLocation);
		this.gl.vertexAttribPointer(
			this.wallWorldStartLocation,
			2,
			this.gl.FLOAT,
			false,
			15 * Float32Array.BYTES_PER_ELEMENT,
			6 * Float32Array.BYTES_PER_ELEMENT,
		);
		this.gl.enableVertexAttribArray(this.wallWorldEndLocation);
		this.gl.vertexAttribPointer(
			this.wallWorldEndLocation,
			2,
			this.gl.FLOAT,
			false,
			15 * Float32Array.BYTES_PER_ELEMENT,
			8 * Float32Array.BYTES_PER_ELEMENT,
		);
		this.gl.enableVertexAttribArray(this.wallScaleAttributeLocation);
		this.gl.vertexAttribPointer(
			this.wallScaleAttributeLocation,
			1,
			this.gl.FLOAT,
			false,
			15 * Float32Array.BYTES_PER_ELEMENT,
			10 * Float32Array.BYTES_PER_ELEMENT,
		);
		this.gl.enableVertexAttribArray(this.wallColorLocation);
		this.gl.vertexAttribPointer(
			this.wallColorLocation,
			4,
			this.gl.FLOAT,
			false,
			15 * Float32Array.BYTES_PER_ELEMENT,
			11 * Float32Array.BYTES_PER_ELEMENT,
		);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, wallVertices.length / 15);

		this.gl.useProgram(this.avatarProgram);
		this.gl.uniform2f(
			this.avatarScaleLocation,
			this.scale.x * view.factor,
			this.scale.y * view.factor,
		);
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.avatarVertexBuffer);
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER,
			new Float32Array(avatarVertices),
			this.gl.DYNAMIC_DRAW,
		);
		this.gl.enableVertexAttribArray(this.avatarPositionLocation);
		this.gl.vertexAttribPointer(
			this.avatarPositionLocation,
			2,
			this.gl.FLOAT,
			false,
			8 * Float32Array.BYTES_PER_ELEMENT,
			0,
		);
		this.gl.enableVertexAttribArray(this.avatarUvLocation);
		this.gl.vertexAttribPointer(
			this.avatarUvLocation,
			2,
			this.gl.FLOAT,
			false,
			8 * Float32Array.BYTES_PER_ELEMENT,
			2 * Float32Array.BYTES_PER_ELEMENT,
		);
		this.gl.enableVertexAttribArray(this.avatarColorLocation);
		this.gl.vertexAttribPointer(
			this.avatarColorLocation,
			4,
			this.gl.FLOAT,
			false,
			8 * Float32Array.BYTES_PER_ELEMENT,
			4 * Float32Array.BYTES_PER_ELEMENT,
		);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, avatarVertices.length / 8);
	}
}
