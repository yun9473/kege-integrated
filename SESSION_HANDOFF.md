# 공간재구조화 연구 시스템 — 작업 총정리

## 프로젝트 정보
- **파일**: `C:\Users\gram\kege-integrated\index.html` (단일 HTML SPA, ~9000줄)
- **GitHub**: `https://github.com/yun9473/kege-integrated.git` (master, Vercel 배포)
- **사이트**: `https://kege-integrated.vercel.app`
- **역할**: 한국교육녹색환경연구원 교육환경센터 통합 시스템

---

## 이번 세션에서 완료한 작업

### 1. 모바일 반응형 레이아웃
- `@media(max-width:768px)` CSS 전면 추가
- 로그인/모듈 선택: 1열 배치, 폰트 축소
- 기초자료 수신: 사이드바→가로탭, sticky 고정, 학교목록 모바일 숨김
- 대시보드: 차트 1열, KPI 2열, 모달 바텀시트
- 상단 topbar: 텍스트 ellipsis 처리

### 2. 아이콘 변경
- 기초자료 수신 → 종이비행기(DM), 연구 진행 → 책, 학교/발주청 → 종이비행기

### 3. 지도 버블 시스템 (MarkerClusterer 교체)
- `_mapClusterer` 제거 → CustomOverlay 버블
- 줌 10+: 시도별 버블 / 줌 7-9: 시군구별 버블 / 줌 6 이하: 개별 마커
- 버블 겹침 방지 (픽셀 기반 충돌 감지)
- 버블에 위험 비율 % 표시
- 시도 클릭 → `setBounds`로 전체 시군구 표시
- 버블 색상: 위험(danger)만 카운트 (경계 제외)

### 4. 시도 경계 GeoJSON 폴리곤
- `data/sido-boundaries.json` (516KB, 17개 시도)
- 시도 버블 클릭 시 반투명 파란 폴리곤 표시
- 줌 아웃 시 자동 해제

### 5. 지도 대작업 9개
- **범례 클릭 → 학교 리스트 패널** → 클릭 시 지도 이동 (`mapShowSchoolListByGrade`, `mapPanToSchool`)
- **학교명 검색**: 상단 검색창 + 드롭다운 (`mapSearchSchools`)
- **줌인 마커 표시 수정**: 버블→마커 전환 시 강제 재렌더
- **마커 클릭 → 동별 리스트**: InfoWindow에 등급/준공/안전+경과 분해
- **좌측 시군구 클릭 → 학교 목록**: `mapShowSggDangerList`
- **지역별 비교 학교 수**: `_mapData`→`_mapSchools` 기준 변경
- **지도 탭 레이아웃**: `mapSwitchSub` 높이 관리 수정
- **학교 상세 위험도 시각화**: 총점 바 + 안전/경과 분해

### 6. 대시보드 탭 전환 스코프 수정
- `switchTab`이 `#module-dashboard` 내부로 한정 (다른 모듈 탭 간섭 방지)

### 7. 알림 이메일 관리
- **메일 관리 탭 분리**: 사이드바에 독립 "메일 관리" 탭 (관리자 전용)
- **이메일 전용 PA URL**: `localStorage`에 별도 저장 (`getEmailPaUrl()`)
- **학교별 이메일 테이블**: 프로젝트 SCHOOLS 기반, Excel 일괄 등록/내보내기
- **일괄 선택/해제 버튼**
- **D-Day 설정 + D-7/D-3/D-1 체크박스**
- **이메일 템플릿**: 제목/본문 편집, 변수 `{school}`, `{building}`, `{deadline}`, `{day}`
- **발송 미리보기**: 제목/본문 프리뷰, 미제출 현황(실배치도/사전인터뷰), 본문 편집 가능
- **발송하기 버튼**: 확인 후 바로 발송
- **발송 완료 알림**: alert 팝업
- **HTML 이메일**: 줄바꿈/볼드/마감일 강조/링크 변환
- **발송 이력 로그**
- **미제출 항목 자동 포함**: `emailGetMissing(sid)` → CHECKLIST의 `schoolReq` 항목 체크

### 8. Power Automate 흐름
- **알림이메일_발송** 흐름 새로 생성 (기존 파일 업로드 흐름과 별도)
- 트리거: HTTP 요청이 수신된 경우 (JSON 스키마: action/to/subject/body/school)
- 작업: Office 365 Outlook 메일 보내기(V2)
- **주의**: "괜히 그럴 수 있는 게 누구?" → "모든 사용자"로 변경 필요

### 9. 기타 수정
- 연구 진행 상단 여백 80px→32px
- 학교 카드 클릭 시 업로드 영역으로 자동 스크롤
- 모듈/탭 전환 시 scrollTo(0,0)

---

## 미해결 이슈 (새 세션에서 수정 필요)

