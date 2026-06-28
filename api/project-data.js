import { createClient } from '@supabase/supabase-js';

const RAW = 'https://raw.githubusercontent.com/yun9473/upload-system/main';

async function verifyToken(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Supabase JWT (관리자)
  if (token.startsWith('eyJ')) {
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user) return null;
    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (!profile) return null;
    return { role: profile.role, identifier: profile.display_name, isAdmin: true };
  }

  // 세션 토큰 (학교/발주청)
  const { data: session } = await sb.from('session_tokens')
    .select('*').eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();
  if (!session) return null;

  // 토큰 만료 연장 (30분)
  await sb.from('session_tokens').update({
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  }).eq('token', token);

  return session;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = await verifyToken(req);
  if (!session) return res.status(401).json({ error: '인증 필요' });

  const { action, id } = req.query;

  if (action === 'index') {
    const r = await fetch(`${RAW}/data/projects/index.json?_=${Date.now()}`);
    if (!r.ok) return res.status(502).json({ error: '프로젝트 목록 로드 실패' });
    let projects = await r.json();

    if (session.role === 'agency') {
      projects = projects.filter(p =>
        p.교육청 === session.identifier || p.교육청.includes(session.identifier)
      );
    }
    return res.json(projects);
  }

  if (action === 'load' && id) {
    const r = await fetch(`${RAW}/data/projects/${id}.json?_=${Date.now()}`);
    if (!r.ok) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    const proj = await r.json();
    return res.json(proj);
  }

  return res.status(400).json({ error: 'action 파라미터 필요 (index 또는 load)' });
}
