import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 인라인 인증 체크
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(403).json({ error: '관리자 권한 필요' });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(403).json({ error: '관리자 권한 필요' });
  const { data: authUser } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!authUser || authUser.role !== 'admin') return res.status(403).json({ error: '관리자 권한 필요' });

  if (req.method === 'GET') {
    const { data: profiles, error } = await supabase
      .from('profiles').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const { data: { users } } = await supabase.auth.admin.listUsers();
    const merged = (profiles || []).map(p => {
      const u = users.find(u => u.id === p.id);
      return { ...p, email: u ? u.email : '(알 수 없음)' };
    });
    return res.json({ users: merged });
  }

  if (req.method === 'POST') {
    const { action, email, password, role: userRole, display_name, region, school_id, userId } = req.body || {};

    if (action === 'create') {
      if (!email || !password || !userRole || !display_name) {
        return res.status(400).json({ error: '필수 항목 누락 (email, password, role, display_name)' });
      }
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) return res.status(400).json({ error: createErr.message });

      const { error: profileErr } = await supabase.from('profiles').insert({
        id: newUser.user.id,
        role: userRole,
        display_name,
        region: region || null,
        school_id: school_id ? Number(school_id) : null,
      });
      if (profileErr) return res.status(500).json({ error: profileErr.message });
      return res.json({ success: true, id: newUser.user.id });
    }

    if (action === 'delete') {
      if (!userId) return res.status(400).json({ error: 'userId 필요' });
      await supabase.from('profiles').delete().eq('id', userId);
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    if (action === 'set_permission') {
      const { can_edit_basic_data } = req.body;
      if (!userId || typeof can_edit_basic_data !== 'boolean') {
        return res.status(400).json({ error: 'userId/can_edit_basic_data 필요' });
      }
      const { error } = await supabase.from('profiles')
        .update({ can_edit_basic_data: can_edit_basic_data }).eq('id', userId);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'unknown action' });
  }

  return res.status(405).end();
}