### 🔴 모듈 전환 버그 (가장 중요)
- **증상**: 개축타당성 데이터베이스 → 지도현황 → 연구 진행 탭 클릭 시, 연구 진행 화면이 안 나오고 지도가 계속 보임
- **시도한 것**: `switchModule`에서 `.module-panel` active 제거 + inline `display:none` 강제, 대시보드 탭 초기화, 지도 전체화면 해제 — 모두 해결 안 됨
- **원인 추정**: `module-dashboard`가 `display:none`이어도 내부 지도 컨테이너가 화면을 덮는 것으로 보임. Kakao Maps 컨테이너가 position 관련 스타일을 변경하거나, `#tab-map > .main`의 인라인 스타일이 남아있을 수 있음
- **파일 위치**: `switchModule` 함수 line ~2521, `mapSwitchSub` 함수 line ~8543

### 🟡 지도 추가 작업 (메모해둔 것)
1. 시도 경계 GeoJSON 폴리곤 — 구현 완료, 추후 시군구 경계 추가 가능
2. 범례 클릭 학교 리스트 — 구현 완료
3. 학교명 검색 — 구현 완료
4. 줌인 마커 — 부분 수정, 추가 테스트 필요
5. 학교 마커 동 리스트 — 구현 완료
6. 좌측 시군구 클릭 — 구현 완료
7. 지역별 비교 학교 수 — 구현 완료
8. 버블 % — 구현 완료
9. 탭 레이아웃 — 부분 수정, 위 모듈 전환 버그와 연관
10. 학교 상세 위험도 — 구현 완료

### 🟡 이메일 발송 테스트
- Power Automate 흐름은 생성 완료
- 사이트에서 발송 시 변수 치환 정상 작동 확인
- 실제 이메일 수신 여부 추가 테스트 필요

---

## 주요 함수/변수 위치 (line 번호는 변동 가능)

| 함수/변수 | 설명 |
|-----------|------|
| `switchModule(mod, el)` ~2521 | 모듈 전환 (upload/dashboard/research) |
| `switchTab(id, el)` ~4841 | 대시보드 내부 탭 전환 |
| `mapSwitchSub(view)` ~8543 | 지도현황/지역별비교 전환 |
| `enterModule(mod)` ~3172 | 모듈 선택 화면에서 진입 |
| `emailDoSend(targets,...)` ~4405 | 이메일 발송 |
| `emailGetMissing(sid)` ~4357 | 미제출 필수 항목 조회 |
| `emailBuildTable()` ~4246 | 이메일 테이블 빌드 |
| `getEmailPaUrl()` ~4283 | 이메일 전용 PA URL |
| `CHECKLIST` ~2608 | 체크리스트 항목 (schoolReq로 필수 구분) |
| `SCHOOLS` ~2541 | 학교/건물 목록 |
| `_mapObj`, `_mapData`, `_mapSchools` | 지도 전역 변수 |
| `_bubbleSidoAgg`, `_bubbleSggAgg` | 버블 집계 데이터 |
| `mapBuildBubbleAgg()` | 버블 집계 데이터 생성 |
| `_createBubble()` | 버블 DOM 생성 |
| `_renderBubbles()` | 뷰포트 내 버블 렌더링 |
| `_spreadBubbles()` | 버블 겹침 방지 |
| `mapHighlightSido()` | 시도 경계 폴리곤 표시 |
| `mapCreateMarker(d)` | 개별 학교 마커 생성 |
| `_doUpdateViewport()` | 줌별 버블/마커 분기 렌더링 |

---

## 모듈 구조

```
screen-login → screen-module-select (admin) / screen-screen-select (school/agency)
screen-app:
  ├── integrated-nav (기초자료 수신 관리 | 개축타당성 데이터베이스 | 연구 진행)
  ├── module-upload (sidebar + screens: upload/status/email/admin)
  │     ├── screen-upload (파일 업로드)
  │     ├── screen-status (수신 현황)
  │     ├── screen-email (메일 관리) ← 새로 추가
  │     └── screen-admin (관리자 설정)
  ├── module-dashboard (header + tab-bar + tab-contents)
  │     ├── tab-overview (전체 개요)
  │     ├── tab-analysis (심층 분석)
  │     ├── tab-search (통합 검색)
  │     ├── tab-edu (교육청별 총괄)
  │     ├── tab-predict (사업 예측 모델)
  │     └── tab-map (지도 현황 — mapSubView-map / mapSubView-region)
  └── module-research (보고서 작성 | 증축이력 조사)
```

## API/서버

| 경로 | 용도 |
|------|------|
| `/api/proxy.js` | Power Automate 프록시 |
| `/api/save-project.js` | GitHub API로 프로젝트 JSON 저장 |
| `/api/building-search.js` | 건축물대장 API |
| `/api/fms-proxy.js` | 시설물 안전관리 API |
| `/api/school-search.js` | NEIS 학교검색 API |
| `data/geo-cache.json` | 학교 주소→좌표 캐시 |
| `data/sido-boundaries.json` | 시도 경계 GeoJSON |
