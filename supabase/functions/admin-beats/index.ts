import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const FUNCTION_NAME = 'admin-beats';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '',
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token, X-Client-Info, Apikey',
};

function responseJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function fail(step: string, error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  return responseJson(
    {
      ok: false,
      function: FUNCTION_NAME,
      step,
      error: message,
    },
    status,
  );
}

function success(record: unknown) {
  return responseJson({
    ok: true,
    function: FUNCTION_NAME,
    record,
  });
}

function requireAdminToken(req: Request) {
  const adminToken = req.headers.get('X-Admin-Token');
  const validAdminCodes = new Set(['rwmg25', 'GLOKEY']);

  if (!adminToken || !validAdminCodes.has(adminToken)) {
    throw new Error('Unauthorized');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    requireAdminToken(req);
  } catch (error) {
    return fail('require_admin_token', error, 401);
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const body = req.method !== 'GET' ? await req.json() : {};

    if (url.pathname.includes('beats')) {
      switch (action) {
        case 'list': {
          const { data, error } = await supabase
            .from('beats')
            .select('*')
            .eq('hidden', false)
            .order('created_at', { ascending: false });
          if (error) return fail('beats_list', error, 500);
          return success(data);
        }

        case 'create': {
          const { data, error } = await supabase
            .from('beats')
            .insert({ ...body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .select()
            .single();
          if (error) return fail('beats_create', error, 500);
          return success(data);
        }

        case 'update': {
          const { id, ...updates } = body as Record<string, unknown>;
          const { data, error } = await supabase
            .from('beats')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
          if (error) return fail('beats_update', error, 500);
          return success(data);
        }

        case 'delete': {
          const { id } = body as Record<string, unknown>;
          const { error } = await supabase.from('beats').delete().eq('id', id);
          if (error) return fail('beats_delete', error, 500);
          return success({ id, deleted: true });
        }
      }
    }

    if (url.pathname.includes('songs')) {
      switch (action) {
        case 'list': {
          const { data, error } = await supabase
            .from('prod_by_songs')
            .select('*')
            .eq('hidden', false)
            .order('created_at', { ascending: false });
          if (error) return fail('songs_list', error, 500);
          return success(data);
        }

        case 'create': {
          const { data, error } = await supabase
            .from('prod_by_songs')
            .insert({ ...body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .select()
            .single();
          if (error) return fail('songs_create', error, 500);
          return success(data);
        }

        case 'update': {
          const { id, ...updates } = body as Record<string, unknown>;
          const { data, error } = await supabase
            .from('prod_by_songs')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
          if (error) return fail('songs_update', error, 500);
          return success(data);
        }

        case 'delete': {
          const { id } = body as Record<string, unknown>;
          const { error } = await supabase.from('prod_by_songs').delete().eq('id', id);
          if (error) return fail('songs_delete', error, 500);
          return success({ id, deleted: true });
        }
      }
    }

    if (url.pathname.includes('tapes')) {
      switch (action) {
        case 'list': {
          const { data, error } = await supabase
            .from('beat_tapes')
            .select('*, tracks:beat_tape_tracks(*)')
            .eq('hidden', false)
            .order('created_at', { ascending: false });
          if (error) return fail('tapes_list', error, 500);
          return success(data);
        }

        case 'create': {
          const { tracks = [], ...tapePayload } = body as Record<string, any>;
          const { data: tape, error } = await supabase
            .from('beat_tapes')
            .insert({ ...tapePayload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .select()
            .single();
          if (error) return fail('tapes_create', error, 500);

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
              if (trackError) return fail('tapes_create_tracks', trackError, 500);
            }
          }

          return success(tape);
        }

        case 'update': {
          const { id, tracks, ...updates } = body as Record<string, any>;
          const { data, error } = await supabase
            .from('beat_tapes')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
          if (error) return fail('tapes_update', error, 500);

          if (Array.isArray(tracks)) {
            const { error: deleteTracksError } = await supabase.from('beat_tape_tracks').delete().eq('tape_id', id);
            if (deleteTracksError) return fail('tapes_replace_tracks_delete', deleteTracksError, 500);

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
              if (trackError) return fail('tapes_replace_tracks_insert', trackError, 500);
            }
          }

          return success(data);
        }

        case 'delete': {
          const { id } = body as Record<string, unknown>;
          const { error } = await supabase.from('beat_tapes').delete().eq('id', id);
          if (error) return fail('tapes_delete', error, 500);
          return success({ id, deleted: true });
        }
      }
    }

    return fail('route_match', 'Invalid endpoint or action.', 400);
  } catch (error) {
    return fail('unhandled', error, 500);
  }
});
