import { DataSet } from 'vis-data';

/**
 * Converts various network data formats to vis-network compatible format
 */
export class NetworkDataAdapter {
  /**
   * Convert backend JSON to vis-network format with only physical connections
   */
  static convertPhysicalOnly(backendJson) {
    if (!backendJson) {
      throw new Error('Invalid backend JSON format - missing content')
    }
    // Accept payloads where nodes are wrapped in a `network_map` property
    // (new schema), or where a raw array/single node was passed directly.
    let nodeRouteInfos = []
    if (backendJson && backendJson.network_map) {
      const nm = backendJson.network_map
      if (Array.isArray(nm)) nodeRouteInfos = nm
      else {
        const vals = Object.values(nm)
        if (vals.length > 0 && vals.every(v => v && (v.node_name || v.neigh_ip_info || v.route_info || v.neigh_infos))) nodeRouteInfos = vals
        else nodeRouteInfos = [nm]
      }
    } else if (Array.isArray(backendJson)) {
      nodeRouteInfos = backendJson
    } else {
      nodeRouteInfos = [backendJson]
    }
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();
    const edgeMap = new Set();
    // helper to normalize ids (IPv6 -> last hex segment)
    const normalizeId = (raw) => {
      if (raw === undefined || raw === null) return '';
      const s = raw.toString().trim();
      if (!s) return '';
      if (s.includes(':')) return this.extractLastHex(s);
      return s;
    };

    nodeRouteInfos.forEach(nodeInfo => {
      const targetRaw = nodeInfo.node_name || nodeInfo.nodeName || nodeInfo.name;
      const targetNodeId = normalizeId(targetRaw);
      if (!targetNodeId) return;
      if (!nodeMap.has(targetNodeId)) {
        nodes.push({
          id: targetNodeId,
          label: `Node ${targetNodeId}`,
          type: 'target',
        });
        nodeMap.set(targetNodeId, true);
      }

  // Preserve local interface info for the target node (do not create new nodes)
      const localIfs = nodeInfo.local_ip_info || nodeInfo.local_ip_infos || [];
      if (Array.isArray(localIfs) && localIfs.length > 0) {
        const existingTarget = nodes.find(n => n.id === targetNodeId);
        if (existingTarget) existingTarget.localInterfaces = localIfs.map(li => ({ interface: li.interface || li.iface, ip: li.local_ip || li.ip || li.address }));
      }

      const neighInfos = nodeInfo.neigh_ip_info || nodeInfo.neigh_infos || nodeInfo.neigh_list || [];
      neighInfos.forEach(neighInfo => {
        const rawNeighbor = neighInfo.neigh_node || neighInfo.neigh || neighInfo.neigh_ip || neighInfo.id;
        const neighborId = normalizeId(rawNeighbor);
        const interfaceType = neighInfo.interface || neighInfo.iface || undefined;
        if (!neighborId) return;
        if (!nodeMap.has(neighborId)) {
          nodes.push({ id: neighborId, label: `Node ${neighborId}`, type: 'neighbor', interface: interfaceType });
          nodeMap.set(neighborId, true);
        }

        // canonicalize undirected physical link id
        const [a, b] = [targetNodeId, neighborId].sort();
        const directEdgeId = `direct-${a}-${b}`;
        if (!edgeMap.has(directEdgeId)) {
          edges.push({ id: directEdgeId, from: a, to: b, label: interfaceType || 'link', edgeType: 'direct', width: 3, color: '#4ECDC4', dashes: false });
          edgeMap.add(directEdgeId);
        }
      });

      const routes = nodeInfo.route_info || nodeInfo.route_infos || [];
      routes.forEach(r => {
        const rawSource = r.source_node || r.source || r.source_ip || r.src;
        const sourceId = normalizeId(rawSource);
        const incomingInterface = r.incoming_interface || r.iif || r.iface || r.via || '';
        if (!sourceId) return;
        const rawNextHop = r.iif_neigh_node || r.next_hop || r.nextHop;
        const nextHopId = normalizeId(rawNextHop) || undefined;
        if (!nodeMap.has(sourceId)) {
          nodes.push({ id: sourceId, label: `Node ${sourceId}`, type: 'source', nextHop: nextHopId, viaInterface: incomingInterface, fullNextHopAddress: rawNextHop });
          nodeMap.set(sourceId, true);
        }
        // route edges point from source -> target
        const routeId = `route-${sourceId}-${targetNodeId}-${incomingInterface || 'i'}`;
        if (!edgeMap.has(routeId)) {
          edges.push({ id: routeId, from: sourceId, to: targetNodeId, label: `via ${incomingInterface || 'unknown'}`, dashes: true, edgeType: 'route', width: 1, nextHop: nextHopId });
          edgeMap.add(routeId);
        }
      });
    });
    return { nodes, edges };
  }
  
