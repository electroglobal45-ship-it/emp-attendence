'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { uploadSelfie } from '@/lib/supabase-storage'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Camera, MapPin, CheckCircle, Loader2, LogOut, Calendar, AlertCircle } from 'lucide-react'
import { formatTimeIST } from '@/lib/time-utils'
import { checkAttendanceAllowed, getTodayIST, formatDateIST } from '@/lib/date-utils'

export default function AttendancePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  // ALWAYS create refs - don't make them conditional
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)

  const [cameraActive,  setCameraActive]  = useState(false)
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null)
  const [selfieBlob,    setSelfieBlob]    = useState<Blob | null>(null)
  const [gpsData,       setGpsData]       = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null)
  const [gpsLoading,    setGpsLoading]    = useState(false)
  const [gpsError,      setGpsError]      = useState<string | null>(null)
  const [submitting,    setSubmitting]    = useState(false)
  const [submitMsg,     setSubmitMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [todayRecord,   setTodayRecord]   = useState<any>(null)
  const [loadingTodayRecord, setLoadingTodayRecord] = useState(true) // NEW: Track if we're still loading today's record
  
  // Markout states
  const [markoutMode,      setMarkoutMode]      = useState(false)
  const [markoutSelfie,    setMarkoutSelfie]    = useState<string | null>(null)
  const [markoutSelfieBlob, setMarkoutSelfieBlob] = useState<Blob | null>(null)
  const [markoutGPS,       setMarkoutGPS]       = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null)
  
  // Holiday/weekend blocking
  const [holidays, setHolidays] = useState<Array<{ name: string; date: string }>>([])
  const [attendanceBlocked, setAttendanceBlocked] = useState(false)
  const [blockReason, setBlockReason] = useState<string>('')
  const [hasOptedIn, setHasOptedIn] = useState(false)
  const [showOptInModal, setShowOptInModal] = useState(false)
  const [optInReason, setOptInReason] = useState('')
  const [optingIn, setOptingIn] = useState(false)

  // Computed values
  const alreadyCheckedIn  = !!todayRecord?.check_in
  const alreadyMarkedOut = !!todayRecord?.check_out
  const canSubmit = !!selfieBlob && !!gpsData && !submitting

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login')
  }, [user, isLoading, router])

  // Fetch holidays on mount
  useEffect(() => {
    fetch('/api/holidays')
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch holidays')
        return r.json()
      })
      .then(d => {
        console.log('Holidays fetched:', d)
        if (d.holidays && Array.isArray(d.holidays)) {
          setHolidays(d.holidays.map((h: any) => ({ name: h.name, date: h.date })))
        }
      })
      .catch(err => {
        console.error('Error fetching holidays:', err)
        // Continue without holidays - will only block weekends
        setHolidays([])
      })
  }, [])

  // Check if attendance is blocked
  useEffect(() => {
    const checkOptIn = async () => {
      if (!user) return
      
      const today = getTodayIST()
      const check = checkAttendanceAllowed(today, holidays)
      
      // Check if today is Sunday or 3rd Saturday
      const dayOfWeek = new Date(today).getDay()
      const dayOfMonth = new Date(today).getDate()
      const isSunday = dayOfWeek === 0
      const isThirdSaturday = dayOfWeek === 6 && dayOfMonth >= 15 && dayOfMonth <= 21
      
      if (isSunday || isThirdSaturday) {
        // Check if user has opted in for today
        const t = localStorage.getItem('authToken')
        try {
          const res = await fetch(`/api/attendance/opt-in-working-day`, {
            headers: { Authorization: `Bearer ${t}` }
          })
          if (res.ok) {
            const data = await res.json()
            const todayOptIn = data.optIns?.find((opt: any) => opt.date === today)
            if (todayOptIn) {
              setHasOptedIn(true)
              setAttendanceBlocked(false)
              setBlockReason('')
              setSubmitMsg(null) // Clear any previous messages
              return
            }
          }
        } catch (err) {
          console.error('Error checking opt-in:', err)
        }
      }
      
      setAttendanceBlocked(!check.allowed)
      if (!check.allowed) {
        setBlockReason(check.reason || 'Attendance not allowed today')
      }
      
      // Check office hours (8 AM - 6:30 PM)
      const now = new Date()
      const istOffset = 5.5 * 60 * 60 * 1000
      const istDate = new Date(now.getTime() + istOffset)
      const istHour = istDate.getUTCHours()
      const istMinute = istDate.getUTCMinutes()
      const totalMinutes = istHour * 60 + istMinute
      
      // Before 8:00 AM (480 minutes)
      if (totalMinutes < 480) {
        setAttendanceBlocked(true)
        setBlockReason('Too early! Office hours start at 8:00 AM')
      }
      
      // After 6:30 PM (1110 minutes) - only block check-in, not markout
      if (totalMinutes >= 1110 && !alreadyCheckedIn) {
        setAttendanceBlocked(true)
        setBlockReason('Office hours ended at 6:30 PM. Please contact admin if you need to mark attendance.')
      }
    }
    
    checkOptIn()
  }, [holidays, alreadyCheckedIn, user])

  useEffect(() => {
    if (!user) return
    setLoadingTodayRecord(true) // Start loading
    const t = localStorage.getItem('authToken')
    fetch(`/api/attendance/today`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        console.log('Attendance page - Today response:', JSON.stringify(d, null, 2))
        console.log('Attendance page - Record:', d.attendance)
        setTodayRecord(d.attendance || null)
      })
      .catch((err) => {
        console.error('Error fetching today attendance:', err)
      })
      .finally(() => {
        setLoadingTodayRecord(false) // Done loading
      })
  }, [user])

  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach(t => t.stop())
      }
    }
  }, [])

  if (isLoading || loadingTodayRecord) return <div className="min-h-screen flex items-center justify-center"><Loader2 size={32} className="animate-spin text-gray-400" /></div>
  if (!user)     return null

  // Render UI showing attendance already marked - prevent any action
  if (!markoutMode && alreadyCheckedIn && !alreadyMarkedOut) {
    return (
      <PageWrapper title="Attendance" subtitle="Mark your daily attendance">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Attendance Already Marked</h2>
            <p className="text-gray-600 mb-4">You have already checked in for today.</p>
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-500 mb-1">Check-in Time</p>
              <p className="text-lg font-semibold text-gray-900">{formatTimeIST(todayRecord?.check_in)}</p>
            </div>
            {!alreadyMarkedOut && (
              <button
                onClick={() => setMarkoutMode(true)}
                className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition"
              >
                <LogOut size={18} className="inline mr-2" />
                Mark Out
              </button>
            )}
          </div>
        </div>
      </PageWrapper>
    )
  }

  // Render UI showing both check-in and check-out done
  if (alreadyCheckedIn && alreadyMarkedOut) {
    return (
      <PageWrapper title="Attendance" subtitle="Mark your daily attendance">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
            <CheckCircle size={48} className="text-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Attendance Complete</h2>
            <p className="text-gray-600 mb-4">You have completed your attendance for today.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Check-in Time</p>
                <p className="text-lg font-semibold text-gray-900">{formatTimeIST(todayRecord?.check_in)}</p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Mark-out Time</p>
                <p className="text-lg font-semibold text-gray-900">{formatTimeIST(todayRecord?.check_out)}</p>
              </div>
            </div>
          </div>
        </div>
      </PageWrapper>
    )
  }

  const handleOpenCamera = async () => {
    // IMPORTANT: Check attendance status FIRST before opening camera
    if (!markoutMode) {
      // For check-in mode, verify attendance is not already marked
      const t = localStorage.getItem('authToken')
      try {
        setSubmitMsg({ type: 'success', text: 'Checking attendance status...' })
        const checkRes = await fetch('/api/attendance/today', { 
          headers: { Authorization: `Bearer ${t}` } 
        })
        const checkData = await checkRes.json()
        
        if (checkData.attendance?.check_in) {
          // Attendance already marked!
          setTodayRecord(checkData.attendance)
          setSubmitMsg({ type: 'error', text: 'Attendance already marked for today. You cannot mark again.' })
          return
        }
      } catch (err) {
        console.error('Error checking attendance:', err)
        // Continue anyway if check fails
      }
      
      // Check if attendance is blocked
      if (attendanceBlocked) {
        setSubmitMsg({ type: 'error', text: blockReason })
        return
      }
    }

    if (markoutMode) {
      setMarkoutSelfie(null)
      setMarkoutSelfieBlob(null)
    } else {
      setSelfieDataUrl(null)
      setSelfieBlob(null)
    }
    
    setSubmitMsg(null)
    handleGetGPS()

    try {
      // Enhanced camera constraints for better mobile support
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        // Better mobile playback handling
        const playPromise = videoRef.current.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Camera started successfully')
              setCameraActive(true)
            })
            .catch(e => {
              console.error('Play error:', e)
              setSubmitMsg({ type: 'error', text: 'Failed to start camera. Please try again.' })
            })
        } else {
          setCameraActive(true)
        }
      }
    } catch (err: any) {
      console.error('Camera error:', err)
      let errorMsg = 'Camera access denied. Please enable camera permissions in your browser settings.'
      if (err.name === 'NotAllowedError') {
        errorMsg = 'Camera permission denied. Please allow camera access and try again.'
      } else if (err.name === 'NotFoundError') {
        errorMsg = 'No camera found on this device.'
      } else if (err.name === 'NotReadableError') {
        errorMsg = 'Camera is already in use by another app.'
      }
      setSubmitMsg({ type: 'error', text: errorMsg })
    }
  }

  const handleStopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  const handleCapture = () => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) { setSubmitMsg({ type: 'error', text: 'Camera not ready' }); return }
    if (video.videoWidth === 0) { setSubmitMsg({ type: 'error', text: 'Video not ready. Wait a moment.' }); return }

    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.save()
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    ctx.restore()

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    
    if (markoutMode) {
      setMarkoutSelfie(dataUrl)
      canvas.toBlob((blob) => { if (blob) setMarkoutSelfieBlob(blob) }, 'image/jpeg', 0.85)
    } else {
      setSelfieDataUrl(dataUrl)
      canvas.toBlob((blob) => { if (blob) setSelfieBlob(blob) }, 'image/jpeg', 0.85)
    }
    
    handleStopCamera()
  }

  const handleRetake = () => {
    if (markoutMode) {
      setMarkoutSelfie(null)
      setMarkoutSelfieBlob(null)
    } else {
      setSelfieDataUrl(null)
      setSelfieBlob(null)
    }
    handleOpenCamera()
  }

  const handleGetGPS = () => {
    if (!navigator.geolocation) { setGpsError('Geolocation not supported'); return }
    setGpsLoading(true)
    setGpsError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gps = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }
        if (markoutMode) {
          setMarkoutGPS(gps)
        } else {
          setGpsData(gps)
        }
        setGpsLoading(false)
      },
      (err) => {
        if (err.code === 3) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const gps = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }
              if (markoutMode) {
                setMarkoutGPS(gps)
              } else {
                setGpsData(gps)
              }
              setGpsLoading(false)
            },
            (fallbackErr) => {
              const msg = fallbackErr.code === 1 ? 'Permission denied' : fallbackErr.code === 2 ? 'Position unavailable' : 'Timeout'
              setGpsError(msg)
              setGpsLoading(false)
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
          )
        } else {
          const msg = err.code === 1 ? 'Permission denied' : err.code === 2 ? 'Position unavailable' : 'Timeout'
          setGpsError(msg)
          setGpsLoading(false)
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )
  }

  const handleMarkAttendance = async () => {
    // Check if attendance is blocked
    if (attendanceBlocked) {
      setSubmitMsg({ type: 'error', text: blockReason })
      return
    }

    // Validate both selfie and GPS are captured
    if (!selfieBlob) {
      setSubmitMsg({ type: 'error', text: 'Please capture your selfie first' })
      return
    }

    if (!gpsData) {
      setSubmitMsg({ type: 'error', text: 'Please enable GPS location first' })
      return
    }

    // Double-check before submitting
    if (alreadyCheckedIn) {
      setSubmitMsg({ type: 'error', text: 'Attendance already marked for today' })
      return
    }

    setSubmitting(true)
    setSubmitMsg({ type: 'success', text: 'Uploading...' })

    try {
      const selfieFile = new File([selfieBlob], 'selfie.jpg', { type: 'image/jpeg' })
      const selfieURL  = await uploadSelfie(selfieFile, user.id)

      let address = 'Unknown'
      try {
        const geo = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${gpsData.latitude}&lon=${gpsData.longitude}`
        )
        const geoData = await geo.json()
        address = geoData.address?.city || geoData.address?.town || geoData.address?.village || 'Unknown'
      } catch {}

      setSubmitMsg({ type: 'success', text: 'Marking attendance...' })

      const t = localStorage.getItem('authToken')
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          employeeId: user.id,
          latitude:   gpsData.latitude,
          longitude:  gpsData.longitude,
          accuracy:   gpsData.accuracy,
          selfieURL,
          address,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setSubmitMsg({ type: 'error', text: data.error || 'Failed' })
      } else {
        setSubmitMsg({ type: 'success', text: '✓ Attendance marked!' })
        setSelfieDataUrl(null)
        setSelfieBlob(null)
        setGpsData(null)
        // Refresh today's record immediately
        const t2 = localStorage.getItem('authToken')
        const r2 = await fetch('/api/attendance/today', { headers: { Authorization: `Bearer ${t2}` } })
        const d2 = await r2.json()
        setTodayRecord(d2.attendance || null)
      }
    } catch (err: any) {
      setSubmitMsg({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkout = async () => {
    // Validate both selfie and GPS for markout
    if (!markoutSelfieBlob) {
      setSubmitMsg({ type: 'error', text: 'Please capture your markout selfie first' })
      return
    }

    if (!markoutGPS) {
      setSubmitMsg({ type: 'error', text: 'Please enable GPS location for markout' })
      return
    }

    setSubmitting(true)
    setSubmitMsg({ type: 'success', text: 'Uploading markout data...' })

    try {
      // Upload markout selfie
      const selfieFile = new File([markoutSelfieBlob], 'markout-selfie.jpg', { type: 'image/jpeg' })
      const markoutSelfieURL = await uploadSelfie(selfieFile, user.id)

      let address = 'Unknown'
      try {
        const geo = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${markoutGPS.latitude}&lon=${markoutGPS.longitude}`
        )
        const geoData = await geo.json()
        address = geoData.address?.city || geoData.address?.town || geoData.address?.village || 'Unknown'
      } catch {}

      const t = localStorage.getItem('authToken')
      const res = await fetch('/api/attendance/markout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          latitude: markoutGPS.latitude,
          longitude: markoutGPS.longitude,
          accuracy: markoutGPS.accuracy,
          markoutSelfieURL,
          address,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubmitMsg({ type: 'success', text: data.message || '✓ Marked out!' })
        setMarkoutMode(false)
        setMarkoutSelfie(null)
        setMarkoutSelfieBlob(null)
        setMarkoutGPS(null)
        const r2 = await fetch('/api/attendance/today', { headers: { Authorization: `Bearer ${t}` } })
        const d2 = await r2.json()
        setTodayRecord(d2.attendance || null)
      } else {
        setSubmitMsg({ type: 'error', text: data.error || 'Failed to mark out' })
      }
    } catch (err: any) {
      setSubmitMsg({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleOptInForToday = async () => {
    const today = getTodayIST()
    const dayOfWeek = new Date(today).getDay()
    const dayOfMonth = new Date(today).getDate()
    
    let type = ''
    if (dayOfWeek === 0) type = 'sunday'
    else if (dayOfWeek === 6 && dayOfMonth >= 15 && dayOfMonth <= 21) type = 'third_saturday'
    else {
      setSubmitMsg({ type: 'error', text: 'Today is not a Sunday or 3rd Saturday' })
      return
    }

    setOptingIn(true)
    try {
      const t = localStorage.getItem('authToken')
      const res = await fetch('/api/attendance/opt-in-working-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          date: today,
          type,
          reason: optInReason || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setHasOptedIn(true)
        setAttendanceBlocked(false)
        setShowOptInModal(false)
        setOptInReason('')
        setSubmitMsg({ type: 'success', text: '✓ You can now mark attendance for today!' })
      } else {
        // If already opted in, just close modal and show success
        if (data.error?.includes('already opted in')) {
          setHasOptedIn(true)
          setAttendanceBlocked(false)
          setShowOptInModal(false)
          setOptInReason('')
          setSubmitMsg({ type: 'success', text: '✓ You can now mark attendance for today!' })
        } else {
          setSubmitMsg({ type: 'error', text: data.error || 'Failed to opt-in' })
        }
      }
    } catch (err: any) {
      setSubmitMsg({ type: 'error', text: err.message })
    } finally {
      setOptingIn(false)
    }
  }

  return (
    <PageWrapper title="Mark Attendance" subtitle={`Welcome, ${user.name}`}>
      <div className="max-w-xl mx-auto px-4 sm:px-0 space-y-4 sm:space-y-5 pb-6">

        {/* Attendance Blocked Message */}
        {attendanceBlocked && !alreadyCheckedIn && !hasOptedIn && (
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <Calendar size={24} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-blue-900 mb-1">Attendance Not Required</p>
                <p className="text-sm text-blue-700">{blockReason}</p>
              </div>
            </div>
            {(new Date(getTodayIST()).getDay() === 0 || (new Date(getTodayIST()).getDay() === 6 && new Date(getTodayIST()).getDate() >= 15 && new Date(getTodayIST()).getDate() <= 21)) && (
              <button onClick={() => setShowOptInModal(true)}
                className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2 touch-manipulation">
                <Calendar size={16} />
                I Want to Work Today
              </button>
            )}
          </div>
        )}

        {/* Working on Sunday/Saturday Badge */}
        {hasOptedIn && !alreadyCheckedIn && (
          <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle size={24} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-900 mb-1">Working on {new Date(getTodayIST()).getDay() === 0 ? 'Sunday' : '3rd Saturday'}</p>
              <p className="text-sm text-green-700">You can mark your attendance today. This day will count as a working day.</p>
            </div>
          </div>
        )}

        {/* Today's record */}
        {todayRecord && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-3">Today&apos;s Record</p>
            <div className="grid grid-cols-3 gap-3 sm:gap-6">
              <div>
                <p className="text-xs text-gray-400">Check In</p>
                <p className="text-sm font-semibold">{formatTimeIST(todayRecord.check_in)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Mark Out</p>
                <p className="text-sm font-semibold">{formatTimeIST(todayRecord.check_out)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Status</p>
                <p className="text-xs sm:text-sm font-semibold capitalize">{todayRecord.status?.replace(/_/g, ' ') || '—'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Already checked in — show markout */}
        {alreadyCheckedIn && !alreadyMarkedOut && !markoutMode && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-600 mb-3">You are checked in. Ready to mark out?</p>
            <button onClick={() => setMarkoutMode(true)} disabled={submitting}
              className="w-full py-3 px-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation">
              <LogOut size={18} />
              Start Mark Out Process
            </button>
          </div>
        )}

        {/* Markout flow with GPS + Selfie */}
        {alreadyCheckedIn && !alreadyMarkedOut && markoutMode && (
          <>
            {/* Markout Step 1 — Selfie + GPS */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${markoutSelfieBlob ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
                  {markoutSelfieBlob ? '✓' : '1'}
                </div>
                <h2 className="font-semibold text-base sm:text-lg">Mark Out Selfie & Location</h2>
              </div>

              {/* Captured markout selfie preview */}
              {markoutSelfie && (
                <div className="mb-4 relative">
                  <img src={markoutSelfie} alt="Mark Out Selfie" className="w-full rounded-lg border border-gray-200" style={{ maxHeight: '320px', objectFit: 'cover' }} />
                  <button onClick={handleRetake} className="absolute top-2 right-2 px-3 py-1.5 bg-black/70 text-white text-xs rounded-lg touch-manipulation">Retake</button>
                  <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-lg">✓ Captured</div>
                </div>
              )}

              {/* GPS status */}
              {gpsLoading && (
                <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 size={16} className="animate-spin" /> Getting location...
                </div>
              )}
              {markoutGPS && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-green-700 mb-1">✓ Location Detected</p>
                  <p className="text-xs text-gray-600 break-all">Lat: {markoutGPS.latitude.toFixed(6)} | Lng: {markoutGPS.longitude.toFixed(6)}</p>
                  <p className="text-xs text-gray-500">Accuracy: ±{Math.round(markoutGPS.accuracy)}m</p>
                </div>
              )}
              {gpsError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <p className="text-sm text-red-700 flex-1">{gpsError}</p>
                  <button onClick={handleGetGPS} className="text-xs text-red-600 underline whitespace-nowrap touch-manipulation">Retry</button>
                </div>
              )}

              {/* Video — always in DOM, hidden when not active */}
              <div style={{ display: cameraActive ? 'block' : 'none' }} className="mb-4 space-y-3">
                <div className="relative rounded-lg overflow-hidden bg-black w-full" style={{ aspectRatio: '4/3', minHeight: '240px', maxHeight: '400px' }}>
                  <video ref={videoRef} autoPlay playsInline muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block', backgroundColor: '#000' }} />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleCapture}
                    className="flex-1 py-3 px-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 flex items-center justify-center gap-2 touch-manipulation">
                    <Camera size={18} /> Capture
                  </button>
                  <button onClick={handleStopCamera} className="px-4 py-3 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 touch-manipulation">
                    Cancel
                  </button>
                </div>
              </div>

              <canvas ref={canvasRef} className="hidden" />

              {!cameraActive && !markoutSelfie && (
                <button onClick={handleOpenCamera}
                  className="w-full py-3 px-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 flex items-center justify-center gap-2 touch-manipulation">
                  <Camera size={18} /> Open Camera
                </button>
              )}
            </div>

            {/* Markout Step 2 — Submit */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${markoutSelfieBlob && markoutGPS ? 'bg-black text-white' : 'bg-gray-200'}`}>2</div>
                <h2 className="font-semibold text-base sm:text-lg">Complete Mark Out</h2>
              </div>

              <div className="mb-4 space-y-2">
                <div className={`flex items-center gap-2 text-sm ${markoutSelfieBlob ? 'text-green-600' : 'text-gray-400'}`}>
                  <CheckCircle size={16} className="flex-shrink-0" /> Selfie {markoutSelfieBlob ? '✓ ready' : 'pending'}
                </div>
                <div className={`flex items-center gap-2 text-sm ${markoutGPS ? 'text-green-600' : 'text-gray-400'}`}>
                  <MapPin size={16} className="flex-shrink-0" /> GPS {markoutGPS ? '✓ ready' : 'pending'}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setMarkoutMode(false)}
                  className="flex-1 py-3 px-4 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 touch-manipulation">
                  Cancel
                </button>
                <button onClick={handleMarkout} disabled={!markoutSelfieBlob || !markoutGPS || submitting}
                  className="flex-1 py-3.5 px-4 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation text-base">
                  {submitting ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : <><LogOut size={18} /> Mark Out</>}
                </button>
              </div>
              
              {(!markoutSelfieBlob || !markoutGPS) && (
                <p className="text-xs text-gray-500 text-center mt-2">
                  {!markoutSelfieBlob && !markoutGPS ? 'Capture selfie and enable GPS to continue' : 
                   !markoutSelfieBlob ? 'Capture your selfie to continue' : 
                   'Enable GPS location to continue'}
                </p>
              )}
            </div>
          </>
        )}

        {/* Complete */}
        {alreadyCheckedIn && alreadyMarkedOut && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700 font-medium">Attendance complete for today!</p>
          </div>
        )}

        {/* Check-in flow */}
        {!alreadyCheckedIn && !attendanceBlocked && (
          <>
            {/* Step 1 — Selfie + GPS */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${selfieBlob ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
                  {selfieBlob ? '✓' : '1'}
                </div>
                <h2 className="font-semibold text-base sm:text-lg">Take Selfie & Get Location</h2>
              </div>

              {/* Captured selfie preview */}
              {selfieDataUrl && (
                <div className="mb-4 relative">
                  <img src={selfieDataUrl} alt="Selfie" className="w-full rounded-lg border border-gray-200" style={{ maxHeight: '320px', objectFit: 'cover' }} />
                  <button onClick={handleRetake} className="absolute top-2 right-2 px-3 py-1.5 bg-black/70 text-white text-xs rounded-lg touch-manipulation">Retake</button>
                  <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-lg">✓ Captured</div>
                </div>
              )}

              {/* GPS status */}
              {gpsLoading && (
                <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 size={16} className="animate-spin" /> Getting location...
                </div>
              )}
              {gpsData && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-green-700 mb-1">✓ Location Detected</p>
                  <p className="text-xs text-gray-600 break-all">Lat: {gpsData.latitude.toFixed(6)} | Lng: {gpsData.longitude.toFixed(6)}</p>
                  <p className="text-xs text-gray-500">Accuracy: ±{Math.round(gpsData.accuracy)}m</p>
                </div>
              )}
              {gpsError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <p className="text-sm text-red-700 flex-1">{gpsError}</p>
                  <button onClick={handleGetGPS} className="text-xs text-red-600 underline whitespace-nowrap touch-manipulation">Retry</button>
                </div>
              )}

              {/* Video — always in DOM, hidden when not active */}
              <div style={{ display: cameraActive ? 'block' : 'none' }} className="mb-4 space-y-3">
                <div className="relative rounded-lg overflow-hidden bg-black w-full" style={{ aspectRatio: '4/3', minHeight: '240px', maxHeight: '400px' }}>
                  <video ref={videoRef} autoPlay playsInline muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block', backgroundColor: '#000' }} />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleCapture}
                    className="flex-1 py-3 px-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 flex items-center justify-center gap-2 touch-manipulation">
                    <Camera size={18} /> Capture
                  </button>
                  <button onClick={handleStopCamera} className="px-4 py-3 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 touch-manipulation">
                    Cancel
                  </button>
                </div>
              </div>

              <canvas ref={canvasRef} className="hidden" />

              {!cameraActive && !selfieDataUrl && (
                <button onClick={handleOpenCamera}
                  className="w-full py-3 px-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 flex items-center justify-center gap-2 touch-manipulation">
                  <Camera size={18} /> Open Camera
                </button>
              )}
            </div>

            {/* Step 2 — Submit */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${canSubmit ? 'bg-black text-white' : 'bg-gray-200'}`}>2</div>
                <h2 className="font-semibold text-base sm:text-lg">Submit Attendance</h2>
              </div>

              <div className="mb-4 space-y-2">
                <div className={`flex items-center gap-2 text-sm ${selfieBlob ? 'text-green-600' : 'text-gray-400'}`}>
                  <CheckCircle size={16} className="flex-shrink-0" /> Selfie {selfieBlob ? '✓ ready' : 'pending'}
                </div>
                <div className={`flex items-center gap-2 text-sm ${gpsData ? 'text-green-600' : 'text-gray-400'}`}>
                  <MapPin size={16} className="flex-shrink-0" /> GPS {gpsData ? '✓ ready' : 'pending'}
                </div>
              </div>

              <button onClick={handleMarkAttendance} disabled={!canSubmit}
                className="w-full py-3.5 px-4 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation text-base">
                {submitting ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : '✓ Mark Attendance'}
              </button>
              
              {!canSubmit && (
                <p className="text-xs text-gray-500 text-center mt-2">
                  {!selfieBlob && !gpsData ? 'Capture selfie and enable GPS to continue' : 
                   !selfieBlob ? 'Capture your selfie to continue' : 
                   'Enable GPS location to continue'}
                </p>
              )}
            </div>
          </>
        )}

        {/* Status message */}
        {submitMsg && (
          <div className={`rounded-xl p-4 text-sm font-medium ${submitMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {submitMsg.text}
          </div>
        )}

      </div>

      {/* Opt-In Modal */}
      {showOptInModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Work on {new Date(getTodayIST()).getDay() === 0 ? 'Sunday' : '3rd Saturday'}</h3>
              <p className="text-sm text-gray-500 mt-1">
                Opt-in to work today. This day will count as a working day for salary calculation.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason (optional)</label>
              <textarea value={optInReason} onChange={(e) => setOptInReason(e.target.value)}
                placeholder="Why are you working today?" rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowOptInModal(false); setOptInReason('') }} disabled={optingIn}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleOptInForToday} disabled={optingIn}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {optingIn ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Confirming...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {submitMsg && (
        <div className={`fixed bottom-4 left-4 right-4 mx-auto max-w-md p-4 rounded-lg shadow-lg ${submitMsg.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-sm font-medium ${submitMsg.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
            {submitMsg.text}
          </p>
        </div>
      )}
    </PageWrapper>
  )
}
