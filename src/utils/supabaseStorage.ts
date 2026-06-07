"use client";

import { supabase } from '@/integrations/supabase/client';

/**
 * Mengunggah file ke Supabase Storage melalui Edge Function menggunakan payload biner ArrayBuffer
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

    // Menentukan struktur path berdasarkan jumlah bagian (patroli biasa vs apar)
    if (parts.length === 3) {
      userId = parts[1];
      locationIdWithTimestamp = parts[2];
    } else if (parts.length === 4) {
      userId = parts[2];
      locationIdWithTimestamp = parts[3];
    } else {
      throw new Error(`Format path file tidak didukung: ${fileName}`);
    }

    const locationId = locationIdWithTimestamp.split('-')[0];

    // Konversi Blob ke ArrayBuffer (Lebih stabil untuk transmisi biner antar browser)
    const arrayBuffer = await fileBlob.arrayBuffer();

    console.log(`[Supabase Storage] Mengirim biner (${arrayBuffer.byteLength} bytes) ke Edge Function...`);

    // Memanggil Edge Function
    const { data, error } = await supabase.functions.invoke('upload-selfie-to-supabase', {
      body: arrayBuffer,
      headers: {
        'x-user-id': userId,
        'x-location-id': locationId,
        'x-file-name': fileName,
        'Content-Type': contentType
      }
    });

    if (error) {
      console.error("[Supabase Storage] Error dari Edge Function:", error);
      // Mencoba membaca detail error jika ada
      const errorMsg = error.message || (typeof error === 'object' ? JSON.stringify(error) : "Unknown Function Error");
      throw new Error(errorMsg);
    }

    if (!data?.publicUrl) {
      console.error("[Supabase Storage] Respon tidak mengandung publicUrl:", data);
      throw new Error("Respon server tidak lengkap (publicUrl kosong).");
    }

    return data.publicUrl;
  } catch (error: any) {
    console.error("[Supabase Storage] Gagal mengunggah:", error);
    
    // Memberikan pesan error yang informatif ke UI
    let friendlyMessage = "Gagal mengirim laporan ke server.";
    if (error.message?.includes('failed to fetch')) {
      friendlyMessage += " Koneksi ke server terputus atau diblokir (CORS/Firewall).";
    } else {
      friendlyMessage += ` Detail: ${error.message}`;
    }
    
    throw new Error(friendlyMessage);
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