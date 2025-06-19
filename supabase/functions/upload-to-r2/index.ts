import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function untuk generate signature
async function generateSignature(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabasePhotoUrl, userId, locationName, supabaseFilePath } = await req.json();

    // Validasi environment variables
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const R2_BUCKET_NAME = 'satpam';

    if (!CLOUDFLARE_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error('Missing Cloudflare R2 credentials');
    }

    // 1. Download photo dari Supabase
    const response = await fetch(supabasePhotoUrl);
    if (!response.ok) throw new Error(`Failed to download photo: ${response.statusText}`);
    
    const photoData = await response.arrayBuffer();
    const photoBytes = new Uint8Array(photoData);

    // 2. Upload ke R2 dengan signed URL
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const fileExtension = supabasePhotoUrl.split('.').pop();
    const objectKey = `${userId}/${locationName.replace(/\s/g, '_')}_${timestamp}.${fileExtension}`;
    
    const signedUrl = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${objectKey}`;
    const signature = await generateSignature(R2_SECRET_ACCESS_KEY, `PUT\n\n${response.headers.get('content-type')}\n\nx-amz-acl:private\n/${R2_BUCKET_NAME}/${objectKey}`);

    const uploadResponse = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'x-amz-acl': 'private',
        'Authorization': `AWS ${R2_ACCESS_KEY_ID}:${signature}`
      },
      body: photoBytes,
    });

    if (!uploadResponse.ok) {
      throw new Error(`R2 upload failed: ${uploadResponse.status}`);
    }

    // 3. Hapus dari Supabase Storage
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
        success: true,
        publicUrl: `https://pub-${CLOUDFLARE_ACCOUNT_ID}.r2.dev/${R2_BUCKET_NAME}/${objectKey}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});