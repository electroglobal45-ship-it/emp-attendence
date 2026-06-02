/**
 * Supabase Auth Helper for API Routes
 * Helper functions to verify authentication in API routes using Supabase Auth
 */

import { NextRequest } from 'next/server'
import { supabaseServer } from './supabase-server'

/**
 * Get authenticated user from request using Supabase Auth
 * Returns user if authenticated, null otherwise
 */
export async function getAuthenticatedUser(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('❌ No Bearer token found')
      return null
    }

    const accessToken = authHeader.substring(7)

    // Verify the access token with Supabase Auth using service role
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(accessToken)

    if (authError || !user) {
      console.log('❌ Invalid token:', authError?.message)
      return null
    }

    console.log('✅ Token verified for user:', user.id)

    // Get user profile from users table using service role
    const { data: profile, error: profileError } = await supabaseServer
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('❌ Profile fetch error:', profileError)
      return null
    }

    if (!profile.is_active) {
      console.log('❌ User inactive')
      return null
    }

    // 🔍 SECURITY AUDIT LOG - Track who is using whose token
    console.log('🔐 [SECURITY AUDIT]', {
      authenticated_user_id: user.id,
      authenticated_email: profile.email,
      user_agent: req.headers.get('user-agent'),
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      endpoint: req.url,
      timestamp: new Date().toISOString(),
    })

    console.log('✅ User authenticated:', profile.email, 'role:', profile.role)

    return {
      userId: user.id,
      email: user.email!,
      role: profile.role,
      profile: profile
    }
  } catch (error) {
    console.error('❌ Auth error:', error)
    return null
  }
}

/**
 * Verify user is authenticated
 * Throws error if not authenticated
 */
export async function requireAuth(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  
  if (!user) {
    throw new Error('Unauthorized')
  }
  
  return user
}

/**
 * Verify user is admin
 * Throws error if not admin
 */
export async function requireAdmin(req: NextRequest) {
  const user = await requireAuth(req)
  
  if (user.role !== 'admin') {
    console.log('❌ User is not admin:', user.role)
    throw new Error('Forbidden: Admin access required')
  }
  
  console.log('✅ Admin access granted')
  return user
}
