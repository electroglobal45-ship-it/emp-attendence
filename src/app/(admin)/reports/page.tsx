'use client'

import { useState } from 'react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Download, Users, User } from 'lucide-react'

export default function ReportsPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [downloading, setDownloading] = useState(false)
  const [downloadingIndividual, setDownloadingIndividual] = useState(false)

  /**
   * Downloads monthly all-employee attendance report (matrix format with dates as columns)
   */
  const downloadMonthlyReport = async () => {
    setDownloading(true)
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch(`/api/export/monthly-report?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `monthly-attendance-${year}-${String(month).padStart(2, '0')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Export failed. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  /**
   * Downloads individual employee reports (one sheet per employee)
   */
  const downloadIndividualReports = async () => {
    setDownloadingIndividual(true)
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch(`/api/export/individual-reports?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `individual-reports-${year}-${String(month).padStart(2, '0')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Export failed. Please try again.')
    } finally {
      setDownloadingIndividual(false)
    }
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  return (
    <PageWrapper title="Reports" subtitle="Export attendance and salary data">
      <div className="max-w-4xl space-y-6">
        {/* Month & Year Selection */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-medium text-gray-900 mb-4">Select Period</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              >
                {months.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Monthly All-Employee Report */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Users size={24} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Monthly All-Employee Report</h3>
              <p className="text-sm text-gray-600 mb-4">
                Matrix format with all employees and dates as columns. Shows attendance status, hours worked, 
                and summary totals for each employee.
              </p>
              <ul className="text-xs text-gray-500 mb-4 space-y-1">
                <li>• Dates as columns showing status (Present, Absent, Holiday, etc.)</li>
                <li>• Hours worked per day</li>
                <li>• Summary: Total working days, Total work days, Total work hours</li>
              </ul>
              <button
                onClick={downloadMonthlyReport}
                disabled={downloading}
                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
              >
                <Download size={16} />
                {downloading ? 'Generating...' : 'Download Monthly Report'}
              </button>
            </div>
          </div>
        </div>

        {/* Individual Employee Reports */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <User size={24} className="text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Individual Employee Reports</h3>
              <p className="text-sm text-gray-600 mb-4">
                Detailed individual report for each employee in separate sheets. Includes complete attendance 
                breakdown, leave details, and monthly summary.
              </p>
              <ul className="text-xs text-gray-500 mb-4 space-y-1">
                <li>• One sheet per employee with complete attendance details</li>
                <li>• Date, Check-in/out times, Status, Hours worked, GPS info</li>
                <li>• Leave requests and approvals</li>
                <li>• Monthly summary with totals and statistics</li>
              </ul>
              <button
                onClick={downloadIndividualReports}
                disabled={downloadingIndividual}
                className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
              >
                <Download size={16} />
                {downloadingIndividual ? 'Generating...' : 'Download Individual Reports'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
