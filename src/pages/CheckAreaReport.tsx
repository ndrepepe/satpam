import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

const CheckAreaReport = () => {
  // [Semua kode komponen tetap sama...]
  
  return (
    // [JSX return tetap sama...]
  );
};

export default CheckAreaReport; // Pastikan ini adalah ekspor default