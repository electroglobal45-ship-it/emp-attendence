'use client'

import { useState, useEffect } from 'react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const leaveSchema = z.object({
  leaveType: z.enum(['full_day', 'half_day', 'sick', 'casual', 'earned', 'personal']),
  startDate: z.string().min(1, 'Start date required'),
  endDate:   z.string().min(1, 'End date required'),
  reason:    z.string().min(5, 'Please provide a reason (min 5 characters)'),
})
type LeaveForm = z.infer<typeof leaveSchema>

const shortLeaveSchema = z.object({
  type:   z.enum(['morning', 'evening']),
  reason: z.string().min(3, 'Please provide a reason'),
})
type ShortLeaveForm = z.infer<typeof shortLeaveSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending:  'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return `px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] || 'bg-gray-100 text-gray-600'}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeavesPage() {
  const [tab, setTab] = useState<'leave' | 'short'>('leave')
  const [leaves,      setLeaves]      = useState<any[]>([])
  const [shortLeaves, setShortLeaves] = useState<any[]>([])
  const [loading,     setLoading]     = useState(false)
  const [success,     setSuccess]     = useState<string | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  const token = () => localStorage.getItem('authToken')

  // Leave form
  const { register: regLeave, handleSubmit: handleLeave, reset: resetLeave, formState: { errors: leaveErrors } } =
    useForm<LeaveForm>({ resolver: zodResolver(leaveSchema) })

  // Short leave form
  const { register: regShort, handleSubmit: handleShort, reset: resetShort, formState: { errors: shortErrors } } =
    useForm<ShortLeaveForm>({ resolver: zodResolver(shortLeaveSchema) })

  useEffect(() => {
    fetch('/api/leaves/apply', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => setLeaves(d.leaves || []))
    fetch('/api/short-leave', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => setShortLeaves(d.shortLeaves || []))
  }, [])

  const onLeaveSubmit = async (data: LeaveForm) => {
    setLoading(true); setError(null); setSuccess(null)
    const res = await fetch('/api/leaves/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    setLoading(false)
    if (!res.ok) { setError(result.error); return }
    setSuccess(result.message || 'Leave applied successfully')
    resetLeave()
    setLeaves(prev => [result.leaveRequest, ...prev])
  }

  const onShortLeaveSubmit = async (data: ShortLeaveForm) => {
    setLoading(true); setError(null); setSuccess(null)
    const res = await fetch('/api/short-leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    setLoading(false)
    if (!res.ok) { setError(result.error); return }
    setSuccess(result.message || 'Short leave applied')
    resetShort()
    setShortLeaves(prev => [result.shortLeave, ...prev])
  }

  return (
    <PageWrapper title="Leaves" subtitle="Apply and track your leave requests">
      <div className="max-w-4xl px-4 sm:px-0 space-y-4 sm:space-y-5 pb-6">

        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {(['leave', 'short'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSuccess(null); setError(null) }}
              className={`px-4 sm:px-5 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap touch-manipulation ${tab === t ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'leave' ? 'Full / Half Day Leave' : 'Short Leave'}
            </button>
          ))}
        </div>

        {success && <div className="p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}
        {error   && <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        {/* ── Full/Half Day Leave ── */}
        {tab === 'leave' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            {/* Apply form */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
              <h3 className="font-medium text-gray-900 mb-4 text-base">Apply for Leave</h3>
              <form onSubmit={handleLeave(onLeaveSubmit)} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
                  <select {...regLeave('leaveType')} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black touch-manipulation">
                    <option value="full_day">Full Day Leave</option>
                    <option value="half_day">Half Day Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="casual">Casual Leave</option>
                    <option value="earned">Earned Leave</option>
                    <option value="personal">Personal Leave</option>
                  </select>
                  {leaveErrors.leaveType && <p className="text-xs text-red-500 mt-1">{leaveErrors.leaveType.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input type="date" {...regLeave('startDate')} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black touch-manipulation" />
                  {leaveErrors.startDate && <p className="text-xs text-red-500 mt-1">{leaveErrors.startDate.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input type="date" {...regLeave('endDate')} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black touch-manipulation" />
                  {leaveErrors.endDate && <p className="text-xs text-red-500 mt-1">{leaveErrors.endDate.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
                  <textarea {...regLeave('reason')} rows={3} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black resize-none touch-manipulation" placeholder="Reason for leave..." />
                  {leaveErrors.reason && <p className="text-xs text-red-500 mt-1">{leaveErrors.reason.message}</p>}
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 touch-manipulation">
                  {loading ? 'Applying...' : 'Apply Leave'}
                </button>
              </form>
            </div>

            {/* Leave history */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-gray-200">
                <h3 className="font-medium text-gray-900 text-base">Leave History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Type','From','To','Days','Reason','Status'].map(h => (
                        <th key={h} className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leaves.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No leave requests yet</td></tr>
                    ) : leaves.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-4 py-3 capitalize whitespace-nowrap text-xs sm:text-sm">{(l.type || l.leave_type || '').replace(/_/g, ' ')}</td>
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs sm:text-sm">{l.start_date}</td>
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs sm:text-sm">{l.end_date}</td>
                        <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm">{l.total_days ?? '—'}</td>
                        <td className="px-3 sm:px-4 py-3" style={{ minWidth: '200px', maxWidth: '400px' }}>
                          <div className="text-xs sm:text-sm text-gray-700 whitespace-normal break-words" style={{ wordBreak: 'break-word' }} title={l.reason || '—'}>
                            {l.reason || '—'}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap"><span className={statusBadge(l.status)}>{l.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Short Leave ── */}
        {tab === 'short' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            {/* Apply form */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
              <h3 className="font-medium text-gray-900 mb-2 text-base">Apply Short Leave</h3>
              <p className="text-xs text-gray-500 mb-4">Max 2 hours. First 2/month = full attendance. Beyond 2 = 0.75 value.</p>
              <form onSubmit={handleShort(onShortLeaveSubmit)} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select {...regShort('type')} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black touch-manipulation">
                    <option value="morning">Morning (report by 11:05 AM)</option>
                    <option value="evening">Evening (leave after 4:00 PM)</option>
                  </select>
                  {shortErrors.type && <p className="text-xs text-red-500 mt-1">{shortErrors.type.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
                  <textarea {...regShort('reason')} rows={3} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black resize-none touch-manipulation" placeholder="Reason..." />
                  {shortErrors.reason && <p className="text-xs text-red-500 mt-1">{shortErrors.reason.message}</p>}
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 touch-manipulation">
                  {loading ? 'Applying...' : 'Apply Short Leave'}
                </button>
              </form>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 space-y-1">
                <p><strong>Morning:</strong> Apply before 11:05 AM IST</p>
                <p><strong>Evening:</strong> Apply after 4:00 PM IST</p>
                <p><strong>Limit:</strong> 2 per month at full value; extra at 0.75</p>
              </div>
            </div>

            {/* Short leave history */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-gray-200">
                <h3 className="font-medium text-gray-900 text-base">Short Leave History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Date','Type','Reason','Status'].map(h => (
                        <th key={h} className="text-left px-3 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {shortLeaves.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">No short leave requests yet</td></tr>
                    ) : shortLeaves.map(sl => (
                      <tr key={sl.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs sm:text-sm">{sl.date}</td>
                        <td className="px-3 sm:px-4 py-3 capitalize whitespace-nowrap text-xs sm:text-sm">{sl.short_leave_type}</td>
                        <td className="px-3 sm:px-4 py-3" style={{ minWidth: '200px', maxWidth: '400px' }}>
                          <div className="text-xs sm:text-sm text-gray-700 whitespace-normal break-words" style={{ wordBreak: 'break-word' }} title={sl.reason || '—'}>
                            {sl.reason || '—'}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap"><span className={statusBadge(sl.status)}>{sl.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </PageWrapper>
  )
}
