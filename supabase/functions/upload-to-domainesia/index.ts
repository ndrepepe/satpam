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

// AWS Signature Version 4 calculation (simplified for PUT object)
async function getSignedHeaders(
  accessKey: string,
  secretKey: string,
  region: string,
  service: string,
  method: string,
  path: string,
  headers: Headers,
  payload: Uint8Array,
  host: string // Explicitly pass host for custom endpoints
): Promise<Headers> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = now.toISOString().slice(0, 8); // YYYYMMDD

  headers.set('x-amz-date', amzDate);
  headers.set('x-amz-content-sha256', await sha256(payload));
  headers.set('host', host); // Use the provided host

  const canonicalHeaders = Array.from(headers.entries())
    .filter(([key]) => key.startsWith('x-amz-') || key === 'host' || key === 'content-type')
    .map(([key, value]) => `${key.toLowerCase()}:${value.trim()}`)
    .sort()
    .join('\n');

  const signedHeaders = Array.from(headers.keys())
    .filter(key => key.startsWith('x-amz-') || key === 'host' || key === 'content-type')
    .map(key => key.toLowerCase())
    .sort()
    .join(';');

  const canonicalRequest = [
    method,
    path,
    '', // Canonical Query String (empty for simple PUT)
    canonicalHeaders,
    '', // Newline after canonical headers
    signedHeaders,
    await sha256(payload), // Hashed Payload
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');

  const kSecret = `AWS4${secretKey}`;
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
    const { userId, locationId, photoData, contentType } = await req.json();
    if (!userId || !locationId || !photoData || !contentType) {
      throw new Error('Missing required fields: userId, locationId, photoData, or contentType');
    }

    const DOMAINESIA_ACCESS_KEY = Deno.env.get('DOMAINESIA_ACCESS_KEY');
    const DOMAINESIA_SECRET_KEY = Deno.env.get('DOMAINESIA_SECRET_KEY');
    const DOMAINESIA_ENDPOINT = Deno.env.get('DOMAINESIA_ENDPOINT');
    const DOMAINESIA_BUCKET_NAME = Deno.env.get('DOMAINESIA_BUCKET_NAME');
    const DOMAINESIA_REGION = Deno.env.get('DOMAINESIA_REGION') || 'us-east-1'; // Default region if not set

    if (!DOMAINESIA_ACCESS_KEY || !DOMAINESIA_SECRET_KEY || !DOMAINESIA_ENDPOINT || !DOMAINESIA_BUCKET_NAME) {
      throw new Error('DomaiNesia credentials or configuration not set in Supabase Secrets.');
    }

    const bytes = new Uint8Array(photoData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExt = contentType.split('/')[1] || 'jpeg';
    const filename = `uploads/${userId}/${locationId}-${timestamp}.${fileExt}`;
    const objectPath = `/${filename}`;

    // Extract host from the endpoint URL
    const endpointUrl = new URL(DOMAINESIA_ENDPOINT);
    const host = endpointUrl.host;

    const url = `${DOMAINESIA_ENDPOINT}/${DOMAINESIA_BUCKET_NAME}${objectPath}`;

    const requestHeaders = new Headers();
    requestHeaders.set('Content-Type', contentType);
    requestHeaders.set('x-amz-acl', 'public-read'); // Set ACL for public read access

    const signedHeaders = await getSignedHeaders(
      DOMAINESIA_ACCESS_KEY,
      DOMAINESIA_SECRET_KEY,
      DOMAINESIA_REGION,
      's3', // DomaiNesia is S3 compatible
      'PUT',
      `/${DOMAINESIA_BUCKET_NAME}${objectPath}`, // Path should include bucket name for S3-compatible
      requestHeaders,
      bytes,
      host // Pass the extracted host
    );

    const response = await fetch(url, {
      method: 'PUT',
      headers: signedHeaders,
      body: bytes
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DomaiNesia Upload Error: ${response.status} - ${errorText}`);
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    // Construct the public URL. Assuming DomaiNesia public URL structure is similar to endpoint + bucket + path
    const publicUrl = `${DOMAINESIA_ENDPOINT}/${DOMAINESIA_BUCKET_NAME}${objectPath}`;

    return new Response(
      JSON.stringify({
        publicUrl: publicUrl
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