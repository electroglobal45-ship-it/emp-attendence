/**
 * GET /api/export/monthly-report?month=X&year=Y
 * 
 * Generates a monthly all-employee attendance report in matrix format:
 * - Dates as columns (Date 1, Date 2, ... Date 31)
 * - Each row represents one employee
 * - Each date cell shows: Status + Hours (e.g., "Present - 9 hrs", "Holiday", "Absent")
 * - Summary columns: Total Working Days, Total Work Days, Total Work Hours
 * 
 * Attendance values:
 * - Present: 1.0
 * - Half Day: 0.5
 * - Approved Short Leave: 1.0
 * - Extra Short Leave: 0.75
 * - Absent: 0
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-auth-helper'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'
import { ATTENDANCE_VALUE } from '@/constants/policy'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface AttendanceRecord {
  date: string
  employee_id: string
  status: string
  attendance_value: number
  check_in: string | null
  check_out: string | null
}

interface Holiday {
  date: string
  name: string
}

interface Employee {
  id: string
  name: string
  email: string
  department: string | null
}

/**
 * Calculate hours worked from check-in and check-out times
 */
function calculateHours(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0
  
  try {
    const inTime = new Date(`1970-01-01T${checkIn}`)
    const outTime = new Date(`1970-01-01T${checkOut}`)
    const diff = outTime.getTime() - inTime.getTime()
    const hours = diff / (1000 * 60 * 60)
    return Math.max(0, Math.round(hours * 10) / 10) // Round to 1 decimal
  } catch {
    return 0
  }
}

/**
 * Format cell value: status + hours
 */
function formatCellValue(
  attendance: AttendanceRecord | null,
  isHoliday: boolean,
  holidayName: string | null,
  isFutureDate: boolean
): string {
  // Future dates - empty
  if (isFutureDate) {
    return ''
  }

  // Holiday
  if (isHoliday) {
    return holidayName || 'Holiday'
  }

  // No attendance record = Absent
  if (!attendance) {
    return 'Absent'
  }

  // Calculate hours
  const hours = calculateHours(attendance.check_in, attendance.check_out)
  const hoursText = hours > 0 ? ` - ${hours} hrs` : ''

  // Status mapping
  const statusMap: Record<string, string> = {
    'present': 'Present',
    'half_day': 'Half Day',
    'late': 'Late',
    'short_leave': 'Short Leave',
    'approved_short_leave': 'Short Leave',
    'absent': 'Absent',
    'leave': 'Leave',
  }

  const displayStatus = statusMap[attendance.status.toLowerCase()] || attendance.status

  return `${displayStatus}${hoursText}`
}

/**
 * Get all working days in month (excluding Sundays and holidays)
 */
function getWorkingDaysInMonth(year: number, month: number, holidays: Holiday[]): number {
  const holidayDates = new Set(holidays.map(h => h.date))
  const lastDay = new Date(year, month, 0).getDate()
  let workingDays = 0

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month - 1, day)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayOfWeek = date.getDay()

    // Skip Sundays (0) and holidays
    if (dayOfWeek !== 0 && !holidayDates.has(dateStr)) {
      workingDays++
    }
  }

  return workingDays
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
    const today = new Date().toISOString().split('T')[0]

    // Fetch all employees
    const { data: employees, error: empError } = await supabaseServer
      .from('users')
      .select('id, name, email, department')
      .eq('role', 'employee')
      .order('name', { ascending: true })

    if (empError) {
      console.error('Error fetching employees:', empError)
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
    }

    // Fetch all attendance records for the month
    const { data: attendanceRecords, error: attError } = await supabaseServer
      .from('attendance')
      .select('date, employee_id, status, attendance_value, check_in, check_out')
      .gte('date', startDate)
      .lte('date', endDate)

    if (attError) {
      console.error('Error fetching attendance:', attError)
      return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
    }

    // Fetch holidays for the month
    const { data: holidays, error: holError } = await supabaseServer
      .from('holidays')
      .select('date, name')
      .gte('date', startDate)
      .lte('date', endDate)

    if (holError) {
      console.error('Error fetching holidays:', holError)
      return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 })
    }

    // Create holiday map
    const holidayMap = new Map<string, string>()
    ;(holidays || []).forEach((h: Holiday) => {
      holidayMap.set(h.date, h.name)
    })

    // Create attendance map: employee_id -> date -> attendance
    const attendanceMap = new Map<string, Map<string, AttendanceRecord>>()
    ;(attendanceRecords || []).forEach((record: AttendanceRecord) => {
      if (!attendanceMap.has(record.employee_id)) {
        attendanceMap.set(record.employee_id, new Map())
      }
      attendanceMap.get(record.employee_id)!.set(record.date, record)
    })

    // Calculate total working days in the month
    const totalWorkingDays = getWorkingDaysInMonth(year, month, holidays || [])

    // Build Excel rows
    const rows: any[] = []

    ;(employees || []).forEach((emp: Employee) => {
      const row: any = {
        'Employee Name': emp.name,
        'Email': emp.email,
        'Department': emp.department || 'N/A',
      }

      let totalWorkDays = 0
      let totalWorkHours = 0

      // Add columns for each date
      for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const date = new Date(year, month - 1, day)
        const dayOfWeek = date.getDay()
        const isSunday = dayOfWeek === 0
        const isHoliday = holidayMap.has(dateStr)
        const isFutureDate = dateStr > today

        const attendance = attendanceMap.get(emp.id)?.get(dateStr) || null

        // Format: "Day DD" (e.g., "Mon 01")
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const columnHeader = `${dayNames[dayOfWeek]} ${String(day).padStart(2, '0')}`

        // Cell value
        if (isSunday) {
          row[columnHeader] = 'Sunday'
        } else {
          row[columnHeader] = formatCellValue(attendance, isHoliday, holidayMap.get(dateStr) || null, isFutureDate)
        }

        // Calculate totals (only for past/present dates, excluding Sundays and holidays)
        if (!isFutureDate && !isSunday && !isHoliday) {
          if (attendance) {
            totalWorkDays += attendance.attendance_value || 0
            const hours = calculateHours(attendance.check_in, attendance.check_out)
            totalWorkHours += hours
          }
          // else: absent, no contribution to totals
        }
      }

      // Summary columns
      row['Total Working Days'] = totalWorkingDays
      row['Total Work Days'] = Math.round(totalWorkDays * 10) / 10 // Round to 1 decimal
      row['Total Work Hours'] = Math.round(totalWorkHours * 10) / 10 // Round to 1 decimal

      rows.push(row)
    })

    // Create Excel workbook
    const ws = XLSX.utils.json_to_sheet(rows)

    // Auto-size columns
    const colWidths: any[] = []
    colWidths.push({ wch: 20 }) // Employee Name
    colWidths.push({ wch: 25 }) // Email
    colWidths.push({ wch: 15 }) // Department

    // Date columns
    for (let i = 0; i < lastDay; i++) {
      colWidths.push({ wch: 12 })
    }

    // Summary columns
    colWidths.push({ wch: 18 }) // Total Working Days
    colWidths.push({ wch: 15 }) // Total Work Days
    colWidths.push({ wch: 16 }) // Total Work Hours

    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Report')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="monthly-attendance-${year}-${String(month).padStart(2, '0')}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating monthly report:', error)
    const status = error.message?.includes('Forbidden') ? 403 : error.message?.includes('Unauthorized') ? 401 : 500
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status })
  }
}
