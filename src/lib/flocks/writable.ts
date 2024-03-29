import { PipeOf, StartStop, mut, pipableOf } from "../mod.ts";
import { Defer } from "../utils/defer.ts";
import { Flock, FlockUpdateSubscriber } from "./readable.ts";
import { WriteonlyFlock } from "./writeonly.ts";

export interface MutFlockOptions extends StartStop {}

export interface MutFlock<T>
	extends WriteonlyFlock<T>,
		Omit<Flock<T>, "pipe">,
		PipeOf<MutFlock<T>> {
	toReadonly(): Flock<T>;
	toWriteonly(): WriteonlyFlock<T>;
}

export const MutFlock = <T>(
	items: Iterable<T> = [],
	opts: MutFlockOptions = {},
): MutFlock<T> => {
	const set = new Set(items);
	const wflock = WriteonlyFlock<T>();
	const size = mut(0);

	const subs = new Set<FlockUpdateSubscriber<T>>();
	const { defer, cleanup } = Defer.create();

	const listenToUpdates = (sub: FlockUpdateSubscriber<T>) => {
		if (subs.size === 0) start();
		subs.add(sub);
		return () => {
			subs.delete(sub);
			if (subs.size === 0) stop();
		};
	};

	const start = () => {
		defer(
			wflock.listenToUpdates((updates) => {
				for (const u of updates) {
					switch (u.type) {
						case "add":
							set.add(u.value);
							break;

						case "delete":
							set.delete(u.value);
							break;

						case "clear":
							set.clear();
							break;
					}
				}
				if (set.size !== size.get()) {
					size.set(set.size);
				}
				for (const s of [...subs]) s(updates);
			}),
		);
		opts.onStart?.({ defer });
	};

	const stop = () => {
		cleanup();
		opts.onStop?.();
	};

	const rflock = Flock.fromMinimal({
		listenToUpdates,
		size,
		has(v) {
			return set.has(v);
		},
		iter() {
			return set;
		},
	});

	const toWriteonly = () => wflock;
	const toReadonly = () => rflock;

	return pipableOf({ ...wflock, ...rflock, toWriteonly, toReadonly });
};
