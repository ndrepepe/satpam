/// <reference types="vite/client" />

declare module 'https://deno.land/std@0.190.0/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response> | Response): Promise<void>;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.45.0' {
  export function createClient(url: string, key: string): any;
}