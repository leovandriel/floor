import { color } from "./color";
import type Renderer from "./render";
import type { RenderBatch } from "./render";
import type { Color, Point } from "./types";
import type View from "./view";

const vertexSource = `#version 300 es
in vec2 a_position;
in vec4 a_color;

out vec4 v_color;

uniform vec2 u_scale;

void main() {
	gl_Position = vec4(a_position * u_scale, 0.0, 1.0);
	v_color = a_color;
}
`;

const fragmentSource = `#version 300 es
precision highp float;

in vec4 v_color;

out vec4 outColor;

void main() {
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

function pushTriangle(
	buffer: number[],
	a: Point,
	b: Point,
	c: Point,
	color: Color,
): void {
	buffer.push(a.x, a.y, color.r, color.g, color.b, color.a);
	buffer.push(b.x, b.y, color.r, color.g, color.b, color.a);
	buffer.push(c.x, c.y, color.r, color.g, color.b, color.a);
}

function pushPolygon(buffer: number[], polygon: Point[], color: Color): void {
	for (let index = 1; index < polygon.length - 1; index++) {
		pushTriangle(buffer, polygon[0], polygon[index], polygon[index + 1], color);
	}
}

function pushCircle(
	buffer: number[],
	center: Point,
	radius: number,
	color: Color,
): void {
	const steps = 64;
	for (let index = 0; index < steps; index++) {
		const start = (index / steps) * Math.PI * 2;
		const end = ((index + 1) / steps) * Math.PI * 2;
		pushTriangle(
			buffer,
			center,
			{
				x: center.x + Math.cos(start) * radius,
				y: center.y + Math.sin(start) * radius,
			},
			{
				x: center.x + Math.cos(end) * radius,
				y: center.y + Math.sin(end) * radius,
			},
			color,
		);
	}
}

export default class WebGLRenderer {
	private readonly gl: WebGL2RenderingContext;
	private readonly program: WebGLProgram;
	private readonly positionLocation: number;
	private readonly colorLocation: number;
	private readonly scaleLocation: WebGLUniformLocation;
	private readonly vertexBuffer: WebGLBuffer;
	private scale = { x: 1, y: 1 };

	constructor(context: WebGL2RenderingContext) {
		this.gl = context;
		this.program = createProgram(context, vertexSource, fragmentSource);
		this.positionLocation = context.getAttribLocation(
			this.program,
			"a_position",
		);
		this.colorLocation = context.getAttribLocation(this.program, "a_color");
		const scaleLocation = context.getUniformLocation(this.program, "u_scale");
		if (!scaleLocation) {
			throw new Error("Failed to find scale uniform");
		}
		this.scaleLocation = scaleLocation;
		const vertexBuffer = context.createBuffer();
		if (!vertexBuffer) {
			throw new Error("Failed to create vertex buffer");
		}
		this.vertexBuffer = vertexBuffer;
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
		const vertices: number[] = [];
		for (const tile of batch.tiles) {
			pushPolygon(vertices, tile.polygon, tile.color);
		}
		for (const wall of batch.walls) {
			pushPolygon(vertices, wall.quad, wall.color);
		}
		for (const avatar of batch.avatars) {
			pushCircle(
				vertices,
				avatar.position,
				renderer.avatarRadius / view.range,
				avatar.faded ? color(0.6, 0.6, 0.6) : renderer.avatarColor,
			);
		}

		this.gl.useProgram(this.program);
		this.gl.uniform2f(
			this.scaleLocation,
			this.scale.x * view.factor,
			this.scale.y * view.factor,
		);
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
		this.gl.bufferData(
			this.gl.ARRAY_BUFFER,
			new Float32Array(vertices),
			this.gl.DYNAMIC_DRAW,
		);
		this.gl.enableVertexAttribArray(this.positionLocation);
		this.gl.vertexAttribPointer(
			this.positionLocation,
			2,
			this.gl.FLOAT,
			false,
			6 * Float32Array.BYTES_PER_ELEMENT,
			0,
		);
		this.gl.enableVertexAttribArray(this.colorLocation);
		this.gl.vertexAttribPointer(
			this.colorLocation,
			4,
			this.gl.FLOAT,
			false,
			6 * Float32Array.BYTES_PER_ELEMENT,
			2 * Float32Array.BYTES_PER_ELEMENT,
		);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, vertices.length / 6);
	}
}
