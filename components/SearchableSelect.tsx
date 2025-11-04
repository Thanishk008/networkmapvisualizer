"use client"

import React, { useState, useRef, useEffect } from 'react'

interface SearchableSelectProps {
  id: string
  value: string
  onChange: (value: string) => void
  options: Array<{ id: string; label: string }>
  placeholder: string
  disabled?: boolean
  darkMode?: boolean
  style?: React.CSSProperties
}

export default function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  darkMode = false,
  style = {}
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Get display label for selected value
  const selectedOption = options.find(opt => opt.id === value)
  const displayValue = selectedOption ? selectedOption.label : ''

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = (optionId: string) => {
    onChange(optionId)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setSearchTerm('')
  }

  // Dark mode colors
  const colors = {
    background: darkMode ? '#1e293b' : '#fff',
    border: darkMode ? '#475569' : '#ccc',
    text: darkMode ? '#e2e8f0' : '#000',
    textMuted: darkMode ? '#94a3b8' : '#999',
    textSecondary: darkMode ? '#94a3b8' : '#666',
    disabledBg: darkMode ? '#0f172a' : '#f5f5f5',
    hoverBg: darkMode ? '#334155' : '#f5f5f5',
    selectedBg: darkMode ? '#1e40af' : '#e3f2fd',
    dropdownBg: darkMode ? '#1e293b' : '#fff',
    dropdownBorder: darkMode ? '#475569' : '#ccc',
    inputBg: darkMode ? '#0f172a' : '#fff',
    inputBorder: darkMode ? '#475569' : '#ddd',
    shadow: darkMode ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.15)',
    divider: darkMode ? '#334155' : '#f5f5f5',
    dividerStrong: darkMode ? '#475569' : '#eee'
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {/* Display/Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          padding: '8px 32px 8px 12px',
          borderRadius: 6,
          border: `1px solid ${colors.border}`,
          background: disabled ? colors.disabledBg : colors.background,
          cursor: disabled ? 'not-allowed' : 'pointer',
          minWidth: '200px',
          position: 'relative',
          userSelect: 'none'
        }}
      >
        <span style={{ color: value ? colors.text : colors.textMuted }}>
          {displayValue || placeholder}
        </span>
        
        {/* Clear button */}
        {value && !disabled && (
          <button
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: '24px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              color: colors.textSecondary,
              fontSize: '16px'
            }}
            title="Clear selection"
          >
            ✕
          </button>
        )}
        
        {/* Dropdown arrow */}
        <span
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: `translateY(-50%) rotate(${isOpen ? '180deg' : '0deg'})`,
            transition: 'transform 0.2s',
            fontSize: '12px',
            color: colors.textSecondary
          }}
        >
          ▼
        </span>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: colors.dropdownBg,
            border: `1px solid ${colors.dropdownBorder}`,
            borderRadius: 6,
            boxShadow: colors.shadow,
            maxHeight: '300px',
            overflow: 'hidden',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Search Input */}
          <div style={{ padding: '8px', borderBottom: `1px solid ${colors.dividerStrong}` }}>
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              style={{
                width: '100%',
                padding: '6px 8px',
                border: `1px solid ${colors.inputBorder}`,
                borderRadius: 4,
                fontSize: '14px',
                outline: 'none',
                background: colors.inputBg,
                color: colors.text
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsOpen(false)
                  setSearchTerm('')
                } else if (e.key === 'Enter' && filteredOptions.length === 1) {
                  handleSelect(filteredOptions[0].id)
                }
              }}
            />
          </div>

          {/* Options List */}
          <div style={{ overflowY: 'auto', maxHeight: '250px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', color: colors.textMuted, textAlign: 'center' }}>
                No matches found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    background: option.id === value ? colors.selectedBg : 'transparent',
                    borderBottom: `1px solid ${colors.divider}`,
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (option.id !== value) {
                      e.currentTarget.style.background = colors.hoverBg
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (option.id !== value) {
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  <div style={{ fontWeight: option.id === value ? 600 : 400, color: colors.text }}>
                    {option.label}
                  </div>
                  <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>
                    {option.id}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
