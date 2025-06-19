import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper functions using Web Crypto API
async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const buffer = typeof data === 'string' 
    ? new TextEncoder().encode(data) 
    : data;
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSigV4Headers(
  method: string,
  url: string,
  accessKey: string,
  secretKey: string,
  body: Uint8Array,
  contentType: string
) {
  const urlObj = new URL(url);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';

  // 1. Create canonical request
  const hashedPayload = await sha256Hex(body);
  const canonicalHeaders = [
    `host:${urlObj.hostname}`,
    `x-amz-content-sha256:${hashedPayload}`,
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
    hashedPayload
  ].join('\n');

  // 2. Create string to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest)
  ].join('\n');

  // 3. Calculate signature
  const kDate = await hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = await hmacSha256(kSigning, stringToSign);

  // 4. Return headers
  return {
    'Host': urlObj.hostname,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': hashedPayload,
    'Content-Type': contentType,
    'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabasePhotoUrl, userId, locationName, supabaseFilePath } = await req.json();

    // Validate environment variables
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const R2_BUCKET_NAME = 'satpam';

    if (!CLOUDFLARE_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error('Missing Cloudflare R2 credentials');
    }

    // 1. Download photo from Supabase
    const response = await fetch(supabasePhotoUrl);
    if (!response.ok) throw new Error(`Failed to download photo: ${response.statusText}`);
    
    const photoBlob = await response.blob();
    const photoBuffer = await photoBlob.arrayBuffer();
    const photoUint8Array = new Uint8Array(photoBuffer);

    // 2. Upload to R2
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const fileExtension = supabasePhotoUrl.split('.').pop();
    const r2Key = `${userId}/${locationName.replace(/\s/g, '_')}_${timestamp}.${fileExtension}`;
    const r2Url = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${r2Key}`;

    const headers = await getSigV4Headers(
      'PUT',
      r2Url,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      photoUint8Array,
      photoBlob.type
    );

    const uploadResponse = await fetch(r2Url, {
      method: 'PUT',
      headers,
      body: photoUint8Array,
    });

    if (!uploadResponse.ok) {
      throw new Error(`R2 upload failed: ${uploadResponse.status}`);
    }

    // 3. Delete from Supabase Storage
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await supabaseAdmin.storage
      .from('check-area-photos')
      .remove([supabaseFilePath]);

    return new Response(
      JSON.stringify({ 
        r2Url: `https://pub-${CLOUDFLARE_ACCOUNT_ID}.r2.dev/${R2_BUCKET_NAME}/${r2Key}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});