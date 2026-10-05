import React from 'react'
import BorderGlow from './BorderGlow.jsx'

export default function TiltCard({
  children,
  className = '',
  innerClassName = '',
  glowColor = 'cyan',
  borderRadius = 28,
  backgroundColor = '#ffffff',
  topAccent,
  onClick,
  style = {},
}) {
  return (
    <BorderGlow
      glowColor={glowColor}
      borderRadius={borderRadius}
      backgroundColor={backgroundColor}
      topAccent={topAccent}
      onClick={onClick}
      className={className}
      innerClassName={innerClassName}
      style={style}
    >
      {children}
    </BorderGlow>
  )
}
