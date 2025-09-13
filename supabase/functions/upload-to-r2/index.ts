import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { encode } from "https://deno.land/std@0.190.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to calculate SHA256 hash
async function sha256(data: Uint8Array | string): Promise<string> {
  const textEncoder = new TextEncoder();
  const dataBuffer = typeof data === 'string' ? textEncoder.encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", dataBuffer);
  return encode(new Uint8Array(hash));
}

// Helper function for HMAC-SHA256
async function hmacSha256(key: string | Uint8Array, msg: string | Uint8Array): Promise<Uint8Array> {
  const textEncoder = new TextEncoder();
  const keyBuffer = typeof key === 'string' ? textEncoder.encode(key) : key;
  const msgBuffer = typeof msg === 'string' ? textEncoder.encode(msg) : msg;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    msgBuffer
  );

  return new Uint8Array(signature);
}

// AWS Signature Version 4 calculation
async function getSignedHeaders(
  accessKey: string,
  secretKey: string,
  region: string,
  service: string,
  method: string,
  path: string, // Path ini seharusnya hanya path objek, bukan termasuk nama bucket
  headers: Headers,
  payload: Uint8Array
): Promise<Headers> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");

  headers.set('x-amz-date', amzDate);
  const contentSha256 = await sha256(payload);
  headers.set('x-amz-content-sha256', contentSha256);

  // Ensure Host header is present and its value is used correctly in canonicalization
  const hostHeaderValue = headers.get('Host');
  if (!hostHeaderValue) {
    throw new Error('Host header is missing from requestHeaders for signing.');
  }

  const canonicalHeaders = Array.from(headers.entries())
    .filter(([key]) => key.startsWith('x-amz-') || key.toLowerCase() === 'host' || key.toLowerCase() === 'content-type')
    .map(([key, value]) => `${key.toLowerCase()}:${value.trim()}`)
    .sort()
    .join('\n');

  const signedHeaders = Array.from(headers.keys())
    .filter(key => key.startsWith('x-amz-') || key.toLowerCase() === 'host' || key.toLowerCase() === 'content-type')
    .map(key => key.toLowerCase())
    .sort()
    .join(';');

  const canonicalRequest = [
    method,
    path, // Menggunakan path objek yang sudah benar
    '', // Query string, which is empty
    canonicalHeaders,
    '', // Empty line after canonical headers
    signedHeaders,
    contentSha256,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');

  const textEncoder = new TextEncoder();
  const kSecret = textEncoder.encode(`AWS4${secretKey}`);
  const kDate = await hmacSha256(kSecret, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');

  const signature = encode(await hmacSha256(kSigning, stringToSign));

  headers.set(
    'Authorization',
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  );

  return headers;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, locationName, photoData, contentType } = await req.json();
    if (!userId || !locationName || !photoData || !contentType) {
      throw new Error('Missing required fields');
    }

    const R2_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME');
    const R2_REGION = Deno.env.get('R2_REGION') || 'auto';

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET || !R2_BUCKET_NAME) {
      throw new Error('R2 credentials (CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) not configured. Please set them in Supabase Edge Functions secrets.');
    }

    const bytes = new Uint8Array(photoData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExt = contentType.split('/')[1] || 'jpg';
    const filename = `uploads/${userId}/${timestamp}.${fileExt}`;
    const objectPath = `/${filename}`; // Path objek yang benar

    const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}${objectPath}`;

    const requestHeaders = new Headers();
    requestHeaders.set('Content-Type', contentType);
    requestHeaders.set('Host', `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    requestHeaders.set('x-amz-acl', 'public-read');

    const signedHeaders = await getSignedHeaders(
      R2_ACCESS_KEY,
      R2_SECRET,
      R2_REGION,
      's3',
      'PUT',
      objectPath, // Menggunakan objectPath yang sudah benar di sini
      requestHeaders,
      bytes
    );

    const response = await fetch(url, {
      method: 'PUT',
      headers: signedHeaders,
      body: bytes
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`R2 Upload Error: ${response.status} - ${errorText}`);
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    return new Response(
      JSON.stringify({
        r2PublicUrl: `https://pub-${R2_ACCOUNT_ID}.r2.dev/${filename}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error("Edge Function error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});