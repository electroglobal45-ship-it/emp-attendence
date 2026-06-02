# QUICK FIX: 401 Unauthorized on Deployed App

## The Problem
You're seeing 401/500 errors because you're logged in as `dhruvelectroglobal@gmail.com`, which is the account that should have been deleted but wasn't.

## Immediate Solution (No Database Access Required)

### Option 1: Force Logout and Create Fresh Account
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Run these commands:
```javascript
// Clear all authentication data
localStorage.clear()
sessionStorage.clear()
```
4. Refresh the page (F5)
5. You should see the login screen
6. **Do NOT login yet!** First delete the old users from database

### Option 2: Delete from Supabase Dashboard (Recommended)
1. Go to Supabase Dashboard → Authentication → Users
2. Find and delete both users:
   - `dhruvelectroglobal@gmail.com`
   - `malhotratanmay06@gmail.com`
3. Go to Table Editor → `users` table
4. Delete the same users from the `users` table
5. Now logout from your app and login with a fresh account

## Why This Error Happened
Your console shows: **"user loaded successfully: dhruvelectroglobal@gmail.com"**

This means:
1. When you logged in, Supabase Auth authenticated you as dhruv
2. The dhruv account still exists in `auth.users` table
3. Your localStorage has dhruv's authToken
4. All API calls use dhruv's token
5. But something is wrong with dhruv's account (inactive, corrupted data, etc.)

## Permanent Fix Steps

### Step 1: Run DELETE_USERS_SIMPLE.sql
```sql
-- Delete from attendance
DELETE FROM attendance 
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Delete from leave_requests
DELETE FROM leave_requests 
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Delete from short_leaves
DELETE FROM short_leaves 
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Delete from working_day_opt_ins
DELETE FROM working_day_opt_ins 
WHERE employee_id IN (
  SELECT id FROM users 
  WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com')
);

-- Delete from users table
DELETE FROM users 
WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com');

-- Delete from auth.users
DELETE FROM auth.users 
WHERE email IN ('dhruvelectroglobal@gmail.com', 'malhotratanmay06@gmail.com');
```

### Step 2: Force Logout All Sessions
```sql
-- This will logout everyone, forcing fresh login
DELETE FROM auth.sessions;
```

### Step 3: Logout and Clear Cache
In your app:
1. Click Logout
2. Clear browser cache (Ctrl+Shift+Delete)
3. Close all browser tabs with your app
4. Open fresh tab and login

### Step 4: Create New User Properly
Make sure when creating a new user:
- Use a different email (not dhruv or tanmay)
- Use a strong password
- Verify the user shows up in Supabase Dashboard → Users

## Testing After Fix
After completing all steps, test:
- ✅ Login should work
- ✅ Home page should load
- ✅ Attendance page should load without 500 error
- ✅ Change password should work without 401 error
- ✅ Marking attendance should work

## If Still Having Issues
Check these in browser DevTools Console:
```javascript
// Check what's stored in localStorage
console.log('authToken:', localStorage.getItem('authToken'))
console.log('user:', localStorage.getItem('user'))

// Check Supabase session
import { supabase } from '@/lib/supabase'
const session = await supabase.auth.getSession()
console.log('Supabase session:', session)
```

If localStorage shows dhruv email, run:
```javascript
localStorage.clear()
```
And login again.
