"use client";

import { supabase } from '@/integrations/supabase/client';

/**
 * Mengunggah file Blob/File ke Supabase Storage melalui Edge Function untuk menghindari error RLS
 */
export const uploadToSupabase = async (
  fileBlob: Blob,
  fileName: string,
  contentType: string
): Promise<string> => {
  try {
    // Ekstrak userId dan locationId dari path fileName secara otomatis
    // Format 1: uploads/USER_ID/LOCATION_ID-TIMESTAMP.jpg
    // Format 2: uploads/apar/USER_ID/APAR_ID-TIMESTAMP.jpg
    const parts = fileName.split('/');
    let userId = '';
    let locationIdWithTimestamp = '';

    if (parts.length === 3) {
      userId = parts[1];
      locationIdWithTimestamp = parts[2];
    } else if (parts.length === 4) {
      userId = parts[2];
      locationIdWithTimestamp = parts[3];
    } else {
      throw new Error("Format nama file tidak dikenali.");
    }

    const locationId = locationIdWithTimestamp.split('-')[0];

    // Konversi Blob menjadi Array Byte (Uint8Array) agar bisa dikirim via JSON ke Edge Function
    const arrayBuffer = await fileBlob.arrayBuffer();
    const byteArray = Array.from(new Uint8Array(arrayBuffer));

    console.log(`[Supabase Storage] Mengunggah via Edge Function untuk User: ${userId}, Lokasi: ${locationId}`);

    // Panggil Edge Function yang menggunakan Service Role Key (Bypass RLS)
    const { data, error } = await supabase.functions.invoke('upload-selfie-to-supabase', {
      body: {
        userId,
        locationId,
        photoData: byteArray,
        contentType
      }
    });

    if (error) {
      throw error;
    }

    if (!data || !data.publicUrl) {
      throw new Error("Gagal mendapatkan URL publik dari Edge Function.");
    }

    return data.publicUrl;
  } catch (error: any) {
    console.error("[Supabase Storage] Gagal mengunggah via Edge Function:", error);
    throw new Error(`Gagal mengunggah foto: ${error.message}`);
  }
};

/**
 * Membuat Signed URL untuk file dari Supabase Storage jika bucket bersifat privat,
 * atau mengembalikan URL asli jika terjadi kegagalan.
 */
export const getSupabaseSignedUrl = async (photoUrl: string): Promise<string> => {
  if (!photoUrl) return "";
  const bucketName = 'satpam';

  try {
    const urlObj = new URL(photoUrl);
    // Ekstrak path file setelah nama bucket di URL Supabase Storage
    const searchPattern = `/storage/v1/object/public/${bucketName}/`;
    const pathParts = urlObj.pathname.split(searchPattern);

    if (pathParts.length > 1) {
      const filePath = decodeURIComponent(pathParts[1]);
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 3600); // Berlaku selama 1 jam

      if (error) throw error;
      return data.signedUrl;
    }
    
    return photoUrl;
  } catch (error) {
    console.warn("[Supabase Storage] Gagal membuat signed URL, menggunakan URL publik asli:", error);
    return photoUrl;
  }
};