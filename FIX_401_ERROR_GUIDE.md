# Fix 401 Unauthorized Error - Deployment Issue

## Problem Diagnosis
You're seeing 401 Unauthorized errors because:
1. The old user accounts (`dhruvelectroglobal@gmail.com` and `malhotratanmay06@gmail.com`) still exist in the database
2. When you logged in, you got a token for the dhruv account (which should have been deleted)
3. All API calls are failing because the system is confused about which user is authenticated

## Solution Steps

### Step 1: Delete the Problematic Users
Run the `DELETE_USERS_SIMPLE.sql` script in Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Copy the entire content of `DELETE_USERS_SIMPLE.sql`
3. Paste and click "Run"
4. Wait for all queries to complete
5. Verify the final SELECT queries show 0 remaining users

### Step 2: Clear All Sessions in Supabase (Optional but Recommended)
This will force everyone to login again with fresh tokens:

```sql
-- Delete all active sessions
DELETE FROM auth.sessions;
```

### Step 3: Logout and Login Again
1. In your deployed app, click Logout
2. Clear browser cache/localStorage (or open an Incognito/Private window)
3. Login with the NEW user credentials you created

### Step 4: Test the Fix
After logging in with a fresh token, test:
- Navigate to Attendance page → Should load without 500 error
- Try changing password → Should work without 401 error
- Mark attendance → Should work properly

## Why This Happens
The authentication flow:
1. Login → Server returns `access_token` from Supabase Auth
2. Client stores token in localStorage as `authToken`
3. All API calls send token as `Authorization: Bearer <token>`
4. Server validates token using `supabaseServer.auth.getUser(accessToken)`

When you logged in before deleting users, you got a token for dhruv account. Even though you want to be a different user, the token still points to dhruv's user ID, causing authentication confusion.

## Prevention
In the future, when deleting users:
1. Delete the users from database first
2. Then force logout all sessions
3. Then have users login again with fresh accounts

## Alternative Quick Fix (Without SQL)
If you can't run SQL right now:
1. Open browser DevTools (F12)
2. Go to Application tab → Storage → Local Storage
3. Delete `authToken` and `user` keys
4. Refresh the page
5. Login again

This will at least let you work with the current session, but the old users will still exist in the database.
