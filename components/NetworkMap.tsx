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

      // Process edges - add interface labels positioned along the edge
      const { nodes, edges } = visData;
      
      // Create a map to store interface info per node per edge
      const nodeEdgeInterfaces = new Map<string, Array<{edgeId: string, interface: string, connectedTo: string}>>();
      
      edges.forEach((edge: any) => {
        if (edge.edgeType === 'direct') {
          const ifA = edge.interfaceA || '';
          const ifB = edge.interfaceB || '';
          
          // Store interface info for node 'from' (a)
          if (ifA) {
            if (!nodeEdgeInterfaces.has(edge.from)) {
              nodeEdgeInterfaces.set(edge.from, []);
            }
            nodeEdgeInterfaces.get(edge.from)!.push({
              edgeId: edge.id,
              interface: ifA,
              connectedTo: edge.to
            });
          }
          
          // Store interface info for node 'to' (b)
          if (ifB) {
            if (!nodeEdgeInterfaces.has(edge.to)) {
              nodeEdgeInterfaces.set(edge.to, []);
            }
            nodeEdgeInterfaces.get(edge.to)!.push({
              edgeId: edge.id,
              interface: ifB,
              connectedTo: edge.from
            });
          }
        }
      });
      
      // Remove labels from edges - we'll display them differently
      const updatedEdges = edges.map((edge: any) => {
        const { label, ...rest } = edge;
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

      // Custom rendering for interface labels on edges
      network.on("afterDrawing", function (ctx) {
        const positions = network.getPositions();
        
        edges.forEach((edge: any) => {
          if (edge.edgeType === 'direct') {
            const fromPos = positions[edge.from];
            const toPos = positions[edge.to];
            
            if (!fromPos || !toPos) return;
            
            const ifA = edge.interfaceA || '';
            const ifB = edge.interfaceB || '';
            
            // Calculate edge direction vector
            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length === 0) return;
            
            // Normalize direction vector
            const ndx = dx / length;
            const ndy = dy / length;
            
            // Perpendicular vector for offset (rotate 90 degrees)
            const perpX = -ndy;
            const perpY = ndx;
            
            // Position labels at 25% from each end along the edge
            // and offset perpendicular to avoid node labels
            const offsetDistance = 8; // pixels perpendicular offset
            const alongEdge = 0.25; // 25% from each node
            
            const fromLabelX = fromPos.x + dx * alongEdge + perpX * offsetDistance;
            const fromLabelY = fromPos.y + dy * alongEdge + perpY * offsetDistance;
            const toLabelX = toPos.x - dx * alongEdge + perpX * offsetDistance;
            const toLabelY = toPos.y - dy * alongEdge + perpY * offsetDistance;
            
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Draw background and label for interface A (near 'from' node)
            if (ifA) {
              const textWidth = ctx.measureText(ifA).width;
              ctx.fillStyle = darkMode ? 'rgba(35, 39, 47, 0.9)' : 'rgba(255, 255, 255, 0.9)';
              ctx.fillRect(fromLabelX - textWidth/2 - 3, fromLabelY - 7, textWidth + 6, 14);
              ctx.strokeStyle = darkMode ? 'rgba(100, 100, 100, 0.5)' : 'rgba(200, 200, 200, 0.5)';
              ctx.lineWidth = 1;
              ctx.strokeRect(fromLabelX - textWidth/2 - 3, fromLabelY - 7, textWidth + 6, 14);
              ctx.fillStyle = darkMode ? '#eee' : '#333';
              ctx.fillText(ifA, fromLabelX, fromLabelY);
            }
            
            // Draw background and label for interface B (near 'to' node)
            if (ifB) {
              const textWidth = ctx.measureText(ifB).width;
              ctx.fillStyle = darkMode ? 'rgba(35, 39, 47, 0.9)' : 'rgba(255, 255, 255, 0.9)';
              ctx.fillRect(toLabelX - textWidth/2 - 3, toLabelY - 7, textWidth + 6, 14);
              ctx.strokeStyle = darkMode ? 'rgba(100, 100, 100, 0.5)' : 'rgba(200, 200, 200, 0.5)';
              ctx.lineWidth = 1;
              ctx.strokeRect(toLabelX - textWidth/2 - 3, toLabelY - 7, textWidth + 6, 14);
              ctx.fillStyle = darkMode ? '#eee' : '#333';
              ctx.fillText(ifB, toLabelX, toLabelY);
            }
          }
        });
      });

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
