import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the service role key
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

    // Fetch all users from auth.users
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      console.error("Error listing users:", usersError);
      return new Response(JSON.stringify({ error: usersError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Fetch all profiles from public.profiles
    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, id_number, role');

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return new Response(JSON.stringify({ error: profilesError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Combine user data with profile data
    const combinedPersonnel = profilesData.map(profile => {
      const user = usersData.users.find(u => u.id === profile.id);
      return {
        ...profile,
        email: user?.email || 'N/A',
      };
    });

    return new Response(JSON.stringify({ personnel: combinedPersonnel }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Edge Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});