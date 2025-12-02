"use client"

import React from 'react'

interface InfoPanelProps {
  darkMode: boolean
  onClose: () => void
}

export default function InfoPanel({ darkMode, onClose }: InfoPanelProps) {
  // Colors adapt to theme - matching NodeDetailsPanel
  const bgColor = darkMode ? '#0b1220' : '#ffffff'
  const borderColor = darkMode ? '#24303a' : '#e5e7eb'
  const headerColor = darkMode ? '#f3f4f6' : '#111827'
  const labelColor = darkMode ? '#60a5fa' : '#0066cc'
  const textColor = darkMode ? '#cbd5e1' : '#555'
  const closeButtonBg = darkMode ? '#1e293b' : '#f3f4f6'

  return (
    <div
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '20px',
        minWidth: '300px',
        maxWidth: '350px',
        height: 'fit-content',
        maxHeight: '85vh',
        overflowY: 'auto',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Header with close button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px',
        paddingBottom: '10px',
        borderBottom: `2px solid ${borderColor}`,
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: 'bold',
          color: headerColor,
        }}>
          Network Info
        </h3>
        <button
          onClick={onClose}
          style={{
            background: closeButtonBg,
            border: 'none',
            borderRadius: '6px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            color: darkMode ? '#94a3b8' : '#666',
          }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Data Source Section */}
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ 
          margin: '0 0 8px 0', 
          color: labelColor,
          fontSize: '14px',
          fontWeight: 600
        }}>
          Data Source
        </h4>
        <ul style={{ 
          margin: 0, 
          paddingLeft: '18px',
          color: textColor,
          fontSize: '13px',
          lineHeight: 1.8
        }}>
          <li>C++ Backend Processor</li>
          <li>IPv6 Multicast Routing Tables</li>
          <li>Neighbor Discovery Information</li>
          <li>Interface Configuration Data</li>
        </ul>
      </div>

      {/* Network Details Section */}
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ 
          margin: '0 0 8px 0', 
          color: labelColor,
          fontSize: '14px',
          fontWeight: 600
        }}>
          Network Details
        </h4>
        <ul style={{ 
          margin: 0, 
          paddingLeft: '18px',
          color: textColor,
          fontSize: '13px',
          lineHeight: 1.8
        }}>
          <li>Multicast Group: ff1e::112</li>
          <li>40+ Nodes with Routing Paths</li>
          <li>Up to 4 Direct Neighbor Connections</li>
        </ul>
      </div>

      {/* Visualization Features Section */}
      <div>
        <h4 style={{ 
          margin: '0 0 8px 0', 
          color: labelColor,
          fontSize: '14px',
          fontWeight: 600
        }}>
          Visualization Features
        </h4>
        <ul style={{ 
          margin: 0, 
          paddingLeft: '18px',
          color: textColor,
          fontSize: '13px',
          lineHeight: 1.8
        }}>
          <li>Static Network Layout</li>
          <li>Hover for Node Statistics</li>
          <li>Color-coded Node Types</li>
          <li>Interface-specific Connections</li>
        </ul>
      </div>
    </div>
  )
}
