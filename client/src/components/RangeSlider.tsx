import React, { useState, useEffect, useRef } from 'react'
import { RANKS, numberToRank } from '../utils/rankUtils'
import '../styles/RangeSlider.css'

interface RangeSliderProps {
  minValue: number
  maxValue: number
  onRangeChange: (min: number, max: number) => void
}

export const RangeSlider: React.FC<RangeSliderProps> = ({ minValue, maxValue, onRangeChange }) => {
  const [minRank, setMinRank] = useState(minValue)
  const [maxRank, setMaxRank] = useState(maxValue)
  const [isDragging, setIsDragging] = useState(false)
  const maxRankIndex = RANKS.length - 1
  const pendingChangeRef = useRef<{ min: number; max: number } | null>(null)

  useEffect(() => {
    setMinRank(minValue)
    setMaxRank(maxValue)
  }, [minValue, maxValue])

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    if (value <= maxRank) {
      setMinRank(value)
      if (isDragging) {
        pendingChangeRef.current = { min: value, max: maxRank }
      } else {
        onRangeChange(value, maxRank)
      }
    }
  }

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    if (value >= minRank) {
      setMaxRank(value)
      if (isDragging) {
        pendingChangeRef.current = { min: minRank, max: value }
      } else {
        onRangeChange(minRank, value)
      }
    }
  }

  const handleMouseDown = () => {
    setIsDragging(true)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    if (pendingChangeRef.current) {
      onRangeChange(pendingChangeRef.current.min, pendingChangeRef.current.max)
      pendingChangeRef.current = null
    }
  }

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp()
      }
    }

    document.addEventListener('mouseup', handleGlobalMouseUp)
    document.addEventListener('touchend', handleGlobalMouseUp)

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp)
      document.removeEventListener('touchend', handleGlobalMouseUp)
    }
  }, [isDragging])


  return (
    <div className="range-slider-container">
      <div className="range-display">
        <span className="rank-label">{numberToRank(minRank)}</span>
        <span className="range-separator">〜</span>
        <span className="rank-label">{numberToRank(maxRank)}</span>
      </div>

      <div className="slider-wrapper">
        <div className="slider-track">
          <div
            className="slider-range"
            style={{
              left: `${(minRank / maxRankIndex) * 100}%`,
              width: `${((maxRank - minRank) / maxRankIndex) * 100}%`,
            }}
          />
        </div>

        <input
          type="range"
          min="0"
          max={maxRankIndex}
          value={minRank}
          onChange={handleMinChange}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          className="slider slider-min"
          aria-label="最小棋力"
        />

        <input
          type="range"
          min="0"
          max={maxRankIndex}
          value={maxRank}
          onChange={handleMaxChange}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          className="slider slider-max"
          aria-label="最大棋力"
        />
      </div>

      <div className="rank-labels">
        <span className="rank-label-start">{RANKS[0]}</span>
        <span className="rank-label-end">{RANKS[maxRankIndex]}</span>
      </div>
    </div>
  )
}
