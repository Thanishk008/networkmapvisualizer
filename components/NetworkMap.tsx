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
  const [nodePositionData, setNodePositionData] = useState<any>(null)
  const nodePositionDataRef = useRef<any>(null)
  
  // Use refs for callbacks to avoid dependency array issues
  const onNodeHoverRef = useRef(onNodeHover)
  const onNodeClickRef = useRef(onNodeClick)
  const onNodeBlurRef = useRef(onNodeBlur)
  
  useEffect(() => {
    onNodeHoverRef.current = onNodeHover
    onNodeClickRef.current = onNodeClick
    onNodeBlurRef.current = onNodeBlur
  })

  // Load node position data on mount
  useEffect(() => {
    fetch('/node-positions.json')
      .then(res => res.json())
      .then(data => {
        // Create TWO maps:
        // 1. nodeName -> nodeId (for nodes with nodeName field)
        // 2. shortId -> nodeId (for nodes without nodeName, lookup by their short ID)
        const nodeMap: Record<string, string> = {};
        const idMap: Record<string, string> = {};
        
        data.nodeInfo?.forEach((node: any) => {
          if (node.nodeName && node.nodeId) {
            nodeMap[node.nodeName] = node.nodeId;
            
            // Also extract the short ID from nodeName and create reverse mapping
            // e.g., "Node00b01973dfaf" -> extract "dfaf" (last 4 hex chars)
            if (node.nodeName.startsWith('Node') && node.nodeName.length > 4) {
              const hexPart = node.nodeName.substring(4); // Remove "Node" prefix
              const shortId = hexPart.substring(hexPart.length - 4); // Last 4 chars
              // Convert to number and back to remove leading zeros
              const normalizedShortId = parseInt(shortId, 16).toString(16);
              idMap[normalizedShortId] = node.nodeId;
            }
          }
        });
        
        // Combine both maps
        const combinedMap = { ...nodeMap, ...idMap };
        setNodePositionData(combinedMap);
        nodePositionDataRef.current = combinedMap;
      })
      .catch(err => console.error('Failed to load node positions:', err));
  }, []);

  useEffect(() => {
    if (containerRef.current && networkData && nodePositionData) {
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
      
      // Create a map to store unique interfaces per node
      const nodeEdgeInterfaces = new Map<string, Map<string, {edgeId: string, interface: string, connectedTo: string}>>();
      
      edges.forEach((edge: any) => {
        if (edge.edgeType === 'direct') {
          const ifA = edge.interfaceA || '';
          const ifB = edge.interfaceB || '';
          
          // Store interface info for node 'from' (a) - deduplicated by interface name
          if (ifA) {
            if (!nodeEdgeInterfaces.has(edge.from)) {
              nodeEdgeInterfaces.set(edge.from, new Map());
            }
            // Only store if this interface hasn't been added yet for this node
            if (!nodeEdgeInterfaces.get(edge.from)!.has(ifA)) {
              nodeEdgeInterfaces.get(edge.from)!.set(ifA, {
                edgeId: edge.id,
                interface: ifA,
                connectedTo: edge.to
              });
            }
          }
          
          // Store interface info for node 'to' (b) - deduplicated by interface name
          if (ifB) {
            if (!nodeEdgeInterfaces.has(edge.to)) {
              nodeEdgeInterfaces.set(edge.to, new Map());
            }
            // Only store if this interface hasn't been added yet for this node
            if (!nodeEdgeInterfaces.get(edge.to)!.has(ifB)) {
              nodeEdgeInterfaces.get(edge.to)!.set(ifB, {
                edgeId: edge.id,
                interface: ifB,
                connectedTo: edge.from
              });
            }
          }
        }
      });
      
      // Remove labels from edges - we'll display them differently
      const updatedEdges = edges.map((edge: any) => {
        const { label, ...rest } = edge;
        return rest;
      });

      // Grid layout algorithm
      // Position nodes based on nodeId from node-positions.json
      
      const positionMap: Record<string, { x: number, y: number }> = {};
      const totalNodes = nodes.length;
      
      // Adaptive spacing based on node count
      let horizontalSpacing = 300;
      let verticalSpacing = 250;
      
      if (totalNodes > 100) {
        horizontalSpacing = 200;
        verticalSpacing = 180;
      } else if (totalNodes > 50) {
        horizontalSpacing = 250;
        verticalSpacing = 200;
      }
      
      // Calculate grid dimensions (try to make it roughly square)
      const cols = Math.ceil(Math.sqrt(totalNodes));
      const rows = Math.ceil(totalNodes / cols);
      
      // Center the grid
      const gridWidth = (cols - 1) * horizontalSpacing;
      const gridHeight = (rows - 1) * verticalSpacing;
      const startX = -gridWidth / 2;
      const startY = -gridHeight / 2;
      
      // Position nodes in grid based on nodeId
      // First, collect and sort all nodes by their nodeId
      const nodesWithIds = nodes.map((node: any) => {
        let nodeIdNum = 0;
        if (nodePositionData && nodePositionData[node.id]) {
          nodeIdNum = parseInt(nodePositionData[node.id]);
        } else {
          // Fallback: extract number from node.id if it contains one
          const match = node.id.match(/\d+/);
          nodeIdNum = match ? parseInt(match[0]) : 0;
        }
        return { node, nodeIdNum };
      });
      
      // Sort by nodeId
      nodesWithIds.sort((a: any, b: any) => a.nodeIdNum - b.nodeIdNum);
      
      // Map to sequential grid positions (0, 1, 2, ... totalNodes-1)
      nodesWithIds.forEach((item: any, sequentialIndex: number) => {
        const row = Math.floor(sequentialIndex / cols);
        const col = sequentialIndex % cols;
        
        positionMap[item.node.id] = {
          x: startX + col * horizontalSpacing,
          y: startY + row * verticalSpacing
        };
      });
      
      // Apply positions to nodes
      const positionedNodes = nodes.map((node: any) => {
        const position = positionMap[node.id];
        
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
        nodeEdgeInterfaces.forEach((interfacesMap, nodeId) => {
          const nodePos = positions[nodeId];
          if (!nodePos || interfacesMap.size === 0) return;
          
          // Draw each interface at its designated fixed position
          interfacesMap.forEach((iface) => {
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
            ctx.fillStyle = darkMode ? '#2c3e50' : '#e8f4f8';
            ctx.strokeStyle = darkMode ? '#34495e' : '#4ECDC4';
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
            ctx.fillStyle = darkMode ? '#ecf0f1' : '#2c3e50';
            ctx.fillText(displayName, labelX, labelY);
            
            ctx.restore();
          });
        });
        
        // Draw physical connections from interface to interface (not node to node)
        // Deduplicate edges to avoid drawing the same connection multiple times
        const drawnConnections = new Set<string>();
        
        edges.forEach((edge: any) => {
          if (edge.edgeType === 'direct') {
            const ifA = edge.interfaceA || '';
            const ifB = edge.interfaceB || '';
            
            if (!ifA || !ifB) return;
            
            const fromIfaceKey = `${edge.from}_${ifA}`;
            const toIfaceKey = `${edge.to}_${ifB}`;
            
            const fromIface = interfacePositions.get(fromIfaceKey);
            const toIface = interfacePositions.get(toIfaceKey);
            
            if (!fromIface || !toIface) return;
            
            // Create a unique bidirectional connection key using actual interface positions
            // This ensures we only draw each physical connection once
            const point1 = `${Math.round(fromIface.x)},${Math.round(fromIface.y)}`;
            const point2 = `${Math.round(toIface.x)},${Math.round(toIface.y)}`;
            const connectionKey = [point1, point2].sort().join('<->');
            
            // Skip if we've already drawn this connection
            if (drawnConnections.has(connectionKey)) return;
            drawnConnections.add(connectionKey);
            
            // Draw line connecting the two interface boxes
            ctx.save();
            ctx.strokeStyle = darkMode ? '#666' : '#bbb';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 3]); // Dashed line for better visibility
            ctx.beginPath();
            ctx.moveTo(fromIface.x, fromIface.y);
            ctx.lineTo(toIface.x, toIface.y);
            ctx.stroke();
            ctx.setLineDash([]); // Reset line dash
            ctx.restore();
          }
        });
      });

      network.on("hoverNode", (event) => {
        const nodeId = event.node
        const nodeData = (networkData.nodes || []).find((n: any) => n.id === nodeId)
        // Add nodeId from node-positions.json if available
        if (nodeData && nodePositionDataRef.current) {
          // Try multiple lookup strategies:
          // 1. Use nodeName field (e.g., "Node00b01973dfaf")
          // 2. Use the node's short ID (e.g., "dfaf")
          // 3. Try fullAddress if it looks like a node name
          const nodeName = nodeData.nodeName;
          if (nodeName && nodePositionDataRef.current[nodeName]) {
            nodeData.nodeIdNumber = nodePositionDataRef.current[nodeName];
          } else if (nodeData.id && nodePositionDataRef.current[nodeData.id]) {
            nodeData.nodeIdNumber = nodePositionDataRef.current[nodeData.id];
          } else if (nodeData.fullAddress && typeof nodeData.fullAddress === 'string' && nodeData.fullAddress.startsWith('Node')) {
            nodeData.nodeIdNumber = nodePositionDataRef.current[nodeData.fullAddress];
          }
        }
        if (onNodeHoverRef.current) {
          onNodeHoverRef.current(nodeData)
        }
      })

      network.on("click", (event) => {
        if (event.nodes.length > 0) {
          const nodeId = event.nodes[0]
          const nodeData = (networkData.nodes || []).find((n: any) => n.id === nodeId)
          // Add nodeId from node-positions.json if available
          if (nodeData && nodePositionDataRef.current) {
            // Try multiple lookup strategies:
            // 1. Use nodeName field (e.g., "Node00b01973dfaf")
            // 2. Use the node's short ID (e.g., "dfaf")
            const nodeName = nodeData.nodeName;
            if (nodeName && nodePositionDataRef.current[nodeName]) {
              nodeData.nodeIdNumber = nodePositionDataRef.current[nodeName];
            } else if (nodeData.id && nodePositionDataRef.current[nodeData.id]) {
              nodeData.nodeIdNumber = nodePositionDataRef.current[nodeData.id];
            }
          }
          if (onNodeClickRef.current) {
            onNodeClickRef.current(nodeData)
          }
        } else {
          if (onNodeClickRef.current) {
            onNodeClickRef.current(null)
          }
        }
      })

      network.on("blurNode", () => {
        if (onNodeBlurRef.current) {
          onNodeBlurRef.current();
        }
      })

      return () => {
        if (networkRef.current) {
          networkRef.current.destroy()
        }
      }
    }
  }, [networkData, darkMode, selectedNode, nodePositionData])

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
