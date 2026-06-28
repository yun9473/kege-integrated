export async function verifyAuth(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user) return null;
    const { data: profile } = await sb
      .from('profiles').select('*').eq('id', user.id).single();
    if (!profile) return null;
    sb.rpc('touch_session', { p_user_id: user.id }).catch(function(){});
    return profile;
  } catch(e) { return null; }
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
