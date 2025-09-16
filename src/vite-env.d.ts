/// <reference types="vite/client" />

declare module 'https://deno.land/std@0.190.0/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response> | Response): Promise<void>;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.45.0' {
  export function createClient(url: string, key: string): any;
}

declare module 'https://esm.sh/@aws-sdk/client-s3@3.621.0' {
  export class S3Client {
    constructor(config: any);
    send(command: any): Promise<any>;
  }
  export class PutObjectCommand {
    constructor(params: any);
  }
}