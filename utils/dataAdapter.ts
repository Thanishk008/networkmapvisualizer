import { DataSet } from "vis-data"

export class NetworkDataAdapter {
  /**
   * Find path between source and target node IDs using the route_info table.
   * This method traces the path by following route entries from each intermediate
   * node toward the target, using the actual routing information from the backend JSON.
   * Returns { pathEdges: string[], pathNodes: string[] } or throws error.
   */
  static findPath(nodes: any[], edges: any[], sourceId: string, targetId: string, backendJson?: any) {
    if (!sourceId || !targetId) throw new Error("Source and target must be provided")
    if (sourceId === targetId) return { pathEdges: [], pathNodes: [sourceId] }
    
    const nodeIds = new Set(nodes.map(n => n.id))
    if (!nodeIds.has(sourceId)) throw new Error(`Source node '${sourceId}' not found`)
    if (!nodeIds.has(targetId)) throw new Error(`Target node '${targetId}' not found`)

    // If backendJson with route_info is provided, use route-based pathfinding
    if (backendJson && backendJson.network_map) {
      return this.findPathUsingRouteInfo(sourceId, targetId, backendJson, edges)
    }

    // Fallback to BFS-based pathfinding if route_info not available
    return this.findPathBFS(sourceId, targetId, edges, true)
  }

  /**
   * Route-based pathfinding: Follow the route_info table from the backend JSON.
   * 
   * The route_info table shows how traffic FROM a source node reaches each node.
   * To support bidirectional pathfinding, we:
   * 1. Try direct neighbor connection (single hop)
   * 2. Try forward direction (target's route_info has entry for source)
   * 3. Try reverse direction (source's route_info has entry for target, then reverse the path)
   */
  private static findPathUsingRouteInfo(sourceId: string, targetId: string, backendJson: any, edges: any[]) {
    // Helper to normalize node IDs (same logic as in convertPhysicalOnly)
    const normalizeId = (raw: any) => {
      if (!raw) return { id: null, fullAddress: null }
      const str = typeof raw === 'string' ? raw : String(raw)
      const trimmed = str.trim()
      if (!trimmed) return { id: null, fullAddress: null }
      // Extract short form: last segment after final ':'
      const parts = trimmed.split(':')
      const shortId = parts[parts.length - 1]
      return { id: shortId, fullAddress: trimmed }
    }

    // Check if source and target are direct neighbors (single hop)
    const directEdge = this.findEdgeBetween(edges, sourceId, targetId)
    if (directEdge) {
      // Look for a physical (direct) edge only, not route edges
      const edge = edges.find(e => e.id === directEdge && e.edgeType === 'direct')
      if (edge) {
        return { pathEdges: [directEdge], pathNodes: [sourceId, targetId] }
      }
    }

    // Build routing tables:
    // - Forward: destination -> source -> next_hop (how to reach destination from source)
    // - Reverse: source -> destination -> next_hop (reverse routing)
    const forwardRoutes = new Map<string, Map<string, { nextHop: string, interface: string }>>()
    
    // Build IP-to-NodeID mapping for pathfinding
    const ipToNodeId = new Map<string, string>()
    for (const entry of backendJson.network_map) {
      const nodeNameRaw = entry.node_name || entry.nodeName || entry.name
      const { id: canonicalNodeId } = normalizeId(nodeNameRaw)
      if (!canonicalNodeId) continue
      
      const localIfs = entry.local_ip_info || entry.localIpInfo || entry.local_ip_infos || []
      for (const localIf of localIfs) {
        const localIp = localIf.local_ip || localIf.localIp || localIf.ip
        if (localIp) {
          const { id: ipId } = normalizeId(localIp)
          if (ipId) {
            ipToNodeId.set(ipId, canonicalNodeId)
          }
        }
      }
    }
    
    for (const entry of backendJson.network_map) {
      let { id: nodeId } = normalizeId(entry.node_name || entry.nodeName)
      if (!nodeId) continue
      
      // Map to canonical node ID
      const mappedNodeId = ipToNodeId.get(nodeId)
      if (mappedNodeId) {
        nodeId = mappedNodeId
      }
      
      const routes = entry.route_info || entry.routeInfo || []
      for (const route of routes) {
        let { id: srcId } = normalizeId(route.source_node || route.sourceNode || route.source)
        let { id: nextHopId } = normalizeId(route.iif_neigh_node || route.iifNeighNode || route.next_hop)
        const iface = route.incoming_interface || route.incomingInterface || route.iif || ''
        
        // Map source and nextHop to canonical node IDs
        if (srcId) {
          const mappedSrcId = ipToNodeId.get(srcId)
          if (mappedSrcId) srcId = mappedSrcId
        }
        
        if (nextHopId) {
          const mappedNextHopId = ipToNodeId.get(nextHopId)
          if (mappedNextHopId) nextHopId = mappedNextHopId
        }
        
        if (srcId && nextHopId) {
          if (!forwardRoutes.has(nodeId)) {
            forwardRoutes.set(nodeId, new Map())
          }
          forwardRoutes.get(nodeId)!.set(srcId, { nextHop: nextHopId, interface: iface })
        }
      }
    }

    // Try forward direction: source -> ... -> target
    try {
      return this.traceRouteForward(sourceId, targetId, forwardRoutes, edges, normalizeId)
    } catch (err) {
      // Forward failed, try reverse direction
    }

    // Try reverse direction: target -> ... -> source, then reverse the path
    try {
      const reversePath = this.traceRouteForward(targetId, sourceId, forwardRoutes, edges, normalizeId)
      // Reverse the nodes and edges
      return {
        pathNodes: reversePath.pathNodes.reverse(),
        pathEdges: reversePath.pathEdges.reverse()
      }
    } catch (err) {
      throw new Error(`No route found from '${sourceId}' to '${targetId}' in either direction`)
    }
  }

