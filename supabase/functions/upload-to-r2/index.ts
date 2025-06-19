import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { HmacSha256 } from "https://deno.land/std@0.190.0/crypto/hmac_sha256.ts";
import { encodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getSigV4Headers(
  method: string,
  url: string,
  accessKey: string,
  secretKey: string,
  region: string,
  service: string,
  body: Uint8Array,
  contentType: string
) {
  const urlObj = new URL(url);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  
  // Step 1: Create canonical request
  const canonicalHeaders = [
    `host:${urlObj.hostname}`,
    `x-amz-content-sha256:${await sha256Hex(body)}`,
    `x-amz-date:${amzDate}`,
    `content-type:${contentType}`
  ].join('\n') + '\n';
  
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date;content-type';
  const canonicalRequest = [
    method,
    urlObj.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    await sha256Hex(body)
  ].join('\n');

  // Step 2: Create string to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(new TextEncoder().encode(canonicalRequest))
  ].join('\n');

  // Step 3: Calculate signature
  const kDate = await hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = await hmacSha256(kSigning, stringToSign);

  // Step 4: Add signing information to headers
  return {
    'Host': urlObj.hostname,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': await sha256Hex(body),
    'Content-Type': contentType,
    'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${toHex(signature)}`
  };
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return toHex(new Uint8Array(hash));
}

async function hmacSha256(key: string | Uint8Array, message: string): Promise<Uint8Array> {
  const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const messageBuffer = new TextEncoder().encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBuffer);
  return new Uint8Array(signature);
}

function toHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabasePhotoUrl, userId, locationName, supabaseFilePath } = await req.json();

    console.log("Edge Function: Received request to upload-to-r2");
    console.log("Edge Function: supabasePhotoUrl:", supabasePhotoUrl);
    console.log("Edge Function: userId:", userId);
    console.log("Edge Function: locationName:", locationName);
    console.log("Edge Function: supabaseFilePath:", supabaseFilePath);

    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const R2_BUCKET_NAME = 'satpam';
    const R2_REGION = 'auto';

    if (!CLOUDFLARE_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      console.error("Edge Function Error: Cloudflare R2 credentials are not set");
      return new Response(
        JSON.stringify({ error: 'Cloudflare R2 credentials are not set' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 1. Download photo from Supabase Storage
    console.log("Edge Function: Downloading photo from Supabase Storage...");
    const response = await fetch(supabasePhotoUrl);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Edge Function Error: Failed to download photo: ${response.statusText}`);
      throw new Error(`Failed to download photo: ${response.statusText}`);
    }
    
    const photoBlob = await response.blob();
    const photoBuffer = await photoBlob.arrayBuffer();
    const photoUint8Array = new Uint8Array(photoBuffer);
    console.log("Edge Function: Photo downloaded successfully");

    // 2. Upload to R2 using SigV4
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const fileExtension = supabasePhotoUrl.split('.').pop();
    const r2Key = `${userId}/${locationName.replace(/\s/g, '_')}_${timestamp}.${fileExtension}`;
    const r2Url = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${r2Key}`;

    console.log("Edge Function: Preparing R2 upload with SigV4...");
    const headers = await getSigV4Headers(
      'PUT',
      r2Url,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      R2_REGION,
      's3',
      photoUint8Array,
      photoBlob.type
    );

    console.log("Edge Function: Uploading to R2...");
    const uploadResponse = await fetch(r2Url, {
      method: 'PUT',
      headers: headers,
      body: photoUint8Array,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(`Edge Function Error: R2 upload failed: ${uploadResponse.status} - ${errorText}`);
      throw new Error(`R2 upload failed: ${uploadResponse.status}`);
    }

    console.log("Edge Function: Upload to R2 successful");
    const r2PublicUrl = `https://pub-${CLOUDFLARE_ACCOUNT_ID}.r2.dev/${R2_BUCKET_NAME}/${r2Key}`;

    // 3. Delete from Supabase Storage
    console.log("Edge Function: Deleting from Supabase Storage...");
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: deleteError } = await supabaseAdmin.storage
      .from('check-area-photos')
      .remove([supabaseFilePath]);

    if (deleteError) {
      console.warn("Edge Function Warning: Failed to delete from Supabase Storage:", deleteError.message);
    } else {
      console.log("Edge Function: Deleted from Supabase Storage");
    }

    return new Response(
      JSON.stringify({ r2Url: r2PublicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error("Edge Function Critical Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});