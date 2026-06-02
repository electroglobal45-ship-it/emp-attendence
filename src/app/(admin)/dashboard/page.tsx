'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { ChangePasswordModal } from '@/components/ChangePasswordModal'
import {
  Users, Clock, Calendar, CheckCircle, XCircle,
  AlertCircle, RefreshCw, UserPlus, Settings, FileText, Lock,
} from 'lucide-react'
import Link from 'next/link'

interface Stats {
  totalEmployees: number
  presentToday: number
  absentToday: number
  pendingLeaves: number
  pendingShortLeaves: number
}

interface AttendanceRecord {
  id: string
  employee_id: string
  date: string
  check_in: string | null
  check_out: string | null
  status: string
  users?: { name: string; email: string }
}

interface LeaveRequest {
  id: string
  employee_id: string
  type: string
  start_date: string
  end_date: string
  reason: string
  status: string
  users?: { name: string; email: string }
}

interface ShortLeave {
  id: string
  employee_id: string
  date: string
  short_leave_type: string
  reason: string
  status: string
  users?: { name: string; email: string }
}

interface OptInWorkingDay {
  id: string
  employee_id: string
  date: string
  type: string
  reason: string | null
  users?: { name: string; email: string }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [shortLeaves, setShortLeaves] = useState<ShortLeave[]>([])
  const [optInWorkingDays, setOptInWorkingDays] = useState<OptInWorkingDay[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'attendance' | 'leaves' | 'optInDays'>('attendance')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showMarkModal, setShowMarkModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string; date: string } | null>(null)
  const [markAction, setMarkAction] = useState<'absent' | 'half_day' | 'mark_checkout'>('absent')
  const [markReason, setMarkReason] = useState('')
  const [marking, setMarking] = useState(false)

  const token = () => localStorage.getItem('authToken')

  const fetchAll = async () => {
    const authToken = token()
    
    if (!authToken) {
      console.error('No auth token found, redirecting to login')
      window.location.href = '/login'
      return
    }

    setLoading(true)
    try {
      const [statsRes, attendanceRes, leavesRes, shortLeavesRes, optInRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/admin/attendance', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/admin/leaves', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/short-leave?all=true', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/admin/opt-in-working-days', { headers: { Authorization: `Bearer ${authToken}` } }),
      ])

      // Check for 401 Unauthorized - token expired or invalid
      if (statsRes.status === 401 || attendanceRes.status === 401 || leavesRes.status === 401 || shortLeavesRes.status === 401 || optInRes.status === 401) {
        console.error('Unauthorized - token invalid or expired, redirecting to login')
        localStorage.removeItem('authToken')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return
      }

