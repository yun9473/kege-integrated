export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
};

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!await verifyToken(req)) return res.status(401).json({ error: '인증 필요' });

  const { paUrl, fileName, folderPath, fileContent } = req.body;

  if (!paUrl || !fileName || !folderPath || !fileContent) {
    return res.status(400).json({ error: '필수 파라미터 누락' });
  }

  try {
    const response = await fetch(paUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, folderPath, fileContent }),
    });

    if (response.ok) {
      return res.status(200).json({ ok: true });
    } else {
      const text = await response.text().catch(() => '');
      return res.status(response.status).json({ error: text.slice(0, 200) });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
