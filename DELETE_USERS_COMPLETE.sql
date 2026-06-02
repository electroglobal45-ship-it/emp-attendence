-- ============================================================================
-- COMPLETE USER DELETION SCRIPT
-- Deletes users: dhruvelectroglobal@gmail.com and malhotratanmay06@gmail.com
-- Removes ALL data from ALL tables including Supabase Auth
-- ============================================================================
-- ⚠️ WARNING: This action is IRREVERSIBLE. All data will be permanently deleted.
-- ============================================================================

-- Run this in Supabase SQL Editor

BEGIN;

-- Step 1: Get the user IDs from email
DO $$
DECLARE
  dhruv_id UUID;
  tanmay_id UUID;
BEGIN
  -- Get Dhruv's ID
  SELECT id INTO dhruv_id FROM users WHERE email = 'dhruvelectroglobal@gmail.com';
  IF dhruv_id IS NOT NULL THEN
    RAISE NOTICE 'Found Dhruv ID: %', dhruv_id;
  ELSE
    RAISE NOTICE 'Dhruv user not found';
  END IF;

  -- Get Tanmay's ID
  SELECT id INTO tanmay_id FROM users WHERE email = 'malhotratanmay06@gmail.com';
  IF tanmay_id IS NOT NULL THEN
    RAISE NOTICE 'Found Tanmay ID: %', tanmay_id;
  ELSE
    RAISE NOTICE 'Tanmay user not found';
  END IF;
END $$;

-- ============================================================================
-- Step 2: Delete from all application tables (CASCADE will handle most)
-- ============================================================================

-- Delete attendance records
DELETE FROM attendance 
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Delete leave requests
DELETE FROM leave_requests 
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Delete short leaves
DELETE FROM short_leaves 
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Delete working day opt-ins
DELETE FROM working_day_opt_ins 
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Delete session audit logs (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'session_audit') THEN
    DELETE FROM session_audit 
    WHERE user_id IN (
      SELECT id FROM users 
      WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
    );
    RAISE NOTICE 'Deleted from session_audit';
  END IF;
END $$;

-- Delete project memberships (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'project_members') THEN
    DELETE FROM project_members 
    WHERE user_id IN (
      SELECT id FROM users 
      WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
    );
    RAISE NOTICE 'Deleted from project_members';
  END IF;
END $$;

-- Delete task assignments (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'task_assignments') THEN
    DELETE FROM task_assignments 
    WHERE user_id IN (
      SELECT id FROM users 
      WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
    );
    RAISE NOTICE 'Deleted from task_assignments';
  END IF;
END $$;

-- Delete tasks created by these users (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tasks') THEN
    DELETE FROM tasks 
    WHERE created_by IN (
      SELECT id FROM users 
      WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
    );
    RAISE NOTICE 'Deleted from tasks';
  END IF;
END $$;

-- Delete task comments (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'task_comments') THEN
    DELETE FROM task_comments 
    WHERE user_id IN (
      SELECT id FROM users 
      WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
    );
    RAISE NOTICE 'Deleted from task_comments';
  END IF;
END $$;

-- ============================================================================
-- Step 3: Delete from users table
-- ============================================================================

DELETE FROM users 
WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com');

-- ============================================================================
-- Step 4: Delete from Supabase Auth tables
-- ============================================================================

-- Delete auth sessions
DELETE FROM auth.sessions 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Delete refresh tokens
DELETE FROM auth.refresh_tokens 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Delete identity data
DELETE FROM auth.identities 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Delete from auth.users (main auth table)
DELETE FROM auth.users 
WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com');

-- ============================================================================
-- Step 5: Verify deletion
-- ============================================================================

-- Check if users still exist in users table
SELECT 'Users table check:' as status, COUNT(*) as remaining_users 
FROM users 
WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com');

-- Check if users still exist in auth.users
SELECT 'Auth.users check:' as status, COUNT(*) as remaining_auth_users 
FROM auth.users 
WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com');

-- Check remaining attendance records
SELECT 'Attendance check:' as status, COUNT(*) as remaining_records 
FROM attendance 
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

COMMIT;

-- ============================================================================
-- Expected Output:
-- All counts should be 0
-- If any count is > 0, some data remains
-- ============================================================================

-- Summary query to confirm complete deletion
SELECT 
  'DELETION COMPLETE' as status,
  (SELECT COUNT(*) FROM users WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')) as users_remaining,
  (SELECT COUNT(*) FROM auth.users WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')) as auth_users_remaining;
