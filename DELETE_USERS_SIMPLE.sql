-- ============================================================================
-- SIMPLE USER DELETION SCRIPT
-- Deletes users: dhruvelectroglobal@gmail.com and malhotratanmay06@gmail.com
-- ============================================================================
-- IMPORTANT: Run this entire script in Supabase SQL Editor
-- It will delete all data associated with these users
-- ============================================================================

-- Step 1: Check if users exist and get their IDs
SELECT 
  'Users to delete:' as info,
  id, 
  email, 
  name, 
  role,
  created_at
FROM users 
WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com');

-- Step 1b: Check auth.users
SELECT 
  'Auth users to delete:' as info,
  id,
  email,
  created_at
FROM auth.users
WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com');

-- Step 2: Delete attendance records
DELETE FROM attendance 
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Step 3: Delete leave requests
DELETE FROM leave_requests 
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Step 4: Delete short leaves
DELETE FROM short_leaves 
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Step 5: Delete working day opt-ins
DELETE FROM working_day_opt_ins 
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Step 6: Delete from users table
DELETE FROM users 
WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com');

-- Step 7: Delete from Supabase Auth (auth.users)
DELETE FROM auth.users 
WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com');

-- Step 8: Force logout all sessions for these users
DELETE FROM auth.sessions 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Step 9: Verify deletion
SELECT 'Users remaining in users table:' as status, COUNT(*) as count
FROM users 
WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com');

SELECT 'Users remaining in auth.users:' as status, COUNT(*) as count
FROM auth.users 
WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com');

SELECT 'Sessions remaining:' as status, COUNT(*) as count
FROM auth.sessions
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Expected: All counts should be 0

-- Step 10: Show all remaining users (to verify cleanup)
SELECT 
  'Remaining users:' as info,
  id,
  email,
  name,
  role
FROM users
ORDER BY created_at DESC;
