/**
 * Time utility functions for IST timezone
 */

/**
 * Convert UTC timestamp to IST and format for display
 * IST is UTC + 5 hours 30 minutes
 * 
 * IMPORTANT: Handles multiple timestamp formats:
 * - ISO format: 2026-05-25T04:48:53.851Z
 * - PostgreSQL format: 2026-05-25 04:48:53.851+00
 * - Without timezone: 2026-05-25 04:48:53.851
 */
export function formatTimeIST(utcTimestamp: string | null): string {
  if (!utcTimestamp) return '—'
  
  try {
    let timestamp = utcTimestamp.trim()
    
    // Handle PostgreSQL timestamp format: "2026-05-25 04:48:53.851+00"
    // Convert to ISO format by replacing space with T and +00 with Z
    if (timestamp.includes(' ') && !timestamp.includes('T')) {
      timestamp = timestamp.replace(' ', 'T')
      if (timestamp.endsWith('+00')) {
        timestamp = timestamp.replace('+00', 'Z')
      } else if (!timestamp.endsWith('Z')) {
        timestamp = timestamp + 'Z'
      }
    } else if (!timestamp.endsWith('Z') && !timestamp.includes('+')) {
      // Add Z if no timezone indicator
      timestamp = timestamp + 'Z'
    }
    
    // Create date object from UTC timestamp
    const date = new Date(timestamp)
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date after conversion:', utcTimestamp, '→', timestamp)
      return '—'
    }
    
    // Format in IST timezone
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    })
  } catch (error) {
    console.error('Error formatting time:', error, utcTimestamp)
    return '—'
  }
}

/**
 * Format date in IST
 */
export function formatDateIST(utcTimestamp: string): string {
  // Ensure timestamp has Z suffix
  const timestamp = utcTimestamp.endsWith('Z') ? utcTimestamp : utcTimestamp + 'Z'
  const date = new Date(timestamp)
  
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Kolkata'
  })
}

/**
 * Calculate hours between two timestamps
 */
export function calculateHours(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return '—'
  
  try {
    // Handle different timestamp formats
    let checkInTimestamp = checkIn.trim()
    let checkOutTimestamp = checkOut.trim()
    
    // Convert PostgreSQL format to ISO format
    if (checkInTimestamp.includes(' ') && !checkInTimestamp.includes('T')) {
      checkInTimestamp = checkInTimestamp.replace(' ', 'T')
      if (checkInTimestamp.endsWith('+00')) {
        checkInTimestamp = checkInTimestamp.replace('+00', 'Z')
      } else if (!checkInTimestamp.endsWith('Z') && !checkInTimestamp.includes('+')) {
        checkInTimestamp = checkInTimestamp + 'Z'
      }
    } else if (!checkInTimestamp.endsWith('Z') && !checkInTimestamp.includes('+')) {
      checkInTimestamp = checkInTimestamp + 'Z'
    }
    
    if (checkOutTimestamp.includes(' ') && !checkOutTimestamp.includes('T')) {
      checkOutTimestamp = checkOutTimestamp.replace(' ', 'T')
      if (checkOutTimestamp.endsWith('+00')) {
        checkOutTimestamp = checkOutTimestamp.replace('+00', 'Z')
      } else if (!checkOutTimestamp.endsWith('Z') && !checkOutTimestamp.includes('+')) {
        checkOutTimestamp = checkOutTimestamp + 'Z'
      }
    } else if (!checkOutTimestamp.endsWith('Z') && !checkOutTimestamp.includes('+')) {
      checkOutTimestamp = checkOutTimestamp + 'Z'
    }
    
    const start = new Date(checkInTimestamp)
    const end = new Date(checkOutTimestamp)
    
    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error('Invalid dates for hours calculation:', checkIn, checkOut)
      return '—'
    }
    
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    
    // Return — if hours is negative or 0
    if (hours <= 0) return '—'
    
    return `${hours.toFixed(1)}h`
  } catch (error) {
    console.error('Error calculating hours:', error, checkIn, checkOut)
    return '—'
  }
}