  /**
   * Convert from custom format to vis-network format
   * @param {Object} customData - Custom network data
   * @returns {Object} vis-network compatible data
   */
  static convertToVisNetwork(customData) {
    if (!customData) return null;

    let nodes = [];
    let edges = [];

    // Handle different input formats
    if (customData.nodes && customData.edges) {
      // Already in nodes/edges format
      nodes = this.processNodes(customData.nodes);
      edges = this.processEdges(customData.edges);
    } else if (customData.topology) {
      // Handle topology-based format
      const result = this.processTopology(customData.topology);
      nodes = result.nodes;
      edges = result.edges;
    } else if (customData.devices) {
      // Handle device-based format
      const result = this.processDevices(customData.devices);
      nodes = result.nodes;
      edges = result.edges;
    }

    return {
      nodes: new DataSet(nodes),
      edges: new DataSet(edges)
    };
  }

  /**
   * Process nodes to ensure vis-network compatibility
   */
  static processNodes(nodeData) {
    return nodeData.map(node => ({
      id: node.id || node.nodeId || node.deviceId,
      label: node.label || node.name || node.hostname || `Node ${node.id}`,
      title: this.generateNodeTooltip(node),
      group: node.group || node.type || this.inferNodeType(node),
      rx: node.rx || node.rxRate || node.receivedRate || '0 Mbps',
      tx: node.tx || node.txRate || node.transmitRate || '0 Mbps',
      traffic: node.traffic || node.utilization || '0%',
      latency: node.latency || node.delay || '0ms',
      packetLoss: node.packetLoss || node.loss || '0%',
      uptime: node.uptime || node.availability || '100%',
      // Preserve any custom properties
      ...node
    }));
  }

  /**
   * Process edges to ensure vis-network compatibility
   */
  static processEdges(edgeData) {
    return edgeData.map(edge => ({
      id: edge.id || edge.edgeId || `${edge.from}-${edge.to}`,
      from: edge.from || edge.source || edge.sourceId,
      to: edge.to || edge.target || edge.targetId,
      label: edge.label || edge.name || '',
      arrows: 'to',
      width: this.calculateEdgeWidth(edge),
      dashes: edge.dashes || edge.isDashed || false,
      color: edge.color || this.getEdgeColor(edge),
      // Preserve any custom properties
      ...edge
    }));
  }

  /**
   * Generate tooltip text for nodes
   */
  static generateNodeTooltip(node) {
    const rx = node.rx || node.rxRate || '0 Mbps';
    const tx = node.tx || node.txRate || '0 Mbps';
    const traffic = node.traffic || node.utilization || '0%';
    const latency = node.latency || '0ms';
    
    return `${node.label || node.name || 'Node'}
RX: ${rx}
TX: ${tx}
Traffic: ${traffic}
Latency: ${latency}`;
  }

  /**
   * Infer node type based on properties
   */
  static inferNodeType(node) {
    if (node.type) return node.type;
    
    const name = (node.name || node.label || '').toLowerCase();
    if (name.includes('router')) return 'router';
    if (name.includes('switch')) return 'switch';
    if (name.includes('server')) return 'server';
    if (name.includes('client')) return 'client';
    if (name.includes('gateway')) return 'gateway';
    
    return 'default';
  }