      if (statsRes.ok) setStats(await statsRes.json())
      if (attendanceRes.ok) {
        const data = await attendanceRes.json()
        setAttendance(data.records || [])
      }
      if (leavesRes.ok) {
        const data = await leavesRes.json()
        setLeaves(data.leaves || [])
      }
      if (shortLeavesRes.ok) {
        const data = await shortLeavesRes.json()
        setShortLeaves(data.shortLeaves || [])
      }
      if (optInRes.ok) {
        const data = await optInRes.json()
        setOptInWorkingDays(data.optIns || [])
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const handleLeaveAction = async (leaveId: string, status: 'approved' | 'rejected') => {
    const authToken = token()
    if (!authToken) {
      window.location.href = '/login'
      return
    }

    setApprovingId(leaveId)
    try {
      const res = await fetch('/api/leaves/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ leaveRequestId: leaveId, status }),
      })
      
      if (res.status === 401) {
        localStorage.removeItem('authToken')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return
      }

      if (res.ok) {
        setLeaves((prev) => prev.map((l) => (l.id === leaveId ? { ...l, status } : l)))
        const statsRes = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${authToken}` } })
        if (statsRes.ok) setStats(await statsRes.json())
      }
    } finally {
      setApprovingId(null)
    }
  }

  const handleShortLeaveAction = async (shortLeaveId: string, status: 'approved' | 'rejected') => {
    const authToken = token()
    if (!authToken) {
      window.location.href = '/login'
      return
    }

    setApprovingId(shortLeaveId)
    try {
      const res = await fetch('/api/short-leave/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ shortLeaveId, status }),
      })
      
      if (res.status === 401) {
        localStorage.removeItem('authToken')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return
      }

      if (res.ok) {
        setShortLeaves((prev) => prev.map((sl) => (sl.id === shortLeaveId ? { ...sl, status } : sl)))
        const statsRes = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${authToken}` } })
        if (statsRes.ok) setStats(await statsRes.json())
      }
    } finally {
      setApprovingId(null)
    }
  }

  const handleOpenMarkModal = (employeeId: string, employeeName: string, date: string) => {
    setSelectedEmployee({ id: employeeId, name: employeeName, date })
    setMarkAction('absent')
    setMarkReason('')
    setShowMarkModal(true)
  }

  const handleMarkAttendance = async () => {
    if (!selectedEmployee) return

    const authToken = token()
    if (!authToken) {
      window.location.href = '/login'
      return
    }

    setMarking(true)
    try {
      const res = await fetch('/api/admin/mark-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          date: selectedEmployee.date,
          action: markAction,
          reason: markReason || undefined,
        }),
      })

      if (res.status === 401) {
        localStorage.removeItem('authToken')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return
      }

      if (res.ok) {
        setShowMarkModal(false)
        setSelectedEmployee(null)
        setMarkReason('')
        fetchAll()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to mark attendance')
      }
    } catch (err) {
      console.error('Mark attendance error:', err)
      alert('Failed to mark attendance')
    } finally {
      setMarking(false)
    }
  }

  const statusColor: Record<string, string> = {
    present: 'bg-green-100 text-green-700',
    late_within_buffer: 'bg-yellow-100 text-yellow-700',
    half_day: 'bg-orange-100 text-orange-700',
    absent: 'bg-red-100 text-red-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
  }

  const badge = (s: string) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor[s] || 'bg-gray-100 text-gray-600'}`}>
      {s?.replace(/_/g, ' ')}
    </span>
  )

  const fmtTime = (iso: string | null) => {
    if (!iso) return '—'
    
    try {
      let timestamp = iso.trim()
      
      // Handle PostgreSQL timestamp format: "2026-05-25 04:48:53.851+00"
      if (timestamp.includes(' ') && !timestamp.includes('T')) {
        timestamp = timestamp.replace(' ', 'T')
        if (timestamp.endsWith('+00')) {
          timestamp = timestamp.replace('+00', 'Z')
        } else if (!timestamp.endsWith('Z')) {
          timestamp = timestamp + 'Z'
        }
      } else if (!timestamp.endsWith('Z') && !timestamp.includes('+')) {
        timestamp = timestamp + 'Z'
      }
      
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return '—'
      
      return date.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true, 
        timeZone: 'Asia/Kolkata' 
      })
    } catch (error) {
      console.error('Error formatting time:', error, iso)
      return '—'
    }
  }

  return (
    <PageWrapper
      title="Dashboard"
      subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')}
      actions={
        <button onClick={fetchAll} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      }
    >
      <div className="space-y-6">
        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/employees" className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Employees</p>
              <p className="text-xs text-gray-400">View & manage</p>
            </div>
          </Link>

          <Link href="/users/create" className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <UserPlus size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Create User</p>
              <p className="text-xs text-gray-400">Add employee</p>
            </div>
          </Link>

          <Link href="/settings" className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <Settings size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Settings</p>
              <p className="text-xs text-gray-400">Office & GPS</p>
            </div>
          </Link>

          <button onClick={() => setShowPasswordModal(true)} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
              <Lock size={18} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Change Password</p>
              <p className="text-xs text-gray-400">Update password</p>
            </div>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Employees', value: stats?.totalEmployees ?? 0, icon: <Users size={20} />, color: 'text-blue-600 bg-blue-50' },
            { label: 'Present Today', value: stats?.presentToday ?? 0, icon: <CheckCircle size={20} />, color: 'text-green-600 bg-green-50' },
            { label: 'Absent Today', value: stats?.absentToday ?? 0, icon: <XCircle size={20} />, color: 'text-red-600 bg-red-50' },
            { label: 'Pending Leaves', value: stats?.pendingLeaves ?? 0, icon: <Calendar size={20} />, color: 'text-yellow-600 bg-yellow-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                {s.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {(['attendance', 'leaves', 'optInDays'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                {tab === 'attendance' ? <Clock size={16} /> : tab === 'leaves' ? <Calendar size={16} /> : <Calendar size={16} />}
                {tab === 'attendance' ? "Today's Attendance" : tab === 'leaves' ? 'Leave Requests' : 'Working Day Requests'}
                {tab === 'attendance' && <span className="ml-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{attendance.length}</span>}
                {tab === 'leaves' && (stats?.pendingLeaves ?? 0) > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">{stats?.pendingLeaves} pending</span>
                )}
                {tab === 'optInDays' && optInWorkingDays.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{optInWorkingDays.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Attendance tab */}
          {activeTab === 'attendance' && (
            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Employee', 'Check In', 'Check Out', 'Status', 'Action'].map(h => (
                        <th key={h} className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {attendance.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">No attendance records for today yet</td></tr>
                    ) : attendance.map((rec) => (
                      <tr key={rec.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{rec.users?.name ?? rec.employee_id}</p>
                          <p className="text-xs text-gray-400">{rec.users?.email}</p>
                        </td>
                        <td className="px-6 py-4 text-gray-700">{fmtTime(rec.check_in)}</td>
                        <td className="px-6 py-4 text-gray-700">{fmtTime(rec.check_out)}</td>
                        <td className="px-6 py-4">{badge(rec.status)}</td>
                        <td className="px-6 py-4">
                          <button onClick={() => handleOpenMarkModal(rec.employee_id, rec.users?.name || 'Employee', rec.date)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline">
                            Mark
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Leaves tab */}
          {activeTab === 'leaves' && (
            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Employee', 'Type', 'Dates', 'Reason', 'Status', 'Action'].map(h => (
                        <th key={h} className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leaves.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">No leave requests found</td></tr>
                    ) : leaves.map((leave) => (
                      <tr key={leave.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{leave.users?.name ?? leave.employee_id}</p>
                          <p className="text-xs text-gray-400">{leave.users?.email}</p>
                        </td>
                        <td className="px-6 py-4 capitalize text-gray-700">{leave.type}</td>
                        <td className="px-6 py-4 text-gray-700">
                          <p>{leave.start_date}</p>
                          {leave.end_date !== leave.start_date && <p className="text-xs text-gray-400">to {leave.end_date}</p>}
                        </td>
                        <td className="px-6 py-4 text-gray-600" style={{ minWidth: '200px', maxWidth: '350px' }}>
                          <p className="whitespace-normal break-words">{leave.reason || '—'}</p>
                        </td>
                        <td className="px-6 py-4">{badge(leave.status)}</td>
                        <td className="px-6 py-4">
                          {leave.status === 'pending' ? (
                            <div className="flex gap-2">
                              <button onClick={() => handleLeaveAction(leave.id, 'approved')} disabled={approvingId === leave.id}
                                className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
                                Approve
                              </button>
                              <button onClick={() => handleLeaveAction(leave.id, 'rejected')} disabled={approvingId === leave.id}
                                className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50 transition">
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 capitalize">{leave.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Short Leaves - shown under leaves tab */}
          {activeTab === 'leaves' && shortLeaves.length > 0 && (
            <div className="overflow-x-auto border-t-4 border-orange-100">
              <div className="px-6 py-3 bg-orange-50 border-b border-orange-200">
                <h4 className="text-sm font-semibold text-orange-900">Short Leave Requests</h4>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Employee', 'Date', 'Type', 'Reason', 'Status', 'Action'].map(h => (
                      <th key={h} className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shortLeaves.map((sl) => (
                    <tr key={sl.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{sl.users?.name ?? sl.employee_id}</p>
                        <p className="text-xs text-gray-400">{sl.users?.email}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{sl.date}</td>
                      <td className="px-6 py-4 capitalize text-gray-700">{sl.short_leave_type}</td>
                      <td className="px-6 py-4 text-gray-600" style={{ minWidth: '200px', maxWidth: '350px' }}>
                        <p className="whitespace-normal break-words">{sl.reason || '—'}</p>
                      </td>
                      <td className="px-6 py-4">{badge(sl.status)}</td>
                      <td className="px-6 py-4">
                        {sl.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleShortLeaveAction(sl.id, 'approved')} disabled={approvingId === sl.id}
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
                              Approve
                            </button>
                            <button onClick={() => handleShortLeaveAction(sl.id, 'rejected')} disabled={approvingId === sl.id}
                              className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50 transition">
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 capitalize">{sl.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Opt-In Working Days tab */}
          {activeTab === 'optInDays' && (
            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Employee', 'Date', 'Day Type', 'Reason'].map(h => (
                        <th key={h} className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {optInWorkingDays.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-400">No employees opted in for Sunday/Saturday work</td></tr>
                    ) : optInWorkingDays.map((opt) => (
                      <tr key={opt.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{opt.users?.name ?? opt.employee_id}</p>
                          <p className="text-xs text-gray-400">{opt.users?.email}</p>
                        </td>
                        <td className="px-6 py-4 text-gray-700">{opt.date}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium capitalize">
                            {opt.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600 max-w-xs"><p className="truncate">{opt.reason || '—'}</p></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Admin Mark Attendance Modal */}
      {showMarkModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Mark Attendance</h3>
              <p className="text-sm text-gray-500 mt-1">
                Employee: <span className="font-medium">{selectedEmployee.name}</span>
              </p>
              <p className="text-xs text-gray-400">Date: {selectedEmployee.date}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
              <select value={markAction} onChange={(e) => setMarkAction(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent">
                <option value="absent">Mark as Absent</option>
                <option value="half_day">Mark as Half Day</option>
                <option value="mark_checkout">Mark Checkout</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason (optional)</label>
              <textarea value={markReason} onChange={(e) => setMarkReason(e.target.value)}
                placeholder="Enter reason for manual marking..." rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-none" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowMarkModal(false); setSelectedEmployee(null); setMarkReason('') }} disabled={marking}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleMarkAttendance} disabled={marking}
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2">
                {marking ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Marking...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </PageWrapper>
  )
}
