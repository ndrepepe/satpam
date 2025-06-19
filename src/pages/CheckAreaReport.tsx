// [Tambahkan kode sebelumnya sampai handleSubmitReport]

const handleSubmitReport = async () => {
  if (!user || !locationId || !photoFile || !locationName) {
    const errorMsg = "Data tidak lengkap. Pastikan: " + 
      (!user ? "Anda sudah login" : 
       !locationId ? "Lokasi terdeteksi" : 
       !photoFile ? "Foto sudah diambil" : "");
    setError(errorMsg);
    toast.error(errorMsg);
    return;
  }

  setLoading(true);
  setError(null);

  try {
    // 1. Upload ke Supabase Storage sementara
    const fileExtension = photoFile.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('check-area-photos')
      .upload(filePath, photoFile, {
        contentType: photoFile.type,
        upsert: false
      });

    if (uploadError) throw uploadError;

    // 2. Panggil Edge Function
    const { data, error: edgeError } = await supabase.functions.invoke('upload-to-r2', {
      body: {
        supabasePhotoUrl: supabase.storage
          .from('check-area-photos')
          .getPublicUrl(filePath).data.publicUrl,
        userId: user.id,
        locationName,
        supabaseFilePath: filePath
      },
    });

    if (edgeError) throw edgeError;
    if (!data?.success) throw new Error(data?.error || 'Upload ke R2 gagal');

    toast.success("Laporan berhasil dikirim!");
    navigate('/satpam-dashboard');
    
  } catch (err: any) {
    console.error("Error:", err);
    const errorMessage = err.message.includes('The resource already exists') 
      ? 'Foto dengan nama yang sama sudah ada' 
      : err.message || 'Gagal mengirim laporan';
    
    setError(errorMessage);
    toast.error(errorMessage);
  } finally {
    setLoading(false);
  }
};

// [Lanjutkan dengan kode render yang sama]