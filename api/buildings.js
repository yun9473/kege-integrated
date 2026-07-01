import { createClient } from '@supabase/supabase-js';

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

    const { data: fields, error: fieldsErr } = await sb
      .from('building_field_master').select('*').eq('active', true).order('display_order');
    if (fieldsErr) return res.status(500).json({ error: fieldsErr.message });

    const { data: buildings, error: bErr } = await sb
      .from('buildings').select('id, legacy_id, school_name, building_name, region, area, school_type')
      .eq('project_id', projectId).order('legacy_id');
    if (bErr) return res.status(500).json({ error: bErr.message });

    const buildingIds = (buildings || []).map(function (b) { return b.id; });
    let values = [];
    if (buildingIds.length) {
      const { data: v, error: vErr } = await sb
        .from('building_values').select('building_id, field_key, value, updated_at')
        .in('building_id', buildingIds);
      if (vErr) return res.status(500).json({ error: vErr.message });
      values = v || [];
    }

    const valuesByBuilding = {};
    values.forEach(function (v) {
      if (!valuesByBuilding[v.building_id]) valuesByBuilding[v.building_id] = {};
      valuesByBuilding[v.building_id][v.field_key] = { value: v.value, updated_at: v.updated_at };
    });

    const result = (buildings || []).map(function (b) {
      return Object.assign({}, b, { values: valuesByBuilding[b.id] || {} });
    });

    return res.json({ buildings: result, fields: fields || [] });
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

    if (action === 'log_changes') {
      const { building_id, changes, source, note } = req.body;
      if (!building_id || !Array.isArray(changes) || !changes.length) {
        return res.status(400).json({ error: '잘못된 요청' });
      }
      const { data: activeFields } = await sb.from('building_field_master').select('field_key').eq('active', true);
      const activeKeys = new Set((activeFields || []).map(function (f) { return f.field_key; }));
      const { data: currentValues } = await sb.from('building_values').select('field_key, value').eq('building_id', building_id);
      const currentByKey = {};
      (currentValues || []).forEach(function (v) { currentByKey[v.field_key] = v.value; });

      const rows = [];
      for (const c of changes) {
        if (!activeKeys.has(c.field_name)) continue;
        rows.push({
          building_id: building_id,
          field_name: c.field_name,
          old_value: currentByKey[c.field_name] != null ? currentByKey[c.field_name] : null,
          new_value: String(c.new_value),
          source: source || null,
          note: note || null,
          confirmed_by: profile.id
        });
      }
      if (!rows.length) return res.status(400).json({ error: '유효한 변경 항목 없음' });
      const { error } = await sb.from('building_change_log').insert(rows);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, count: rows.length });
    }

    if (action === 'field_add') {
      const { field_key, field_label, data_type, select_options } = req.body;
      if (!field_key || !field_label || !['text', 'number', 'boolean', 'select'].includes(data_type)) {
        return res.status(400).json({ error: '잘못된 요청' });
      }
      const { data: maxOrder } = await sb.from('building_field_master').select('display_order').order('display_order', { ascending: false }).limit(1).single();
      const { error } = await sb.from('building_field_master').insert({
        field_key: field_key,
        field_label: field_label,
        data_type: data_type,
        select_options: data_type === 'select' && Array.isArray(select_options) ? select_options : null,
        display_order: (maxOrder ? maxOrder.display_order : 0) + 1
      });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    if (action === 'field_remove') {
      const { field_key } = req.body;
      if (!field_key) return res.status(400).json({ error: 'field_key 필요' });
      const { error } = await sb.from('building_field_master').update({ active: false }).eq('field_key', field_key);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
