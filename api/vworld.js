export default async function handler(req, res) {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat/lng required' });

  const key = process.env.VWORLD_API_KEY;
  if (!key) return res.status(500).json({ error: 'API key not configured' });

  const delta = 0.0002;
  const bbox = `${parseFloat(lng)-delta},${parseFloat(lat)-delta},${parseFloat(lng)+delta},${parseFloat(lat)+delta}`;

  const url = `https://api.vworld.kr/req/wfs?service=WFS&version=2.0.0&request=GetFeature` +
    `&typeName=lt_c_uq111&output=application/json&srsName=EPSG:4326` +
    `&bbox=${bbox},EPSG:4326&key=${key}`;

  try {
    const r = await fetch(url, {
      headers: {
        'Referer': 'https://kege-integrated.vercel.app',
        'Origin': 'https://kege-integrated.vercel.app'
      }
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      return res.status(502).json({ error: 'vworld error', status: r.status, body, url: url.replace(key, 'HIDDEN') });
    }
    const data = await r.json();

    const features = data?.features || [];
    if (!features.length) return res.json({ found: false });

    // 가장 작은 면적의 용도지역 (좌표 포인트에 가장 정확한 것)
    const feat = features[0];
    const props = feat.properties || {};
    const uqName = props.uq_nm || props.UQ_NM || '';  // 용도지역명

    res.json({ found: true, uqName });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
