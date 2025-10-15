"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import NetworkMap from "./NetworkMap"
import StatisticsDisplay from "./StatisticsDisplay"
import { NetworkDataAdapter } from "@/utils/dataAdapter"

interface BackendNetworkExampleProps {
  darkMode: boolean
}

export default function BackendNetworkExample({ darkMode }: BackendNetworkExampleProps) {
  // Ensure hover is cleared on blur
  const handleNodeBlur = useCallback(() => {
    setHoveredNode(null);
  }, []);
  const [networkData, setNetworkData] = useState<any>(null)
  const [rawBackendData, setRawBackendData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<any>(null)
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [selectedSource, setSelectedSource] = useState("")
  const [selectedTarget, setSelectedTarget] = useState("")
  const [pathLoading, setPathLoading] = useState(false)
  const [pathHighlighted, setPathHighlighted] = useState(false)
  const [pathError, setPathError] = useState<string | null>(null)
  const [noPathExists, setNoPathExists] = useState(false)

  useEffect(() => {
    const loadBackendData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch("/sample-backend-data.json")
        if (!response.ok) {
          throw new Error(`Failed to load backend data: ${response.status} ${response.statusText}`)
        }
        const rawData = await response.json()
        console.log("[v0] Loaded raw backend data:", rawData)

        const physData = NetworkDataAdapter.convertPhysicalOnly(rawData)
        console.log("[v0] Converted to physical data:", physData)

        if (!physData || !physData.nodes || physData.nodes.length === 0) {
          setError(
            "Backend data is missing or malformed. Check sample-backend-data.json and ensure it is in the public folder and matches the expected format.",
          )
          setNetworkData(null)
          return
        }
        setRawBackendData(rawData)
        setNetworkData(NetworkDataAdapter.convertToVisNetwork(physData))
      } catch (err: any) {
        console.error("[v0] Failed to load backend data:", err)
        setError(`Failed to load network data: ${err.message}`)
        setNetworkData(null)
      } finally {
        setLoading(false)
      }
    }
    loadBackendData()
  }, [darkMode])

  // Helper: compute connected interfaces for a given node by scanning all node_route_infos
  const computeConnectedInterfaces = useCallback((nodeId: string) => {
    const conns: Array<{ interface: string; neighbor: string }> = []
    const infos = rawBackendData?.network_map?.node_route_infos || []
    const target = (nodeId || '').toString().trim()
    if (!target) return []

    for (const nodeInfo of infos) {
      const owner = (nodeInfo.node_name || '').toString().trim()

      // If nodeInfo describes the queried node, include its neigh_infos (local view)
      if (owner && owner === target) {
        for (const neigh of nodeInfo.neigh_infos || []) {
          const neighNode = (neigh.neigh_node || neigh.neighbor || '').toString().trim()
          const iface = (neigh.neigh_interface || neigh.interface || '').toString().trim()
          if (neighNode) {
            conns.push({ interface: iface || 'unknown', neighbor: neighNode })
          }
        }
      }

      // If other nodes list the queried node as a neighbor, include that interface pointing to the other node
      for (const neigh of nodeInfo.neigh_infos || []) {
        const neighNode = (neigh.neigh_node || neigh.neighbor || '').toString().trim()
        const iface = (neigh.neigh_interface || neigh.interface || '').toString().trim()
        if (neighNode && neighNode === target) {
          conns.push({ interface: iface || 'unknown', neighbor: owner || nodeInfo.node_name })
        }
      }
    }

    // Deduplicate by normalized interface+neighbor, and sort
    const seen = new Set<string>()
    const dedup: Array<{ interface: string; neighbor: string }> = []
    for (const c of conns) {
      const iface = (c.interface || '').toString().trim()
      const neigh = (c.neighbor || '').toString().trim()
      if (!neigh) continue
      const key = `${iface.toLowerCase()}::${neigh.toLowerCase()}`
      if (!seen.has(key)) {
        seen.add(key)
        dedup.push({ interface: iface || 'unknown', neighbor: neigh })
      }
    }

    // Sort by interface name then neighbor
    dedup.sort((a, b) => a.interface.localeCompare(b.interface) || a.neighbor.localeCompare(b.neighbor))
    return dedup
  }, [rawBackendData])

  const handleNodeHover = useCallback((nodeData: any) => {
    if (!nodeData || !rawBackendData) {
      setHoveredNode(null);
      return;
    }

    const connectedInterfaces = computeConnectedInterfaces(nodeData.id)
    const enrichedNodeData = { ...nodeData, connectedInterfaces: connectedInterfaces.length > 0 ? connectedInterfaces : undefined };
    setHoveredNode(enrichedNodeData);
  }, [rawBackendData, computeConnectedInterfaces])

  const handleNodeClick = useCallback((nodeData: any) => {
    if (!nodeData || !rawBackendData) {
      setSelectedNode(null);
      return;
    }

    // Find backend node info for statistics
    let backendNodeInfo = null;
    for (const nodeInfo of rawBackendData.network_map?.node_route_infos || []) {
      if (nodeInfo.node_name === nodeData.id) {
        backendNodeInfo = nodeInfo;
        break;
      }
    }

    const connectedInterfaces = computeConnectedInterfaces(nodeData.id)
    const mergedNode = { ...nodeData, ...backendNodeInfo, connectedInterfaces: connectedInterfaces.length > 0 ? connectedInterfaces : undefined };
    setSelectedNode(mergedNode);
  }, [rawBackendData, computeConnectedInterfaces])

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    setMousePosition({ x: event.clientX + 10, y: event.clientY + 10 })
  }, [])

  const handleRefreshData = async () => {
    setLoading(true)
    try {
      setError(null)
      const response = await fetch("/sample-backend-data.json")
      if (!response.ok) {
        throw new Error(`Failed to load backend data: ${response.status} ${response.statusText}`)
      }
      const rawData = await response.json()
      const physData = NetworkDataAdapter.convertPhysicalOnly(rawData)
      setNetworkData(NetworkDataAdapter.convertToVisNetwork(physData))
      setRawBackendData(rawData)
    } catch (err: any) {
      console.error("[v0] Failed to refresh network data:", err)
      setError(`Failed to refresh network data: ${err.message}`)
      setNetworkData(null)
    } finally {
      setLoading(false)
    }
  }

  const sourceNodes =
    rawBackendData?.network_map?.node_route_infos
      ?.flatMap((nodeInfo: any) =>
        (nodeInfo.route_infos || []).map((routeInfo: any) => ({
          id: routeInfo.source_node,
          label: `Node ${routeInfo.source_node}`,
        })),
      )
      .filter((node: any, index: number, self: any[]) => index === self.findIndex((n) => n.id === node.id)) || []

  // Build full node list (physical) for target selection
  const physicalList = rawBackendData ? NetworkDataAdapter.convertPhysicalOnly(rawBackendData) : { nodes: [], edges: [] }
  const allNodes = physicalList.nodes || []

  // Compute and highlight path when explicitly requested
  const computeAndHighlightPath = useCallback(() => {
    if (!rawBackendData) return
    const physData = NetworkDataAdapter.convertPhysicalOnly(rawBackendData)
    if (!selectedSource || !selectedTarget) {
      setNetworkData(NetworkDataAdapter.convertToVisNetwork(physData))
      setPathHighlighted(false)
      setNoPathExists(false)
      return
    }
    try {
      const { pathEdges, pathNodes } = NetworkDataAdapter.findPath(physData.nodes, physData.edges, selectedSource, selectedTarget)
      const highlightColor = getComputedStyle(document.documentElement).getPropertyValue('--color-legend-highlight').trim() || (darkMode ? "#FFD166" : "#FF6B6B")
      const highlightEdgeStyle = { color: highlightColor, width: 6, dashes: true, shadow: true, animation: true }
      const highlightNodeStyle = { color: { background: highlightColor, border: highlightColor }, borderWidth: 4 }

      const nodes = physData.nodes.map((n: any) => pathNodes.includes(n.id) ? { ...n, ...highlightNodeStyle } : n)
      const edges = physData.edges.map((e: any) => pathEdges.includes(e.id) ? { ...e, ...highlightEdgeStyle } : e)
      setNetworkData(NetworkDataAdapter.convertToVisNetwork({ nodes, edges }))
      // If a path with at least source and target exists, mark highlighted
      const hasPath = (pathNodes || []).length > 1
      setPathHighlighted(hasPath)
      setNoPathExists(!hasPath)
    } catch (err: any) {
      console.warn('Path compute failed:', err)
      setNetworkData(NetworkDataAdapter.convertToVisNetwork(physData))
      setPathHighlighted(false)
      setNoPathExists(true)
    }
  }, [rawBackendData, selectedSource, selectedTarget, darkMode])

  // When raw data or theme changes, reset to physical topology
  useEffect(() => {
    if (!rawBackendData) return
    const physData = NetworkDataAdapter.convertPhysicalOnly(rawBackendData)
    setNetworkData(NetworkDataAdapter.convertToVisNetwork(physData))
  }, [rawBackendData, darkMode])

  // Listen for a global refresh event so header can host the refresh button
  useEffect(() => {
    const onRefresh = () => {
      if (typeof handleRefreshData === 'function') handleRefreshData()
    }
    window.addEventListener('network-refresh', onRefresh)
    return () => window.removeEventListener('network-refresh', onRefresh)
  }, [])

  if (loading) {
    return <div className="loading-container">Loading network topology...</div>
  }

  // Button styles with small animations
  const btnBase: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease',
  }
  const showBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: '#17a2b8',
    color: '#fff',
    boxShadow: pathLoading ? '0 6px 18px rgba(23,162,184,0.18)' : '0 4px 12px rgba(0,0,0,0.08)'
  }
  const clearBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: '#ffc107',
    color: '#000'
  }
  const refreshBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: '#007bff',
    color: '#fff'
  }

  return (
    <div onMouseMove={handleMouseMove} style={{ width: "100%", height: "100%" }}>
      <div className="network-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: '0 0 auto' }}>
          <h2 className="network-title">Network Map</h2>
          <p className="network-subtitle">Select a source and target to visualize a path.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: '1 1 auto', justifyContent: 'center' }}>
          <div className="source-selector" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label htmlFor="source-select" className="source-label" style={{ fontWeight: 600 }}>Source</label>
            <select id="source-select" value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} className="source-select" style={{ padding: '8px', borderRadius: 6 }}>
              <option value="">-- Select Source Node --</option>
              {sourceNodes.map((node: any) => (
                <option key={node.id} value={node.id}>{node.label}</option>
              ))}
            </select>

            <label htmlFor="target-select" className="source-label" style={{ fontWeight: 600 }}>Target</label>
            <select id="target-select" value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value)} className="source-select" style={{ padding: '8px', borderRadius: 6 }}>
              <option value="">-- Select Target Node --</option>
              {allNodes.map((node: any) => (
                <option key={node.id} value={node.id}>{node.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => { setPathError(''); setPathLoading(true); computeAndHighlightPath(); setTimeout(() => setPathLoading(false), 300) }}
              disabled={loading || !selectedSource || !selectedTarget || selectedSource === selectedTarget}
              className={`action-btn ${pathLoading ? 'is-loading' : ''} ${(!loading && selectedSource && selectedTarget && selectedSource !== selectedTarget) ? 'highlight-enabled' : ''}`}
              style={{ ...showBtnStyle, opacity: (loading || !selectedSource || !selectedTarget || selectedSource === selectedTarget) ? 0.6 : 1 }}
              title={
                !selectedSource || !selectedTarget
                  ? 'Please select both source and target nodes.'
                  : selectedSource === selectedTarget
                  ? 'Source and target nodes are the same. Please select different nodes.'
                  : 'Compute and show shortest path'
              }
            >
              {pathLoading ? 'Computing…' : 'Show Path'}
            </button>

            <button
              onClick={() => {
                setSelectedSource(''); setSelectedTarget(''); setPathError('');
                setNoPathExists(false)
                if (rawBackendData) {
                  const physData = NetworkDataAdapter.convertPhysicalOnly(rawBackendData)
                  setNetworkData(NetworkDataAdapter.convertToVisNetwork(physData))
                }
                setPathHighlighted(false)
              }}
              disabled={loading}
              className="action-btn clear-variant highlight-enabled"
              style={clearBtnStyle}
            >
              Clear Path
            </button>
          </div>
        </div>

        {/* Refresh button moved to header; component will listen for a global 'network-refresh' event */}
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          <div className="error-hint">
            Make sure the sample-backend-data.json file is in the public folder and the server is running.
          </div>
        </div>
      )}

      <div className="network-container" style={{ width: "100%", height: "600px", position: "relative" }}>
        {noPathExists && (
          <div style={{ color: '#ff4d4f', fontWeight: 700, marginBottom: 8, textAlign: 'center', fontStyle: 'italic' }}>
            No path exists between the selected nodes.
          </div>
        )}
        {networkData ? (
          <>
            <NetworkMap
              networkData={networkData}
              onNodeHover={handleNodeHover}
              onNodeClick={handleNodeClick}
              darkMode={darkMode}
              selectedNode={selectedNode}
              onNodeBlur={handleNodeBlur}
            />
            {hoveredNode && (
              <StatisticsDisplay nodeData={hoveredNode} position={mousePosition} darkMode={darkMode} selectedSource={selectedSource} selectedTarget={selectedTarget} />
            )}
          </>
        ) : (
          <div className="no-data-message">{error ? "Failed to load network data" : "No network data available"}</div>
        )}
      </div>

      <div className="legend" style={{ marginTop: "20px" }}>
        <h3 style={{ margin: "0 0 10px 0", fontWeight: 600 }}>Legend</h3>
        <div style={{ display: "flex", gap: "30px", flexWrap: "wrap", fontSize: "15px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="legend-phys" style={{ width: "16px", height: "16px", borderRadius: "50%" }}></div>
            <span>Physical Connection</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="legend-route" style={{ width: "16px", height: "16px", borderRadius: "50%" }}></div>
            <span>Highlighted Multicast Route</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="legend-phys" style={{ width: "16px", height: "2px", borderRadius: "1px" }}></div>
            <span>Direct Link</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              className="legend-highlight edge-highlight"
              style={{ width: "16px", height: "2px", borderRadius: "1px" }}
            ></div>
            <span>Multicast Route Path</span>
          </div>
        </div>
      </div>
    </div>
  )
}
