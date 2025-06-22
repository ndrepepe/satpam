import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper function to convert string to Uint8Array
function strToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Helper function to sign a string with HMAC-SHA256 using Web Crypto API
async function sign(key: ArrayBuffer, msg: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    strToUint8Array(msg)
  );
  return signature;
}

// Helper function to create SHA256 hash using Web Crypto API
async function sha256(data: string | ArrayBuffer | Uint8Array | Blob): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof data === 'string') {
    buffer = strToUint8Array(data).buffer;
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer;
  } else if (data instanceof ArrayBuffer) {
    buffer = data;
  } else if (data instanceof Blob) {
    buffer = await data.arrayBuffer();
  } else {
    throw new Error("Unsupported data type for hashing.");
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// AWS Signature Version 4 signing logic
async function signAwsV4(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  service: string,
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string | ArrayBuffer | Uint8Array | Blob;
  }
): Promise<Record<string, string>> {
  const url = new URL(request.url);
  const host = url.host;
  const path = url.pathname;
  const query = url.searchParams.toString();
  const method = request.method.toUpperCase();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  // 1. Create a canonical request
  let canonicalHeaders = '';
  let signedHeaders = '';
  const headersToSign: Record<string, string> = {};

  // Add host and x-amz-date to headers to sign
  headersToSign['host'] = host;
  headersToSign['x-amz-date'] = amzDate;

  let payloadHash = 'UNSIGNED-PAYLOAD';
  if (request.body) {
    payloadHash = await sha256(request.body);
  } else {
    payloadHash = await sha256(''); // Empty string hash for no body
  }
  headersToSign['x-amz-content-sha256'] = payloadHash;


  // Add other headers from request
  for (const key in request.headers) {
    headersToSign[key.toLowerCase()] = request.headers[key];
  }

  const sortedHeaderKeys = Object.keys(headersToSign).sort();
  for (const key of sortedHeaderKeys) {
    canonicalHeaders += `${key}:${headersToSign[key].trim()}\n`;
  }
  signedHeaders = sortedHeaderKeys.join(';');

  const canonicalRequest = [
    method,
    path,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // 2. Create a string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');

  // 3. Calculate the signature
  const kSecret = strToUint8Array(`AWS4${secretAccessKey}`).buffer;
  const kDate = await sign(kSecret, dateStamp);
  const kRegion = await sign(kDate, region);
  const kService = await sign(kRegion, service);
  const kSigning = await sign(kService, 'aws4_request');
  const signature = bufferToHex(await sign(kSigning, stringToSign));

  // 4. Add the Authorization header
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Authorization': authorizationHeader,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    'host': host,
    ...request.headers
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabasePhotoUrl, userId, locationName, supabaseFilePath } = await req.json();
    console.log("Edge Function: Received request for userId:", userId, "locationName:", locationName);

    // Validate environment variables
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const R2_BUCKET_NAME = 'satpam'; // Nama bucket R2 Anda
    const R2_ENDPOINT = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    if (!CLOUDFLARE_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      console.error("Edge Function: Missing Cloudflare R2 credentials!");
      throw new Error('Missing Cloudflare R2 credentials');
    }
    console.log("Edge Function: R2 credentials found.");

    // 1. Download photo from Supabase Storage
    console.log("Edge Function: Attempting to download photo from Supabase URL:", supabasePhotoUrl);
    const response = await fetch(supabasePhotoUrl);
    if (!response.ok) {
      console.error(`Edge Function: Failed to download photo from Supabase: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to download photo: ${response.statusText}`);
    }
    
    const photoBlob = await response.blob();
    const photoBuffer = await photoBlob.arrayBuffer();
    const photoUint8Array = new Uint8Array(photoBuffer);
    console.log("Edge Function: Photo downloaded successfully. Size:", photoUint8Array.length, "bytes.");

    // 2. Upload to R2 using direct fetch with SigV4 signing
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const fileExtension = photoBlob.type.split('/').pop();
    const r2Key = `${userId}/${locationName.replace(/\s/g, '_')}_${timestamp}.${fileExtension}`;
    const r2UploadUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${r2Key}`;

    console.log("Edge Function: R2 Target Key:", r2Key);
    console.log("Edge Function: R2 Upload URL:", r2UploadUrl);

    const requestToSign = {
      method: 'PUT',
      url: r2UploadUrl,
      headers: {
        'Content-Type': photoBlob.type,
      },
      body: photoUint8Array,
    };

    console.log("Edge Function: Before signAwsV4 call.");
    const signedHeaders = await signAwsV4(
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      'auto', // Cloudflare R2 uses 'auto' region
      's3',   // Service name for S3 compatible APIs
      requestToSign
    );
    console.log("Edge Function: After signAwsV4 call. Signed Headers:", JSON.stringify(signedHeaders));
    
    console.log("Edge Function: Before R2 fetch call.");
    const r2UploadResponse = await fetch(r2UploadUrl, {
      method: 'PUT',
      headers: signedHeaders,
      body: photoUint8Array,
    });

    if (!r2UploadResponse.ok) {
      const errorText = await r2UploadResponse.text();
      console.error(`Edge Function: Failed to upload to R2: ${r2UploadResponse.status} ${r2UploadResponse.statusText} - ${errorText}`);
      throw new Error(`Failed to upload photo to R2: ${r2UploadResponse.statusText} - ${errorText}`);
    }
    console.log("Edge Function: Photo uploaded to R2 successfully using signed fetch.");

    // 3. Delete from Supabase Storage
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    console.log("Edge Function: Attempting to delete photo from Supabase Storage path:", supabaseFilePath);
    const { error: deleteError } = await supabaseAdmin.storage
      .from('check-area-photos')
      .remove([supabaseFilePath]);

    if (deleteError) {
      console.error("Edge Function: Error deleting from Supabase Storage:", deleteError);
      // Jangan throw error di sini, karena unggah ke R2 sudah berhasil
    } else {
      console.log("Edge Function: Photo deleted from Supabase Storage successfully.");
    }

    // Konstruksi URL publik R2
    const r2PublicUrl = `https://pub-${CLOUDFLARE_ACCOUNT_ID}.r2.dev/${R2_BUCKET_NAME}/${r2Key}`;
    console.log("Edge Function: R2 Public URL:", r2PublicUrl);

    return new Response(
      JSON.stringify({ r2Url: r2PublicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error("Edge Function: Caught error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});