  /**
   * Trace a route forward using the routing table
   */
  private static traceRouteForward(
    sourceId: string, 
    targetId: string, 
    forwardRoutes: Map<string, Map<string, { nextHop: string, interface: string }>>,
    edges: any[],
    normalizeId: (raw: any) => { id: string | null, fullAddress: string | null }
  ) {
    const pathNodes: string[] = []
    const pathEdges: string[] = []
    
    let currentNode = targetId
    const visited = new Set<string>([currentNode])
    const maxHops = 20
    let hops = 0

    while (currentNode !== sourceId && hops < maxHops) {
      hops++
      const routes = forwardRoutes.get(currentNode)
      
      if (!routes || !routes.has(sourceId)) {
        throw new Error(`No route from '${sourceId}' to '${targetId}' at node '${currentNode}'`)
      }

      const routeEntry = routes.get(sourceId)!
      const nextHopId = routeEntry.nextHop

      if (visited.has(nextHopId)) {
        throw new Error(`Routing loop detected at '${currentNode}' -> '${nextHopId}'`)
      }

      // Find the edge between currentNode and nextHopId
      const edgeId = this.findEdgeBetween(edges, nextHopId, currentNode)
      if (!edgeId) {
        throw new Error(`No edge found between '${nextHopId}' and '${currentNode}'`)
      }

      pathNodes.unshift(nextHopId)
      pathEdges.unshift(edgeId)
      visited.add(nextHopId)
      currentNode = nextHopId
    }

    if (currentNode !== sourceId) {
      throw new Error(`Path tracing exceeded maximum hops (${maxHops})`)
    }

    pathNodes.push(targetId)
    return { pathEdges, pathNodes }
  }

  /**
   * Helper to find an edge ID between two nodes (works with bidirectional physical links)
   */
  private static findEdgeBetween(edges: any[], nodeA: string, nodeB: string): string | null {
    for (const edge of edges) {
      if (edge.hidden || edge.redundant) continue // Skip hidden/redundant edges
      if ((edge.from === nodeA && edge.to === nodeB) || 
          (edge.from === nodeB && edge.to === nodeA)) {
        return edge.id
      }
    }
    return null
  }

