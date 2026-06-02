/**
 * GET /api/admin/session-audit?email=xxx
 * View session audit logs for a specific user or all users
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase-auth-helper'
import { supabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)

    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = supabaseServer
      .from('session_audit')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (email) {
      query = query.eq('email', email)
    }

    const { data: logs, error } = await query

    if (error) {
      console.error('Error fetching session audit:', error)
      return NextResponse.json({ error: 'Failed to fetch session audit' }, { status: 500 })
    }

    // Group by IP address to detect token sharing
    const ipGroups: Record<string, any[]> = {}
    const deviceGroups: Record<string, any[]> = {}

    logs?.forEach((log: any) => {
      const ip = log.ip_address || 'unknown'
      const device = log.user_agent || 'unknown'

      if (!ipGroups[ip]) ipGroups[ip] = []
      if (!deviceGroups[device]) deviceGroups[device] = []

      ipGroups[ip].push(log)
      deviceGroups[device].push(log)
    })

    // Detect suspicious activity
    const suspicious = []
    for (const [ip, logsFromIP] of Object.entries(ipGroups)) {
      const uniqueUsers = new Set(logsFromIP.map((l: any) => l.email))
      if (uniqueUsers.size > 1) {
        suspicious.push({
          type: 'multiple_users_same_ip',
          ip_address: ip,
          users: Array.from(uniqueUsers),
          count: logsFromIP.length,
        })
      }
    }

    return NextResponse.json({
      logs: logs || [],
      totalCount: logs?.length || 0,
      ipGroups: Object.keys(ipGroups).length,
      deviceGroups: Object.keys(deviceGroups).length,
      suspicious,
    })
  } catch (error: any) {
    console.error('Session audit error:', error)
    const status = error.message?.includes('Forbidden') ? 403 : 401
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status })
  }
}
