import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = "https://gxbzdhrhlhrjdgzcfzbw.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4YnpkaHJobGhyamRnemNmemJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MzM2OTgsImV4cCI6MjA5NDIwOTY5OH0.O-bZUcNF_RFTGwrt9HkciQdcZ0LN7NB3j0nE2eOI3tQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);