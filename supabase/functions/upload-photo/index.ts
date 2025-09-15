/// <reference no-default-lib="true" lib="deno.ns" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'; // Updated to 2.45.0

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
    
    // Validasi input
    if (!userId || !locationId || !photoData || !contentType) {
      throw new Error('Missing required fields: userId, locationId, photoData, or contentType');
    }

    // Inisialisasi Supabase Client dengan service role key untuk akses penuh ke Storage
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // Menggunakan service role key
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const bytes = new Uint8Array(photoData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExt = contentType.split('/')[1] || 'jpeg';
    const filename = `uploads/${userId}/${locationId}-${timestamp}.${fileExt}`;
    const bucketName = 'satpam'; // Ganti dengan nama bucket Supabase Storage Anda

    // Upload ke Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filename, bytes, {
        contentType,
        upsert: false, // Jangan menimpa jika sudah ada
      });

    if (uploadError) {
      console.error("Supabase Storage upload error:", uploadError);
      throw new Error(`Failed to upload photo to Supabase Storage: ${uploadError.message}`);
    }

    // Dapatkan URL publik
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(filename);

    if (!publicUrl) {
      throw new Error("Failed to get public URL for the uploaded photo.");
    }

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