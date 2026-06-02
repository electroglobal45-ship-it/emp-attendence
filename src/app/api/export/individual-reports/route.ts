/**
 * GET /api/export/individual-reports?month=X&year=Y
 * 
 * Generates individual employee reports (one sheet per employee) with:
 * - Employee header: Name, Email, Department, Joining Date
 * - Detailed attendance table: Date, Check-in, Check-out, Hours, Status, GPS Distance
 * - Leave section: All leave requests with type, dates, reason, status
 * - Summary section: Total days present, absent, leaves, working days, hours worked
 * 
 * Different format from monthly report - detailed per employee
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-auth-helper'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'
import { ATTENDANCE_VALUE } from '@/constants/policy'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Employee {
  id: string
  name: string
  email: string
  department: string | null
  created_at: string
}

interface AttendanceRecord {
  date: string
  check_in: string | null
  check_out: string | null
  status: string
  attendance_value: number
  gps_data: any
}

interface LeaveRequest {
  leave_type: string
  from_date: string
  to_date: string
  reason: string
  status: string
  created_at: string
}

interface ShortLeave {
  date: string
  leave_type: string
  start_time: string
  end_time: string
  reason: string
  status: string
  created_at: string
}

interface Holiday {
  date: string
  name: string
}

/**
 * Calculate hours worked
 */
function calculateHours(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0
  
  try {
    const inTime = new Date(`1970-01-01T${checkIn}`)
    const outTime = new Date(`1970-01-01T${checkOut}`)
    const diff = outTime.getTime() - inTime.getTime()
    const hours = diff / (1000 * 60 * 60)
    return Math.max(0, Math.round(hours * 10) / 10)
  } catch {
    return 0
  }
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Get GPS distance string
 */
function getGPSDistance(gpsData: any): string {
  if (!gpsData) return 'N/A'
  if (typeof gpsData === 'object' && gpsData.distance_from_office !== undefined) {
    return `${Math.round(gpsData.distance_from_office)} m`
  }
  return 'N/A'
}

/**
 * Count working days (excluding Sundays and holidays)
 */
function countWorkingDays(year: number, month: number, holidays: Holiday[]): number {
  const holidayDates = new Set(holidays.map(h => h.date))
  const lastDay = new Date(year, month, 0).getDate()
  let count = 0

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month - 1, day)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayOfWeek = date.getDay()

    if (dayOfWeek !== 0 && !holidayDates.has(dateStr)) {
      count++
    }
  }

  return count
}

/**
 * Generate sheet for one employee
 */
