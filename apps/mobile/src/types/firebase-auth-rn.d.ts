// @firebase/auth's package.json exports a single top-level `types` condition that always
// resolves to the generic (non-React-Native) declaration file, so TypeScript never sees
// `getReactNativePersistence` even though it exists at runtime in the `react-native` build.
// The `export {}` below keeps this file a module, so the block below augments the existing
// `@firebase/auth` types instead of replacing them entirely.
import type { Persistence } from 'firebase/auth';

declare module '@firebase/auth' {
  export function getReactNativePersistence(storage: unknown): Persistence;
}

export {};
