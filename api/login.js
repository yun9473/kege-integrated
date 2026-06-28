import { createClient } from '@supabase/supabase-js';

const RAW = 'https://raw.githubusercontent.com/yun9473/upload-system/main';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { type, id, pw } = req.body || {};
  if (!type || !id || !pw) return res.status(400).json({ error: '필수 항목 누락' });

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (type === 'school') {
    const schoolPw = process.env.SCHOOL_PW || '1234';
    if (pw !== schoolPw) return res.status(401).json({ error: '비밀번호가 틀렸습니다.' });

    // 프로젝트에서 학교 검색
    let indexRes;
    try {
      indexRes = await fetch(`${RAW}/data/projects/index.json?_=${Date.now()}`);
    } catch (e) {
      return res.status(502).json({ error: '서버 연결 오류' });
    }
    if (!indexRes.ok) return res.status(502).json({ error: '프로젝트 목록 로드 실패: HTTP ' + indexRes.status });
    const projects = await indexRes.json();
    if (!Array.isArray(projects) || projects.length === 0) {
      return res.status(502).json({ error: '프로젝트 목록 비어있음', raw: JSON.stringify(projects).substring(0, 200) });
    }

    const errors = [];
    for (const meta of projects) {
      try {
        const r = await fetch(`${RAW}/data/projects/${meta.id}.json?_=${Date.now()}`);
        if (!r.ok) { errors.push(`${meta.id}: HTTP ${r.status}`); continue; }
        const proj = await r.json();
        const normalId = id.normalize('NFC');
        const keys = Object.keys(proj.codes || {});
        const matchKey = keys.find(k => k.normalize('NFC') === normalId);
        if (!matchKey) {
          const hex = k => [...k].map(c => c.charCodeAt(0).toString(16)).join(' ');
          errors.push(`id_hex=${hex(normalId)} first_key_hex=${keys[0]?hex(keys[0].normalize('NFC')):'none'} keys=${keys.length}`);
        }
        if (matchKey) {
          const { data: token, error } = await sb.from('session_tokens').insert({
            role: 'school',
            identifier: id,
            project_id: meta.id,
          }).select('token').single();
          if (error) return res.status(500).json({ error: 'DB오류: ' + error.message });

          return res.json({
            token: token.token,
            role: 'school',
            visIds: proj.codes[matchKey],
            projectId: meta.id,
            label: `학교 (${id})`,
          });
        }
      } catch (e) { errors.push(`${meta.id}: ${e.message}`); continue; }
    }
    return res.status(401).json({ error: '학교명이 올바르지 않습니다.', debug: errors });
  }

  if (type === 'agency') {
    const agencyPw = process.env.AGENCY_PW || '12345';
    if (pw !== agencyPw) return res.status(401).json({ error: '비밀번호가 틀렸습니다.' });

    let indexRes;
    try {
      indexRes = await fetch(`${RAW}/data/projects/index.json?_=${Date.now()}`);
    } catch (e) {
      return res.status(502).json({ error: '서버 연결 오류' });
    }
    if (!indexRes.ok) return res.status(502).json({ error: '프로젝트 목록 로드 실패' });
    const projects = await indexRes.json();
    const nid = id.normalize('NFC');
    const matching = projects.filter(p => {
      const office = (p.교육청||'').normalize('NFC');
      return office === nid || office.includes(nid);
    });
    if (matching.length === 0) return res.status(401).json({ error: '해당 교육청의 프로젝트가 없습니다.' });

    // 토큰 발급 (프로젝트 미지정 — 클라이언트가 선택)
    const { data: token, error } = await sb.from('session_tokens').insert({
      role: 'agency',
      identifier: id,
    }).select('token').single();
    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      token: token.token,
      role: 'agency',
      projects: matching,
      label: `발주청 (${id})`,
    });
  }

  return res.status(400).json({ error: '지원하지 않는 로그인 유형' });
}
