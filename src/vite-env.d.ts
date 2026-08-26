/// <reference types="vite/client" />

declare module '*?url' {
  const src: string;
  export default src;
}

// Supplied by the feature-flags plugin in vite.config.ts, which reads flag.env.
declare module 'virtual:feature-flags' {
  const flags: Record<string, string>;
  export default flags;
}
