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
    const { schedulesData } = await req.json(); // Expecting [{ date: 'YYYY-MM-DD', userId: 'uuid' }]

    if (!schedulesData || !Array.isArray(schedulesData) || schedulesData.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or empty schedules data provided.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
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

    // Fetch all locations to assign to
    const { data: locations, error: locationsError } = await supabaseAdmin
      .from('locations')
      .select('id');

    if (locationsError) {
      console.error("Error fetching locations in Edge Function:", locationsError);
      return new Response(JSON.stringify({ error: locationsError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!locations || locations.length === 0) {
      return new Response(JSON.stringify({ error: 'No locations found to assign schedules to.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const locationIds = locations.map(loc => loc.id);
    const schedulesToInsert = [];

    // Fetch existing schedules to prevent duplicates for the same user on the same date
    const uniqueScheduleDates = [...new Set(schedulesData.map((s: any) => s.date))];
    const uniqueUserIds = [...new Set(schedulesData.map((s: any) => s.userId))];

    const { data: existingSchedules, error: existingSchedulesError } = await supabaseAdmin
      .from('schedules')
      .select('user_id, schedule_date')
      .in('schedule_date', uniqueScheduleDates)
      .in('user_id', uniqueUserIds);

    if (existingSchedulesError) {
      console.error("Error fetching existing schedules:", existingSchedulesError);
      return new Response(JSON.stringify({ error: existingSchedulesError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const existingScheduleSet = new Set(existingSchedules?.map(s => `${s.user_id}-${s.schedule_date}`));

    for (const entry of schedulesData) {
      const { date, userId } = entry;
      if (existingScheduleSet.has(`${userId}-${date}`)) {
        console.warn(`Skipping duplicate schedule for user ${userId} on date ${date}`);
        continue; // Skip if already scheduled
      }
      for (const locationId of locationIds) {
        schedulesToInsert.push({
          schedule_date: date,
          user_id: userId,
          location_id: locationId,
        });
      }
    }

    if (schedulesToInsert.length === 0) {
      return new Response(JSON.stringify({ message: 'No new schedules to insert (all duplicates or no locations).' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from('schedules')
      .insert(schedulesToInsert);

    if (insertError) {
      console.error("Error during bulk insert:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ message: 'Schedules inserted successfully.' }), {
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