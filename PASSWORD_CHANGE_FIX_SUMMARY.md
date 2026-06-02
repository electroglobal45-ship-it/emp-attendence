# Password Change Authorization Fix

## Problem
When users changed their password from temporary to new password, they would get:
- ❌ 401 Unauthorized errors on API calls
- ❌ 500 Internal Server errors on attendance marking
- ❌ Authorization bypass and RLS issues

## Root Cause
After password change, the authentication flow had a synchronization issue:

1. **Password Change API** generates a new session token ✅
2. **localStorage** gets updated with new token ✅
3. **AuthContext** still had OLD user session in memory ❌
4. **API calls** used old token from memory instead of new token from localStorage ❌

This caused a token mismatch where:
- localStorage had valid NEW token
- React state (AuthContext) had OLD user session
- Components used OLD session for API calls
- Server rejected OLD token → 401 Unauthorized

## Solution Implemented

### 1. Update ChangePasswordModal.tsx
Added `refreshUser()` call after password change to sync AuthContext with new token:

```typescript
// Update token in localStorage
if (data.token) {
  localStorage.setItem('authToken', data.token)
  
  // CRITICAL: Refresh user session in AuthContext
  await refreshUser()  // ← THIS IS THE FIX
}
```

### 2. Update Admin Settings Page
Same fix applied to admin password change:

```typescript
if (data.token) {
  localStorage.setItem('authToken', data.token)
  
  // CRITICAL: Refresh user session to sync with new token
  await refreshUser()  // ← THIS IS THE FIX
}
```

### 3. What refreshUser() Does
The `refreshUser()` function:
1. Calls `getCurrentUser()` to get latest Supabase Auth session
2. Updates AuthContext state with new user data
3. Syncs localStorage with latest access token via `syncLegacySession()`
4. Ensures all components use the new valid token

## Files Modified
- ✅ `src/components/ChangePasswordModal.tsx` - Added refreshUser() call
- ✅ `src/app/(admin)/settings/page.tsx` - Added refreshUser() call

## Testing Checklist
After deploying this fix, test the following flow:

### For New Employee
1. ✅ Login with temporary password → Should work
2. ✅ System prompts to change password → Modal should open
3. ✅ Change password → Should succeed
4. ✅ Navigate to Attendance page → Should load (no 500 error)
5. ✅ Mark attendance → Should work (no 401 error)
6. ✅ View leaves page → Should work
7. ✅ Apply for leave → Should work

### For Admin
1. ✅ Login → Should work
2. ✅ Go to Settings → Change Password
3. ✅ Change password → Should succeed
4. ✅ Navigate to Dashboard → Should load
5. ✅ Approve/Reject leaves → Should work
6. ✅ View reports → Should work

### Cross-Device Testing
1. ✅ Change password on mobile → Should work
2. ✅ Immediately mark attendance on mobile → Should work (no 401)
3. ✅ Open laptop → Should require fresh login (token changed)
4. ✅ Login on laptop with NEW password → Should work

## How to Verify the Fix
Check browser console after password change. You should see:

```
✅ Auth token updated in localStorage
🔄 Refreshing user session after password change...
Loading user from Supabase session...
User loaded successfully: user@example.com role: employee
✅ User session refreshed
✅ Password changed successfully!
```

If you see these logs, the fix is working correctly.

## Prevention: Never Happens Again
To ensure this doesn't happen again:

### Rule 1: Always Refresh AuthContext After Token Changes
Whenever you update the `authToken` in localStorage, ALWAYS call `refreshUser()`:

```typescript
localStorage.setItem('authToken', newToken)
await refreshUser()  // Always do this!
```

### Rule 2: Token Changes That Need Refresh
These operations MUST call `refreshUser()`:
- Password change
- Token refresh/renewal
- Account settings update that affects auth
- Manual token update

### Rule 3: Check for Sync Issues
If users report 401 errors after auth operations, check:
1. Is localStorage updated?
2. Is AuthContext refreshed?
3. Are components using AuthContext or localStorage directly?

## Technical Details

### Authentication Flow
```
User Action (Password Change)
    ↓
API Call (/api/auth/change-password)
    ↓
Server: Update password → Generate new session
    ↓
Response: { token: newAccessToken, session: {...} }
    ↓
Client: localStorage.setItem('authToken', newToken)
    ↓
Client: await refreshUser() ← CRITICAL STEP
    ↓
AuthContext: loadUser() → getCurrentUser()
    ↓
Supabase: getSession() → Returns NEW session
    ↓
AuthContext: syncLegacySession(profile, newToken)
    ↓
✅ All systems synchronized with new token
```

### Why This Works
1. **Server-side**: Generates new Supabase Auth session after password change
2. **Client localStorage**: Stores new access token immediately
3. **Client AuthContext**: Refreshes to load new session from Supabase Auth
4. **Supabase Client**: Already has new session (happens automatically)
5. **API calls**: Use new token from AuthContext → Success!

## RLS and Authorization
RLS (Row Level Security) is **DISABLED** on all main tables:
- users
- attendance
- leave_requests
- short_leaves
- working_day_opt_ins

Authorization is handled by:
- API routes verify token using `requireAuth()`
- Service role key used for database operations
- Token validation with `supabaseServer.auth.getUser(accessToken)`

So RLS is NOT the issue - it was purely a token sync problem.

## Deployment Notes
1. Deploy the updated files
2. Test with a fresh user account
3. Change password from temporary to new password
4. Verify no 401 errors occur
5. Test marking attendance immediately after password change
6. Verify works on both mobile and desktop

## Rollback Plan (If Issues Occur)
If this fix causes problems, rollback by:
1. Remove `await refreshUser()` calls from both files
2. Instead, force user to logout/login after password change:
```typescript
if (data.token) {
  alert('Password changed! Please login again.')
  logout()
  window.location.href = '/login'
}
```

But this is NOT recommended as it's bad UX.