  /**
   * Fallback BFS-based pathfinding (original implementation)
   */
  private static findPathBFS(sourceId: string, targetId: string, edges: any[], bidirectional = true) {
    const adj = new Map<string, Array<{ to: string; edgeId: string }>>()
    edges.forEach((e: any) => {
      const from = e.from
      const to = e.to
      const id = e.id || e.edgeId || `${from}-${to}`
      const type = e.edgeType || e.type || undefined

      if (!adj.has(from)) adj.set(from, [])
      if (!adj.has(to)) adj.set(to, [])

      if (type === 'direct') {
        adj.get(from)!.push({ to, edgeId: id })
        adj.get(to)!.push({ to: from, edgeId: id })
      } else if (type === 'route') {
        adj.get(from)!.push({ to, edgeId: id })
      } else {
        adj.get(from)!.push({ to, edgeId: id })
        if (bidirectional) adj.get(to)!.push({ to: from, edgeId: id })
      }
    })

    type PathStep = { from: string, to: string, edgeId: string }
    const queue: Array<[string, PathStep[]]> = [[sourceId, []]]
    const visited = new Set([sourceId])

    while (queue.length) {
      const next = queue.shift()
      if (!next) break
      const [current, path] = next

      if (current === targetId) {
        const pathNodes = [sourceId]
        const pathEdges = []
        for (const step of path) {
          pathNodes.push(step.to)
          pathEdges.push(step.edgeId)
        }
        return { pathEdges, pathNodes }
      }

      const neighbors = adj.get(current) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.to)) {
          visited.add(neighbor.to)
          queue.push([neighbor.to, [...path, { from: current, to: neighbor.to, edgeId: neighbor.edgeId }]])
        }
      }
    }

    throw new Error(`No path found from '${sourceId}' to '${targetId}'`)
  }
  static convertPhysicalOnly(backendJson: any) {
    // New format: top-level node object with keys like `node_name`, `neigh_ip_info`, `local_ip_info`, `route_info`.
    if (!backendJson) throw new Error("Invalid backend JSON format - missing content")

    const nodes: any[] = []
    const edges: any[] = []
    const nodeMap = new Map<string, boolean>()
    const edgeMap = new Set<string>()

    // Helper to add a node only once. If a fullAddress is provided, attach it
    // but keep the canonical (short) id for graph operations.
    const addNode = (id: string, opts: any = {}) => {
      if (!id) return
      if (!nodeMap.has(id)) {
        // Use provided label or create one without "Node" prefix if id already contains "Node"
        const defaultLabel = id.includes('Node') ? id : `Node ${id}`
        const nodeObj: any = { id, label: opts.label || defaultLabel, ...opts }
        // preserve any fullAddress provided in opts
        if (opts && opts.fullAddress) nodeObj.fullAddress = opts.fullAddress
        if (opts && opts.allLocalIps) nodeObj.allLocalIps = opts.allLocalIps
        nodes.push(nodeObj)
        nodeMap.set(id, true)
      } else {
        // If node exists, update it with new properties
        const existing = nodes.find((n) => n.id === id)
        if (existing) {
          if (opts && opts.fullAddress && !existing.fullAddress) {
            existing.fullAddress = opts.fullAddress
          }
          if (opts && opts.allLocalIps && !existing.allLocalIps) {
            existing.allLocalIps = opts.allLocalIps
          }
          // Update other properties if needed
          if (opts && opts.type && !existing.type) {
            existing.type = opts.type
          }
          if (opts && opts.label && !existing.label) {
            existing.label = opts.label
          }
        }
      }
    }

    // Normalize ids: if the value looks like an IPv6 address, convert to
    // the short hex token used elsewhere (last segment) while returning both
    // the short id and the original full address when present.
    const normalizeId = (raw: any) => {
      if (raw === undefined || raw === null) return { id: '', fullAddress: undefined }
      const s = raw.toString().trim()
      if (!s) return { id: '', fullAddress: undefined }
      if (s.includes(':')) {
        return { id: this.extractLastHex(s), fullAddress: s }
      }
      return { id: s, fullAddress: undefined }
    }

    // If the payload wraps nodes under `network_map` (new format), extract them;
    // otherwise if the payload is an array treat it as entries; otherwise wrap
    // a single node object into an array.
    let nodeEntries: any[] = []
    if (backendJson && backendJson.network_map) {
      const nm = backendJson.network_map
      if (Array.isArray(nm)) nodeEntries = nm
      else {
        const vals = Object.values(nm)
        if (vals.length > 0 && vals.every((v: any) => v && (v.node_name || v.neigh_ip_info || v.route_info || v.neigh_infos))) {
          nodeEntries = vals
        } else {
          nodeEntries = [nm]
        }
      }
    } else if (Array.isArray(backendJson)) {
      nodeEntries = backendJson
    } else {
      nodeEntries = [backendJson]
    }

    // Build IP-to-NodeID mapping using localIpInfo
    // Also store all local IPs for each node (to show in hover)
    const ipToNodeId = new Map<string, string>()
    const nodeLocalIps = new Map<string, Array<{interface: string, ip: string}>>()
    
    for (const entry of nodeEntries) {
      const targetRaw = entry.node_name || entry.nodeName || entry.name
      const { id: nodeId } = normalizeId(targetRaw)
      if (!nodeId) continue
      
      const localIfs = entry.local_ip_info || entry.localIpInfo || entry.local_ip_infos || []
      const allLocalIps: Array<{interface: string, ip: string}> = []
      
      for (const localIf of localIfs) {
        const localIp = localIf.local_ip || localIf.localIp || localIf.ip
        const iface = localIf.interface || 'unknown'
        if (localIp) {
          const { id: ipId } = normalizeId(localIp)
          if (ipId) {
            ipToNodeId.set(ipId, nodeId)
            allLocalIps.push({ interface: iface, ip: localIp })
          }
        }
      }
      
      nodeLocalIps.set(nodeId, allLocalIps)
    }

    for (const entry of nodeEntries) {
      const targetRaw = entry.node_name || entry.nodeName || entry.name
      const { id: target, fullAddress: targetFull } = normalizeId(targetRaw)
      if (!target) continue
      
      // Attach all local IPs to the node for display in hover
      const localIpsForNode = nodeLocalIps.get(target) || []
      
      // Use 'target' type to represent the destination node
      addNode(target, { 
        type: 'target', 
        fullAddress: targetFull,
        allLocalIps: localIpsForNode 
      })

      // Neighbors come from neigh_ip_info (IP-based) or neigh_list
      // Preserve local interface info for the target node (do not create new nodes).
      const localIfs = entry.local_ip_info || entry.localIpInfo || entry.local_ip_infos || []
      if (Array.isArray(localIfs) && localIfs.length > 0) {
        // attach localInterfaces metadata to the target node if available
        const existingTarget = nodes.find((n) => n.id === target)
        if (existingTarget) existingTarget.localInterfaces = localIfs.map((li: any) => ({ interface: li.interface || li.iface, ip: li.local_ip || li.localIp || li.ip || li.address }))
      }

      const neighInfos = entry.neigh_ip_info || entry.neighIpInfo || entry.neigh_infos || entry.neigh_list || []
      for (const n of neighInfos) {
        // Prefer explicit neighbor id, otherwise use neigh_ip and normalize
        const rawNeighbor = n.neigh_node || n.neigh || n.neigh_ip || n.neighIp || n.id || undefined
        let { id: neighborId, fullAddress: neighborFull } = normalizeId(rawNeighbor)
        if (!neighborId) continue
        
        // Map neighbor IP to actual node ID if available
        const mappedNodeId = ipToNodeId.get(neighborId)
        if (mappedNodeId) {
          neighborId = mappedNodeId
        }
        
        // Get local IPs for this neighbor node
        const neighborLocalIps = nodeLocalIps.get(neighborId) || []
        
        addNode(neighborId, { 
          type: 'neighbor', 
          interface: n.interface || n.iface || undefined, 
          fullAddress: neighborFull,
          allLocalIps: neighborLocalIps 
        })

        // canonicalize undirected physical link id so duplicate physical links are not added
        const [a, b] = [target, neighborId].sort()
        const eid = `direct-${a}-${b}`
        if (!edgeMap.has(eid)) {
          // Store interface information for both endpoints
          // When target < neighborId alphabetically, target interface goes first
          const targetInterface = n.interface || n.iface || 'link'
          const neighborIpAddress = rawNeighbor // Store the original neighbor IP
          const edgeData: any = { 
            id: eid, 
            from: a, 
            to: b, 
            label: targetInterface, 
            edgeType: 'direct', 
            width: 3, 
            color: '#4ECDC4', 
            dashes: false 
          }
          // Store which interface belongs to which endpoint and the neighbor IP
          if (target === a) {
            edgeData.interfaceA = targetInterface
            edgeData.neighborIpA = neighborIpAddress
          } else {
            edgeData.interfaceB = targetInterface
            edgeData.neighborIpB = neighborIpAddress
          }
          edges.push(edgeData)
          edgeMap.add(eid)
        } else {
          // Edge already exists, add the interface for this endpoint
          const existingEdge = edges.find(e => e.id === eid)
          if (existingEdge) {
            const targetInterface = n.interface || n.iface || 'link'
            const neighborIpAddress = rawNeighbor
            if (target === a) {
              existingEdge.interfaceA = targetInterface
              existingEdge.neighborIpA = neighborIpAddress
            } else {
              existingEdge.interfaceB = targetInterface
              existingEdge.neighborIpB = neighborIpAddress
            }
          }
        }
      }

      // Routes may reference sources by IPv6 or by id; attempt to normalize
      const routes = entry.route_info || entry.routeInfo || entry.route_infos || []
      for (const r of routes) {
        const rawSource = r.source_node || r.sourceNode || r.source || r.source_ip || r.src || undefined
        let { id: sourceId, fullAddress: sourceFull } = normalizeId(rawSource)
        const incomingInterface = r.incoming_interface || r.incomingInterface || r.iif || r.iface || r.via || ''
        if (!sourceId) continue
        
        // Map source IP to actual node ID if available
        const mappedSourceId = ipToNodeId.get(sourceId)
        if (mappedSourceId) {
          sourceId = mappedSourceId
        }
        
        const rawNextHop = r.iif_neigh_node || r.iifNeighNode || r.next_hop || r.nextHop || undefined
        let { id: nextHopId, fullAddress: nextHopFull } = normalizeId(rawNextHop)
        
        // Map next hop IP to actual node ID if available
        if (nextHopId) {
          const mappedNextHopId = ipToNodeId.get(nextHopId)
          if (mappedNextHopId) {
            nextHopId = mappedNextHopId
          }
        }
        
        // Get local IPs for this source node
        const sourceLocalIps = nodeLocalIps.get(sourceId) || []
        
        addNode(sourceId, { 
          type: 'source', 
          nextHop: nextHopId || undefined, 
          viaInterface: incomingInterface, 
          fullAddress: sourceFull,
          allLocalIps: sourceLocalIps 
        })
        // route edges are directional: from source -> target
        const routeId = `route-${sourceId}-${target}-${incomingInterface || 'i'}`
        if (!edgeMap.has(routeId)) {
          // If a direct physical link already exists between these nodes, mark the
          // route edge as redundant/hidden to avoid duplicate visual links. We
          // still keep the route entry for pathfinding semantics, but it should
          // not clutter the topology when a physical connection is present.
          const a = [sourceId, target].sort()[0]
          const b = [sourceId, target].sort()[1]
          const directId = `direct-${a}-${b}`
          const isRedundant = edgeMap.has(directId)

          const routeEdge: any = { 
            id: routeId, 
            from: sourceId, 
            to: target, 
            label: `via ${incomingInterface || 'unknown'}`, 
            dashes: true, 
            edgeType: 'route', 
            width: 1, 
            nextHop: nextHopId || undefined,
            // Hide ALL route edges by default - they're only used for pathfinding logic
            hidden: true
          }
          if (isRedundant) {
            routeEdge.redundant = true
          }
          edges.push(routeEdge)
          edgeMap.add(routeId)
        }
      }
    }

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
    // Accept the new backend JSON format. The payload may be:
    // - an array of node entries
    // - a single node entry
    // - an object with a `network_map` property that is either an array or an object
    if (!backendJson) throw new Error('Invalid backend JSON')

    // If the new format nests nodes under `network_map`, extract them.
    let entries: any[] = []
    if (backendJson.network_map) {
      const nm = backendJson.network_map
      // Expect the new format: network_map is either an array of node entries
      // or an object whose values are node entries. Do not accept legacy
      // `node_route_infos` payloads anymore.
      if (Array.isArray(nm)) entries = nm
      else {
        // If network_map is an object whose values are node objects, use them;
        // otherwise treat it as a single node wrapped in an array.
        const vals = Object.values(nm)
        if (vals.length > 0 && vals.every((v: any) => v && (v.node_name || v.neigh_ip_info || v.route_info || v.neigh_infos))) {
          entries = vals
        } else {
          entries = [nm]
        }
      }
    } else if (Array.isArray(backendJson)) {
      entries = backendJson
    } else if (backendJson.node_name || backendJson.neigh_ip_info || backendJson.route_info || backendJson.neigh_infos) {
      entries = [backendJson]
    } else {
      throw new Error('Unrecognized backend JSON format for new schema')
    }

    return this.convertPhysicalOnly(entries)
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
