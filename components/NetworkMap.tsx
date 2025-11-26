"use client"

import { useEffect, useRef, useState } from "react"
import { Network } from "vis-network"

const getNetworkOptions = (darkMode: boolean) => ({
  nodes: {
    shape: "box",
    size: 25,
    font: {
      size: 14,
      color: darkMode ? "#ffffff" : "#ffffff",
      face: "Arial",
      bold: { color: darkMode ? "#ffffff" : "#ffffff" }
    },
    borderWidth: 3,
    borderWidthSelected: 4,
    color: {
      border: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || (darkMode ? "#45B7B8" : "#4ECDC4"),
      background: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || (darkMode ? "#4ECDC4" : "#4ECDC4"),
      highlight: {
        border: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-highlight').trim() || (darkMode ? "#FF6B6B" : "#FFD166"),
        background: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-route').trim() || (darkMode ? "#FF8844" : "#FFE5A0"),
      },
    },
    shapeProperties: {
      borderRadius: 4
    }
  },
  edges: {
    width: 0,
    color: { color: 'transparent', opacity: 0 },
    smooth: {
      enabled: false,
      type: "continuous",
      roundness: 0
    },
    arrows: {
      to: {
        enabled: false,
      },
    },
    hidden: true
  },
  groups: {
    target: {
      shape: "box",
      color: {
        background: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#4ECDC4",
        border: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#45B7B8",
      },
      size: 28,
      shapeProperties: { borderRadius: 4 }
    },
    neighbor: {
      shape: "box",
      color: {
        background: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#4ECDC4",
        border: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#45B7B8",
      },
      size: 25,
      shapeProperties: { borderRadius: 4 }
    },
    source: {
      // Source nodes should not be auto-highlighted; use the physical link palette
      shape: "box",
      color: {
        background: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#4ECDC4",
        border: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#45B7B8",
      },
      size: 22,
      shapeProperties: { borderRadius: 4 }
    },
    router: {
      shape: "box",
      color: {
        background: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#4682B4",
        border: getComputedStyle(document.documentElement).getPropertyValue('--color-legend-phys').trim() || "#4682B4",
      },
      size: 25,
      shapeProperties: { borderRadius: 4 }
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

      // Custom rendering: interface boxes in fixed positions (e0=top, e1=right, u0=bottom, u1=left)
      network.on("afterDrawing", function (ctx) {
        const positions = network.getPositions();
        const nodeSize = 25; // Node box size from options
        const interfaceBoxWidth = 24; // Width of interface label box
        const interfaceBoxHeight = 18; // Height of interface label box
        
        // Map interface names to fixed positions: e0=top, e1=right, u0=bottom, u1=left
        const verticalDistance = 30; // Top and bottom distance
        const horizontalDistance = 55; // Left and right distance
        
        const getInterfacePosition = (interfaceName: string) => {
          const name = interfaceName.toLowerCase();
          if (name.includes('eth0') || name.includes('e0')) {
            // Top position
            return { offsetX: 0, offsetY: -verticalDistance };
          } else if (name.includes('eth1') || name.includes('e1')) {
            // Right position
            return { offsetX: horizontalDistance, offsetY: 0 };
          } else if (name.includes('usb0') || name.includes('u0')) {
            // Bottom position
            return { offsetX: 0, offsetY: verticalDistance };
          } else if (name.includes('usb1') || name.includes('u1')) {
            // Left position
            return { offsetX: -horizontalDistance, offsetY: 0 };
          }
          // Default fallback
          return { offsetX: 0, offsetY: -verticalDistance };
        };
        
        // Store interface positions for later connection drawing
        const interfacePositions = new Map<string, { x: number, y: number, nodeId: string, interface: string }>();
        
        // Draw interface labels in fixed positions for each node
        nodeEdgeInterfaces.forEach((interfaces, nodeId) => {
          const nodePos = positions[nodeId];
          if (!nodePos || interfaces.length === 0) return;
          
          // Draw each interface at its designated fixed position
          interfaces.forEach((iface) => {
            const pos = getInterfacePosition(iface.interface);
            
            // Position interface box at fixed position
            const labelX = nodePos.x + pos.offsetX;
            const labelY = nodePos.y + pos.offsetY;
            
            // Store position for connection drawing
            const key = `${nodeId}_${iface.interface}`;
            interfacePositions.set(key, { x: labelX, y: labelY, nodeId, interface: iface.interface });
            
            // Shorten interface name for display
            let displayName = iface.interface;
            if (displayName.startsWith('eth')) {
              displayName = 'e' + displayName.substring(3);
            } else if (displayName.startsWith('usb')) {
              displayName = 'u' + displayName.substring(3);
            } else if (displayName.length > 4) {
              displayName = displayName.substring(0, 4);
            }
            
            ctx.save();
            
            // Draw interface box (attached to node edge)
            ctx.fillStyle = darkMode ? '#2c3e50' : '#34495e';
            ctx.strokeStyle = darkMode ? '#34495e' : '#1a252f';
            ctx.lineWidth = 2;
            
            const boxX = labelX - interfaceBoxWidth / 2;
            const boxY = labelY - interfaceBoxHeight / 2;
            
            // Rounded rectangle for interface box
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, interfaceBoxWidth, interfaceBoxHeight, 3);
            ctx.fill();
            ctx.stroke();
            
            // Draw interface text
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ecf0f1';
            ctx.fillText(displayName, labelX, labelY);
            
            ctx.restore();
          });
        });
        
        // Draw physical connections from interface to interface (not node to node)
        edges.forEach((edge: any) => {
          if (edge.edgeType === 'direct') {
            const ifA = edge.interfaceA || '';
            const ifB = edge.interfaceB || '';
            
            if (!ifA || !ifB) return;
            
            // Get interface positions
            const fromIfaceKey = `${edge.from}_${ifA}`;
            const toIfaceKey = `${edge.to}_${ifB}`;
            
            const fromIface = interfacePositions.get(fromIfaceKey);
            const toIface = interfacePositions.get(toIfaceKey);
            
            if (!fromIface || !toIface) return;
            
            // Draw line connecting the two interface boxes
            ctx.save();
            ctx.strokeStyle = darkMode ? '#666' : '#999';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(fromIface.x, fromIface.y);
            ctx.lineTo(toIface.x, toIface.y);
            ctx.stroke();
            ctx.restore();
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
