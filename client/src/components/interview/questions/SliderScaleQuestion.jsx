import React, { useState } from 'react'
import { Sliders, Send, Loader2 } from 'lucide-react'

export default function SliderScaleQuestion({
  question,
  value = null,
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const config = question.sliderConfig || {}
  const min = typeof config.min === 'number' ? config.min : 1
  const max = typeof config.max === 'number' ? config.max : 10
  const step = typeof config.step === 'number' ? config.step : 1
  const minLabel = config.minLabel || 'Lowest / Beginner'
  const maxLabel = config.maxLabel || 'Highest / Expert'
  const unit = config.unit || ''

  const initialVal = typeof value === 'number'
    ? value
    : (typeof value?.numericValue === 'number' ? value.numericValue : Math.round((min + max) / 2))

  const [currentVal, setCurrentVal] = useState(initialVal)
  const [hasInteracted, setHasInteracted] = useState(
    value !== null && value !== undefined && (typeof value === 'number' || typeof value?.numericValue === 'number')
  )
  const [touchedError, setTouchedError] = useState('')

  const handleChange = (e) => {
    const val = Number(e.target.value)
    setCurrentVal(val)
    setHasInteracted(true)
    setTouchedError('')
    onChange({
      numericValue: val,
      text: `${val}${unit ? ` ${unit}` : ''}`,
      inputMethod: 'slider',
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isSubmitting || isAiSpeaking) return
    if (!hasInteracted) {
      setTouchedError('Please adjust the slider to select your intended value before submitting.')
      return
    }
    onSubmit({
      numericValue: currentVal,
      text: `${currentVal}${unit ? ` ${unit}` : ''}`,
      inputMethod: 'slider',
    })
  }

  const percentage = ((currentVal - min) / (max - min)) * 100

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <Sliders className="w-3.5 h-3.5 text-blue-600" />
          <span>NUMERIC SCALE / SLIDER INPUT</span>
        </div>
        <span>Range: {min} to {max}</span>
      </div>

      {/* Main slider box */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs flex flex-col items-center gap-4">
        {/* Large Value Indicator */}
        <div className="flex flex-col items-center">
          <div className="text-3xl font-bold font-mono text-blue-600 tabular-nums">
            {currentVal} <span className="text-sm font-sans font-normal text-slate-500">{unit}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 font-sans">
            Current Selected Value
          </div>
        </div>

        {/* Range Slider */}
        <div className="w-full px-2">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={currentVal}
            onChange={handleChange}
            disabled={isSubmitting || isAiSpeaking}
            className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50"
          />
        </div>

        {/* Labels at extremes */}
        <div className="w-full flex items-center justify-between text-xs text-slate-600 px-1 font-sans">
          <div className="flex flex-col items-start">
            <span className="font-bold text-slate-800">{min}</span>
            <span className="text-[10px] text-slate-400">{minLabel}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-bold text-slate-800">{max}</span>
            <span className="text-[10px] text-slate-400">{maxLabel}</span>
          </div>
        </div>
      </div>

      {touchedError && (
        <div className="text-xs text-amber-600 font-sans px-1">
          {touchedError}
        </div>
      )}

      {/* Submit Button */}
      <div className="flex items-center justify-end px-1">
        <button
          type="submit"
          disabled={isSubmitting || isAiSpeaking}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-medium text-xs shadow-sm transition cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <span>Submit Rating / Value</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </form>
  )
}
