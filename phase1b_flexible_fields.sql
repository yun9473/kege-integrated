-- kege-integrated 데이터 정합화 Phase 1b — 항목을 코드가 아니라 데이터로 관리
-- Supabase SQL Editor에서 전체 복사 → 붙여넣기 → Run
-- (phase1_migration.sql을 이미 실행했다는 전제 하에 이어서 실행하는 마이그레이션)

create table if not exists building_field_master (
  field_key text primary key,
  field_label text not null,
  data_type text not null check (data_type in ('text', 'number', 'boolean', 'select')),
  select_options text[],
  display_order int default 0,
  active boolean default true
);

insert into building_field_master (field_key, field_label, data_type, select_options, display_order) values
  ('gross_area',         '연면적',            'number',  null, 1),
  ('built_year',         '준공연도',          'number',  null, 2),
  ('seismic_capacity',   '내진성능유무',      'boolean', null, 3),
  ('seismic_reinforced', '내진보강여부',      'boolean', null, 4),
  ('asbestos',           '석면유무',          'boolean', null, 5),
  ('safety_grade',       '안전등급',          'select',  array['A','B1','B2','B3','B4','C1','C2','C3','C4','D','E'], 6),
  ('evaluation_type',    '개축/리모델링',      'select',  array['개축','리모델링'], 7)
on conflict (field_key) do nothing;

create table if not exists building_values (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings(id) on delete cascade,
  field_key text references building_field_master(field_key),
  value text,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id),
  unique (building_id, field_key)
);

alter table building_change_log drop constraint if exists building_change_log_field_name_check;
alter table building_change_log drop constraint if exists building_change_log_field_name_fk;
alter table building_change_log
  add constraint building_change_log_field_name_fk
  foreign key (field_name) references building_field_master(field_key);

-- 트리거를 dynamic SQL(execute format) 없는 방식으로 재작성 — building_values에 upsert만 함
create or replace function apply_change_log()
returns trigger as $$
begin
  insert into building_values (building_id, field_key, value, updated_at, updated_by)
  values (new.building_id, new.field_name, new.new_value, now(), new.confirmed_by)
  on conflict (building_id, field_key)
  do update set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return new;
end;
$$ language plpgsql;

alter table building_field_master enable row level security;
alter table building_values enable row level security;
-- 이전과 동일하게 API(/api/buildings.js, 서비스키)를 통해서만 접근 — RLS는 켜두고 정책은 만들지 않음(기본 차단)

-- 참고: buildings 테이블의 gross_area/built_year/seismic_capacity/seismic_reinforced/asbestos/safety_grade/
-- evaluation_type 컬럼은 더 이상 사용하지 않습니다(값은 이제 building_values에 저장). 컬럼 자체는 그냥 둬도
-- 문제 없지만, 나중에 완전히 정리하고 싶으면 별도로 알려주시면 drop 구문 만들어 드리겠습니다.