  /**
   * Calculate edge width based on traffic or bandwidth
   */
  static calculateEdgeWidth(edge) {
    if (edge.width) return edge.width;
    
    const traffic = edge.traffic || edge.utilization || edge.bandwidth || 0;
    const numericTraffic = typeof traffic === 'string' ? 
      parseFloat(traffic.replace(/[^0-9.]/g, '')) : traffic;
    
    // Scale width based on traffic (1-5 range)
    if (numericTraffic > 80) return 5;
    if (numericTraffic > 60) return 4;
    if (numericTraffic > 40) return 3;
    if (numericTraffic > 20) return 2;
    return 1;
  }

  /**
   * Get edge color based on traffic or status
   */
  static getEdgeColor(edge) {
    if (edge.color) return edge.color;
    
    const traffic = edge.traffic || edge.utilization || 0;
    const numericTraffic = typeof traffic === 'string' ? 
      parseFloat(traffic.replace(/[^0-9.]/g, '')) : traffic;
    
    if (numericTraffic > 80) return '#ff4444'; // Red - high traffic
    if (numericTraffic > 60) return '#ff8800'; // Orange - medium-high traffic
    if (numericTraffic > 40) return '#ffaa00'; // Yellow - medium traffic
    return '#848484'; // Gray - normal traffic
  }

  /**
   * Process topology-based data format
   */
  static processTopology(topology) {
    const nodes = [];
    const edges = [];
    
    // Extract nodes and connections from topology
    if (topology.devices) {
      nodes.push(...this.processNodes(topology.devices));
    }
    
    if (topology.connections) {
      edges.push(...this.processEdges(topology.connections));
    }
    
    return { nodes, edges };
  }

  /**
   * Process device-based data format
   */
  static processDevices(devices) {
    const nodes = [];
    const edges = [];
    
    devices.forEach(device => {
      // Add device as node
      nodes.push({
        id: device.id,
        label: device.name,
        ...device
      });
      
      // Add connections as edges
      if (device.connections) {
        device.connections.forEach(conn => {
          edges.push({
            id: `${device.id}-${conn.to}`,
            from: device.id,
            to: conn.to,
            ...conn
          });
        });
      }
    });
    
    return { 
      nodes: this.processNodes(nodes), 
      edges: this.processEdges(edges) 
    };
  }

