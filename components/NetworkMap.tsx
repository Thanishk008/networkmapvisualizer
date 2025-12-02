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
  positionsFile?: string
  highlightedPath?: { nodes: string[], edges: string[] } | null  // For source-target path highlighting
}


export default function NetworkMap({ networkData, onNodeHover, onNodeClick, onNodeBlur, darkMode = false, selectedNode, positionsFile = "/node-positions-150.json", highlightedPath }: NetworkMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const [nodePositionData, setNodePositionData] = useState<any>(null)
  const nodePositionDataRef = useRef<any>(null)
  const [clickHighlightedNode, setClickHighlightedNode] = useState<string | null>(null) // For click-to-highlight feature
  
  // Use refs for callbacks to avoid dependency array issues
  const onNodeHoverRef = useRef(onNodeHover)
  const onNodeClickRef = useRef(onNodeClick)
  const onNodeBlurRef = useRef(onNodeBlur)
  
  useEffect(() => {
    onNodeHoverRef.current = onNodeHover
    onNodeClickRef.current = onNodeClick
    onNodeBlurRef.current = onNodeBlur
  })

  // Load node position data when positionsFile changes
  useEffect(() => {
    fetch(positionsFile)
      .then(res => res.json())
      .then(data => {
        // Create THREE maps:
        // 1. nodeName -> nodeId (for nodes with nodeName field)
        // 2. shortId -> nodeId (for nodes without nodeName, lookup by their short ID)
        // 3. nodeName -> groupInfo (NCA number and node number within NCA)
        const nodeMap: Record<string, string> = {};
        const idMap: Record<string, string> = {};
        const groupInfoMap: Record<string, { ncaNumber: string, nodeNumber: string }> = {};
        
        data.nodeInfo?.forEach((node: any) => {
          if (node.nodeName && node.nodeId) {
            nodeMap[node.nodeName] = node.nodeId;
            
            // Parse nodeLabelPath to extract NCA and Node numbers
            // Format: "Root\NCA 4\Node 7\Hardware Layer\ANNCPU"
            if (node.nodeLabelPath) {
              const ncaMatch = node.nodeLabelPath.match(/NCA\s+(\d+)/);
              const nodeMatch = node.nodeLabelPath.match(/Node\s+(\d+)/);
              if (ncaMatch && nodeMatch) {
                groupInfoMap[node.nodeName] = {
                  ncaNumber: ncaMatch[1],
                  nodeNumber: nodeMatch[1]
                };
                // Also store by shortId for nodes without nodeName
                if (node.nodeName.startsWith('Node') && node.nodeName.length > 4) {
                  const hexPart = node.nodeName.substring(4);
                  const shortId = hexPart.substring(hexPart.length - 4);
                  const normalizedShortId = parseInt(shortId, 16).toString(16);
                  groupInfoMap[normalizedShortId] = {
                    ncaNumber: ncaMatch[1],
                    nodeNumber: nodeMatch[1]
                  };
                }
              }
            }
            
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
        const combinedMap = { ...nodeMap, ...idMap, _groupInfo: groupInfoMap };
        setNodePositionData(combinedMap);
        nodePositionDataRef.current = combinedMap;
      })
      .catch(err => console.error('Failed to load node positions:', err));
  }, [positionsFile]);

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
        const interfacePositions = new Map<string, { x: number, y: number, nodeId: string, interface: string, side: string }>();
        
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
            
            // Determine which side this interface is on
            let side = 'top';
            if (iface.interface.includes('eth1') || iface.interface.includes('e1')) {
              side = 'right';
            } else if (iface.interface.includes('usb0') || iface.interface.includes('u0')) {
              side = 'bottom';
            } else if (iface.interface.includes('usb1') || iface.interface.includes('u1')) {
              side = 'left';
            }
            
            // Store position for connection drawing
            const key = `${nodeId}_${iface.interface}`;
            interfacePositions.set(key, { x: labelX, y: labelY, nodeId, interface: iface.interface, side });
            
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
        
        // ============================================
        // GLOBAL LANE-BASED ROUTING SYSTEM
        // ============================================
        // Every horizontal and vertical line segment gets a unique "track" to prevent overlap.
        // We track ALL Y-coordinates used by horizontal segments and ALL X-coordinates used by vertical segments.
        
        const LANE_SPACING = 4; // Pixels between each lane - smaller for more lanes
        
        // Global sets to track which exact coordinates are already used
        const usedHorizontalY = new Set<number>(); // All Y coords used by horizontal segments
        const usedVerticalX = new Set<number>();   // All X coords used by vertical segments
        
        // Helper: Get the next available Y coordinate for a horizontal segment
        // Starting from a preferred Y and searching ONLY in the specified direction
        // to avoid reversing back into node exclusion zones
        const getAvailableHorizontalY = (preferredY: number, searchDirection: 'up' | 'down' | 'both' = 'both'): number => {
          // Round to lane spacing for alignment
          let y = Math.round(preferredY / LANE_SPACING) * LANE_SPACING;
          
          if (searchDirection === 'both') {
            // Search outward from preferred position - try alternating directions
            let offset = 0;
            let direction = 1;
            while (usedHorizontalY.has(y) && offset < 1000) {
              offset += LANE_SPACING;
              direction *= -1;
              y = Math.round(preferredY / LANE_SPACING) * LANE_SPACING + direction * Math.ceil(offset / (2 * LANE_SPACING)) * LANE_SPACING;
            }
          } else {
            // Search only in specified direction to avoid going back into nodes
            const step = searchDirection === 'up' ? -LANE_SPACING : LANE_SPACING;
            let attempts = 0;
            while (usedHorizontalY.has(y) && attempts < 250) {
              y += step;
              attempts++;
            }
          }
          usedHorizontalY.add(y);
          return y;
        };
        
        // Helper: Get the next available X coordinate for a vertical segment
        const getAvailableVerticalX = (preferredX: number, searchDirection: 'left' | 'right' | 'both' = 'both'): number => {
          // Round to lane spacing for alignment
          let x = Math.round(preferredX / LANE_SPACING) * LANE_SPACING;
          
          if (searchDirection === 'both') {
            // Search outward from preferred position - try alternating directions
            let offset = 0;
            let direction = 1;
            while (usedVerticalX.has(x) && offset < 1000) {
              offset += LANE_SPACING;
              direction *= -1;
              x = Math.round(preferredX / LANE_SPACING) * LANE_SPACING + direction * Math.ceil(offset / (2 * LANE_SPACING)) * LANE_SPACING;
            }
          } else {
            // Search only in specified direction to avoid going back into nodes
            const step = searchDirection === 'left' ? -LANE_SPACING : LANE_SPACING;
            let attempts = 0;
            while (usedVerticalX.has(x) && attempts < 250) {
              x += step;
              attempts++;
            }
          }
          usedVerticalX.add(x);
          return x;
        };
        
        // ============================================
        // UNIQUE EDGE COLORING SYSTEM
        // ============================================
        // Generate a unique muted color for each edge using HSL
        // This makes each path visually distinguishable while keeping them subtle
        const generateEdgeColor = (index: number, totalEdges: number): string => {
          // Evenly distribute hues across the color wheel
          const hue = (index * 360 / Math.max(totalEdges, 1)) % 360;
          // Muted: low saturation, medium lightness for dark mode, slightly different for light
          const saturation = darkMode ? 45 : 50;
          const lightness = darkMode ? 50 : 45;
          return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        };
        
        // Build edge color map - assign each unique edge a color
        const edgeColorMap = new Map<string, string>();
        let edgeIndex = 0;
        const directEdges = edges.filter((e: any) => e.edgeType === 'direct');
        directEdges.forEach((edge: any) => {
          const edgeKey = `${edge.from}-${edge.to}-${edge.interfaceA}-${edge.interfaceB}`;
          if (!edgeColorMap.has(edgeKey)) {
            edgeColorMap.set(edgeKey, generateEdgeColor(edgeIndex, directEdges.length));
            edgeIndex++;
          }
        });
        
        // Determine which edges/nodes should be highlighted or dimmed
        // Priority: highlightedPath (source-target) > clickHighlightedNode > normal
        const clickConnectedEdges = new Set<string>();
        const clickConnectedNodes = new Set<string>();
        
        if (clickHighlightedNode && !highlightedPath) {
          // Find all edges connected to the click-highlighted node
          directEdges.forEach((edge: any) => {
            if (edge.from === clickHighlightedNode || edge.to === clickHighlightedNode) {
              const edgeKey = `${edge.from}-${edge.to}-${edge.interfaceA}-${edge.interfaceB}`;
              clickConnectedEdges.add(edgeKey);
              clickConnectedNodes.add(edge.from);
              clickConnectedNodes.add(edge.to);
            }
          });
        }
        
        // Draw physical connections from interface to interface (not node to node)
        // Deduplicate edges to avoid drawing the same connection multiple times
        const drawnConnections = new Set<string>();
        const interfaceConnectionCount = new Map<string, number>(); // Track connections per interface
        
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
            
            // Determine routing type based on interface sides
            const isFromHorizontal = fromIface.side === 'left' || fromIface.side === 'right';
            const isToHorizontal = toIface.side === 'left' || toIface.side === 'right';
            
            // Track connections per interface SIDE for initial spacing
            // Use side-based keys to ensure multiple interfaces on the same side (e.g. eth0, eth2 both on Top)
            // share the same counter and get spaced out properly to avoid overlaps.
            const fromSideKey = `${edge.from}_${fromIface.side}`;
            const toSideKey = `${edge.to}_${toIface.side}`;
            
            const fromIfaceConnectionCount = interfaceConnectionCount.get(fromSideKey) || 0;
            const toIfaceConnectionCount = interfaceConnectionCount.get(toSideKey) || 0;
            interfaceConnectionCount.set(fromSideKey, fromIfaceConnectionCount + 1);
            interfaceConnectionCount.set(toSideKey, toIfaceConnectionCount + 1);
            
            // Get node positions for collision avoidance
            const fromNodePos = network.getPosition(edge.from);
            const toNodePos = network.getPosition(edge.to);
            
            // Add small offset at origin for connections from same interface
            const interfaceSpacing = 6; // Increased spacing for better visibility
            
            // Helper to alternate offsets (0, +6, -6, +12, -12...) to keep bundle centered-ish
            const getOffset = (idx: number) => (idx === 0 ? 0 : (idx % 2 === 0 ? -1 : 1) * Math.ceil(idx / 2) * interfaceSpacing);
            
            // Determine edge styling based on highlight state
            const edgeKey = `${edge.from}-${edge.to}-${edge.interfaceA}-${edge.interfaceB}`;
            const baseEdgeColor = edgeColorMap.get(edgeKey) || (darkMode ? '#666' : '#bbb');
            
            // Check if this edge is part of the highlighted path (source-target selection)
            const isPathHighlighted = highlightedPath && highlightedPath.edges && highlightedPath.edges.includes(edge.id);
            // Check if this edge is connected to the click-highlighted node
            const isClickHighlighted = clickConnectedEdges.has(edgeKey);
            // Check if we're in a highlight mode but this edge is NOT highlighted
            const isInHighlightMode = highlightedPath || clickHighlightedNode;
            const shouldDim = isInHighlightMode && !isPathHighlighted && !isClickHighlighted;
            
            // Set edge style based on state
            let edgeColor: string;
            let edgeWidth: number;
            let edgeOpacity: number;
            
            if (isPathHighlighted) {
              // Source-target path: bright, thick, fully visible
              edgeColor = getComputedStyle(document.documentElement).getPropertyValue('--color-legend-highlight').trim() || '#FFD166';
              edgeWidth = 3;
              edgeOpacity = 1;
            } else if (isClickHighlighted) {
              // Click-highlighted connections: use edge's unique color but brighter/thicker
              edgeColor = baseEdgeColor;
              edgeWidth = 2.5;
              edgeOpacity = 1;
            } else if (shouldDim) {
              // Not highlighted, in highlight mode: very dim
              edgeColor = darkMode ? '#444' : '#ddd';
              edgeWidth = 1;
              edgeOpacity = 0.3;
            } else {
              // Normal state: unique muted color
              edgeColor = baseEdgeColor;
              edgeWidth = 1.5;
              edgeOpacity = 0.6;
            }
            
            // Draw orthogonal (right-angled) line connecting the two interface boxes
            ctx.save();
            ctx.strokeStyle = edgeColor;
            ctx.lineWidth = edgeWidth;
            ctx.globalAlpha = edgeOpacity;
            ctx.setLineDash(isPathHighlighted ? [] : [5, 3]); // Solid for highlighted path, dashed for others
            ctx.beginPath();
            
            // Calculate orthogonal path with right angles that avoids nodes and interfaces
            // Start at the center of interface boxes
            const centerStartX = fromIface.x;
            const centerStartY = fromIface.y;
            const centerEndX = toIface.x;
            const centerEndY = toIface.y;
            
            // Constants for routing
            const nodeSize = 40; // Half of node box size
            const interfaceBoxSize = 15; // Full width/height of interface box
            const interfaceOffset = 50; // Distance of interface boxes from node center
            const clearanceFromInterface = 35; // Extra space from interface box edge (increased for better separation)
            
            // Calculate actual start and end points at the center of the interface box edge
            // that faces the direction of the connection
            let startX = centerStartX;
            let startY = centerStartY;
            let endX = centerEndX;
            let endY = centerEndY;
            
            // Determine which edge of the interface box to connect to based on connection direction
            // For start interface: connect at the edge facing towards the end interface
            const startToEndDx = centerEndX - centerStartX;
            const startToEndDy = centerEndY - centerStartY;
            
            // Store unmodified base Y positions for calculating horizontal corridors
            let baseStartY = centerStartY;
            let baseEndY = centerEndY;
            
            if (fromIface.side === 'top' || fromIface.side === 'bottom') {
              // Interface is on top/bottom of node - connect at vertical edge
              startY = fromIface.side === 'top' ? 
                centerStartY - interfaceBoxSize / 2 : // Top edge of interface box
                centerStartY + interfaceBoxSize / 2;  // Bottom edge of interface box
              baseStartY = startY; // Update base for vertical interfaces
              // Add horizontal offset for multiple connections from same interface
              startX = centerStartX + getOffset(fromIfaceConnectionCount);
            } else {
              // Interface is on left/right of node - connect at horizontal edge
              startX = fromIface.side === 'left' ? 
                centerStartX - interfaceBoxSize / 2 : // Left edge of interface box
                centerStartX + interfaceBoxSize / 2;  // Right edge of interface box
              // Add vertical offset for multiple connections from same interface
              startY = centerStartY + getOffset(fromIfaceConnectionCount);
              // baseStartY stays as centerStartY for horizontal interfaces
            }
            
            // For end interface: connect at the edge facing towards the start interface
            if (toIface.side === 'top' || toIface.side === 'bottom') {
              // Interface is on top/bottom of node - connect at vertical edge
              endY = toIface.side === 'top' ? 
                centerEndY - interfaceBoxSize / 2 : // Top edge of interface box
                centerEndY + interfaceBoxSize / 2;  // Bottom edge of interface box
              baseEndY = endY; // Update base for vertical interfaces
              // Add horizontal offset for multiple connections to same interface
              endX = centerEndX + getOffset(toIfaceConnectionCount);
            } else {
              // Interface is on left/right of node - connect at horizontal edge
              endX = toIface.side === 'left' ? 
                centerEndX - interfaceBoxSize / 2 : // Left edge of interface box
                centerEndX + interfaceBoxSize / 2;  // Right edge of interface box
              // Add vertical offset for multiple connections to same interface
              endY = centerEndY + getOffset(toIfaceConnectionCount);
              // baseEndY stays as centerEndY for horizontal interfaces
            }
            
            ctx.moveTo(startX, startY);
            
            // Determine the interface positions relative to their nodes
            const fromIfaceSide = fromIface.side; // 'top', 'right', 'bottom', 'left'
            const toIfaceSide = toIface.side;
            
            // Calculate routing based on interface sides and node positions
            const dx = endX - startX;
            const dy = endY - startY;
            
            // Define exclusion zones for nodes (node box + gap to interfaces)
            // The exclusion zone extends from node center to beyond the interface boxes
            // Define exclusion zones for nodes - MUCH larger to account for:
            // - Node box itself (~25px)
            // - Interface boxes around it (up to 55px away + 12px half-width)
            // - Extra padding to ensure lines don't get too close
            const nodeExclusionHalfSizeX = horizontalDistance + interfaceBoxWidth / 2 + 25; // ~92px for left/right
            const nodeExclusionHalfSizeY = verticalDistance + interfaceBoxHeight / 2 + 25; // ~64px for top/bottom
            
            // Get all node positions for collision checking
            const allNodePositions = Object.entries(positions).map(([id, pos]: [string, any]) => ({
              id,
              x: pos.x,
              y: pos.y
            }));
            
            // Helper to check if a horizontal segment at Y would pass through ANY node's exclusion zone
            const wouldCrossAnyNodeHorizontally = (y: number, x1: number, x2: number, excludeNodeIds: string[] = []) => {
              const minX = Math.min(x1, x2);
              const maxX = Math.max(x1, x2);
              return allNodePositions.some(nodePos => {
                if (excludeNodeIds.includes(nodePos.id)) return false;
                // Check if Y is within node's vertical exclusion zone AND segment's X range overlaps node's X zone
                return y > nodePos.y - nodeExclusionHalfSizeY && 
                       y < nodePos.y + nodeExclusionHalfSizeY &&
                       maxX > nodePos.x - nodeExclusionHalfSizeX &&
                       minX < nodePos.x + nodeExclusionHalfSizeX;
              });
            };
            
            // Helper to check if a vertical segment at X would pass through ANY node's exclusion zone
            const wouldCrossAnyNodeVertically = (x: number, y1: number, y2: number, excludeNodeIds: string[] = []) => {
              const minY = Math.min(y1, y2);
              const maxY = Math.max(y1, y2);
              return allNodePositions.some(nodePos => {
                if (excludeNodeIds.includes(nodePos.id)) return false;
                // Check if X is within node's horizontal exclusion zone AND segment's Y range overlaps node's Y zone
                return x > nodePos.x - nodeExclusionHalfSizeX && 
                       x < nodePos.x + nodeExclusionHalfSizeX &&
                       maxY > nodePos.y - nodeExclusionHalfSizeY &&
                       minY < nodePos.y + nodeExclusionHalfSizeY;
              });
            };
            
            // Collision avoidance step - use larger steps for faster escape from node zones
            const COLLISION_STEP = 15;
            
            // Helper to find a safe horizontal Y that doesn't cross any nodes
            const findSafeHorizontalY = (preferredY: number, x1: number, x2: number, direction: 'up' | 'down', excludeNodeIds: string[] = []): number => {
              let y = preferredY;
              let attempts = 0;
              while (wouldCrossAnyNodeHorizontally(y, x1, x2, excludeNodeIds) && attempts < 200) {
                y = direction === 'up' ? y - COLLISION_STEP : y + COLLISION_STEP;
                attempts++;
              }
              return y;
            };
            
            // Helper to find a safe vertical X that doesn't cross any nodes
            const findSafeVerticalX = (preferredX: number, y1: number, y2: number, direction: 'left' | 'right', excludeNodeIds: string[] = []): number => {
              let x = preferredX;
              let attempts = 0;
              while (wouldCrossAnyNodeVertically(x, y1, y2, excludeNodeIds) && attempts < 200) {
                x = direction === 'left' ? x - COLLISION_STEP : x + COLLISION_STEP;
                attempts++;
              }
              return x;
            };
            
            // Strategy: Route away from interfaces with proper clearance
            // Apply perpendicular offset to separate overlapping parallel lines
            
            if (fromIfaceSide === 'top' || fromIfaceSide === 'bottom') {
              // Start interface is vertical (top/bottom)
              // Extend from the edge of interface box with additional clearance
              let extendY = fromIfaceSide === 'top' ? 
                startY - clearanceFromInterface : startY + clearanceFromInterface;
              
              // Apply offset based on interface connection count to separate lines starting from same interface
              if (fromIfaceSide === 'top') {
                extendY -= (fromIfaceConnectionCount * 10);
              } else {
                extendY += (fromIfaceConnectionCount * 10);
              }
              
              if (toIfaceSide === 'top' || toIfaceSide === 'bottom') {
                // Both interfaces are vertical (top/bottom)
                
                let targetExtendY = toIfaceSide === 'top' ? 
                  endY - clearanceFromInterface : endY + clearanceFromInterface;
                
                // Apply offset based on target interface connection count
                if (toIfaceSide === 'top') {
                  targetExtendY -= (toIfaceConnectionCount * 10);
                } else {
                  targetExtendY += (toIfaceConnectionCount * 10);
                }
                
                // LANE-BASED ROUTING for V-to-V connections
                const excludeNodes = [edge.from, edge.to]; // Don't check collision with source/dest nodes
                
                // Step 1: Determine the rough routing corridor
                // The vertical middle segment prefers to be between the two nodes
                let preferredMidX = (fromNodePos.x + toNodePos.x) / 2;
                
                // Step 2: First pass - collision avoidance with nodes
                // For horizontal segments, test the FULL X extent they will traverse
                const fullMinX = Math.min(startX, endX) - 50;
                const fullMaxX = Math.max(startX, endX) + 50;
                
                const extendDirection: 'up' | 'down' = fromIfaceSide === 'top' ? 'up' : 'down';
                extendY = findSafeHorizontalY(extendY, fullMinX, fullMaxX, extendDirection, excludeNodes);
                
                const targetDirection: 'up' | 'down' = toIfaceSide === 'top' ? 'up' : 'down';
                targetExtendY = findSafeHorizontalY(targetExtendY, fullMinX, fullMaxX, targetDirection, excludeNodes);
                
                // For vertical segment, test the FULL Y extent FROM START TO END
                // This must cover the entire vertical span the line could traverse
                const fullMinY = Math.min(startY, endY, extendY, targetExtendY) - 50;
                const fullMaxY = Math.max(startY, endY, extendY, targetExtendY) + 50;
                const vertDirection: 'left' | 'right' = preferredMidX < Math.min(fromNodePos.x, toNodePos.x) ? 'left' : 'right';
                let midX = findSafeVerticalX(preferredMidX, fullMinY, fullMaxY, vertDirection, excludeNodes);
                
                // Step 3: AFTER collision avoidance, get unique lanes to prevent overlap with OTHER lines
                // CRITICAL: Search in same direction as collision avoidance to avoid going back into nodes
                extendY = getAvailableHorizontalY(extendY, extendDirection);
                targetExtendY = getAvailableHorizontalY(targetExtendY, targetDirection);
                midX = getAvailableVerticalX(midX, vertDirection);
                
                // Route: start -> extend vertically -> horizontal to gutter -> vertical in gutter -> horizontal to target -> down to target
                ctx.lineTo(startX, extendY);
                ctx.lineTo(midX, extendY);
                ctx.lineTo(midX, targetExtendY);
                ctx.lineTo(endX, targetExtendY);
                ctx.lineTo(endX, endY);
                
                ctx.stroke();
                ctx.globalAlpha = 1; // Reset alpha for markers
                
                const markerSize = 4;
                // Use edge color for corner markers, slightly brighter
                ctx.strokeStyle = isPathHighlighted ? edgeColor : (isClickHighlighted ? edgeColor : (shouldDim ? (darkMode ? '#555' : '#ccc') : edgeColor));
                ctx.lineWidth = isPathHighlighted ? 2.5 : 2;
                ctx.setLineDash([]);
                
                // Draw L-bracket at corner: fromDir is vector pointing BACK to where we came from
                // toDir is vector pointing FORWARD to where we're going
                const drawCorner = (x: number, y: number, fromDx: number, fromDy: number, toDx: number, toDy: number) => {
                  const fromDist = Math.abs(fromDx) + Math.abs(fromDy);
                  const toDist = Math.abs(toDx) + Math.abs(toDy);
                  if (fromDist < 5 || toDist < 5) return;
                  const fromIsHorizontal = Math.abs(fromDx) > Math.abs(fromDy);
                  const toIsHorizontal = Math.abs(toDx) > Math.abs(toDy);
                  if (fromIsHorizontal === toIsHorizontal) return;
                  
                  // Arms point in the direction of the vectors (back along from, forward along to)
                  const fromArmX = fromDx !== 0 ? Math.sign(fromDx) * markerSize : 0;
                  const fromArmY = fromDy !== 0 ? Math.sign(fromDy) * markerSize : 0;
                  const toArmX = toDx !== 0 ? Math.sign(toDx) * markerSize : 0;
                  const toArmY = toDy !== 0 ? Math.sign(toDy) * markerSize : 0;
                  
                  ctx.beginPath();
                  ctx.moveTo(x + fromArmX, y + fromArmY);
                  ctx.lineTo(x, y);
                  ctx.lineTo(x + toArmX, y + toArmY);
                  ctx.stroke();
                };
                
                drawCorner(startX, extendY, 0, startY - extendY, midX - startX, 0);
                drawCorner(midX, extendY, startX - midX, 0, 0, targetExtendY - extendY);
                drawCorner(midX, targetExtendY, 0, extendY - targetExtendY, endX - midX, 0);
                drawCorner(endX, targetExtendY, midX - endX, 0, 0, endY - targetExtendY);
              } else {
                // End interface is horizontal (left/right)
                // Route with right angles only: vertical -> horizontal -> vertical -> horizontal
                
                let targetExtendX = toIfaceSide === 'left' ? 
                  endX - clearanceFromInterface : endX + clearanceFromInterface;

                // Apply offset based on target interface connection count
                if (toIfaceSide === 'left') {
                  targetExtendX -= (toIfaceConnectionCount * 10);
                } else {
                  targetExtendX += (toIfaceConnectionCount * 10);
                }

                // LANE-BASED ROUTING for V-to-H connections
                const excludeNodes = [edge.from, edge.to];
                
                // Step 1: Collision avoidance FIRST
                // Test full extent of horizontal segment - FROM START TO END
                const fullMinX = Math.min(startX, endX, targetExtendX) - 50;
                const fullMaxX = Math.max(startX, endX, targetExtendX) + 50;
                const extendDirection: 'up' | 'down' = fromIfaceSide === 'top' ? 'up' : 'down';
                extendY = findSafeHorizontalY(extendY, fullMinX, fullMaxX, extendDirection, excludeNodes);
                
                // Test full extent of vertical segment - FROM START TO END
                const fullMinY = Math.min(startY, endY, extendY) - 50;
                const fullMaxY = Math.max(startY, endY, extendY) + 50;
                const targetDirection: 'left' | 'right' = toIfaceSide === 'left' ? 'left' : 'right';
                targetExtendX = findSafeVerticalX(targetExtendX, fullMinY, fullMaxY, targetDirection, excludeNodes);

                // Step 2: Get unique lanes AFTER collision avoidance
                // CRITICAL: Search in same direction as collision avoidance to avoid going back into nodes
                extendY = getAvailableHorizontalY(extendY, extendDirection);
                targetExtendX = getAvailableVerticalX(targetExtendX, targetDirection);

                ctx.lineTo(startX, extendY);         // Vertical: extend away from start interface
                ctx.lineTo(targetExtendX, extendY);  // Horizontal: to target clearance x
                ctx.lineTo(targetExtendX, endY);     // Vertical: to target y
                ctx.lineTo(endX, endY);              // Horizontal: to interface edge
                
                ctx.stroke();
                
                // Draw L-bracket corner markers only at actual 90-degree turns
                const markerSize = 4;
                ctx.strokeStyle = darkMode ? '#888' : '#999';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
                
                // Draw L-bracket at corner
                const drawCorner = (x: number, y: number, fromDx: number, fromDy: number, toDx: number, toDy: number) => {
                  const fromDist = Math.abs(fromDx) + Math.abs(fromDy);
                  const toDist = Math.abs(toDx) + Math.abs(toDy);
                  if (fromDist < 5 || toDist < 5) return;
                  const fromIsHorizontal = Math.abs(fromDx) > Math.abs(fromDy);
                  const toIsHorizontal = Math.abs(toDx) > Math.abs(toDy);
                  if (fromIsHorizontal === toIsHorizontal) return;
                  
                  const fromArmX = fromDx !== 0 ? Math.sign(fromDx) * markerSize : 0;
                  const fromArmY = fromDy !== 0 ? Math.sign(fromDy) * markerSize : 0;
                  const toArmX = toDx !== 0 ? Math.sign(toDx) * markerSize : 0;
                  const toArmY = toDy !== 0 ? Math.sign(toDy) * markerSize : 0;
                  
                  ctx.beginPath();
                  ctx.moveTo(x + fromArmX, y + fromArmY);
                  ctx.lineTo(x, y);
                  ctx.lineTo(x + toArmX, y + toArmY);
                  ctx.stroke();
                };
                
                // Corner 1: (startX, extendY) - vertical to horizontal
                drawCorner(startX, extendY, 0, startY - extendY, targetExtendX - startX, 0);
                // Corner 2: (targetExtendX, extendY) - horizontal to vertical
                drawCorner(targetExtendX, extendY, startX - targetExtendX, 0, 0, endY - extendY);
                // Corner 3: (targetExtendX, endY) - vertical to horizontal
                drawCorner(targetExtendX, endY, 0, extendY - endY, endX - targetExtendX, 0);
              }
            } else {
              // Start interface is horizontal (left/right)
              // Extend from the edge of interface box with additional clearance
              let extendX = fromIfaceSide === 'left' ? 
                startX - clearanceFromInterface : startX + clearanceFromInterface;
              
              // Apply offset based on interface connection count
              if (fromIfaceSide === 'left') {
                extendX -= (fromIfaceConnectionCount * 10);
              } else {
                extendX += (fromIfaceConnectionCount * 10);
              }
              
              if (toIfaceSide === 'left' || toIfaceSide === 'right') {
                // Both interfaces are horizontal (left/right)
                
                let targetExtendX = toIfaceSide === 'left' ? 
                  endX - clearanceFromInterface : endX + clearanceFromInterface;
                
                // Apply offset based on target interface connection count
                if (toIfaceSide === 'left') {
                  targetExtendX -= (toIfaceConnectionCount * 10);
                } else {
                  targetExtendX += (toIfaceConnectionCount * 10);
                }
                
                // LANE-BASED ROUTING for H-to-H connections
                const excludeNodes = [edge.from, edge.to]; // Don't check collision with source/dest nodes
                
                // Step 1: Determine the rough routing corridor
                let preferredMidY = (fromNodePos.y + toNodePos.y) / 2;
                
                // Step 2: First pass - collision avoidance with nodes
                // For vertical segments, test the FULL Y extent FROM START TO END
                const fullMinY = Math.min(startY, endY) - 50;
                const fullMaxY = Math.max(startY, endY) + 50;
                
                const extendDirection: 'left' | 'right' = fromIfaceSide === 'left' ? 'left' : 'right';
                extendX = findSafeVerticalX(extendX, fullMinY, fullMaxY, extendDirection, excludeNodes);
                
                const targetDirection: 'left' | 'right' = toIfaceSide === 'left' ? 'left' : 'right';
                targetExtendX = findSafeVerticalX(targetExtendX, fullMinY, fullMaxY, targetDirection, excludeNodes);
                
                // For horizontal segment, test the FULL X extent FROM START TO END
                const fullMinX = Math.min(startX, endX, extendX, targetExtendX) - 50;
                const fullMaxX = Math.max(startX, endX, extendX, targetExtendX) + 50;
                const horizDirection: 'up' | 'down' = preferredMidY < Math.min(fromNodePos.y, toNodePos.y) ? 'up' : 'down';
                let midY = findSafeHorizontalY(preferredMidY, fullMinX, fullMaxX, horizDirection, excludeNodes);
                
                // Step 3: AFTER collision avoidance, get unique lanes to prevent overlap with OTHER lines
                // CRITICAL: Search in same direction as collision avoidance to avoid going back into nodes
                extendX = getAvailableVerticalX(extendX, extendDirection);
                targetExtendX = getAvailableVerticalX(targetExtendX, targetDirection);
                midY = getAvailableHorizontalY(midY, horizDirection);
                
                // Route: start -> extend horizontally -> vertical to gutter -> horizontal in gutter -> vertical to target -> right to target
                ctx.lineTo(extendX, startY);
                ctx.lineTo(extendX, midY);
                ctx.lineTo(targetExtendX, midY);
                ctx.lineTo(targetExtendX, endY);
                ctx.lineTo(endX, endY);
                
                ctx.stroke();
                ctx.globalAlpha = 1; // Reset alpha for markers
                
                const markerSize = 4;
                ctx.strokeStyle = isPathHighlighted ? edgeColor : (isClickHighlighted ? edgeColor : (shouldDim ? (darkMode ? '#555' : '#ccc') : edgeColor));
                ctx.lineWidth = isPathHighlighted ? 2.5 : 2;
                ctx.setLineDash([]);
                
                // Draw L-bracket at corner
                const drawCorner = (x: number, y: number, fromDx: number, fromDy: number, toDx: number, toDy: number) => {
                  const fromDist = Math.abs(fromDx) + Math.abs(fromDy);
                  const toDist = Math.abs(toDx) + Math.abs(toDy);
                  if (fromDist < 5 || toDist < 5) return;
                  const fromIsHorizontal = Math.abs(fromDx) > Math.abs(fromDy);
                  const toIsHorizontal = Math.abs(toDx) > Math.abs(toDy);
                  if (fromIsHorizontal === toIsHorizontal) return;
                  
                  const fromArmX = fromDx !== 0 ? Math.sign(fromDx) * markerSize : 0;
                  const fromArmY = fromDy !== 0 ? Math.sign(fromDy) * markerSize : 0;
                  const toArmX = toDx !== 0 ? Math.sign(toDx) * markerSize : 0;
                  const toArmY = toDy !== 0 ? Math.sign(toDy) * markerSize : 0;
                  
                  ctx.beginPath();
                  ctx.moveTo(x + fromArmX, y + fromArmY);
                  ctx.lineTo(x, y);
                  ctx.lineTo(x + toArmX, y + toArmY);
                  ctx.stroke();
                };
                
                drawCorner(extendX, startY, startX - extendX, 0, 0, midY - startY);
                drawCorner(extendX, midY, 0, startY - midY, targetExtendX - extendX, 0);
                drawCorner(targetExtendX, midY, extendX - targetExtendX, 0, 0, endY - midY);
                drawCorner(targetExtendX, endY, 0, midY - endY, endX - targetExtendX, 0);
              } else {
                // End interface is vertical (top/bottom)
                // Route with right angles only: horizontal -> vertical -> horizontal -> vertical
                
                let targetExtendY = toIfaceSide === 'top' ? 
                  endY - clearanceFromInterface : endY + clearanceFromInterface;

                // Apply offset based on target interface connection count
                if (toIfaceSide === 'top') {
                  targetExtendY -= (toIfaceConnectionCount * 10);
                } else {
                  targetExtendY += (toIfaceConnectionCount * 10);
                }

                // LANE-BASED ROUTING for H-to-V connections
                const excludeNodes = [edge.from, edge.to];
                
                // Step 1: Collision avoidance FIRST
                // Test full extent of vertical segment - FROM START TO END
                const fullMinY = Math.min(startY, endY, targetExtendY) - 50;
                const fullMaxY = Math.max(startY, endY, targetExtendY) + 50;
                const extendDirection: 'left' | 'right' = fromIfaceSide === 'left' ? 'left' : 'right';
                extendX = findSafeVerticalX(extendX, fullMinY, fullMaxY, extendDirection, excludeNodes);
                
                // Test full extent of horizontal segment - FROM START TO END
                const fullMinX = Math.min(startX, endX, extendX) - 50;
                const fullMaxX = Math.max(startX, endX, extendX) + 50;
                const targetDirection: 'up' | 'down' = toIfaceSide === 'top' ? 'up' : 'down';
                targetExtendY = findSafeHorizontalY(targetExtendY, fullMinX, fullMaxX, targetDirection, excludeNodes);

                // Step 2: Get unique lanes AFTER collision avoidance
                // CRITICAL: Search in same direction as collision avoidance to avoid going back into nodes
                extendX = getAvailableVerticalX(extendX, extendDirection);
                targetExtendY = getAvailableHorizontalY(targetExtendY, targetDirection);

                ctx.lineTo(extendX, startY);         // Horizontal: extend away from start interface
                ctx.lineTo(extendX, targetExtendY);  // Vertical: to target clearance y
                ctx.lineTo(endX, targetExtendY);     // Horizontal: to target x
                ctx.lineTo(endX, endY);              // Vertical: to interface edge
                
                ctx.stroke();
                ctx.globalAlpha = 1; // Reset alpha for markers
                
                // Draw L-bracket corner markers only at actual 90-degree turns
                const markerSize = 4;
                ctx.strokeStyle = isPathHighlighted ? edgeColor : (isClickHighlighted ? edgeColor : (shouldDim ? (darkMode ? '#555' : '#ccc') : edgeColor));
                ctx.lineWidth = isPathHighlighted ? 2.5 : 2;
                ctx.setLineDash([]);
                
                // Draw L-bracket at corner
                const drawCorner = (x: number, y: number, fromDx: number, fromDy: number, toDx: number, toDy: number) => {
                  const fromDist = Math.abs(fromDx) + Math.abs(fromDy);
                  const toDist = Math.abs(toDx) + Math.abs(toDy);
                  if (fromDist < 5 || toDist < 5) return;
                  const fromIsHorizontal = Math.abs(fromDx) > Math.abs(fromDy);
                  const toIsHorizontal = Math.abs(toDx) > Math.abs(toDy);
                  if (fromIsHorizontal === toIsHorizontal) return;
                  
                  const fromArmX = fromDx !== 0 ? Math.sign(fromDx) * markerSize : 0;
                  const fromArmY = fromDy !== 0 ? Math.sign(fromDy) * markerSize : 0;
                  const toArmX = toDx !== 0 ? Math.sign(toDx) * markerSize : 0;
                  const toArmY = toDy !== 0 ? Math.sign(toDy) * markerSize : 0;
                  
                  ctx.beginPath();
                  ctx.moveTo(x + fromArmX, y + fromArmY);
                  ctx.lineTo(x, y);
                  ctx.lineTo(x + toArmX, y + toArmY);
                  ctx.stroke();
                };
                
                // Corner 1: (extendX, startY) - horizontal to vertical turn
                drawCorner(extendX, startY, startX - extendX, 0, 0, targetExtendY - startY);
                // Corner 2: (extendX, targetExtendY) - vertical to horizontal turn
                drawCorner(extendX, targetExtendY, 0, startY - targetExtendY, endX - extendX, 0);
                // Corner 3: (endX, targetExtendY) - horizontal to vertical turn
                drawCorner(endX, targetExtendY, extendX - endX, 0, 0, endY - targetExtendY);
              }
            }
            
            ctx.setLineDash([]); // Reset line dash
            ctx.restore();
          }
        });
      });

      network.on("hoverNode", (event) => {
        const nodeId = event.node
        const nodeData = (networkData.nodes || []).find((n: any) => n.id === nodeId)
        // Add nodeId and group info from node-positions.json if available
        if (nodeData && nodePositionDataRef.current) {
          // Try multiple lookup strategies:
          // 1. Use nodeName field (e.g., "Node00b01973dfaf")
          // 2. Use the node's short ID (e.g., "dfaf")
          // 3. Try fullAddress if it looks like a node name
          const nodeName = nodeData.nodeName;
          let lookupKey = null;
          
          if (nodeName && nodePositionDataRef.current[nodeName]) {
            nodeData.nodeIdNumber = nodePositionDataRef.current[nodeName];
            lookupKey = nodeName;
          } else if (nodeData.id && nodePositionDataRef.current[nodeData.id]) {
            nodeData.nodeIdNumber = nodePositionDataRef.current[nodeData.id];
            lookupKey = nodeData.id;
          } else if (nodeData.fullAddress && typeof nodeData.fullAddress === 'string' && nodeData.fullAddress.startsWith('Node')) {
            nodeData.nodeIdNumber = nodePositionDataRef.current[nodeData.fullAddress];
            lookupKey = nodeData.fullAddress;
          }
          
          // Add group info (NCA and node number within NCA)
          if (lookupKey && nodePositionDataRef.current._groupInfo && nodePositionDataRef.current._groupInfo[lookupKey]) {
            const groupInfo = nodePositionDataRef.current._groupInfo[lookupKey];
            nodeData.ncaNumber = groupInfo.ncaNumber;
            nodeData.nodeNumber = groupInfo.nodeNumber;
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
          
          // Toggle click highlight: click same node to unhighlight, different node to switch
          setClickHighlightedNode(prev => prev === nodeId ? null : nodeId);
          
          // Add nodeId and group info from node-positions.json if available
          if (nodeData && nodePositionDataRef.current) {
            // Try multiple lookup strategies:
            // 1. Use nodeName field (e.g., "Node00b01973dfaf")
            // 2. Use the node's short ID (e.g., "dfaf")
            const nodeName = nodeData.nodeName;
            let lookupKey = null;
            
            if (nodeName && nodePositionDataRef.current[nodeName]) {
              nodeData.nodeIdNumber = nodePositionDataRef.current[nodeName];
              lookupKey = nodeName;
            } else if (nodeData.id && nodePositionDataRef.current[nodeData.id]) {
              nodeData.nodeIdNumber = nodePositionDataRef.current[nodeData.id];
              lookupKey = nodeData.id;
            }
            
            // Add group info (NCA and node number within NCA)
            if (lookupKey && nodePositionDataRef.current._groupInfo && nodePositionDataRef.current._groupInfo[lookupKey]) {
              const groupInfo = nodePositionDataRef.current._groupInfo[lookupKey];
              nodeData.ncaNumber = groupInfo.ncaNumber;
              nodeData.nodeNumber = groupInfo.nodeNumber;
            }
          }
          if (onNodeClickRef.current) {
            onNodeClickRef.current(nodeData)
          }
        } else {
          // Clicked on empty space - clear click highlight
          setClickHighlightedNode(null);
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
  }, [networkData, darkMode, selectedNode, nodePositionData, clickHighlightedNode, highlightedPath])

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
