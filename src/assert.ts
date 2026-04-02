export default function assert(
	condition: unknown,
	message: string,
	...args: unknown[]
): asserts condition {
	if (!condition) {
		throw new Error(
			args.length > 0 ? `${message}: ${args.map(String).join(", ")}` : message,
		);
	}
}
