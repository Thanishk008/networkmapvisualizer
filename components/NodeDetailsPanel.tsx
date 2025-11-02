"use client"

interface NodeDetailsPanelProps {
  nodeData: any
  onClose: () => void
  darkMode?: boolean
}

export default function NodeDetailsPanel({ nodeData, onClose, darkMode = false }: NodeDetailsPanelProps) {
  if (!nodeData) return null

  // Colors adapt to theme
  const bgColor = darkMode ? '#0b1220' : '#ffffff'
  const borderColor = darkMode ? '#24303a' : '#e5e7eb'
  const headerColor = darkMode ? '#f3f4f6' : '#111827'
  const labelColor = darkMode ? '#94a3b8' : '#6b7280'
  const valueColor = darkMode ? '#e6eef7' : '#111827'
  const closeButtonBg = darkMode ? '#1e293b' : '#f3f4f6'
  const closeButtonHover = darkMode ? '#334155' : '#e5e7eb'

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '12px',
      padding: '20px',
      minWidth: '350px',
      maxWidth: '450px',
      height: 'fit-content',
      maxHeight: '85vh',
      overflowY: 'auto',
      transition: 'all 0.3s ease',
    }}>
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
          Node Details
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
            color: labelColor,
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = closeButtonHover}
          onMouseLeave={(e) => e.currentTarget.style.background = closeButtonBg}
        >
          ✕
        </button>
      </div>

      {/* Node Name/Label */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{
          margin: '0 0 8px 0',
          fontSize: '16px',
          color: headerColor,
          fontWeight: 'bold',
        }}>
          {nodeData.label || nodeData.id}
        </h4>
        <p style={{
          margin: 0,
          fontSize: '11px',
          color: labelColor,
          fontFamily: 'monospace',
          wordBreak: 'break-all',
        }}>
          {nodeData.fullAddress || nodeData.id}
        </p>
      </div>

      {/* Local IP Addresses Section */}
      {nodeData.allLocalIps && nodeData.allLocalIps.length > 0 ? (
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          background: darkMode ? '#1e293b' : '#f9fafb',
          borderRadius: '8px',
          border: `1px solid ${borderColor}`,
        }}>
          <h4 style={{
            margin: '0 0 10px 0',
            fontSize: '14px',
            fontWeight: 'bold',
            color: headerColor,
          }}>
            Local IP Addresses
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {nodeData.allLocalIps.map((ipInfo: any, index: number) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
              }}>
                <span style={{ color: labelColor, fontWeight: 'bold' }}>
                  {ipInfo.interface || 'unknown'}:
                </span>
                <span style={{
                  color: valueColor,
                  fontFamily: 'monospace',
                  fontSize: '11px',
                }}>
                  {ipInfo.ip}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          background: darkMode ? '#1e293b' : '#f9fafb',
          borderRadius: '8px',
          border: `1px solid ${borderColor}`,
        }}>
          <h4 style={{
            margin: '0 0 10px 0',
            fontSize: '14px',
            fontWeight: 'bold',
            color: headerColor,
          }}>
            Local IP Addresses
          </h4>
          <div style={{ fontSize: '12px', color: labelColor, fontStyle: 'italic' }}>
            No local IP information available for this node
          </div>
        </div>
      )}

      {/* Node Statistics */}
      <div style={{
        marginBottom: '20px',
        padding: '15px',
        background: darkMode ? '#1e293b' : '#f9fafb',
        borderRadius: '8px',
        border: `1px solid ${borderColor}`,
      }}>
        <h4 style={{
          margin: '0 0 10px 0',
          fontSize: '14px',
          fontWeight: 'bold',
          color: headerColor,
        }}>
          Statistics
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
          {nodeData.routeCount !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: labelColor, fontWeight: 'bold' }}>Routes:</span>
              <span style={{ color: valueColor }}>{nodeData.routeCount}</span>
            </div>
          )}
          {nodeData.neighborCount !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: labelColor, fontWeight: 'bold' }}>Neighbors:</span>
              <span style={{ color: valueColor }}>{nodeData.neighborCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Connections Section */}
      {Array.isArray(nodeData.connectedInterfaces) && nodeData.connectedInterfaces.length > 0 && (
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          background: darkMode ? '#1e293b' : '#f9fafb',
          borderRadius: '8px',
          border: `1px solid ${borderColor}`,
        }}>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: 'bold',
            color: headerColor,
          }}>
            Connections
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {nodeData.connectedInterfaces
              .filter((conn: any) => conn && conn.neighbor)
              .map((conn: any, index: number) => (
                <div key={index} style={{
                  padding: '10px',
                  background: darkMode ? '#0f172a' : '#ffffff',
                  borderRadius: '6px',
                  border: `1px solid ${borderColor}`,
                }}>
                  {/* Interface and Neighbor */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    paddingBottom: '8px',
                    borderBottom: `1px solid ${borderColor}`,
                  }}>
                    <span style={{
                      color: labelColor,
                      fontWeight: 'bold',
                      fontSize: '12px',
                    }}>
                      {conn.interface}
                    </span>
                    <span style={{
                      color: valueColor,
                      fontFamily: 'monospace',
                      fontSize: '10px',
                      maxWidth: '200px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {conn.neighbor}
                    </span>
                  </div>

                  {/* Local IP for this interface */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    paddingBottom: '8px',
                    borderBottom: `1px solid ${borderColor}`,
                    fontSize: '11px',
                  }}>
                    <span style={{ color: labelColor }}>Local IP:</span>
                    <span style={{
                      color: conn.localIp ? valueColor : labelColor,
                      fontFamily: conn.localIp ? 'monospace' : 'inherit',
                      fontSize: '10px',
                      fontStyle: conn.localIp ? 'normal' : 'italic',
                    }}>
                      {conn.localIp ? conn.localIp.split(':').pop() : 'N/A'}
                    </span>
                  </div>

                  {/* Traffic Statistics */}
                  {(conn.rx_packets !== undefined || conn.tx_packets !== undefined || conn.rtt_ms !== undefined) && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '6px',
                      fontSize: '11px',
                    }}>
                      {conn.rx_packets !== undefined && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: labelColor, fontSize: '10px' }}>RX Packets</span>
                          <span style={{ color: valueColor, fontWeight: 'bold' }}>{conn.rx_packets}</span>
                        </div>
                      )}
                      {conn.tx_packets !== undefined && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: labelColor, fontSize: '10px' }}>TX Packets</span>
                          <span style={{ color: valueColor, fontWeight: 'bold' }}>{conn.tx_packets}</span>
                        </div>
                      )}
                      {conn.rtt_ms !== undefined && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: labelColor, fontSize: '10px' }}>RTT</span>
                          <span style={{ color: valueColor, fontWeight: 'bold' }}>{conn.rtt_ms} ms</span>
                        </div>
                      )}
                      {conn.mdev_rtt_ms !== undefined && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: labelColor, fontSize: '10px' }}>Jitter</span>
                          <span style={{ color: valueColor, fontWeight: 'bold' }}>{conn.mdev_rtt_ms} ms</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
