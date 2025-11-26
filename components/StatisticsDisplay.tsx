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
    connectedInterfaces: nodeData.connectedInterfaces, 
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
    minWidth: '300px',
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
  const headerLabel = isSelectedSource ? 'Source' : isSelectedTarget ? 'Target' : 'Node'

  return (
    <div style={containerStyle}>
          <div style={headerStyle}>
            {headerLabel !== 'Node' ? `${headerLabel}: ${stats.label || stats.id}` : stats.label || stats.id}
          </div>

          <div style={statRowStyle}>
            <span style={labelStyle}>Label:</span>
            <span style={valueStyle}>{stats.label || stats.id}</span>
          </div>

          <div style={statRowStyle}>
            <span style={labelStyle}>Node IP:</span>
            <span style={{ ...valueStyle, fontSize: '10px', wordBreak: 'break-all', fontFamily: 'monospace' }}>{nodeData.fullAddress}</span>
          </div>

          {nodeData.nodeIdNumber && (
            <div style={statRowStyle}>
              <span style={labelStyle}>Node ID:</span>
              <span style={valueStyle}>{nodeData.nodeIdNumber}</span>
            </div>
          )}

          {nodeData.ncaNumber && nodeData.nodeNumber && (
            <div style={statRowStyle}>
              <span style={labelStyle}>Group:</span>
              <span style={valueStyle}>NCA : {nodeData.ncaNumber}, Node : {nodeData.nodeNumber}</span>
            </div>
          )}

      {nodeData.allLocalIps && nodeData.allLocalIps.length > 0 && (
        <div style={{ ...statRowStyle, marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${borderColor}`, flexDirection: 'column', gap: '5px' }}>
          <span style={{ ...labelStyle, marginBottom: '5px' }}>Local IP Addresses:</span>
          <div style={{ marginLeft: '10px', fontSize: '11px' }}>
            {nodeData.allLocalIps.map((ipInfo: any, index: number) => (
              <div key={index} style={{ marginBottom: '3px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: labelColor, fontWeight: 'bold' }}>{ipInfo.interface}:</span>
                <span style={{ color: valueColor, fontFamily: 'monospace', fontSize: '10px' }}>{ipInfo.ip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(isSelectedSource || isSelectedTarget) && (
        <div style={statRowStyle}>
          <span style={labelStyle}>Node Type:</span>
          <span style={valueStyle}>{isSelectedSource ? 'Source' : 'Target'}</span>
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

      {stats.fullNextHopAddress && (
        <div style={{ ...statRowStyle, marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #eee" }}>
          <span style={labelStyle}>Full Address:</span>
          <span style={{ ...valueStyle, fontSize: "10px", wordBreak: "break-all" }}>{stats.fullNextHopAddress}</span>
        </div>
      )}

      {Array.isArray(stats.connectedInterfaces) && stats.connectedInterfaces.length > 0 ? (
        <div style={{ ...statRowStyle, marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${borderColor}`, flexDirection: 'column' }}>
          <span style={{ ...labelStyle, marginBottom: '8px' }}>Connections:</span>
          <div style={{ marginLeft: '10px', fontSize: '11px' }}>
            {stats.connectedInterfaces
              .filter((conn: any) => conn && conn.neighbor)
              .map((conn: any, index: number) => (
                <div key={index} style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: index < stats.connectedInterfaces.length - 1 ? `1px solid ${borderColor}` : 'none' }}>
                  <div style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: labelColor, fontWeight: 'bold' }}>{conn.interface}:</span>
                    <span style={{ color: valueColor, fontFamily: 'monospace', fontSize: '10px' }} title={conn.neighborFullIp || conn.neighbor}>
                      {conn.neighborFullIp || conn.neighbor}
                    </span>
                  </div>
                  {(conn.rx_packets !== undefined || conn.tx_packets !== undefined || conn.rtt_ms !== undefined) && (
                    <div style={{ marginLeft: '10px', fontSize: '10px', marginTop: '4px' }}>
                      {conn.rx_packets !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ color: labelColor }}>RX Packets:</span>
                          <span style={{ color: valueColor }}>{conn.rx_packets}</span>
                        </div>
                      )}
                      {conn.tx_packets !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ color: labelColor }}>TX Packets:</span>
                          <span style={{ color: valueColor }}>{conn.tx_packets}</span>
                        </div>
                      )}
                      {conn.rtt_ms !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ color: labelColor }}>RTT:</span>
                          <span style={{ color: valueColor }}>{conn.rtt_ms} ms</span>
                        </div>
                      )}
                      {conn.mdev_rtt_ms !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ color: labelColor }}>Jitter:</span>
                          <span style={{ color: valueColor }}>{conn.mdev_rtt_ms} ms</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
