"use client";

import { supabase } from '@/integrations/supabase/client';

/**
 * Mengunggah file Blob/File ke Supabase Storage di dalam bucket 'satpam'
 */
export const uploadToSupabase = async (
  fileBlob: Blob,
  fileName: string,
  contentType: string
): Promise<string> => {
  const bucketName = 'satpam';

  // Unggah file ke Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, fileBlob, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error("[Supabase Storage] Gagal mengunggah:", error);
    throw new Error(`Gagal mengunggah ke Supabase Storage: ${error.message}`);
  }

  // Dapatkan URL publik file
  const { data: { publicUrl } } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  return publicUrl;
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