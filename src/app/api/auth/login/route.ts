/**
 * POST /api/auth/login
 * Email/password authentication with plain text password verification
 * Uses Supabase Auth for session management only
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    console.log('🔐 Login attempt:', email)

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Get user profile from users table
    const { data: profile, error: profileError } = await supabaseServer
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()

    if (profileError || !profile) {
      console.log('❌ User not found')
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Verify plain text password
    if (profile.password_hash !== password) {
      console.log('❌ Password mismatch')
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (!profile.is_active) {
      console.log('❌ User inactive')
      return NextResponse.json({ error: 'User account is inactive' }, { status: 403 })
    }

    console.log('✅ Password verified, signing in with Supabase Auth')

    // Sign in with Supabase Auth using the plain text password
    const { data: authData, error: authError } = await supabaseServer.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: password,
    })

    if (authError || !authData.user) {
      console.log('❌ Auth error:', authError?.message)
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    console.log('✅ Login successful for:', profile.email, 'role:', profile.role)

    // 🔍 Log session creation for audit trail
    try {
      await supabaseServer.from('session_audit').insert({
        user_id: profile.id,
        email: profile.email,
        action: 'login',
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
        device_info: JSON.stringify({
          platform: req.headers.get('sec-ch-ua-platform'),
          mobile: req.headers.get('sec-ch-ua-mobile'),
        }),
      })
      console.log('✅ Session audit logged for:', profile.email)
    } catch (auditError) {
      console.error('⚠️ Failed to log session audit:', auditError)
      // Don't fail login if audit logging fails
    }

    return NextResponse.json({
      success: true,
      token: authData.session.access_token, // Add this for compatibility
      session: authData.session,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        category: profile.category,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
