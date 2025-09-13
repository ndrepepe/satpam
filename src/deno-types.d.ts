/// <reference types="https://deno.land/x/deno@v1.36.1/types/lib.deno.ns.d.ts" />

// Explicitly declare Deno global for TypeScript in non-Deno environments
declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
    };
  };
}