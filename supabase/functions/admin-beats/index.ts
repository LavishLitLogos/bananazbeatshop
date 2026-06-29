import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Admin passcode - must match AdminGateway frontend check
const ADMIN_PASSCODE = 'rwmg25';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token, X-Client-Info, Apikey',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Verify admin token
  const adminToken = req.headers.get('X-Admin-Token');

  const VALID_ADMIN_CODES = new Set([
    'rwmg25',
    'GLOKEY',
  ]);

  if (!adminToken || !VALID_ADMIN_CODES.has(adminToken)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const body = req.method !== 'GET' ? await req.json() : {};

    // Beats CRUD
    if (url.pathname.includes('beats')) {
      switch (action) {
        case 'list': {
          const { data, error } = await supabase
            .from('beats')
            .select('*')
            .eq('hidden', false)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'create': {
          const { data, error } = await supabase
            .from('beats')
            .insert({ ...body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .select()
            .single();
          if (error) throw error;
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'update': {
          const { id, ...updates } = body;
          const { data, error } = await supabase
            .from('beats')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
          if (error) throw error;
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'delete': {
          const { id } = body;
          const { error } = await supabase.from('beats').delete().eq('id', id);
          if (error) throw error;
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        default:
          return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Prod By Songs CRUD
    if (url.pathname.includes('songs')) {
      switch (action) {
        case 'list': {
          const { data, error } = await supabase
            .from('prod_by_songs')
            .select('*')
            .eq('hidden', false)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'create': {
          const { data, error } = await supabase
            .from('prod_by_songs')
            .insert({ ...body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .select()
            .single();
          if (error) throw error;
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'update': {
          const { id, ...updates } = body;
          const { data, error } = await supabase
            .from('prod_by_songs')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
          if (error) throw error;
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'delete': {
          const { id } = body;
          const { error } = await supabase.from('prod_by_songs').delete().eq('id', id);
          if (error) throw error;
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        default:
          return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }


    // Beat Tapes CRUD
    if (url.pathname.includes('tapes')) {
      switch (action) {
        case 'list': {
          const { data, error } = await supabase
            .from('beat_tapes')
            .select('*, tracks:beat_tape_tracks(*)')
            .eq('hidden', false)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'create': {
          const { tracks = [], ...tapePayload } = body;
          const { data: tape, error } = await supabase
            .from('beat_tapes')
            .insert({ ...tapePayload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .select()
            .single();
          if (error) throw error;

          if (Array.isArray(tracks) && tracks.length > 0) {
            const trackRows = tracks
              .filter((track: any) => track.title && track.audio_file_url)
              .map((track: any, index: number) => ({
                tape_id: tape.id,
                title: track.title,
                audio_file_url: track.audio_file_url,
                track_order: track.track_order ?? index + 1,
              }));
            if (trackRows.length > 0) {
              const { error: trackError } = await supabase.from('beat_tape_tracks').insert(trackRows);
              if (trackError) throw trackError;
            }
          }

          return new Response(JSON.stringify(tape), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'update': {
          const { id, tracks, ...updates } = body;
          const { data, error } = await supabase
            .from('beat_tapes')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
          if (error) throw error;
          if (Array.isArray(tracks)) {
            await supabase.from('beat_tape_tracks').delete().eq('tape_id', id);
            const trackRows = tracks
              .filter((track: any) => track.title && track.audio_file_url)
              .map((track: any, index: number) => ({
                tape_id: id,
                title: track.title,
                audio_file_url: track.audio_file_url,
                track_order: track.track_order ?? index + 1,
              }));
            if (trackRows.length > 0) {
              const { error: trackError } = await supabase.from('beat_tape_tracks').insert(trackRows);
              if (trackError) throw trackError;
            }
          }
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        case 'delete': {
          const { id } = body;
          const { error } = await supabase.from('beat_tapes').delete().eq('id', id);
          if (error) throw error;
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        default:
          return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid endpoint' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('Admin function error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
