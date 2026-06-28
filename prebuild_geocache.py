"""CSV 고유 주소 추출 → Kakao REST API 좌표 변환 → geo-cache.json 생성"""
import sys, csv, json, time, os
sys.stdout.reconfigure(encoding='utf-8')

try:
    import requests
except ImportError:
    os.system(sys.executable + ' -m pip install requests')
    import requests

CSV_PATH = r'D:\전국 학교정보 (1950년이전, 100헤베 이하 삭제).csv'
OUTPUT = r'C:\Users\gram\kege-integrated\data\geo-cache.json'
KAKAO_KEY = '25ae0c7c8645b6a47989ca839f19729a'

def log(msg):
    print(msg, flush=True)

# 1. CSV에서 고유 주소 추출
addresses = set()
with open(CSV_PATH, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        addr = row.get('도로명주소', '').strip()
        if addr:
            addresses.add(addr)
log(f'고유 주소: {len(addresses)}건')

# 2. 기존 캐시 로드
cache = {}
if os.path.exists(OUTPUT):
    with open(OUTPUT, 'r', encoding='utf-8') as f:
        cache = json.load(f)
    log(f'기존 캐시: {len(cache)}건')

# 3. 변환 필요한 주소
todo = [a for a in addresses if a not in cache]
log(f'변환 필요: {len(todo)}건')

if not todo:
    log('변환할 주소 없음. 완료.')
    sys.exit(0)

# 4. Kakao REST API 변환
headers = {'Authorization': f'KakaoAK {KAKAO_KEY}'}
success = 0
fail = 0

for i, addr in enumerate(todo):
    try:
        resp = requests.get(
            'https://dapi.kakao.com/v2/local/search/address.json',
            params={'query': addr},
            headers=headers,
            timeout=5
        )
        data = resp.json()
        if data.get('documents'):
            doc = data['documents'][0]
            cache[addr] = [float(doc['y']), float(doc['x'])]
            success += 1
        else:
            fail += 1
    except:
        fail += 1

    if (i + 1) % 100 == 0 or i == len(todo) - 1:
        pct = round((i + 1) / len(todo) * 100)
        log(f'  {i+1}/{len(todo)} ({pct}%) 성공:{success} 실패:{fail}')
        with open(OUTPUT, 'w', encoding='utf-8') as f:
            json.dump(cache, f, ensure_ascii=False)

    time.sleep(0.035)

with open(OUTPUT, 'w', encoding='utf-8') as f:
    json.dump(cache, f, ensure_ascii=False)

log(f'완료: {len(cache)}건 → {OUTPUT}')
