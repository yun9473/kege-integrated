-- kege-integrated 데이터 정합화 Phase 1c
-- 1) 기초자료 수신현황(O/X 체크리스트)을 로컬(브라우저) 저장소 대신 서버에 저장
-- 2) 기초자료 2단계(실제 값 입력) 권한을 계정별로 부여할 수 있는 컬럼 추가
-- Supabase SQL Editor에서 전체 복사 → 붙여넣기 → Run

alter table profiles add column if not exists can_edit_basic_data boolean default false;

create table if not exists basic_data_checklist (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  legacy_id int not null,
  item_key text not null,
  value text,
  updated_at timestamptz default now(),
  updated_by_role text,
  updated_by_label text,
  unique (project_id, legacy_id, item_key)
);

alter table basic_data_checklist enable row level security;
-- 이전과 동일하게 API(/api/checklist.js, 서비스키)를 통해서만 접근 — RLS는 켜두고 정책은 만들지 않음(기본 차단)

-- 참고: 학교/발주청 계정은 Supabase Auth가 아니라 session_tokens(레거시) 방식으로 인증하므로
-- updated_by를 auth.users 외래키로 걸지 않고, 역할/식별자를 텍스트로만 남깁니다.
