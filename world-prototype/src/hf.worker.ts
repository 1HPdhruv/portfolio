// Generates the Basin heightfield off the main thread and transfers the buffers back.
// Deterministic: identical to calling `new Heightfield()` on the main thread (verified by hash in tools/qa.mjs).
import { Heightfield } from './heightfield';

const post = (m: unknown, t?: Transferable[]) => (self as unknown as Worker).postMessage(m, t ?? []);
self.onmessage = () => {
  try {
    const t0 = performance.now();
    Heightfield.onStage = (stage, frac) => post({ type: 'progress', stage, frac });
    const hf = new Heightfield();
    const data = hf.toData();
    post({ type: 'done', data, ms: performance.now() - t0 }, Heightfield.transferables(data));
  } catch (e) {
    post({ type: 'error', message: String((e as Error)?.message ?? e) });
  }
};
