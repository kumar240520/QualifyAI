import React, { useState, useEffect, useRef } from 'react'

export default function CountUp({
  start = 0,
  end = 100,
  duration = 1.6, // seconds
  decimals = 0,
  prefix = '',
  suffix = '',
  separator = '',
  delay = 0,
  trigger = null, // optional external boolean
  startOnView = true,
  className = '',
}) {
  const [value, setValue] = useState(start)
  const [hasStarted, setHasStarted] = useState(false)
  const elementRef = useRef(null)

  useEffect(() => {
    if (trigger !== null) {
      if (trigger && !hasStarted) {
        setHasStarted(true)
      }
      return
    }

    if (!startOnView) {
      setHasStarted(true)
      return
    }

    const el = elementRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasStarted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [trigger, startOnView, hasStarted])

  useEffect(() => {
    if (!hasStarted) return

    let startTime = null
    let animationFrameId = null
    let timeoutId = null

    // Quartic ease out for a silky smooth deceleration
    const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4)

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime
      const elapsed = (currentTime - startTime) / 1000 // seconds
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easeOutQuart(progress)

      const currentVal = start + (end - start) * easedProgress
      setValue(currentVal)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate)
      } else {
        setValue(end)
      }
    }

    if (delay > 0) {
      timeoutId = setTimeout(() => {
        animationFrameId = requestAnimationFrame(animate)
      }, delay)
    } else {
      animationFrameId = requestAnimationFrame(animate)
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [hasStarted, start, end, duration, delay])

  const formatted = (() => {
    const fixed = value.toFixed(decimals)
    if (!separator) return fixed
    const parts = fixed.split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator)
    return parts.join('.')
  })()

  return (
    <span ref={elementRef} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
