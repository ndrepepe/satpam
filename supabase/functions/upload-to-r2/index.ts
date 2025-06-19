import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper untuk membuat signature R2
async function getR2AuthHeaders(
  method: string,
  url: string,
  accessKey: string,
  secretKey: string,
  contentType = '',
) {
  const urlObj = new URL(url);
  const timestamp = new Date().toUTCString();
  const payload = [
    method,
    '',
    contentType,
    timestamp,
    urlObj.pathname,
  ].join('\n');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    'Authorization': `AWS ${accessKey}:${signatureHex}`,
    'Date': timestamp,
    'Content-Type': contentType,
  };
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
    console.log("Edge Function: Photo downloaded successfully");

    // 2. Upload to R2 using direct API call
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const fileExtension = supabasePhotoUrl.split('.').pop();
    const r2Key = `${userId}/${locationName.replace(/\s/g, '_')}_${timestamp}.${fileExtension}`;
    const r2Url = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${r2Key}`;

    console.log("Edge Function: Preparing R2 upload...");
    const headers = await getR2AuthHeaders(
      'PUT',
      r2Url,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      photoBlob.type
    );

    console.log("Edge Function: Uploading to R2...");
    const uploadResponse = await fetch(r2Url, {
      method: 'PUT',
      headers: headers,
      body: photoBuffer,
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