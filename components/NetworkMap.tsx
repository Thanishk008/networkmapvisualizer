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
    target: {
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
      // Source nodes should not be auto-highlighted; use the physical link palette
      color: {
        background: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#4ECDC4",
        border: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#45B7B8",
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
    randomSeed: undefined,
    improvedLayout: false,
    hierarchical: {
      enabled: false,
    },
  },
  interaction: {
    hover: true,
    tooltipDelay: 300,
    hideEdgesOnDrag: false,
    hideNodesOnDrag: false,
    dragNodes: true,
    dragView: true,
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

      // Exclude label from edges
      const { nodes, edges } = visData;
      const updatedEdges = edges.map((edge: any) => {
        const { label, ...rest } = edge; // Remove the label property
        return rest;
      });

      // Dynamic layout algorithm without physics
      // Calculate positions based on graph structure using a layered approach
      
      // Build adjacency map from edges
      const adjacencyMap = new Map<string, Set<string>>();
      nodes.forEach((node: any) => {
        adjacencyMap.set(node.id, new Set());
      });
      
      updatedEdges.forEach((edge: any) => {
        if (edge.edgeType === 'direct') {
          adjacencyMap.get(edge.from)?.add(edge.to);
          adjacencyMap.get(edge.to)?.add(edge.from);
        }
      });
      
      // Find the node with type 'target' or the most connected node as root
      let rootNode = nodes.find((n: any) => n.type === 'target');
      if (!rootNode) {
        // Find most connected node
        let maxConnections = 0;
        nodes.forEach((node: any) => {
          const connections = adjacencyMap.get(node.id)?.size || 0;
          if (connections > maxConnections) {
            maxConnections = connections;
            rootNode = node;
          }
        });
      }
      
      // BFS to assign layers
      const layers = new Map<string, number>();
      const visited = new Set<string>();
      const queue: string[] = [rootNode.id];
      layers.set(rootNode.id, 0);
      visited.add(rootNode.id);
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        const currentLayer = layers.get(current)!;
        
        adjacencyMap.get(current)?.forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            layers.set(neighbor, currentLayer + 1);
            queue.push(neighbor);
          }
        });
      }
      
      // Group nodes by layer
      const layerGroups = new Map<number, string[]>();
      layers.forEach((layer, nodeId) => {
        if (!layerGroups.has(layer)) {
          layerGroups.set(layer, []);
        }
        layerGroups.get(layer)!.push(nodeId);
      });
      
      // Calculate positions
      const positionMap: Record<string, { x: number, y: number }> = {};
      const verticalSpacing = 250;
      const horizontalSpacing = 300;
      
      layerGroups.forEach((nodeIds, layer) => {
        const width = (nodeIds.length - 1) * horizontalSpacing;
        const startX = -width / 2;
        
        nodeIds.forEach((nodeId, index) => {
          positionMap[nodeId] = {
            x: startX + index * horizontalSpacing,
            y: layer * verticalSpacing
          };
        });
      });
      
      // Apply positions to nodes
      const positionedNodes = nodes.map((node: any, index: number) => {
        let position = positionMap[node.id];
        
        // If node wasn't positioned (disconnected or not in BFS), assign a default position
        if (!position) {
          const unpositionedOffset = 400;
          position = {
            x: (index % 3) * horizontalSpacing - horizontalSpacing,
            y: Math.floor(index / 3) * verticalSpacing + unpositionedOffset
          };
        }
        
        return {
          ...node,
          x: position.x,
          y: position.y,
          fixed: { x: true, y: true }
        };
      });

      const updatedNetworkData = { nodes: positionedNodes, edges: updatedEdges };

      const network = new Network(containerRef.current, updatedNetworkData, options);
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
