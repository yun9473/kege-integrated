-- kege-integrated 데이터 정합화 Phase 1
-- Supabase SQL Editor에서 전체 복사 → 붙여넣기 → Run

create table if not exists buildings (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  legacy_id int not null,
  school_name text,
  building_name text,
  region text,
  area text,
  school_type text,
  gross_area numeric,
  built_year int,
  extension_history jsonb,
  seismic_capacity boolean,
  seismic_reinforced boolean,
  asbestos boolean,
  safety_grade text,
  evaluation_type text check (evaluation_type in ('개축', '리모델링')),
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id),
  unique (project_id, legacy_id)
);

create table if not exists building_change_log (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings(id) on delete cascade,
  field_name text not null check (field_name in (
    'school_name', 'building_name', 'gross_area', 'built_year',
    'seismic_capacity', 'seismic_reinforced', 'asbestos', 'safety_grade', 'evaluation_type'
  )),
  old_value text,
  new_value text,
  evidence_url text,
  source text,
  note text,
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz default now()
);

create or replace function apply_change_log()
returns trigger as $$
begin
  if new.field_name in ('seismic_capacity', 'seismic_reinforced', 'asbestos') then
    execute format('update buildings set %I = $1, updated_at = now(), updated_by = $2 where id = $3', new.field_name)
      using (new.new_value::boolean), new.confirmed_by, new.building_id;
  elsif new.field_name = 'gross_area' then
    execute format('update buildings set %I = $1, updated_at = now(), updated_by = $2 where id = $3', new.field_name)
      using (new.new_value::numeric), new.confirmed_by, new.building_id;
  elsif new.field_name = 'built_year' then
    execute format('update buildings set %I = $1, updated_at = now(), updated_by = $2 where id = $3', new.field_name)
      using (new.new_value::int), new.confirmed_by, new.building_id;
  else
    execute format('update buildings set %I = $1, updated_at = now(), updated_by = $2 where id = $3', new.field_name)
      using new.new_value, new.confirmed_by, new.building_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_apply_change on building_change_log;
create trigger trg_apply_change
after insert on building_change_log
for each row execute function apply_change_log();

alter table buildings enable row level security;
alter table building_change_log enable row level security;
-- 이 두 테이블은 웹페이지에서 직접 접근하지 않고 /api/buildings.js(서버 쪽, 서비스키 사용)를 통해서만 접근합니다.
-- RLS만 켜두고 별도 정책(policy)을 만들지 않으면, 브라우저 쪽 키로는 기본적으로 아무것도 볼 수 없는 안전한 상태가 됩니다.
