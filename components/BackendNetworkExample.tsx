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

  const handleNodeHover = useCallback((nodeData: any) => {
    setHoveredNode(nodeData)
  }, [])

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
      for (const neighInfo of nodeInfo.neigh_infos || []) {
        if (neighInfo.neigh_node === nodeData.id) {
          backendNodeInfo = neighInfo;
          break;
        }
      }
    }
    // Merge vis-network nodeData with backendNodeInfo
    const mergedNode = { ...nodeData, ...backendNodeInfo };
    setSelectedNode(mergedNode);
  }, [rawBackendData])

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

  const centralNodeId = rawBackendData?.network_map?.node_route_infos?.[0]?.node_name || ""

  useEffect(() => {
    if (!selectedSource || !rawBackendData) {
      if (rawBackendData) {
        const physData = NetworkDataAdapter.convertPhysicalOnly(rawBackendData)
        setNetworkData(NetworkDataAdapter.convertToVisNetwork(physData))
      }
      return
    }
    const fullData = NetworkDataAdapter.convertFromBackend(rawBackendData)
    const directEdge = fullData.edges?.find(
      (e: any) => e.from === centralNodeId && e.to === selectedSource && e.edgeType === "direct",
    )
    if (directEdge) {
      const physData = NetworkDataAdapter.convertPhysicalOnly(rawBackendData)
      setNetworkData(NetworkDataAdapter.convertToVisNetwork(physData))
    } else {
      const physData = NetworkDataAdapter.convertPhysicalOnly(rawBackendData)
      const routeEdge = fullData.edges?.find(
        (e: any) => e.from === selectedSource && e.to === centralNodeId && e.edgeType === "route",
      )
      if (routeEdge) {
        physData.edges.push({
          ...routeEdge,
          color: darkMode ? "#FFD166" : "#FF6B6B",
          width: 6,
          dashes: true,
          shadow: true,
          animation: true,
        })
      }
      setNetworkData(NetworkDataAdapter.convertToVisNetwork(physData))
    }
  }, [selectedSource, rawBackendData, centralNodeId, darkMode])

  if (loading) {
    return <div className="loading-container">Loading network topology...</div>
  }

  return (
    <div onMouseMove={handleMouseMove} style={{ width: "100%", height: "100%" }}>
      <div className="network-controls">
        <div>
          <h2 className="network-title">Network Map (Physical Links)</h2>
          <p className="network-subtitle">
            Select a source node to highlight multicast route.
          </p>
        </div>
        <div className="source-selector">
          <label htmlFor="source-select" className="source-label">
            Highlight Path from Source:
          </label>
          <select
            id="source-select"
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="source-select"
          >
            <option value="">-- Select Source Node --</option>
            {sourceNodes.map((node: any) => (
              <option key={node.id} value={node.id}>
                {node.label}
              </option>
            ))}
          </select>
        </div>
        <button onClick={handleRefreshData} disabled={loading} className="refresh-button">
          {loading ? "Refreshing..." : "Refresh Data"}
        </button>
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
              <StatisticsDisplay nodeData={hoveredNode} position={mousePosition} />
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
