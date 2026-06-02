# Cache Management & Mobile/Desktop Sync

## Overview
This document explains how the application handles caching to ensure proper synchronization between mobile and desktop devices when users log in, change passwords, or switch devices.

## Problem Statement
When using the app on both mobile and laptop:
- Old cached data can cause "Invalid credentials" errors
- Password changes on one device may not reflect on another
- Session tokens become stale and cause authentication issues
- Users have to manually clear browser cache or re-mark attendance

## Solution Implemented

### 1. **Automatic Cache Clearing**
The app now automatically clears all caches in these scenarios:

#### On Login
- Clears all service worker caches
- Clears session storage
- Clears stale localStorage items
- Sets fresh login timestamp
- ✅ **Result**: Clean slate for every login

#### On Password Change
- Generates new session token automatically
- Clears all old caches
- Updates localStorage with new token
- Updates login timestamp
- ✅ **Result**: Seamless password change without re-login

#### On Logout
- Removes all auth tokens
- Clears all caches
- Clears session storage
- ✅ **Result**: Complete cleanup

### 2. **Session Validation**
- Sessions are validated on app load
- Expired sessions (>24 hours) are automatically cleared
- Fresh sessions are maintained
- ✅ **Result**: No stale session issues

### 3. **Cache-Busting Headers**
All authentication API calls include:
```
Cache-Control: no-cache, no-store, must-revalidate, max-age=0
Pragma: no-cache
Expires: 0
```
✅ **Result**: API responses are never cached

### 4. **Next.js Configuration**
Updated `next.config.js` to add cache control headers:
- All `/api/*` routes have no-cache headers
- All `/api/auth/*` routes have strict no-cache headers
- Dynamic build IDs prevent build caching issues
✅ **Result**: Server-side cache prevention

## Files Modified

### Core Files
1. **`src/lib/cache-utils.ts`** (NEW)
   - Centralized cache management utilities
   - `clearAllCaches()` - Clears all browser caches
   - `clearExpiredSession()` - Removes old sessions
   - `getCacheBustingHeaders()` - Returns no-cache headers
   - `isSessionFresh()` - Validates session age

2. **`src/components/providers/SessionProvider.tsx`**
   - Added automatic cache clearing on login/logout
   - Added session validation on mount
   - Added cache clearing on password change
   - Uses cache-busting headers for all auth requests

3. **`src/components/ChangePasswordModal.tsx`**
   - Clears caches after password change
   - Updates token automatically
   - Handles require-login scenario

4. **`src/app/(admin)/settings/page.tsx`**
   - Admin password change with cache clearing
   - Token refresh after password change
   - Consistent with employee behavior

5. **`src/app/api/auth/change-password/route.ts`**
   - Generates new session token after password change
   - Returns new token to client
   - Automatic re-login mechanism

6. **`next.config.js`**
   - Added cache control headers for all API routes
   - Strict headers for auth endpoints
   - Dynamic build IDs

### Utility Files
7. **`clear-cache.bat`** (NEW)
   - Manual cache clearing script for development
   - Deletes `.next` folder
   - Deletes `node_modules/.cache`
   - Run when you need to clear build cache

## How It Works

### Password Change Flow
```
User Changes Password
    ↓
1. API updates password in DB
    ↓
2. API updates password in Supabase Auth
    ↓
3. API generates NEW session token (re-login)
    ↓
4. API returns new token to client
    ↓
5. Client clears all caches
    ↓
6. Client updates localStorage with new token
    ↓
7. User stays logged in with fresh token
    ↓
✅ SUCCESS - No re-login needed
```

### Login Flow
```
User Logs In
    ↓
1. Client clears all old caches
    ↓
2. API authenticates user
    ↓
3. API returns session token
    ↓
4. Client stores token + timestamp
    ↓
5. User redirected to home
    ↓
✅ SUCCESS - Fresh session started
```

