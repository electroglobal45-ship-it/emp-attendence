/**
 * POST /api/auth/change-password
 * Change user password with plain text storage
 * Updates both Supabase Auth and users.password_hash
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const { oldPassword, newPassword } = await req.json()

    console.log('🔐 Change password request received')

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: 'Old password and new password are required' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
    }

    // Get authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('❌ No Bearer token found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = authHeader.substring(7)

    // Verify user with Supabase Auth using service role
    const { data: { user }, error: userError } = await supabaseServer.auth.getUser(accessToken)

    if (userError || !user) {
      console.log('❌ Invalid token:', userError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ User verified:', user.id)

    // Get user profile to verify old password (plain text comparison)
    const { data: profile, error: profileError } = await supabaseServer
      .from('users')
      .select('password_hash, email')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('❌ Profile fetch error:', profileError)
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    console.log('✅ Profile fetched for:', profile.email)

    // Verify old password using plain text comparison
    if (profile.password_hash !== oldPassword) {
      console.log('❌ Old password mismatch')
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    console.log('✅ Old password verified')

    // Step 1: Update plain text password in users table FIRST
    const { error: dbUpdateError } = await supabaseServer
      .from('users')
      .update({ 
        password_hash: newPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (dbUpdateError) {
      console.error('❌ Database password update error:', dbUpdateError)
      return NextResponse.json({ error: 'Failed to update password in database' }, { status: 500 })
    }

    console.log('✅ Password updated in users table')

    // Step 2: Update password in Supabase Auth using admin API
    const { error: updateError } = await supabaseServer.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    )

    if (updateError) {
      console.error('❌ Supabase Auth password update error:', updateError)
      // Rollback database change
      await supabaseServer
        .from('users')
        .update({ password_hash: oldPassword })
        .eq('id', user.id)
      return NextResponse.json({ error: 'Failed to update password in auth system' }, { status: 500 })
    }

    console.log('✅ Password updated in Supabase Auth')

    // Step 3: Generate new session with the new password
    // This ensures the user stays logged in with a valid token
    console.log('🔄 Generating new session with updated password')
    const { data: newAuthData, error: signInError } = await supabaseServer.auth.signInWithPassword({
      email: profile.email,
      password: newPassword,
    })

    if (signInError || !newAuthData.session) {
      console.error('❌ Failed to generate new session:', signInError)
      // Password was updated but session refresh failed
      // User will need to login again manually
      return NextResponse.json({
        success: true,
        message: 'Password changed successfully. Please login again.',
        requireLogin: true,
      })
    }

    console.log('✅ New session generated')
    console.log('✅ Password changed successfully for user:', user.id)

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
      token: newAuthData.session.access_token,
      session: newAuthData.session,
    })
  } catch (error) {
    console.error('❌ Change password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
