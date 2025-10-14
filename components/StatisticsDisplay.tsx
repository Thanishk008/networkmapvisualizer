"use client"

interface StatisticsDisplayProps {
  nodeData: any
  position: { x: number; y: number }
  darkMode?: boolean
  selectedSource?: string
  selectedTarget?: string
}

export default function StatisticsDisplay({ nodeData, position, darkMode = false, selectedSource, selectedTarget }: StatisticsDisplayProps) {
  if (!nodeData) return null

  const stats = {
    id: nodeData.id,
    label: nodeData.label,
    type: nodeData.type,
    interface: nodeData.interface,
    routeCount: nodeData.routeCount,
    neighborCount: nodeData.neighborCount,
    nextHop: nodeData.nextHop,
    viaInterface: nodeData.viaInterface,
    fullNextHopAddress: nodeData.fullNextHopAddress,
    rx: nodeData.rx, 
    tx: nodeData.tx, 
  }

  // Colors adapt to theme
  const bgColor = darkMode ? '#0b1220' : '#ffffff'
  const borderColor = darkMode ? '#24303a' : '#e5e7eb'
  const shadow = darkMode ? '0 6px 18px rgba(2,6,23,0.6)' : '0 4px 12px rgba(0,0,0,0.12)'
  const headerColor = darkMode ? '#f3f4f6' : '#111827'
  const labelColor = darkMode ? '#94a3b8' : '#6b7280'
  const valueColor = darkMode ? '#e6eef7' : '#111827'

  const containerStyle = {
    position: 'fixed' as const,
    left: position?.x || 20,
    top: position?.y || 20,
    backgroundColor: bgColor,
    border: `1px solid ${borderColor}`,
    borderRadius: '8px',
    padding: '15px',
    boxShadow: shadow,
    zIndex: 1000,
    minWidth: '200px',
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
  }

  const headerStyle = {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    marginBottom: '10px',
    color: headerColor,
    borderBottom: `1px solid ${borderColor}`,
    paddingBottom: '5px',
  }

  const statRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '5px',
  }

  const labelStyle = {
    fontWeight: 'bold' as const,
    color: labelColor,
  }

  const valueStyle = {
    color: valueColor,
  }

  const isSelectedSource = selectedSource && selectedSource === stats.id
  const isSelectedTarget = selectedTarget && selectedTarget === stats.id
  const headerLabel = isSelectedSource ? 'Source Node' : isSelectedTarget ? 'Target Node' : 'Node'

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        {headerLabel}: {stats.id}
      </div>

      <div style={statRowStyle}>
        <span style={labelStyle}>Node ID:</span>
        <span style={valueStyle}>{stats.id}</span>
      </div>

      {(isSelectedSource || isSelectedTarget) && (
        <div style={statRowStyle}>
          <span style={labelStyle}>Node Type:</span>
          <span style={valueStyle}>{isSelectedSource ? 'Source' : 'Target'}</span>
        </div>
      )}

      {stats.interface && (
        <div style={statRowStyle}>
          <span style={labelStyle}>Interface:</span>
          <span style={valueStyle}>{stats.interface}</span>
        </div>
      )}

      {stats.routeCount !== undefined && (
        <div style={statRowStyle}>
          <span style={labelStyle}>Routes:</span>
          <span style={valueStyle}>{stats.routeCount}</span>
        </div>
      )}

      {stats.neighborCount !== undefined && (
        <div style={statRowStyle}>
          <span style={labelStyle}>Neighbors:</span>
          <span style={valueStyle}>{stats.neighborCount}</span>
        </div>
      )}

      {stats.nextHop && (
        <div style={statRowStyle}>
          <span style={labelStyle}>Next Hop:</span>
          <span style={valueStyle}>{stats.nextHop}</span>
        </div>
      )}

      {stats.viaInterface && (
        <div style={statRowStyle}>
          <span style={labelStyle}>Via Interface:</span>
          <span style={valueStyle}>{stats.viaInterface}</span>
        </div>
      )}

      {stats.rx !== undefined && (
        <div style={statRowStyle}>
          <span style={labelStyle}>RX:</span>
          <span style={valueStyle}>{stats.rx}</span>
        </div>
      )}

      {stats.tx !== undefined && (
        <div style={statRowStyle}>
          <span style={labelStyle}>TX:</span>
          <span style={valueStyle}>{stats.tx}</span>
        </div>
      )}

      {stats.fullNextHopAddress && (
        <div style={{ ...statRowStyle, marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #eee" }}>
          <span style={labelStyle}>Full Address:</span>
          <span style={{ ...valueStyle, fontSize: "10px", wordBreak: "break-all" }}>{stats.fullNextHopAddress}</span>
        </div>
      )}
    </div>
  )
}
