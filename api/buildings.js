import { createClient } from '@supabase/supabase-js';

const ALLOWED_FIELDS = [
  'school_name', 'building_name', 'gross_area', 'built_year',
  'seismic_capacity', 'seismic_reinforced', 'asbestos', 'safety_grade', 'evaluation_type'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '토큰 없음', reason: 'no_token' });
  const { data: { user }, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user) return res.status(401).json({ error: '인증 실패', reason: 'invalid_token', detail: userErr ? userErr.message : null });
  const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) return res.status(403).json({ error: '프로필 없음', reason: 'no_profile' });
  if (profile.role !== 'admin') return res.status(403).json({ error: '권한 없음', reason: 'not_admin', role: profile.role });

  if (req.method === 'GET') {
    const projectId = req.query.project_id;
    if (!projectId) return res.status(400).json({ error: 'project_id 필요' });
    const { data, error } = await sb.from('buildings').select('*').eq('project_id', projectId).order('legacy_id');
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ buildings: data });
  }

  if (req.method === 'POST') {
    const { action } = req.body || {};

    if (action === 'sync') {
      const { project_id, schools } = req.body;
      if (!project_id || !Array.isArray(schools)) return res.status(400).json({ error: 'project_id/schools 필요' });
      const { data: existing } = await sb.from('buildings').select('legacy_id').eq('project_id', project_id);
      const existingIds = new Set((existing || []).map(function (b) { return b.legacy_id; }));
      const toInsert = schools
        .filter(function (s) { return !existingIds.has(s.id); })
        .map(function (s) {
          return {
            project_id: project_id,
            legacy_id: s.id,
            school_name: s.school,
            building_name: s.building,
            region: s.region,
            area: s.area,
            school_type: s.type,
            updated_by: profile.id
          };
        });
      if (toInsert.length) {
        const { error } = await sb.from('buildings').insert(toInsert);
        if (error) return res.status(500).json({ error: error.message });
      }
      return res.json({ inserted: toInsert.length });
    }

    if (action === 'log_change') {
      const { building_id, field_name, new_value, evidence_url, source, note } = req.body;
      if (!building_id || !ALLOWED_FIELDS.includes(field_name)) {
        return res.status(400).json({ error: '잘못된 요청' });
      }
      const { data: building } = await sb.from('buildings').select(field_name).eq('id', building_id).single();
      if (!building) return res.status(404).json({ error: '대상동 없음' });
      const oldValue = building[field_name];
      const { error } = await sb.from('building_change_log').insert({
        building_id: building_id,
        field_name: field_name,
        old_value: oldValue === null || oldValue === undefined ? null : String(oldValue),
        new_value: String(new_value),
        evidence_url: evidence_url || null,
        source: source || null,
        note: note || null,
        confirmed_by: profile.id
      });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
