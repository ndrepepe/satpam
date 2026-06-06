"use client";

import { supabase } from '@/integrations/supabase/client';

/**
 * Mengunggah file ke Supabase Storage melalui Edge Function menggunakan payload biner (sangat efisien)
 */
export const uploadToSupabase = async (
  fileBlob: Blob,
  fileName: string,
  contentType: string
): Promise<string> => {
  try {
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
      throw new Error("Format path file tidak didukung.");
    }

    const locationId = locationIdWithTimestamp.split('-')[0];

    console.log(`[Supabase Storage] Mengirim biner ke Edge Function...`);

    // Mengirim file sebagai biner mentah (bukan JSON) agar koneksi stabil dan ringan
    const { data, error } = await supabase.functions.invoke('upload-selfie-to-supabase', {
      body: fileBlob,
      headers: {
        'x-user-id': userId,
        'x-location-id': locationId,
        'x-file-name': fileName,
        'Content-Type': contentType
      }
    });

    if (error) throw error;
    if (!data?.publicUrl) throw new Error("Respon fungsi tidak valid.");

    return data.publicUrl;
  } catch (error: any) {
    console.error("[Supabase Storage] Gagal mengunggah:", error);
    throw new Error(`Gagal mengirim laporan ke server. Pastikan koneksi internet stabil.`);
  }
};

/**
 * Membuat Signed URL untuk file privat
 */
export const getSupabaseSignedUrl = async (photoUrl: string): Promise<string> => {
  if (!photoUrl) return "";
  const bucketName = 'satpam';

  try {
    const urlObj = new URL(photoUrl);
    const searchPattern = `/storage/v1/object/public/${bucketName}/`;
    const pathParts = urlObj.pathname.split(searchPattern);

    if (pathParts.length > 1) {
      const filePath = decodeURIComponent(pathParts[1]);
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 3600);

      if (error) throw error;
      return data.signedUrl;
    }
    
    return photoUrl;
  } catch (error) {
    return photoUrl;
  }
};