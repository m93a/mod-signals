import { Signal } from "./readable.ts";
import type {
	Invalidator,
	MinimalSignal,
	MinimalSubscriber,
} from "./types.ts";

export const MappedSignal = <S, T>(
	signal: MinimalSignal<S>,
	fn: (value: S) => T,
): Signal<T> => {
	const subs = new Set<MinimalSubscriber<T>>();
	const invs = new Set<Invalidator>();
	let unsub = () => {};
	let value: T;

	const start = () => {
		unsub = signal.subscribe(
			(v) => {
				value = fn(v);
				subs.forEach((s) => s(value));
			},
			() => {
				invs.forEach((i) => i());
			},
		);
	};
	const stop = () => {
		unsub();
		unsub = () => {};
	};

	const subscribe = (s: MinimalSubscriber<T>, i?: Invalidator) => {
		if (subs.size === 0) start();

		subs.add(s);
		if (i) invs.add(i);

		s(value);

		return () => {
			subs.delete(s);
			if (i) invs.delete(i);
			if (subs.size === 0) stop();
		};
	};

	const get = () => {
		if (subs.size === 0) {
			if (signal.get) return fn(signal.get()!);
			start();
			stop();
		}
		return value;
	};

	return Signal.fromMinimal({ subscribe, get });
};
