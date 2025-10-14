"use client"

import { useEffect, useRef, useState } from "react"
import { Network } from "vis-network"

const getNetworkOptions = (darkMode: boolean) => ({
  nodes: {
    shape: "dot",
    size: 20,
    font: {
      size: 16,
      color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || (darkMode ? "#eee" : "#333"),
      background: darkMode ? "rgba(35, 39, 47, 0.9)" : "rgba(255, 255, 255, 0.9)",
      strokeWidth: 2,
      strokeColor: darkMode ? "#23272f" : "#ffffff",
    },
    borderWidth: 2,
    color: {
      border: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || (darkMode ? "#45B7B8" : "#4ECDC4"),
      background: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || (darkMode ? "#2B7CE9" : "#97C2FC"),
      highlight: {
        border: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-highlight').trim() || (darkMode ? "#FF6B6B" : "#FFD166"),
        background: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-route').trim() || (darkMode ? "#FF8844" : "#FFE5A0"),
      },
    },
  },
  edges: {
    width: 2,
    color: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || (darkMode ? "#666" : "#848484") },
    smooth: {
      enabled: true,
      type: "continuous",
      roundness: 0.2,
    },
    arrows: {
      to: {
        enabled: false,
      },
    },
    font: {
      size: 14,
      color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || (darkMode ? "#eee" : "#333"),
      background: darkMode ? "rgba(35, 39, 47, 0.8)" : "rgba(255, 255, 255, 0.8)",
      strokeWidth: 0,
    },
  },
  groups: {
    central: {
      color: {
        background: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#4ECDC4",
        border: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#45B7B8",
      },
      size: 25,
    },
    neighbor: {
      color: {
        background: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#4ECDC4",
        border: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#45B7B8",
      },
      size: 20,
    },
    source: {
      color: {
        background: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-highlight').trim() || "#FFD166",
        border: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-highlight').trim() || "#3A9BC1",
      },
      size: 15,
    },
    router: {
      color: {
        background: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#4682B4",
        border: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#4682B4",
      },
      size: 20,
    },
  },
  physics: {
    enabled: false,
  },
  layout: {
    randomSeed: 42,
    improvedLayout: true,
    hierarchical: {
      enabled: true,
      direction: "UD",
      sortMethod: "directed",
      nodeSpacing: 150,
      levelSeparation: 200,
    },
  },
  interaction: {
    hover: true,
    tooltipDelay: 300,
    hideEdgesOnDrag: false,
    hideNodesOnDrag: false,
    dragNodes: false,
    dragView: false,
    zoomView: true,
  },
})


interface NetworkMapProps {
  networkData: any
  onNodeHover?: (nodeData: any) => void
  onNodeClick?: (nodeData: any) => void
  onNodeBlur?: () => void
  darkMode?: boolean
  selectedNode?: any
}


export default function NetworkMap({ networkData, onNodeHover, onNodeClick, onNodeBlur, darkMode = false, selectedNode }: NetworkMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)

  useEffect(() => {
    if (containerRef.current && networkData) {
      if (networkRef.current) {
        networkRef.current.destroy()
      }

      // Prepare networkData for vis-network, enforce single highlight color for selected node
      let visData = networkData;
      if (networkData && networkData.nodes && selectedNode) {
        const highlightColor = getComputedStyle(document.documentElement).getPropertyValue('--color-legend-highlight').trim();
        visData = {
          ...networkData,
          nodes: networkData.nodes.map((n: any) => n.id === selectedNode.id ? {
            ...n,
            color: {
              background: highlightColor,
              border: highlightColor
            },
            borderWidth: 4
          } : {
            ...n,
            color: n.color && typeof n.color === 'object' ? { background: n.color.background, border: n.color.border } : n.color,
            borderWidth: 2
          })
        };
      }
      // Explicitly disable arrows in the vis-network instance
      const options = getNetworkOptions(darkMode);
      options.edges.arrows = { to: { enabled: false } }; // Corrected type
      const network = new Network(containerRef.current, visData, options);
      networkRef.current = network;

      network.on("hoverNode", (event) => {
        const nodeId = event.node
        const nodeData = (networkData.nodes || []).find((n: any) => n.id === nodeId)
        if (onNodeHover) {
          onNodeHover(nodeData)
        }
      })

      network.on("click", (event) => {
        if (event.nodes.length > 0) {
          const nodeId = event.nodes[0]
          const nodeData = (networkData.nodes || []).find((n: any) => n.id === nodeId)
          if (onNodeClick) {
            onNodeClick(nodeData)
          }
        } else {
          if (onNodeClick) {
            onNodeClick(null)
          }
        }
      })

      network.on("blurNode", () => {
        if (typeof onNodeBlur === 'function') {
          onNodeBlur();
        }
      })

      return () => {
        if (networkRef.current) {
          networkRef.current.destroy()
        }
      }
    }
  }, [networkData, onNodeHover, onNodeClick, onNodeBlur, darkMode, selectedNode])

  const hasNodes = Array.isArray(networkData?.nodes) && networkData.nodes.length > 0
  const hasEdges = Array.isArray(networkData?.edges) && networkData.edges.length > 0
  return (
    <div style={{ width: "100%", height: "600px" }}>
      {!hasNodes ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#c00" }}>
          No network nodes found. Please check your backend data and refresh.
        </div>
      ) : (
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      )}
    </div>
  )
}
