import { DataSet } from "vis-data"

export class NetworkDataAdapter {
  /**
   * Find shortest path between source and target node IDs using BFS.
   * Returns { pathEdges: string[], pathNodes: string[] } or throws error.
   */
  /**
   * Find shortest path between source and target node IDs using BFS.
   * By default the search treats edges as bidirectional (undirected) so a path
   * can be found regardless of edge 'from' -> 'to' direction. Set `bidirectional=false`
   * to enforce directed-only traversal.
   * Returns { pathEdges: string[], pathNodes: string[] } or throws error.
   */
  static findPath(nodes: any[], edges: any[], sourceId: string, targetId: string, bidirectional = true) {
    if (!sourceId || !targetId) throw new Error("Source and target must be provided")
    if (sourceId === targetId) return { pathEdges: [], pathNodes: [sourceId] }
    const nodeIds = new Set(nodes.map(n => n.id))
    if (!nodeIds.has(sourceId)) throw new Error(`Source node '${sourceId}' not found`)
    if (!nodeIds.has(targetId)) throw new Error(`Target node '${targetId}' not found`)
    // Build adjacency list. By default add both directions so the search is
    // effectively undirected while preserving the original edge id (this
    // allows highlighting the vis-network edge even when traversing the
    // reverse direction).
    const adj = new Map()
    edges.forEach(e => {
      if (!adj.has(e.from)) adj.set(e.from, [])
      adj.get(e.from).push({ to: e.to, edgeId: e.id })
      if (bidirectional) {
        if (!adj.has(e.to)) adj.set(e.to, [])
        // add reverse neighbor that records the same edge id
        adj.get(e.to).push({ to: e.from, edgeId: e.id })
      }
    })

    // BFS
    type PathStep = { from: string, to: string, edgeId: string };
    const queue: Array<[string, PathStep[]]> = [[sourceId, []]];
    const visited = new Set([sourceId]);

    while (queue.length) {
      const next = queue.shift();
      if (!next) break;
      const [current, path] = next;

      if (current === targetId) {
        const pathNodes = [sourceId];
        const pathEdges = [];
        for (const step of path) {
          pathNodes.push(step.to);
          pathEdges.push(step.edgeId);
        }
        return { pathEdges, pathNodes };
      }

      const neighbors = adj.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.to)) {
          visited.add(neighbor.to);
          queue.push([neighbor.to, [...path, { from: current, to: neighbor.to, edgeId: neighbor.edgeId }]]);
        }
      }
    }

    console.error(`No path found from '${sourceId}' to '${targetId}'`);
    throw new Error(`No path found from '${sourceId}' to '${targetId}'`)
  }
  static convertPhysicalOnly(backendJson: any) {
    if (!backendJson || !backendJson.network_map || !backendJson.network_map.node_route_infos) {
      throw new Error("Invalid backend JSON format - missing network_map.node_route_infos")
    }
    const nodeRouteInfos = backendJson.network_map.node_route_infos
    const nodes: any[] = []
    const edges: any[] = []
    const nodeMap = new Map()
    const edgeMap = new Set()

    nodeRouteInfos.forEach((nodeInfo: any) => {
      const centralNodeId = nodeInfo.node_name
      if (!nodeMap.has(centralNodeId)) {
        nodes.push({
          id: centralNodeId,
          label: `Node ${centralNodeId}`,
          type: "central",
        })
        nodeMap.set(centralNodeId, true)
      }
      if (nodeInfo.neigh_infos) {
        nodeInfo.neigh_infos.forEach((neighInfo: any) => {
          const neighborId = neighInfo.neigh_node
          const interfaceType = neighInfo.interface
          if (!nodeMap.has(neighborId)) {
            nodes.push({
              id: neighborId,
              label: `Node ${neighborId}`,
              type: "neighbor",
              interface: interfaceType,
            })
            nodeMap.set(neighborId, true)
          }
          const directEdgeId = `direct-${centralNodeId}-${neighborId}`
          // Normalize undirected direct edge id so the link between two nodes
          // is represented only once even if both nodes list each other.
          const [a, b] = [centralNodeId, neighborId].sort()
          const normalizedDirectId = `direct-${a}-${b}`
          if (!edgeMap.has(normalizedDirectId)) {
            edges.push({
              id: normalizedDirectId,
              from: a,
              to: b,
              label: `${interfaceType}`,
              edgeType: "direct",
              width: 3,
              color: "#4ECDC4",
              dashes: false,
            })
            edgeMap.add(normalizedDirectId)
          }
        })
      }
    })
    return { nodes, edges }
  }

  static convertToVisNetwork(customData: any) {
    if (!customData) return null

    let nodes: any[] = []
    let edges: any[] = []

    if (customData.nodes && customData.edges) {
      nodes = this.processNodes(customData.nodes)
      edges = this.processEdges(customData.edges)
    } else if (customData.topology) {
      const result = this.processTopology(customData.topology)
      nodes = result.nodes
      edges = result.edges
    } else if (customData.devices) {
      const result = this.processDevices(customData.devices)
      nodes = result.nodes
      edges = result.edges
    }

    return {
      nodes,
      edges,
    }
  }

  static processNodes(nodeData: any[]) {
    return nodeData.map((node) => ({
      id: node.id || node.nodeId || node.deviceId,
      label: node.label || node.name || node.hostname || `Node ${node.id}`,
      title: this.generateNodeTooltip(node),
      group: node.group || node.type || this.inferNodeType(node),
      rx: node.rx || node.rxRate || node.receivedRate || "0 Mbps",
      tx: node.tx || node.txRate || node.transmitRate || "0 Mbps",
      traffic: node.traffic || node.utilization || "0%",
      latency: node.latency || node.delay || "0ms",
      packetLoss: node.packetLoss || node.loss || "0%",
      uptime: node.uptime || node.availability || "100%",
      ...node,
    }))
  }

  static processEdges(edgeData: any[]) {
    return edgeData.map((edge) => ({
      id: edge.id || edge.edgeId || `${edge.from}-${edge.to}`,
      from: edge.from || edge.source || edge.sourceId,
      to: edge.to || edge.target || edge.targetId,
      label: edge.label || edge.name || "",
      arrows: { to: { enabled: false } }, // Ensure arrows are disabled
      width: this.calculateEdgeWidth(edge),
      dashes: edge.dashes || edge.isDashed || false,
      color: edge.color || this.getEdgeColor(edge),
      ...edge,
    }))
  }

  static generateNodeTooltip(node: any) {
    const rx = node.rx || node.rxRate || "0 Mbps"
    const tx = node.tx || node.txRate || "0 Mbps"
    const traffic = node.traffic || node.utilization || "0%"
    const latency = node.latency || "0ms"

    return `${node.label || node.name || "Node"}
RX: ${rx}
TX: ${tx}
Traffic: ${traffic}
Latency: ${latency}`
  }

  static inferNodeType(node: any) {
    if (node.type) return node.type

    const name = (node.name || node.label || "").toLowerCase()
    if (name.includes("router")) return "router"
    if (name.includes("switch")) return "switch"
    if (name.includes("server")) return "server"
    if (name.includes("client")) return "client"
    if (name.includes("gateway")) return "gateway"

    return "default"
  }

  static calculateEdgeWidth(edge: any) {
    if (edge.width) return edge.width

    const traffic = edge.traffic || edge.utilization || edge.bandwidth || 0
    const numericTraffic = typeof traffic === "string" ? Number.parseFloat(traffic.replace(/[^0-9.]/g, "")) : traffic

    if (numericTraffic > 80) return 5
    if (numericTraffic > 60) return 4
    if (numericTraffic > 40) return 3
    if (numericTraffic > 20) return 2
    return 1
  }

  static getEdgeColor(edge: any) {
    if (edge.color) return edge.color

    const traffic = edge.traffic || edge.utilization || 0
    const numericTraffic = typeof traffic === "string" ? Number.parseFloat(traffic.replace(/[^0-9.]/g, "")) : traffic

    if (numericTraffic > 80) return "#ff4444"
    if (numericTraffic > 60) return "#ff8800"
    if (numericTraffic > 40) return "#ffaa00"
    return "#848484"
  }

  static processTopology(topology: any) {
    const nodes: any[] = []
    const edges: any[] = []

    if (topology.devices) {
      nodes.push(...this.processNodes(topology.devices))
    }

    if (topology.connections) {
      edges.push(...this.processEdges(topology.connections))
    }

    return { nodes, edges }
  }

  static processDevices(devices: any[]) {
    const nodes: any[] = []
    const edges: any[] = []

    devices.forEach((device) => {
      nodes.push({
        id: device.id,
        label: device.name,
        ...device,
      })

      if (device.connections) {
        device.connections.forEach((conn: any) => {
          edges.push({
            id: `${device.id}-${conn.to}`,
            from: device.id,
            to: conn.to,
            ...conn,
          })
        })
      }
    })

    return {
      nodes: this.processNodes(nodes),
      edges: this.processEdges(edges),
    }
  }

  static convertFromBackend(backendJson: any) {
    if (!backendJson || !backendJson.network_map || !backendJson.network_map.node_route_infos) {
      throw new Error("Invalid backend JSON format - missing network_map.node_route_infos")
    }

    const nodeRouteInfos = backendJson.network_map.node_route_infos
    const nodes: any[] = []
    const edges: any[] = []
    const nodeMap = new Map()
    const edgeMap = new Set()

    nodeRouteInfos.forEach((nodeInfo: any) => {
      const centralNodeId = nodeInfo.node_name

      if (!nodeMap.has(centralNodeId)) {
        nodes.push({
          id: centralNodeId,
          label: `Node ${centralNodeId}`,
          type: "central",
          rx: "0 Mbps",
          tx: "0 Mbps",
          traffic: "0%",
          latency: "0ms",
          routeCount: nodeInfo.route_infos ? nodeInfo.route_infos.length : 0,
          neighborCount: nodeInfo.neigh_infos ? nodeInfo.neigh_infos.length : 0,
        })
        nodeMap.set(centralNodeId, true)
      }

      if (nodeInfo.neigh_infos) {
        nodeInfo.neigh_infos.forEach((neighInfo: any) => {
          const neighborId = neighInfo.neigh_node
          const interfaceType = neighInfo.interface

          if (!nodeMap.has(neighborId)) {
            nodes.push({
              id: neighborId,
              label: `Node ${neighborId}`,
              type: "neighbor",
              rx: "0 Mbps",
              tx: "0 Mbps",
              traffic: "0%",
              latency: "0ms",
              interface: interfaceType,
            })
            nodeMap.set(neighborId, true)
          }

          const directEdgeId = `direct-${centralNodeId}-${neighborId}`
            // Normalize undirected direct edge id so the link between two nodes
            // is represented only once even if both nodes list each other.
            const [a, b] = [centralNodeId, neighborId].sort()
            const normalizedDirectId = `direct-${a}-${b}`
            if (!edgeMap.has(normalizedDirectId)) {
              edges.push({
                id: normalizedDirectId,
                from: a,
                to: b,
                label: `${interfaceType}`,
                traffic: 0,
                edgeType: "direct",
                width: 3,
              })
              edgeMap.add(normalizedDirectId)
            }
        })
      }

      if (nodeInfo.route_infos) {
        nodeInfo.route_infos.forEach((routeInfo: any) => {
          const sourceNodeId = routeInfo.source_node
          const incomingInterface = routeInfo.incoming_interface
          const nextHopNode = this.extractLastHex(routeInfo.iif_neigh_node)

          if (!nodeMap.has(sourceNodeId)) {
            nodes.push({
              id: sourceNodeId,
              label: `Node ${sourceNodeId}`,
              type: "source",
              rx: "0 Mbps",
              tx: "0 Mbps",
              traffic: "0%",
              latency: "0ms",
              nextHop: nextHopNode,
              viaInterface: incomingInterface,
              fullNextHopAddress: routeInfo.iif_neigh_node,
            })
            nodeMap.set(sourceNodeId, true)
          }

          const routeEdgeId = `route-${sourceNodeId}-${centralNodeId}-${incomingInterface}`
          if (!edgeMap.has(routeEdgeId)) {
            edges.push({
              id: routeEdgeId,
              from: sourceNodeId,
              to: centralNodeId,
              label: `via ${incomingInterface}`,
              traffic: 0,
              dashes: true,
              edgeType: "route",
              width: 1,
              nextHop: nextHopNode,
            })
            edgeMap.add(routeEdgeId)
          }
        })
      }
    })

    console.log(`Processed ${nodes.length} nodes and ${edges.length} edges from backend data`)
    return { nodes, edges }
  }

  static extractLastHex(ipv6Address: string) {
    if (!ipv6Address) return ""
    const lastColonPos = ipv6Address.lastIndexOf(":")

    if (lastColonPos !== -1) {
      return ipv6Address.substring(lastColonPos + 1)
    }

    return ipv6Address
  }

  static getInterfaceDisplayName(interfaceString: string) {
    return interfaceString || "unknown"
  }

  static async loadFromBackendFile(filePath: string) {
    const response = await fetch(filePath)
    if (!response.ok) {
      throw new Error(`Failed to load backend data: ${response.status} ${response.statusText}`)
    }
    const backendJson = await response.json()
    return this.convertFromBackend(backendJson)
  }
}
