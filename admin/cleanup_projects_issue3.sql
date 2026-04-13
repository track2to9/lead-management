-- Issue #3: youngmin.k@gmail.com 계정의 진행중/mockup 프로젝트 정리
-- 완료된 프로젝트는 유지, 진행중인 것들 중 최신 1건만 남김
--
-- 실행 전: SELECT로 확인 후 DELETE 실행할 것!

-- 1. 확인: 현재 youngmin.k@gmail.com 계정의 모든 프로젝트
SELECT p.id, p.name, p.status, p.created_at, au.email
FROM projects p
JOIN auth.users au ON au.id = p.user_id
WHERE au.email = 'youngmin.k@gmail.com'
ORDER BY p.created_at DESC;

-- 2. 완료된 것 외 진행중 프로젝트에서 최신 1건만 남기고 삭제
-- (아래 블록은 위 SELECT 결과 확인 후 수동 실행 권장)

-- WITH latest_active AS (
--   SELECT p.id
--   FROM projects p
--   JOIN auth.users au ON au.id = p.user_id
--   WHERE au.email = 'youngmin.k@gmail.com'
--     AND p.status NOT IN ('completed')
--   ORDER BY p.created_at DESC
--   LIMIT 1
-- )
-- DELETE FROM projects
-- WHERE id IN (
--   SELECT p.id
--   FROM projects p
--   JOIN auth.users au ON au.id = p.user_id
--   WHERE au.email = 'youngmin.k@gmail.com'
--     AND p.status NOT IN ('completed')
--     AND p.id NOT IN (SELECT id FROM latest_active)
-- );
