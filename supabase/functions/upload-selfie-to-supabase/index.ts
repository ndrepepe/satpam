import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, locationId, photoData, contentType } = await req.json();
    
    if (!userId || !locationId || !photoData || !contentType) {
      throw new Error('Missing required fields: userId, locationId, photoData, or contentType.');
    }

    // Inisialisasi Supabase Client dengan service role key untuk akses penuh ke Storage
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const bytes = new Uint8Array(photoData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExt = contentType.split('/')[1] || 'jpg';
    const filename = `uploads/${userId}/${locationId}-${timestamp}.${fileExt}`;
    const bucketName = 'satpam'; // Ganti dengan nama bucket Supabase Storage Anda

    // Upload ke Supabase Storage
    const { data, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filename, bytes, {
        contentType,
        upsert: false, // Jangan menimpa jika sudah ada
      });

    if (uploadError) {
      console.error("Supabase Storage upload error:", uploadError);
      throw new Error(`Failed to upload photo to Supabase Storage: ${uploadError.message}`);
    }

    // Dapatkan URL publik dari file yang diunggah
    const { data: { publicUrl }, error: publicUrlError } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(filename);

    if (publicUrlError) {
      console.error("Supabase Storage getPublicUrl error:", publicUrlError);
      throw new Error(`Failed to get public URL for uploaded photo: ${publicUrlError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
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