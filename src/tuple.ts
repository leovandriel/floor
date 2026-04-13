type TupleNode<Value> = Map<unknown, TupleNode<Value> | Value>;

export class TupleMap<Key extends readonly unknown[], Value> {
	private readonly root: TupleNode<Value> = new Map();

	has(key: Key): boolean {
		return this.get(key) !== undefined;
	}

	get(key: Key): Value | undefined {
		if (key.length === 0) {
			return undefined;
		}
		const node = this.getNode(key, false);
		if (!node) {
			return undefined;
		}
		return node.get(key[key.length - 1]) as Value | undefined;
	}

	set(key: Key, value: Value): this {
		if (key.length === 0) {
			throw new Error("Tuple keys must not be empty");
		}
		const node = this.getNode(key, true);
		if (!node) {
			throw new Error("Tuple keys must not be empty");
		}
		node.set(key[key.length - 1], value);
		return this;
	}

	delete(key: Key): boolean {
		if (key.length === 0) {
			return false;
		}
		return this.deleteAt(this.root, key, 0);
	}

	private getNode(key: Key, create: boolean): TupleNode<Value> | undefined {
		let node = this.root;
		for (const part of key.slice(0, -1)) {
			const next = node.get(part);
			if (next instanceof Map) {
				node = next as TupleNode<Value>;
				continue;
			}
			if (!create) {
				return undefined;
			}
			const child: TupleNode<Value> = new Map();
			node.set(part, child);
			node = child;
		}
		return node;
	}

	private deleteAt(node: TupleNode<Value>, key: Key, index: number): boolean {
		const part = key[index];
		if (index === key.length - 1) {
			return node.delete(part);
		}
		const next = node.get(part);
		if (!(next instanceof Map)) {
			return false;
		}
		const removed = this.deleteAt(next as TupleNode<Value>, key, index + 1);
		if (removed && next.size === 0) {
			node.delete(part);
		}
		return removed;
	}
}

export class TupleSet<Key extends readonly unknown[]> {
	private readonly map = new TupleMap<Key, true>();

	has(key: Key): boolean {
		return this.map.has(key);
	}

	add(key: Key): this {
		this.map.set(key, true);
		return this;
	}

	delete(key: Key): boolean {
		return this.map.delete(key);
	}
}