async function generateEmployeeSheet(
  employee: Employee,
  month: number,
  year: number,
  holidays: Holiday[]
): Promise<any[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
  const today = new Date().toISOString().split('T')[0]

  // Fetch attendance records
  const { data: attendance } = await supabaseServer
    .from('attendance')
    .select('date, check_in, check_out, status, attendance_value, gps_data')
    .eq('employee_id', employee.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  // Fetch leave requests
  const { data: leaves } = await supabaseServer
    .from('leave_requests')
    .select('leave_type, from_date, to_date, reason, status, created_at')
    .eq('employee_id', employee.id)
    .or(`and(from_date.lte.${endDate},to_date.gte.${startDate})`)
    .order('created_at', { ascending: false })

  // Fetch short leaves
  const { data: shortLeaves } = await supabaseServer
    .from('short_leaves')
    .select('date, leave_type, start_time, end_time, reason, status, created_at')
    .eq('employee_id', employee.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  const holidayMap = new Map(holidays.map(h => [h.date, h.name]))
  const attendanceMap = new Map(
    (attendance || []).map((a: AttendanceRecord) => [a.date, a])
  )

  const rows: any[] = []

  // Header section
  rows.push({
    A: 'EMPLOYEE REPORT',
    B: '',
    C: '',
    D: '',
    E: '',
    F: '',
  })
  rows.push({})
  rows.push({
    A: 'Name:',
    B: employee.name,
    C: '',
    D: 'Email:',
    E: employee.email,
    F: '',
  })
  rows.push({
    A: 'Department:',
    B: employee.department || 'N/A',
    C: '',
    D: 'Joining Date:',
    E: formatDate(employee.created_at),
    F: '',
  })
  rows.push({
    A: 'Report Period:',
    B: `${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    C: '',
    D: '',
    E: '',
    F: '',
  })
  rows.push({})

  // Attendance section
  rows.push({
    A: 'ATTENDANCE DETAILS',
    B: '',
    C: '',
    D: '',
    E: '',
    F: '',
  })
  rows.push({
    A: 'Date',
    B: 'Day',
    C: 'Check In',
    D: 'Check Out',
    E: 'Hours',
    F: 'Status',
    G: 'GPS Distance',
  })

  let totalPresent = 0
  let totalHalfDay = 0
  let totalAbsent = 0
  let totalHours = 0
  let totalShortLeaves = 0

  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const date = new Date(year, month - 1, day)
    const dayOfWeek = date.getDay()
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const isFutureDate = dateStr > today

    const record = attendanceMap.get(dateStr)
    const holiday = holidayMap.get(dateStr)

    let status = ''
    let hours = 0
    let checkIn = ''
    let checkOut = ''
    let gpsDistance = ''

    if (isFutureDate) {
      status = '—'
    } else if (dayOfWeek === 0) {
      status = 'Sunday'
    } else if (holiday) {
      status = `Holiday (${holiday})`
    } else if (record) {
      checkIn = record.check_in || '—'
      checkOut = record.check_out || '—'
      hours = calculateHours(record.check_in, record.check_out)
      gpsDistance = getGPSDistance(record.gps_data)
      
      const statusMap: Record<string, string> = {
        'present': 'Present',
        'half_day': 'Half Day',
        'late': 'Late',
        'short_leave': 'Short Leave',
        'approved_short_leave': 'Short Leave (Approved)',
        'absent': 'Absent',
        'leave': 'Leave',
      }
      status = statusMap[record.status.toLowerCase()] || record.status

      // Count for summary
      if (record.attendance_value === 1) totalPresent++
      else if (record.attendance_value === 0.5) totalHalfDay++
      else if (record.attendance_value === 0) totalAbsent++
      if (record.status.toLowerCase().includes('short_leave')) totalShortLeaves++

      totalHours += hours
    } else {
      status = 'Absent'
      totalAbsent++
    }

    rows.push({
      A: formatDate(dateStr),
      B: dayNames[dayOfWeek],
      C: checkIn,
      D: checkOut,
      E: hours > 0 ? hours : '',
      F: status,
      G: gpsDistance,
    })
  }

  rows.push({})

  // Leave section
  rows.push({
    A: 'LEAVE REQUESTS',
    B: '',
    C: '',
    D: '',
    E: '',
    F: '',
  })
  rows.push({
    A: 'Type',
    B: 'From Date',
    C: 'To Date',
    D: 'Reason',
    E: 'Status',
    F: 'Applied On',
  })

  if ((leaves || []).length > 0) {
    (leaves || []).forEach((leave: LeaveRequest) => {
      rows.push({
        A: leave.leave_type.replace('_', ' ').toUpperCase(),
        B: formatDate(leave.from_date),
        C: formatDate(leave.to_date),
        D: leave.reason || 'N/A',
        E: leave.status.toUpperCase(),
        F: formatDate(leave.created_at),
      })
    })
  } else {
    rows.push({
      A: 'No leave requests',
      B: '',
      C: '',
      D: '',
      E: '',
      F: '',
    })
  }

  rows.push({})

  // Short leave section
  rows.push({
    A: 'SHORT LEAVES',
    B: '',
    C: '',
    D: '',
    E: '',
    F: '',
  })
  rows.push({
    A: 'Date',
    B: 'Type',
    C: 'Start Time',
    D: 'End Time',
    E: 'Reason',
    F: 'Status',
  })

  if ((shortLeaves || []).length > 0) {
    (shortLeaves || []).forEach((sl: ShortLeave) => {
      rows.push({
        A: formatDate(sl.date),
        B: sl.leave_type.replace('_', ' ').toUpperCase(),
        C: sl.start_time || 'N/A',
        D: sl.end_time || 'N/A',
        E: sl.reason || 'N/A',
        F: sl.status.toUpperCase(),
      })
    })
  } else {
    rows.push({
      A: 'No short leaves',
      B: '',
      C: '',
      D: '',
      E: '',
      F: '',
    })
  }

  rows.push({})

  // Summary section
  const workingDays = countWorkingDays(year, month, holidays)
  
  rows.push({
    A: 'MONTHLY SUMMARY',
    B: '',
    C: '',
    D: '',
    E: '',
    F: '',
  })
  rows.push({
    A: 'Total Working Days in Month:',
    B: workingDays,
    C: '',
    D: '',
    E: '',
    F: '',
  })
  rows.push({
    A: 'Days Present (Full):',
    B: totalPresent,
    C: '',
    D: '',
    E: '',
    F: '',
  })
  rows.push({
    A: 'Half Days:',
    B: totalHalfDay,
    C: '',
    D: '',
    E: '',
    F: '',
  })
  rows.push({
    A: 'Short Leaves:',
    B: totalShortLeaves,
    C: '',
    D: '',
    E: '',
    F: '',
  })
  rows.push({
    A: 'Days Absent:',
    B: totalAbsent,
    C: '',
    D: '',
    E: '',
    F: '',
  })
  rows.push({
    A: 'Total Hours Worked:',
    B: Math.round(totalHours * 10) / 10,
    C: '',
    D: '',
    E: '',
    F: '',
  })
  rows.push({
    A: 'Average Hours per Day:',
    B: totalPresent > 0 ? Math.round((totalHours / totalPresent) * 10) / 10 : 0,
    C: '',
    D: '',
    E: '',
    F: '',
  })

  return rows
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)

    const { searchParams } = new URL(req.url)
    const month = parseInt(searchParams.get('month') || '0')
    const year = parseInt(searchParams.get('year') || '0')

    if (!month || !year || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Valid month (1-12) and year are required' }, { status: 400 })
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    // Fetch all employees
    const { data: employees, error: empError } = await supabaseServer
      .from('users')
      .select('id, name, email, department, created_at')
      .eq('role', 'employee')
      .order('name', { ascending: true })

    if (empError) {
      console.error('Error fetching employees:', empError)
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
    }

    // Fetch holidays
    const { data: holidays, error: holError } = await supabaseServer
      .from('holidays')
      .select('date, name')
      .gte('date', startDate)
      .lte('date', endDate)

    if (holError) {
      console.error('Error fetching holidays:', holError)
      return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 })
    }

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Generate sheet for each employee
    for (const employee of employees || []) {
      const sheetData = await generateEmployeeSheet(employee, month, year, holidays || [])
      
      const ws = XLSX.utils.json_to_sheet(sheetData, { skipHeader: true })
      
      // Column widths
      ws['!cols'] = [
        { wch: 18 }, // A - Date/Labels
        { wch: 15 }, // B - Day/Values
        { wch: 12 }, // C - Check In
        { wch: 12 }, // D - Check Out
        { wch: 8 },  // E - Hours
        { wch: 20 }, // F - Status
        { wch: 15 }, // G - GPS Distance
      ]

      // Use employee name as sheet name (sanitized)
      const sheetName = employee.name.substring(0, 30).replace(/[\\\/\[\]\*\?:]/g, '_')
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="individual-reports-${year}-${String(month).padStart(2, '0')}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating individual reports:', error)
    const status = error.message?.includes('Forbidden') ? 403 : error.message?.includes('Unauthorized') ? 401 : 500
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status })
  }
}
