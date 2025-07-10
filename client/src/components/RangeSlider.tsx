import React, { useState, useEffect } from 'react'
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
  const maxRankIndex = RANKS.length - 1

  useEffect(() => {
    setMinRank(minValue)
    setMaxRank(maxValue)
  }, [minValue, maxValue])

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    // 両方が九段の場合、下限は自由に動かせる
    if (value <= maxRank || (minRank === maxRankIndex && maxRank === maxRankIndex)) {
      setMinRank(value)
      // 常にリアルタイムで更新
      onRangeChange(value, maxRank)
    }
  }

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    // 両方が20級の場合、上限は自由に動かせる
    if (value >= minRank || (minRank === 0 && maxRank === 0)) {
      setMaxRank(value)
      // 常にリアルタイムで更新
      onRangeChange(minRank, value)
    }
  }



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
          className={`slider slider-min ${minRank === maxRankIndex && maxRank === maxRankIndex ? 'slider-priority' : ''}`}
          aria-label="最小棋力"
        />

        <input
          type="range"
          min="0"
          max={maxRankIndex}
          value={maxRank}
          onChange={handleMaxChange}
          className={`slider slider-max ${minRank === 0 && maxRank === 0 ? 'slider-priority' : ''}`}
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
