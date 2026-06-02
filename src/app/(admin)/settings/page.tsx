'use client'

import { useState, useEffect } from 'react'
import { MapPin, AlertCircle, Info } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { redirect } from 'next/navigation'
import { PageWrapper } from '@/components/layout/PageWrapper'

export default function SettingsPage() {
  const { user, isLoading, refreshUser } = useAuth()
  const [office, setOffice] = useState({ name: '', latitude: '', longitude: '', radiusMeters: '100' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (isLoading) return
    if (!user || user.role !== 'admin') { redirect('/login'); return }

    fetch('/api/settings/office')
      .then((r) => r.json())
      .then((d) => {
        if (d.office) {
          setOffice({
            name: d.office.name || '',
            latitude: d.office.latitude?.toString() || '',
            longitude: d.office.longitude?.toString() || '',
            radiusMeters: d.office.radius_meters?.toString() || '100',
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user, isLoading])

  const saveOffice = async () => {
    setError('')
    setSaved(false)
    if (!office.name.trim()) { setError('Office name is required'); return }
    if (!office.latitude || !office.longitude) { setError('Latitude and longitude are required'); return }
    if (!office.radiusMeters || parseInt(office.radiusMeters) <= 0) { setError('Radius must be greater than 0'); return }

    setSaving(true)
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/settings/office', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: office.name,
          latitude: parseFloat(office.latitude),
          longitude: parseFloat(office.longitude),
          radiusMeters: parseInt(office.radiusMeters),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save office location')
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch { setError('Failed to save office location') }
    finally { setSaving(false) }
  }

  const changePassword = async () => {
    setPasswordError('')
    setPasswordSaved(false)
    if (!passwordForm.oldPassword) { setPasswordError('Current password is required'); return }
    if (!passwordForm.newPassword) { setPasswordError('New password is required'); return }
    if (passwordForm.newPassword.length < 6) { setPasswordError('New password must be at least 6 characters'); return }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setPasswordError('Passwords do not match'); return }
    if (passwordForm.oldPassword === passwordForm.newPassword) { setPasswordError('New password must be different'); return }

    setPasswordSaving(true)
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          employeeId: user?.id,
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      })
      const data = await res.json()
      
      if (!res.ok) {
        setPasswordError(data.error || 'Failed to change password')
      } else {
        // Update token if new one provided
        if (data.token) {
          localStorage.setItem('authToken', data.token)
          console.log('✅ Auth token updated after password change')
          
          // CRITICAL: Refresh user session to sync with new token
          console.log('🔄 Refreshing user session...')
          await refreshUser()
          console.log('✅ User session refreshed')
        }
        
        // Handle require login case
        if (data.requireLogin) {
          setPasswordError('Password changed. Please login again.')
          setTimeout(() => {
            localStorage.removeItem('authToken')
            localStorage.removeItem('user')
            window.location.href = '/'
          }, 2000)
          return
        }
        
        setPasswordSaved(true)
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
        setTimeout(() => setPasswordSaved(false), 3000)
      }
    } catch { setPasswordError('Failed to change password') }
    finally { setPasswordSaving(false) }
  }

  if (isLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }
  if (!user || user.role !== 'admin') { redirect('/login') }

  return (
    <PageWrapper title="Settings" subtitle="Configure office location and GPS radius">
      <div className="max-w-2xl space-y-6">

        {/* Office GPS Settings */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={20} className="text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Office Location</h2>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Set your office GPS coordinates and allowed radius. Employees must be within this radius to mark attendance.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {saved && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">✓ Office location saved successfully</p>
            </div>
          )}

          <div className="space-y-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Office Name</label>
              <input value={office.name} onChange={(e) => setOffice({ ...office, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-black"
                placeholder="e.g., Head Office" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input value={office.latitude} onChange={(e) => setOffice({ ...office, latitude: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-black"
                  placeholder="28.6139" type="number" step="0.0001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input value={office.longitude} onChange={(e) => setOffice({ ...office, longitude: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-black"
                  placeholder="77.2090" type="number" step="0.0001" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Radius (meters)</label>
              <input value={office.radiusMeters} onChange={(e) => setOffice({ ...office, radiusMeters: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-black"
                type="number" placeholder="100" min="1" />
              <p className="text-xs text-gray-400 mt-1">Employees outside this range cannot mark attendance.</p>
            </div>
          </div>

          <button onClick={saveOffice} disabled={saving}
            className="w-full py-2.5 px-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 transition">
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Office Location'}
          </button>
        </div>

        {/* How to find coordinates */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">How to Find Your Office Coordinates</h3>
              <ol className="text-sm text-gray-600 space-y-1">
                <li>1. Open <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Maps</a></li>
                <li>2. Search for your office address</li>
                <li>3. Right-click on the pin → click the coordinates at the top</li>
                <li>4. Paste latitude and longitude above</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>

          {passwordError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{passwordError}</p>
            </div>
          )}
          {passwordSaved && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">✓ Password changed successfully</p>
            </div>
          )}

          <div className="space-y-4 mb-5">
            {[
              { label: 'Current Password', key: 'oldPassword', placeholder: 'Enter current password' },
              { label: 'New Password', key: 'newPassword', placeholder: 'Min 6 characters' },
              { label: 'Confirm New Password', key: 'confirmPassword', placeholder: 'Confirm new password' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type="password"
                  value={passwordForm[key as keyof typeof passwordForm]}
                  onChange={(e) => setPasswordForm({ ...passwordForm, [key]: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-black"
                  placeholder={placeholder} />
              </div>
            ))}
          </div>

          <button onClick={changePassword} disabled={passwordSaving}
            className="w-full py-2.5 px-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 transition">
            {passwordSaving ? 'Updating...' : passwordSaved ? '✓ Updated' : 'Change Password'}
          </button>
        </div>

      </div>
    </PageWrapper>
  )
}
