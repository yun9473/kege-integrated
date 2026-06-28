-- ═══════════════════════════════════════════════
-- KEGE 공간재구조화 연구 시스템 — Supabase DB 스키마
-- Supabase SQL Editor에서 실행하세요
-- ═══════════════════════════════════════════════

-- 1. 사용자 프로필 테이블 (Supabase Auth와 연동)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'agency', 'school')),
  display_name TEXT NOT NULL,
  region TEXT,          -- 교육청: 관할 시도 (예: '경기')
  school_id INTEGER,    -- 학교: SCHOOLS 배열의 id
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 본인 프로필만 조회 가능
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 관리자는 전체 프로필 조회 가능
CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. 세션 활동 로그 (30분 타임아웃 체크용)
CREATE TABLE IF NOT EXISTS session_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  last_active TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE session_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_own" ON session_activity
  FOR ALL USING (auth.uid() = user_id);

-- 3. 함수: 세션 타임아웃 체크 (30분)
CREATE OR REPLACE FUNCTION check_session_timeout(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM session_activity
    WHERE user_id = p_user_id
    AND last_active > now() - INTERVAL '30 minutes'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. 함수: 세션 갱신
CREATE OR REPLACE FUNCTION touch_session(p_user_id UUID)
RETURNS VOID AS $$
  INSERT INTO session_activity (user_id, last_active)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET last_active = now();
$$ LANGUAGE sql SECURITY DEFINER;

-- session_activity에 user_id UNIQUE 제약 추가
ALTER TABLE session_activity ADD CONSTRAINT session_activity_user_unique UNIQUE (user_id);
