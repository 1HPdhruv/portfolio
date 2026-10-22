/** Build diagnostics for the dev server; compiled out of production builds. */
export const devLog = (...args: unknown[]) => { if (import.meta.env.DEV) console.log(...args); };
