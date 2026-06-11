-- ============================================================================
-- MARK TODAY'S ATTENDANCE FOR TANMAY AS PRESENT AT 9:04 AM
-- ============================================================================
-- This marks today (June 2, 2026) for malhotratanmay06@gmail.com as present
-- ============================================================================

-- Step 1: Check if user exists
SELECT 
  'User Info:' as info,
  id, 
  email, 
  name, 
  role
FROM users 
WHERE email = 'malhotratanmay06@gmail.com';

-- Step 2: Mark today's attendance as present
INSERT INTO attendance (
  employee_id,
  date,
  check_in,
  status,
  admin_marked,
  admin_reason,
  created_at,
  updated_at
)
SELECT 
  (SELECT id FROM users WHERE email = 'malhotratanmay06@gmail.com') as employee_id,
  TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') as date,
  (CURRENT_DATE + TIME '09:04:00') AT TIME ZONE 'Asia/Kolkata' as check_in,
  'present' as status,
  true as admin_marked,
  'Manually marked by admin at 9:04 AM' as admin_reason,
  NOW() as created_at,
  NOW() as updated_at
WHERE NOT EXISTS (
  -- Don't insert if attendance already exists for today
  SELECT 1 FROM attendance a 
  WHERE a.employee_id = (SELECT id FROM users WHERE email = 'malhotratanmay06@gmail.com')
  AND a.date = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')
);

-- Step 3: Update if already exists
UPDATE attendance
SET 
  check_in = (CURRENT_DATE + TIME '09:04:00') AT TIME ZONE 'Asia/Kolkata',
  status = 'present',
  admin_marked = true,
  admin_reason = 'Manually marked by admin at 9:04 AM',
  updated_at = NOW()
WHERE employee_id = (SELECT id FROM users WHERE email = 'malhotratanmay06@gmail.com')
  AND date = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');

-- Step 4: Verify today's attendance
SELECT 
  'Today''s Attendance:' as info,
  u.email,
  u.name,
  a.date,
  a.check_in,
  a.status,
  a.admin_marked
FROM attendance a
JOIN users u ON a.employee_id = u.id
WHERE u.email = 'malhotratanmay06@gmail.com'
  AND a.date = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');

-- Expected: Should show today marked as present at 09:04:00
