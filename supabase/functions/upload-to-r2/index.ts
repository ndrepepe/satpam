import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.621.0'; // Mengganti modul presign dengan AWS SDK S3

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Edge Function: Received request.");
    const { userId, locationName, supabasePhotoUrl, photoId } = await req.json();

    if (!userId || !locationName || !supabasePhotoUrl || !photoId) {
      return new Response(JSON.stringify({ error: 'Missing userId, locationName, supabasePhotoUrl, or photoId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !CLOUDFLARE_ACCOUNT_ID) {
      console.error("Edge Function: Missing R2 credentials or Cloudflare Account ID.");
      return new Response(JSON.stringify({ error: 'Missing R2 credentials or Cloudflare Account ID' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    console.log("Edge Function: R2 credentials found.");
    console.log(`Edge Function: Received request for userId: ${userId} locationName: ${locationName}`);

    // 1. Download photo from Supabase Storage
    console.log(`Edge Function: Attempting to download photo from Supabase URL: ${supabasePhotoUrl}`);
    const photoResponse = await fetch(supabasePhotoUrl);
    if (!photoResponse.ok) {
      throw new Error(`Failed to download photo from Supabase Storage: ${photoResponse.statusText}`);
    }
    const photoBuffer = await photoResponse.arrayBuffer();
    console.log(`Edge Function: Photo downloaded successfully. Size: ${photoBuffer.byteLength} bytes.`);

    // 2. Upload to Cloudflare R2 using AWS SDK
    const bucketName = 'satpam'; // Your R2 bucket name
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const r2TargetKey = `${userId}/${locationName.replace(/\s/g, '_')}_${timestamp}.jpeg`; // Pastikan nama kunci valid
    const contentType = 'image/jpeg'; // Asumsi JPEG, sesuaikan jika perlu

    console.log(`Edge Function: R2 Target Key: ${r2TargetKey}`);

    const s3Client = new S3Client({
      region: 'auto', // R2 menggunakan 'auto' atau wilayah spesifik jika Anda mengaturnya
      endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true, // Penting untuk kompatibilitas R2
    });

    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: r2TargetKey,
      Body: new Uint8Array(photoBuffer), // Konversi ArrayBuffer ke Uint8Array
      ContentType: contentType,
    });

    console.log("Edge Function: Before sending PutObjectCommand to R2.");
    const r2UploadResponse = await s3Client.send(putCommand);
    console.log("Edge Function: After sending PutObjectCommand. Response:", JSON.stringify(r2UploadResponse));

    if (r2UploadResponse.$metadata.httpStatusCode !== 200) {
      throw new Error(`Failed to upload photo to R2. Status: ${r2UploadResponse.$metadata.httpStatusCode}`);
    }
    console.log("Edge Function: Photo uploaded to R2 successfully.");

    // 3. Delete photo from Supabase Storage
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Gunakan service role key untuk operasi admin
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { error: deleteError } = await supabaseClient.storage
      .from('check-area-photos')
      .remove([`${userId}/${photoId}`]); // Gunakan photoId asli (nama file)

    if (deleteError) {
      console.error("Edge Function: Error deleting photo from Supabase Storage:", deleteError);
      // Jangan lempar error di sini, karena unggahan R2 sudah berhasil. Cukup log.
    } else {
      console.log("Edge Function: Photo deleted from Supabase Storage successfully.");
    }

    // 4. Return R2 public URL
    const r2PublicUrl = `https://pub-${CLOUDFLARE_ACCOUNT_ID}.r2.dev/${bucketName}/${r2TargetKey}`; // Format URL Publik R2
    console.log(`Edge Function: R2 Public URL: ${r2PublicUrl}`);

    return new Response(JSON.stringify({ r2PublicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Edge Function: Caught error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});