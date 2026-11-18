import type { Persistence, ReactNativeAsyncStorage } from "firebase/auth";

// `firebase/auth` re-exports `@firebase/auth`, whose public typings are the browser build. At runtime
// Metro resolves the "react-native" build, which also exports getReactNativePersistence
// (see @firebase/auth/dist/rn/index.rn.d.ts). Declare it so TypeScript matches the bundle.
declare module "firebase/auth" {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
