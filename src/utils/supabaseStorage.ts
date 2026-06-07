"use client";

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { supabase } from '@/integrations/supabase/client';

/**
 * Mengunggah file ke Supabase Storage melalui Edge Function menggunakan fetch manual
 * Cara ini jauh lebih stabil untuk perangkat mobile dibandingkan menggunakan SDK invoke.
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
      throw new Error(`Format path tidak didukung: ${fileName}`);
    }

    const locationId = locationIdWithTimestamp.split('-')[0];
    const functionUrl = `${SUPABASE_URL}/functions/v1/upload-selfie-to-supabase`;

    console.log(`[Supabase Storage] Mengunggah biner secara manual ke: ${functionUrl}`);

    // Menggunakan fetch manual untuk kontrol penuh dan stabilitas maksimal di mobile
    const response = await fetch(functionUrl, {
      method: 'POST',
      body: fileBlob,
      headers: {
        'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'x-user-id': userId,
        'x-location-id': locationId,
        'x-file-name': fileName,
        'Content-Type': contentType
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Supabase Storage] Server merespon dengan error:", errorText);
      throw new Error(`Server Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (!data?.publicUrl) {
      throw new Error("Respon server tidak mengandung publicUrl.");
    }

    return data.publicUrl;
  } catch (error: any) {
    console.error("[Supabase Storage] Kegagalan kritis pengunggahan:", error);
    
    let msg = "Gagal mengirim laporan ke server.";
    if (error.message?.includes('failed to fetch') || error.name === 'TypeError') {
      msg += " Masalah jaringan atau ukuran file terlalu besar untuk koneksi Anda.";
    } else {
      msg += ` Detail: ${error.message}`;
    }
    
    throw new Error(msg);
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