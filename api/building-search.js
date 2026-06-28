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
  const API_KEY = process.env.FMS_API_KEY;
  const { bldNm, siDo, siGunGu } = req.query;
  if (!bldNm) return res.status(400).json({ error: 'bldNm 파라미터 필요' });

  const params = new URLSearchParams({
    serviceKey: API_KEY,
    numOfRows: '10',
    pageNo: '1',
    _type: 'json',
    bldNm: bldNm,
  });
  if (siDo) params.append('siDo', siDo);
  if (siGunGu) params.append('siGunGu', siGunGu);

  const url = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo?' + params.toString();

  try {
    const response = await fetch(url);
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch(e) {
      return res.status(200).json({ items: [] });
    }
    const items = data?.response?.body?.items?.item || [];
    const arr = Array.isArray(items) ? items : [items];
    const result = arr.map(function(it) {
      return {
        bldNm: it.bldNm || '',
        platPlcNm: it.platPlcNm || it.newPlatPlcNm || '',
        useAprDay: it.useAprDay ? String(it.useAprDay).substring(0,4) : '',
        strctCdNm: it.strctCdNm || '',
        area: it.archArea || ''
      };
    }).filter(function(it){ return it.useAprDay; });
    return res.status(200).json({ items: result });
  } catch(e) {
    return res.status(502).json({ error: e.message });
  }
}
