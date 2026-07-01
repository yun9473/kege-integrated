export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      paUrl: process.env.PA_URL || '',
      basePath: process.env.BASE_PATH || '',
      neisKey: process.env.NEIS_KEY || '',
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
      vworldKey: process.env.VWORLD_API_KEY || '',
    });
  }

  if (req.method === 'POST') {
    // 관리자가 설정 저장 시 → Vercel 환경변수는 대시보드에서만 변경 가능하므로
    // localStorage에만 저장 (기존 방식 유지)
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