### Session Validation on Load
```
App Loads
    ↓
1. Check loginTimestamp in localStorage
    ↓
2. If > 24 hours old → Clear session
    ↓
3. If fresh → Load user data
    ↓
4. Validate token with API
    ↓
✅ SUCCESS - Valid session or redirect to login
```

## Mobile & Desktop Sync

### How It Works Across Devices
Each device maintains its own:
- **Independent session token** (stored in localStorage)
- **Independent login timestamp**
- **Independent cache**

When you switch devices:
1. Login on Device A → Fresh token A stored
2. Login on Device B → Fresh token B stored
3. Change password on Device A → Token A auto-refreshed
4. Next time on Device B → Login again (password changed)

**This is correct behavior!** Changing password should invalidate old sessions for security.

### Expected Behavior
✅ **Login on mobile** → Works with fresh cache  
✅ **Login on laptop** → Works with fresh cache  
✅ **Change password on mobile** → Mobile stays logged in with new token  
✅ **Use laptop after password change** → Must re-login (security feature)  
✅ **Switch between devices** → Each has independent valid session  

## Testing

### Test Scenarios
1. **Login Test**
   - Login on mobile
   - Verify attendance marking works
   - Login on laptop with same credentials
   - Verify both devices work independently

2. **Password Change Test**
   - Change password on mobile
   - Verify mobile stays logged in
   - Verify attendance still works on mobile
   - Try laptop → Should ask for new password (correct)

3. **Cache Clear Test**
   - Login → Logout → Login again
   - Verify no "Invalid credentials" errors
   - Verify no cached data issues

4. **Session Expiry Test**
   - Login and wait 24+ hours
   - Reload page
   - Verify session is cleared and redirects to login

## Manual Cache Clearing

### For Users (Browser)
**Chrome/Edge (Desktop & Mobile):**
1. Settings → Privacy and Security → Clear browsing data
2. Select "Cached images and files"
3. Click "Clear data"

**Or use incognito/private mode for testing**

### For Developers
**Windows:**
```bash
clear-cache.bat
```

**Manual:**
```bash
rmdir /s /q .next
rmdir /s /q node_modules\.cache
npm run dev
```

## Troubleshooting

### Issue: "Invalid credentials" after password change
**Solution**: This should NOT happen anymore. If it does:
1. Check browser console for errors
2. Verify new token was stored in localStorage
3. Check if `loginTimestamp` was updated
4. Clear browser cache manually and try again

### Issue: Attendance shows "mark again" after login
**Solution**: This should NOT happen anymore. If it does:
1. Verify cache was cleared on login
2. Check localStorage for stale attendance data
3. Run `clear-cache.bat` and restart dev server

### Issue: Different behavior on mobile vs laptop
**Solution**: This is expected if:
- Password was changed on one device (other must re-login)
- Using different browsers/accounts
- One device has very old session (>24 hours)

**Not expected if:**
- Both devices logged in recently with same password
- Both devices show "Invalid credentials" → Check API logs

## Benefits

✅ **No more "Invalid credentials" after password change**  
✅ **No more manual cache clearing needed**  
✅ **Seamless experience across mobile and desktop**  
✅ **Automatic session cleanup (24-hour expiry)**  
✅ **Secure password changes with auto token refresh**  
✅ **Independent device sessions (security)**  
✅ **No stale data issues**  

## Security Notes

- Each device has its own session token (independent sessions)
- Changing password invalidates sessions on OTHER devices (correct behavior)
- Sessions expire after 24 hours automatically
- All auth tokens stored in localStorage (not cookies for mobile compatibility)
- Cache-busting prevents sensitive data caching
- Logout clears all traces of session

## Future Improvements

- [ ] Add refresh token mechanism for longer sessions
- [ ] Add "Logout all devices" feature
- [ ] Add session management dashboard for users
- [ ] Add push notifications for password changes
- [ ] Add device fingerprinting for security

---

**Last Updated**: June 2, 2026  
**Tested On**: Chrome (Desktop), Chrome (Mobile), Edge (Desktop)  
**Status**: ✅ Production Ready
