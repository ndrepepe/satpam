import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.592.0";
import { fromStatic } from "https://esm.sh/@aws-sdk/credential-provider-static@3.592.0"; // Import fromStatic

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    if (!CLOUDFLARE_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      console.error("Edge Function: Missing Cloudflare R2 credentials!");
      throw new Error('Missing Cloudflare R2 credentials');
    }
    console.log("Edge Function: R2 credentials found.");

    // Inisialisasi S3 Client untuk Cloudflare R2
    const s3Client = new S3Client({
      region: "auto", // Cloudflare R2 menggunakan region 'auto'
      endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      // Explicitly use a static credential provider to prevent file system access
      credentials: fromStatic({
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      }),
      forcePathStyle: true, // Often needed for R2 compatibility
    });
    console.log("Edge Function: S3Client initialized for R2.");

    // 1. Download photo from Supabase Storage
    console.log("Edge Function: Attempting to download photo from Supabase URL:", supabasePhotoUrl);
    const response = await fetch(supabasePhotoUrl);
    if (!response.ok) {
      console.error(`Edge Function: Failed to download photo from Supabase: ${response.statusText}`);
      throw new Error(`Failed to download photo: ${response.statusText}`);
    }
    
    const photoBlob = await response.blob();
    const photoBuffer = await photoBlob.arrayBuffer();
    const photoUint8Array = new Uint8Array(photoBuffer);
    console.log("Edge Function: Photo downloaded successfully. Size:", photoUint8Array.length, "bytes.");

    // 2. Upload to R2 using AWS SDK
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const fileExtension = photoBlob.type.split('/').pop(); // Dapatkan ekstensi dari content-type
    const r2Key = `${userId}/${locationName.replace(/\s/g, '_')}_${timestamp}.${fileExtension}`;
    
    console.log("Edge Function: R2 Target Key:", r2Key);

    const putObjectCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      Body: photoUint8Array,
      ContentType: photoBlob.type, // Set content type
    });

    console.log("Edge Function: Attempting to upload to R2 using AWS SDK...");
    await s3Client.send(putObjectCommand);
    console.log("Edge Function: Photo uploaded to R2 successfully using AWS SDK.");

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