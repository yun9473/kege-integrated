import { createClient } from '@supabase/supabase-js';

async function verifyToken(req, sb) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;

  // Supabase JWT (관리자)
  if (token.startsWith('eyJ')) {
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user) return null;
    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (!profile) return null;
    return { role: profile.role, label: profile.display_name || profile.role };
  }

  // 세션 토큰 (학교/발주청)
  const { data: session } = await sb.from('session_tokens')
    .select('*').eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();
  if (!session) return null;

  await sb.from('session_tokens').update({
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  }).eq('token', token);

  return { role: session.role, label: session.identifier };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const session = await verifyToken(req, sb);
  if (!session) return res.status(401).json({ error: '인증 필요' });

  if (req.method === 'GET') {
    const projectId = req.query.project_id;
    if (!projectId) return res.status(400).json({ error: 'project_id 필요' });
    const { data, error } = await sb
      .from('basic_data_checklist').select('*').eq('project_id', projectId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data || [] });
  }

  if (req.method === 'POST') {
    const { action, project_id, items } = req.body || {};
    if (action === 'bulk_set') {
      if (!project_id || !Array.isArray(items) || !items.length) {
        return res.status(400).json({ error: '잘못된 요청' });
      }
      const rows = items.map(function (it) {
        return {
          project_id: project_id,
          legacy_id: it.legacy_id,
          item_key: it.item_key,
          value: it.value == null ? null : String(it.value),
          updated_at: new Date().toISOString(),
          updated_by_role: session.role,
          updated_by_label: session.label
        };
      });
      const { error } = await sb.from('basic_data_checklist')
        .upsert(rows, { onConflict: 'project_id,legacy_id,item_key' });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, count: rows.length });
    }
    return res.status(400).json({ error: 'unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
