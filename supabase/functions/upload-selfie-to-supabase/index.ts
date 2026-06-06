/// <reference path="../../../src/deno-types.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-location-id, x-file-name',
};

serve(async (req) => {
  // Tangani preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Ambil metadata dari header kustom
    const userId = req.headers.get('x-user-id');
    const locationId = req.headers.get('x-location-id');
    const fileName = req.headers.get('x-file-name');
    const contentType = req.headers.get('Content-Type') || 'image/jpeg';

    if (!userId || !locationId || !fileName) {
      throw new Error('Metadata file (User ID, Location ID, atau File Name) tidak ditemukan di header.');
    }

    // Baca body sebagai biner mentah (Uint8Array)
    const photoBuffer = await req.arrayBuffer();
    const photoData = new Uint8Array(photoBuffer);

    if (photoData.length === 0) {
      throw new Error('Data foto kosong.');
    }

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

    const bucketName = 'satpam';

    // Upload biner ke Supabase Storage (Melewati RLS karena menggunakan Service Role Key)
    const { data, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, photoData, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error(`Gagal menyimpan ke storage: ${uploadError.message}`);
    }

    // Dapatkan URL publik
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({ success: true, publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (err: any) {
    console.error("Edge Function error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});