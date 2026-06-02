-- SQL queries to diagnose the dhruv account issue
-- Run these in Supabase SQL Editor to investigate

-- 1. Check if dhruv account exists and is active
SELECT 
  id,
  email,
  name,
  role,
  is_active,
  created_at,
  updated_at
FROM users
WHERE email = 'dhruvelectroglobal@gmail.com';

-- 2. Check all attendance records for dhruv
SELECT 
  id,
  employee_id,
  date,
  check_in,
  status,
  selfie_url,
  gps_data,
  created_at
FROM attendance
WHERE employee_id = (
  SELECT id FROM users WHERE email = 'dhruvelectroglobal@gmail.com'
)
ORDER BY date DESC
LIMIT 20;

-- 3. Check if there are multiple users with similar emails (cleverness check)
SELECT 
  id,
  email,
  name,
  is_active
FROM users
WHERE email ILIKE '%dhruv%' OR name ILIKE '%dhruv%';

-- 4. Check Supabase Auth users table for dhruv
SELECT 
  id,
  email,
  email_confirmed_at,
  last_sign_in_at,
  created_at
FROM auth.users
WHERE email = 'dhruvelectroglobal@gmail.com';

-- 5. Check if multiple auth users share the same email (should not happen)
SELECT email, COUNT(*) as count
FROM auth.users
WHERE email = 'dhruvelectroglobal@gmail.com'
GROUP BY email
HAVING COUNT(*) > 1;

-- 6. Check session audit logs (if table exists)
SELECT 
  user_id,
  email,
  action,
  ip_address,
  user_agent,
  created_at
FROM session_audit
WHERE email = 'dhruvelectroglobal@gmail.com'
ORDER BY created_at DESC
LIMIT 50;
