import { verifyAuth, cors } from './_auth.js';
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const authUser = await verifyAuth(req);
  if (!authUser) return res.status(401).json({ error: '인증 필요' });
  const FMS_KEY = process.env.FMS_API_KEY;
  const { facilNm } = req.query;
  if (!facilNm) return res.status(400).json({ error: 'facilNm 파라미터 필요' });

  const url = 'https://apis.data.go.kr/B552016/PublicFacilSafetyMngService/getPublicFacilSafetyMngList'
    + '?ServiceKey=' + encodeURIComponent(FMS_KEY)
    + '&numOfRows=20&pageNo=1&type=json'
    + '&facilNm=' + encodeURIComponent(facilNm);

  try {
    const response = await fetch(url);
    const data = await response.json();
    return res.status(200).json(data);
  } catch(e) {
    return res.status(502).json({ error: e.message });
  }
}