  /**
   * Convert from C++ backend JSON format (confrpc.cpp output) to standard format
   * @param {Object} backendJson - JSON output from C++ network processor
   * @returns {Object} Standard network data format
   */
  static convertFromBackend(backendJson) {
    if (!backendJson) {
      throw new Error('Invalid backend JSON')
    }

    // The new backend schema places node entries under `network_map` which
    // may be an array or an object whose values are node entries. We no
    // longer support the legacy `network_map.node_route_infos` structure.
    let nodeRouteInfos = []
    if (backendJson.network_map) {
      const nm = backendJson.network_map
      if (Array.isArray(nm)) nodeRouteInfos = nm
      else {
        const vals = Object.values(nm)
        if (vals.length > 0 && vals.every(v => v && (v.node_name || v.neigh_ip_info || v.route_info || v.neigh_infos))) {
          nodeRouteInfos = vals
        } else {
          nodeRouteInfos = [nm]
        }
      }
    } else {
      throw new Error('Unrecognized backend JSON format for new schema')
    }
    const nodes = [];
    const edges = [];
    const nodeMap = new Map(); // Track created nodes to avoid duplicates
    const edgeMap = new Set(); // Track edges to avoid duplicates

    // Process all node route information
    nodeRouteInfos.forEach(nodeInfo => {
      const targetNodeId = nodeInfo.node_name;
      
      // Create target node if not already created
      if (!nodeMap.has(targetNodeId)) {
        nodes.push({
          id: targetNodeId,
          label: `Node ${targetNodeId}`,
          type: 'target',
          rx: '0 Mbps',
          tx: '0 Mbps',
          traffic: '0%',
          latency: '0ms',
          routeCount: nodeInfo.route_infos ? nodeInfo.route_infos.length : 0,
          neighborCount: nodeInfo.neigh_infos ? nodeInfo.neigh_infos.length : 0
        });
        nodeMap.set(targetNodeId, true);
      }

      // Process ALL neighbor information to create neighbor nodes and direct connections
      if (nodeInfo.neigh_infos) {
        nodeInfo.neigh_infos.forEach(neighInfo => {
          const neighborId = neighInfo.neigh_node;
          const interfaceType = neighInfo.interface;
          
          // Create neighbor node if not already created
          if (!nodeMap.has(neighborId)) {
            nodes.push({
              id: neighborId,
              label: `Node ${neighborId}`,
              type: 'neighbor',
              rx: '0 Mbps',
              tx: '0 Mbps',
              traffic: '0%',
              latency: '0ms',
              interface: interfaceType
            });
            nodeMap.set(neighborId, true);
          }

          // Create direct connection edge (canonicalized so a-b == b-a)
          const [a, b] = [targetNodeId, neighborId].sort();
          const directEdgeId = `direct-${a}-${b}`;
          if (!edgeMap.has(directEdgeId)) {
            edges.push({
              id: directEdgeId,
              from: a,
              to: b,
              label: `${interfaceType}`,
              traffic: 0,
              edgeType: 'direct',
              width: 3
            });
            edgeMap.add(directEdgeId);
          }
        });
      }

      // Process ALL route information to add routing nodes and paths
      if (nodeInfo.route_infos) {
        nodeInfo.route_infos.forEach(routeInfo => {
          const sourceNodeId = routeInfo.source_node;
          const incomingInterface = routeInfo.incoming_interface;
          const nextHopNode = this.extractLastHex(routeInfo.iif_neigh_node);
          
          // Create source node if not already created
          if (!nodeMap.has(sourceNodeId)) {
            nodes.push({
              id: sourceNodeId,
              label: `Node ${sourceNodeId}`,
              type: 'source',
              rx: '0 Mbps',
              tx: '0 Mbps',
              traffic: '0%',
              latency: '0ms',
              nextHop: nextHopNode,
              viaInterface: incomingInterface,
              fullNextHopAddress: routeInfo.iif_neigh_node
            });
            nodeMap.set(sourceNodeId, true);
          }

          // Create routing path edge (directional: source -> target)
          const routeEdgeId = `route-${sourceNodeId}-${targetNodeId}-${incomingInterface}`;
          if (!edgeMap.has(routeEdgeId)) {
            edges.push({
              id: routeEdgeId,
              from: sourceNodeId,
              to: targetNodeId,
              label: `via ${incomingInterface}`,
              traffic: 0,
              dashes: true,
              edgeType: 'route',
              width: 1,
              nextHop: nextHopNode
            });
            edgeMap.add(routeEdgeId);
          }
        });
      }
    });

    console.log(`Processed ${nodes.length} nodes and ${edges.length} edges from backend data`);
    return { nodes, edges };
  }

  /**
   * Extract last 4 hex characters from an IPv6 address
   * @param {string} ipv6Address - Full IPv6 address
   * @returns {string} Last 4 hex characters
   */
  static extractLastHex(ipv6Address) {
    if (!ipv6Address) return '';
    // Find the position of the last colon
    const lastColonPos = ipv6Address.lastIndexOf(':');
    
    // If a colon is found, return the substring after it
    if (lastColonPos !== -1) {
      return ipv6Address.substring(lastColonPos + 1);
    }
    
    // If no colon is found, return the entire string
    return ipv6Address;
  }

  /**
   * Convert interface string to display name (backend uses string interfaces)
   */
  static getInterfaceDisplayName(interfaceString) {
    // Backend already provides interface as string ("eth0", "eth1", etc.)
    return interfaceString || 'unknown';
  }

  /**
   * Load network data from backend output file
   * @param {string} filePath - Path to the output.txt file
   * @returns {Promise<Object>} Processed network data
   */
  static async loadFromBackendFile(filePath) {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load backend data: ${response.status} ${response.statusText}`);
    }
    const backendJson = await response.json();
    return this.convertFromBackend(backendJson);
  }
}

export default NetworkDataAdapter;
