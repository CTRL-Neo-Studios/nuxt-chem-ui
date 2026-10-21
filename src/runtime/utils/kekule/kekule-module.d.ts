/**
 * The `kekule` npm package (1.x) ships no TypeScript declarations. This shim
 * only gives the dynamic import in loadKekule.ts a resolvable shape; the
 * structural API types this library codes against live in types.ts.
 */
declare module 'kekule' {
  export const Kekule: unknown
}

declare module 'kekule/theme'
