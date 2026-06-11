-- ============================================================================
-- MARK ALL MAY 2026 ATTENDANCE FOR TANMAY AS PRESENT AT 9:04 AM
-- ============================================================================
-- This marks all working days in May 2026 for malhotratanmay06@gmail.com
-- as present with check-in at 9:04 AM
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

-- Step 2: Check existing May 2026 attendance for this user
SELECT 
  'Existing May 2026 Attendance:' as info,
  a.date,
  a.check_in,
  a.check_out,
  a.status
FROM attendance a
WHERE a.employee_id = (SELECT id FROM users WHERE email = 'malhotratanmay06@gmail.com')
  AND a.date LIKE '2026-05-%'
ORDER BY a.date;

-- Step 3: Generate all dates in May 2026 and insert attendance
-- This will create attendance records for all days in May (1-31)
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
  TO_CHAR(day_date, 'YYYY-MM-DD') as date,
  (day_date + TIME '09:04:00') AT TIME ZONE 'Asia/Kolkata' as check_in,
  'present' as status,
  true as admin_marked,
  'Manually marked by admin for May 2026' as admin_reason,
  NOW() as created_at,
  NOW() as updated_at
FROM generate_series(
  '2026-05-01'::date,
  '2026-05-31'::date,
  '1 day'::interval
) as day_date
WHERE NOT EXISTS (
  -- Don't insert if attendance already exists for this date
  SELECT 1 FROM attendance a 
  WHERE a.employee_id = (SELECT id FROM users WHERE email = 'malhotratanmay06@gmail.com')
  AND a.date = TO_CHAR(day_date, 'YYYY-MM-DD')
);

-- Step 4: Update existing May 2026 records (if any already exist)
UPDATE attendance
SET 
  check_in = (date::date + TIME '09:04:00') AT TIME ZONE 'Asia/Kolkata',
  status = 'present',
  admin_marked = true,
  admin_reason = 'Manually marked by admin for May 2026',
  updated_at = NOW()
WHERE employee_id = (SELECT id FROM users WHERE email = 'malhotratanmay06@gmail.com')
  AND date LIKE '2026-05-%';

-- Step 5: Verify all May 2026 attendance was created
SELECT 
  'Final May 2026 Attendance:' as info,
  a.date,
  a.check_in,
  a.status,
  a.admin_marked
FROM attendance a
WHERE a.employee_id = (SELECT id FROM users WHERE email = 'malhotratanmay06@gmail.com')
  AND a.date LIKE '2026-05-%'
ORDER BY a.date;

-- Step 6: Count total days marked
SELECT 
  'Total May Days Marked:' as info,
  COUNT(*) as total_days
FROM attendance a
WHERE a.employee_id = (SELECT id FROM users WHERE email = 'malhotratanmay06@gmail.com')
  AND a.date LIKE '2026-05-%';

-- Expected: Should show 31 days (May 1-31, 2026) all marked as present at 09:04:00
