/**
 * Device Compatibility Verification for QualifyAI Assessments (Requirement 10)
 * Evaluates user agent, platform touch points, and device capabilities
 * to ensure candidates open interviews exclusively on desktop/laptop environments.
 */

export function checkDeviceCompatibility() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isDesktop: true }
  }

  const userAgent = navigator.userAgent || navigator.vendor || window.opera || ''

  // 1. Mobile & tablet user agent detection regex
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|Silk|Kindle/i
  const isMobileUA = mobileRegex.test(userAgent)

  // 2. iPadOS detection: iPads on iOS 13+ report 'MacIntel' platform but have touch points > 1
  const isIPadOS = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1

  // 3. Screen dimensions & touch capability
  const screenWidth = Math.min(window.screen?.width || window.innerWidth, window.innerWidth)
  const hasCoarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  const hasTouchPoints = (navigator.maxTouchPoints || 0) > 0
  const isSmallScreenTouch = (hasCoarsePointer || hasTouchPoints) && screenWidth < 1024

  const isUnsupported = isMobileUA || isIPadOS || isSmallScreenTouch

  return {
    isDesktop: !isUnsupported,
    isMobile: isMobileUA,
    isTablet: isIPadOS || (isSmallScreenTouch && screenWidth >= 600),
    userAgent,
    detectedType: isIPadOS ? 'iPad / Tablet' : isMobileUA ? 'Mobile Phone' : isSmallScreenTouch ? 'Touch Screen Device' : 'Desktop / Laptop',
  }
}
