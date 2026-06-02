-- ============================================================================
-- CHECK DATABASE STRUCTURE
-- Run this first to see what tables exist and their columns
-- ============================================================================

-- 1. List all tables in public schema
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Check users table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 3. Check attendance table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'attendance'
ORDER BY ordinal_position;

-- 4. Check foreign key relationships for users table
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'users';

-- 5. Count records for the two users across tables
SELECT 
  'users' as table_name,
  COUNT(*) as record_count
FROM users
WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')

UNION ALL

SELECT 
  'attendance' as table_name,
  COUNT(*) as record_count
FROM attendance
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
)

UNION ALL

SELECT 
  'leave_requests' as table_name,
  COUNT(*) as record_count
FROM leave_requests
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
)

UNION ALL

SELECT 
  'short_leaves' as table_name,
  COUNT(*) as record_count
FROM short_leaves
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
)

UNION ALL

SELECT 
  'auth.users' as table_name,
  COUNT(*) as record_count
FROM auth.users
WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com');
