'use client'

import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { ChangePasswordModal } from '@/components/ChangePasswordModal'
import { Clock, Calendar, DollarSign, CheckCircle, ArrowRight, Lock } from 'lucide-react'
import { format } from 'date-fns'
import { formatTimeIST } from '@/lib/time-utils'

export default function EmployeeDashboard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [todayAttendance, setTodayAttendance] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login')
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user) return
    const token = localStorage.getItem('authToken')
    fetch('/api/attendance/today', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        console.log('Home - Today attendance response:', JSON.stringify(d, null, 2))
        console.log('Home - Attendance object:', d.attendance)
        setTodayAttendance(d.attendance || null)
      })
      .catch((err) => {
        console.error('Home - Error fetching attendance:', err)
      })
      .finally(() => setLoading(false))
  }, [user])

  if (isLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  }

  const checkedIn  = !!todayAttendance?.check_in
  const checkedOut = !!todayAttendance?.check_out

  return (
    <PageWrapper
      title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${user?.name?.split(' ')[0]}`}
      subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')}
    >
      <div className="max-w-2xl px-4 sm:px-0 space-y-4 sm:space-y-5 pb-6">

        {/* Office Hours Info Card */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Clock size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Office Hours</h3>
              <p className="text-sm text-gray-600 mb-2">Monday to Saturday (except 3rd Saturday)</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/60 rounded-lg p-2">
                  <p className="text-xs text-gray-500">Start Time</p>
                  <p className="font-semibold text-gray-900">8:00 AM</p>
                </div>
                <div className="bg-white/60 rounded-lg p-2">
                  <p className="text-xs text-gray-500">End Time</p>
                  <p className="font-semibold text-gray-900">6:30 PM</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ℹ️ Attendance can be marked from 8:00 AM to 6:30 PM
              </p>
            </div>
          </div>
        </div>

        {/* Today's attendance card */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 text-base sm:text-lg">Today&apos;s Attendance</h2>
            {checkedIn && !checkedOut && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium whitespace-nowrap">Checked In</span>
            )}
            {checkedIn && checkedOut && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium flex items-center gap-1 whitespace-nowrap">
                <CheckCircle size={12} className="flex-shrink-0" /> Complete
              </span>
            )}
            {!checkedIn && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full font-medium whitespace-nowrap">Not marked</span>
            )}
          </div>

          {todayAttendance ? (
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Check In</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatTimeIST(todayAttendance.check_in)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Mark Out</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatTimeIST(todayAttendance.check_out)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Status</p>
                <p className="text-xs sm:text-sm font-semibold text-gray-900 capitalize break-words">
                  {todayAttendance.status?.replace(/_/g, ' ') || '—'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-sm text-gray-500">You haven&apos;t marked attendance yet today.</p>
              <Link
                href="/attendance"
                className="flex items-center gap-1 text-sm font-medium text-black hover:underline whitespace-nowrap touch-manipulation"
              >
                Mark now <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Link
            href="/attendance"
            className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 hover:shadow-md transition group touch-manipulation"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3 flex-shrink-0">
              <Clock size={20} className="text-blue-600" />
            </div>
            <p className="font-medium text-gray-900 text-sm">Mark Attendance</p>
            <p className="text-xs text-gray-400 mt-0.5">GPS + Selfie required</p>
          </Link>

          <Link
            href="/leaves"
            className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 hover:shadow-md transition group touch-manipulation"
          >
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mb-3 flex-shrink-0">
              <Calendar size={20} className="text-green-600" />
            </div>
            <p className="font-medium text-gray-900 text-sm">Apply Leave</p>
            <p className="text-xs text-gray-400 mt-0.5">Full day, half day, or short leave</p>
          </Link>

          <Link
            href="/salary"
            className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 hover:shadow-md transition group touch-manipulation"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center mb-3 flex-shrink-0">
              <DollarSign size={20} className="text-purple-600" />
            </div>
            <p className="font-medium text-gray-900 text-sm">My Salary</p>
            <p className="text-xs text-gray-400 mt-0.5">View payslip details</p>
          </Link>
        </div>

        {/* Account settings */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
          <h2 className="font-semibold text-gray-900 mb-4 text-base sm:text-lg">Account Settings</h2>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition touch-manipulation"
          >
            <Lock size={18} className="text-gray-600 flex-shrink-0" />
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-gray-900">Change Password</p>
              <p className="text-xs text-gray-400">Update your login password</p>
            </div>
            <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />
          </button>
        </div>

      </div>

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </PageWrapper>
  )
}
