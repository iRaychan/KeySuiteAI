import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Supabase function environment is incomplete.');

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing login session.' }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user?.email) return json({ error: 'Invalid login session.' }, 401);

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const callerEmail = userData.user.email.toLowerCase();
    const { data: caller, error: callerError } = await service
      .from('ks_user_access')
      .select('email,role,active,company_id')
      .eq('email', callerEmail)
      .maybeSingle();
    if (callerError) throw callerError;
    if (!caller?.active || String(caller.role).toLowerCase() !== 'owner') return json({ error: 'Only the Owner can invite users.' }, 403);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const displayName = String(body.display_name ?? '').trim();
    const requestedRole = String(body.role ?? 'user').trim().toLowerCase();
    const redirectTo = String(body.redirect_to ?? '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'A valid email address is required.' }, 400);
    if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(requestedRole)) return json({ error: 'The selected role is invalid.' }, 400);

    const { data: target, error: targetError } = await service
      .from('ks_user_access')
      .select('email,active,company_id,role')
      .eq('email', email)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target?.active) return json({ error: 'Save the user as Active in KeySuite before sending an invitation.' }, 400);
    if (target.company_id !== caller.company_id) return json({ error: 'The user belongs to a different company.' }, 403);

    // V4.05.12: the saved KeySuite access row is the source of truth. This allows
    // owner-defined roles without hard-coding role names in the invite function.
    const role = String(target.role ?? requestedRole ?? 'user').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(role)) return json({ error: 'The saved user role is invalid.' }, 400);

    const invite = await service.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo || undefined,
      data: { display_name: displayName, role, company_id: caller.company_id },
    });

    if (invite.error) {
      const text = String(invite.error.message ?? '').toLowerCase();
      if (text.includes('already') || text.includes('registered') || text.includes('exists')) {
        return json({ status: 'already_exists', email });
      }
      throw invite.error;
    }
    return json({ status: 'invited', email });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
