import { createClient } from '@supabase/supabase-js';
async function verifyToken(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (!t) return false;
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (t.startsWith('eyJ')) {
    const { data: { user } } = await sb.auth.getUser(t);
    return !!user;
  }
  const { data } = await sb.from('session_tokens').select('token').eq('token', t).gt('expires_at', new Date().toISOString()).single();
  if (data) await sb.from('session_tokens').update({ expires_at: new Date(Date.now()+30*60*1000).toISOString() }).eq('token', t);
  return !!data;
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!await verifyToken(req)) return res.status(401).json({ error: '인증 필요' });
  const NICE_KEY = process.env.NICE_API_KEY;
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q 파라미터 필요' });

  const url = 'https://open.neis.go.kr/hub/schoolInfo'
    + '?KEY=' + NICE_KEY
    + '&Type=json&pIndex=1&pSize=20'
    + '&SCHUL_NM=' + encodeURIComponent(q);

  try {
    const response = await fetch(url);
    const data = await response.json();
    return res.status(200).json(data);
  } catch(e) {
    return res.status(502).json({ error: e.message });
  }
}
