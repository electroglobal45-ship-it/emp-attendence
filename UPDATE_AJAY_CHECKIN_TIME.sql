-- ============================================================================
-- UPDATE AJAY'S CHECK-IN TIME
-- Today: 9:03 AM
-- Yesterday: 9:05 AM
-- ============================================================================

-- Step 1: Check current attendance for Ajay
SELECT 
  'Current Attendance for Ajay:' as info,
  u.email,
  u.name,
  a.date,
  a.check_in,
  a.status
FROM attendance a
JOIN users u ON a.employee_id = u.id
WHERE u.email = 'ajay@electroglobal.com'
  AND (a.date = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') 
    OR a.date = TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD'))
ORDER BY a.date;

-- Step 2: Update TODAY's check-in to 9:03 AM and status to present
UPDATE attendance
SET 
  check_in = (CURRENT_DATE + TIME '09:03:00') AT TIME ZONE 'Asia/Kolkata',
  status = 'present',
  updated_at = NOW()
WHERE employee_id = (SELECT id FROM users WHERE email = 'ajay@electroglobal.com')
  AND date = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');

-- Step 3: Update YESTERDAY's check-in to 9:05 AM and status to present
UPDATE attendance
SET 
  check_in = ((CURRENT_DATE - INTERVAL '1 day')::date + TIME '09:05:00') AT TIME ZONE 'Asia/Kolkata',
  status = 'present',
  updated_at = NOW()
WHERE employee_id = (SELECT id FROM users WHERE email = 'ajay@electroglobal.com')
  AND date = TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD');

-- Step 4: Verify the changes
SELECT 
  'Updated Attendance:' as info,
  u.email,
  u.name,
  a.date,
  a.check_in,
  a.status,
  CASE 
    WHEN a.date = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') THEN 'TODAY (should be 09:03:00)'
    WHEN a.date = TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD') THEN 'YESTERDAY (should be 09:05:00)'
    ELSE 'Other date'
  END as note
FROM attendance a
JOIN users u ON a.employee_id = u.id
WHERE u.email = 'ajay@electroglobal.com'
  AND (a.date = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') 
    OR a.date = TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD'))
ORDER BY a.date;

-- Expected: 
-- Today (2026-06-02) should show check_in at 09:03:00
-- Yesterday (2026-06-01) should show check_in at 09:05:00
