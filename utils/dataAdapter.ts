import { DataSet } from "vis-data"

export class NetworkDataAdapter {
  /**
   * Find ALL paths between source and target node IDs.
   * This method returns all direct connections (for multicast scenarios where there may be
   * multiple physical links between two nodes via different interfaces).
   * Returns { pathEdges: string[], pathNodes: string[] } with ALL matching edges.
   */
  static findAllPaths(nodes: any[], edges: any[], sourceId: string, targetId: string, backendJson?: any) {
    if (!sourceId || !targetId) throw new Error("Source and target must be provided")
    if (sourceId === targetId) return { pathEdges: [], pathNodes: [sourceId] }
    
    const nodeIds = new Set(nodes.map(n => n.id))
    if (!nodeIds.has(sourceId)) throw new Error(`Source node '${sourceId}' not found`)
    if (!nodeIds.has(targetId)) throw new Error(`Target node '${targetId}' not found`)

    // Debug: log all edges that involve either source or target
    console.log(`[findAllPaths] Searching for paths between '${sourceId}' and '${targetId}'`)
    const relatedEdges = edges.filter(e => 
      e.from === sourceId || e.to === sourceId || 
      e.from === targetId || e.to === targetId
    )
    console.log(`[findAllPaths] Edges involving source or target:`, relatedEdges.map(e => ({
      id: e.id, from: e.from, to: e.to, ifaceA: e.interfaceA, ifaceB: e.interfaceB
    })))

    // Find all direct edges between source and target (multicast support)
    const directEdges = this.findAllEdgesBetween(edges, sourceId, targetId)
    
    if (directEdges.length > 0) {
      // Direct neighbors with one or more connections
      console.log(`[findAllPaths] Found ${directEdges.length} direct paths between ${sourceId} and ${targetId}:`, directEdges)
      return { pathEdges: directEdges, pathNodes: [sourceId, targetId] }
    }

    // Not direct neighbors - try route-based pathfinding for single path
    // For multi-hop paths, we currently only find one path
    // (multi-hop multicast routing would require more complex analysis)
    if (backendJson && (backendJson.network_map || backendJson.networkMap)) {
      try {
        return this.findPathUsingRouteInfo(sourceId, targetId, backendJson, edges)
      } catch (err) {
        console.warn('Route-based pathfinding failed, falling back to BFS:', err)
      }
    }

    // Fallback to BFS
    return this.findPathBFS(sourceId, targetId, edges, true)
  }

  /**
   * Helper to find ALL edges between two nodes (for multicast with multiple physical links)
   */
  private static findAllEdgesBetween(edges: any[], nodeA: string, nodeB: string): string[] {
    const result: string[] = []
    console.log(`[findAllEdgesBetween] Looking for edges between '${nodeA}' and '${nodeB}'`)
    console.log(`[findAllEdgesBetween] Total edges to check: ${edges.length}`)
    
    for (const edge of edges) {
      if (edge.hidden || edge.redundant) continue // Skip hidden/redundant edges
      if ((edge.from === nodeA && edge.to === nodeB) || 
          (edge.from === nodeB && edge.to === nodeA)) {
        console.log(`[findAllEdgesBetween] Found edge: ${edge.id} (${edge.from} -> ${edge.to}, interfaceA: ${edge.interfaceA}, interfaceB: ${edge.interfaceB})`)
        result.push(edge.id)
      }
    }
    
    console.log(`[findAllEdgesBetween] Total matching edges: ${result.length}`)
    return result
  }

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

    // If backendJson with route_info is provided, try route-based pathfinding first
    // Support both snake_case (network_map) and camelCase (networkMap)
    if (backendJson && (backendJson.network_map || backendJson.networkMap)) {
      try {
        return this.findPathUsingRouteInfo(sourceId, targetId, backendJson, edges)
      } catch (err) {
        console.warn('Route-based pathfinding failed, falling back to BFS:', err)
        // Fall through to BFS
      }
    }

    // Fallback to BFS-based pathfinding if route_info not available or failed
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
      
      // Handle "Node00b0197a14cb" format - extract the last hex segment
      if (trimmed.startsWith('Node') && trimmed.length > 4) {
        const hexPart = trimmed.substring(4) // Remove "Node" prefix
        // Extract last 4 characters as the node ID
        const nodeId = hexPart.substring(hexPart.length - 4)
        return { id: nodeId, fullAddress: trimmed }
      }
      
      // Extract short form: last segment after final ':'
      if (trimmed.includes(':')) {
        const parts = trimmed.split(':')
        const shortId = parts[parts.length - 1]
        return { id: shortId, fullAddress: trimmed }
      }
      
      return { id: trimmed, fullAddress: null }
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
    // Support both snake_case and camelCase field names
    const ipToNodeId = new Map<string, string>()
    const networkMapData = backendJson?.network_map || backendJson?.networkMap
    let nodeList: any[] = []
    
    if (networkMapData) {
      // Handle nested structure: { networkMap: { nodeRouteInfo: [...] } }
      if (networkMapData.nodeRouteInfo || networkMapData.node_route_info) {
        nodeList = networkMapData.nodeRouteInfo || networkMapData.node_route_info
      } else if (Array.isArray(networkMapData)) {
        nodeList = networkMapData
      }
    }
    
    for (const entry of nodeList) {
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
    
    for (const entry of nodeList) {
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
          // Only update fullAddress if:
          // 1. No fullAddress exists yet, OR
          // 2. The new data is from a target node (type='target') which has authoritative eth0 IP
          // Don't let neighbor references overwrite the correct eth0 IP from target entries
          if (opts && opts.fullAddress) {
            if (!existing.fullAddress || opts.type === 'target') {
              existing.fullAddress = opts.fullAddress
            }
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
    // Also handle "NodeXXXXXXXX" format by extracting the hex portion.
    const normalizeId = (raw: any) => {
      if (raw === undefined || raw === null) return { id: '', fullAddress: undefined }
      const s = raw.toString().trim()
      if (!s) return { id: '', fullAddress: undefined }
      
      // Handle "Node00b0197a14cb" format - extract the last hex segment
      if (s.startsWith('Node') && s.length > 4) {
        const hexPart = s.substring(4) // Remove "Node" prefix
        // Extract last 4 characters as the node ID and remove leading zeros
        const nodeIdWithZeros = hexPart.substring(hexPart.length - 4)
        // Convert to number and back to hex to remove leading zeros
        const nodeId = parseInt(nodeIdWithZeros, 16).toString(16)
        return { id: nodeId, fullAddress: s }
      }
      
      if (s.includes(':')) {
        return { id: this.extractLastHex(s), fullAddress: s }
      }
      return { id: s, fullAddress: undefined }
    }

    // If the payload wraps nodes under `network_map` or `networkMap` (new format), extract them;
    // otherwise if the payload is an array treat it as entries; otherwise wrap
    // a single node object into an array.
    let nodeEntries: any[] = []
    // Support both snake_case (network_map) and camelCase (networkMap)
    const networkMapData = backendJson?.network_map || backendJson?.networkMap
    if (networkMapData) {
      // Handle nested structure: { networkMap: { nodeRouteInfo: [...] } }
      let nm = networkMapData
      if (nm.nodeRouteInfo || nm.node_route_info) {
        nm = nm.nodeRouteInfo || nm.node_route_info
      }
      
      if (Array.isArray(nm)) nodeEntries = nm
      else {
        const vals = Object.values(nm)
        if (vals.length > 0 && vals.every((v: any) => v && (v.node_name || v.nodeName || v.neigh_ip_info || v.neighIpInfo || v.route_info || v.routeInfo || v.neigh_infos))) {
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
    // AND store original node names for lookup
    const ipToNodeId = new Map<string, string>()
    const nodeLocalIps = new Map<string, Array<{interface: string, ip: string}>>()
    const nodeIdToNodeName = new Map<string, string>()
    
    for (const entry of nodeEntries) {
      const targetRaw = entry.node_name || entry.nodeName || entry.name
      const { id: nodeId } = normalizeId(targetRaw)
      if (!nodeId) continue
      
      // Store the original node name for this nodeId
      if (typeof targetRaw === 'string' && targetRaw.startsWith('Node')) {
        nodeIdToNodeName.set(nodeId, targetRaw)
      }
      
      const localIfs = entry.local_ip_info || entry.localIpInfo || entry.local_ip_infos || []
      const allLocalIps: Array<{interface: string, ip: string}> = []
      
      for (const localIf of localIfs) {
        const localIp = localIf.local_ip || localIf.localIp || localIf.ip
        let iface = localIf.interface || localIf.iface
        
        // If no interface specified, try to infer from existing interfaces
        // Default to eth0 if it's the first unspecified interface
        if (!iface) {
          const existingInterfaces = allLocalIps.map(li => li.interface)
          if (!existingInterfaces.includes('eth0')) {
            iface = 'eth0'
          } else {
            iface = 'unknown'
          }
        }
        
        if (localIp) {
          const { id: ipId } = normalizeId(localIp)
          if (ipId) {
            ipToNodeId.set(ipId, nodeId)
            allLocalIps.push({ interface: iface, ip: localIp })
          }
        }
      }
      
      // Sort local IPs by interface order: eth0, eth1, usb0, usb1
      const interfaceOrder: {[key: string]: number} = { 'eth0': 0, 'eth1': 1, 'usb0': 2, 'usb1': 3 }
      allLocalIps.sort((a, b) => {
        const orderA = interfaceOrder[a.interface] ?? 999
        const orderB = interfaceOrder[b.interface] ?? 999
        return orderA - orderB
      })
      
      nodeLocalIps.set(nodeId, allLocalIps)
    }

    for (const entry of nodeEntries) {
      const targetRaw = entry.node_name || entry.nodeName || entry.name
      let { id: target, fullAddress: targetFull } = normalizeId(targetRaw)
      
      // Get the eth0 IP address to use as the full address for display
      const localIfs = entry.local_ip_info || entry.localIpInfo || entry.local_ip_infos || []
      
      // Priority order: eth0 (or undefined) → eth1 → usb0 → usb1
      let eth0IpAddress = null
      
      // First try to find eth0 or undefined interface
      const eth0Entry = localIfs.find((li: any) => {
        const iface = li.interface || li.iface
        return !iface || iface === 'eth0' || iface === 'NO_INTERFACE'
      })
      
      if (eth0Entry) {
        eth0IpAddress = eth0Entry.local_ip || eth0Entry.localIp || eth0Entry.ip
      } else {
        // If no eth0, try eth1 → usb0 → usb1 in priority order
        const priorityOrder = ['eth1', 'usb0', 'usb1']
        for (const ifaceName of priorityOrder) {
          const entry = localIfs.find((li: any) => {
            const iface = li.interface || li.iface
            return iface === ifaceName
          })
          if (entry) {
            eth0IpAddress = entry.local_ip || entry.localIp || entry.ip
            break
          }
        }
        
        // If still not found, use the first available as last resort
        if (!eth0IpAddress && localIfs.length > 0) {
          const firstEntry = localIfs[0]
          eth0IpAddress = firstEntry.local_ip || firstEntry.localIp || firstEntry.ip
        }
      }
      
      // If normalizeId couldn't extract a canonical ID (non-standard node_name like "fireapp-VirtualBox"),
      // try to use the eth0 interface IP to determine the canonical node ID
      if (target && !targetRaw.toString().includes(':') && !targetRaw.toString().startsWith('Node')) {
        if (eth0IpAddress) {
          const { id: canonicalId } = normalizeId(eth0IpAddress)
          if (canonicalId) {
            target = canonicalId
            targetFull = eth0IpAddress // Use eth0 IP as fullAddress
          }
        }
      } else if (eth0IpAddress) {
        // For standard node names, also use eth0 IP as fullAddress
        targetFull = eth0IpAddress
      }
      
      if (!target) continue
      
      // Create a short label for display
      let displayLabel = targetRaw
      if (typeof targetRaw === 'string') {
        if (targetRaw.includes(':')) {
          // For IPv6, show "Node XXXX" format
          displayLabel = `Node ${target}`
        } else if (targetRaw.startsWith('Node') && targetRaw.length > 4) {
          // For "NodeXXXX..." format, show last 4 hex digits
          displayLabel = `Node ${target}`
        }
      }
      
      // Attach all local IPs to the node for display in hover
      const localIpsForNode = nodeLocalIps.get(target) || []
      
      // Use 'target' type to represent the destination node
      addNode(target, { 
        type: 'target', 
        fullAddress: targetFull,
        nodeName: targetRaw, // Store original node name for lookup
        label: displayLabel, // Use short label
        allLocalIps: localIpsForNode 
      })

      // Neighbors come from neigh_ip_info (IP-based) or neigh_list
      // Preserve local interface info for the target node (do not create new nodes).
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
        
        // Create a short label for neighbor display
        let neighborDisplayLabel = rawNeighbor
        if (typeof rawNeighbor === 'string') {
          if (rawNeighbor.includes(':')) {
            neighborDisplayLabel = `Node ${neighborId}`
          } else if (rawNeighbor.startsWith('Node') && rawNeighbor.length > 4) {
            neighborDisplayLabel = `Node ${neighborId}`
          }
        }
        
        addNode(neighborId, { 
          type: 'neighbor', 
          interface: n.interface || n.iface || undefined, 
          fullAddress: neighborFull,
          nodeName: nodeIdToNodeName.get(neighborId) || rawNeighbor, // Get original node name
          label: neighborDisplayLabel,
          allLocalIps: neighborLocalIps 
        })

        // canonicalize undirected physical link id
        // Use sorted pair of local IP and neighbor IP to uniquely identify each connection
        // This allows multiple connections between same nodes via different interface pairs
        const targetInterface = n.interface || n.iface || 'eth0'
        
        // Find the local IP for this interface on the current node
        const localIpForInterface = localIfs.find((li: any) => (li.interface || li.iface) === targetInterface)
        const localIpStr = localIpForInterface?.local_ip || localIpForInterface?.localIp
        const { id: localIpId } = normalizeId(localIpStr || target)
        const { id: neighIpId } = normalizeId(rawNeighbor)
        
        // Create canonical edge ID by sorting the two IP IDs
        const [ipA, ipB] = [localIpId, neighIpId].sort()
        const eid = `direct-${ipA}-${ipB}`
        
        if (!edgeMap.has(eid)) {
          // Determine which nodes are 'from' and 'to' for the edge
          const [a, b] = [target, neighborId].sort()
          
          const neighborIpAddress = rawNeighbor // Store the original neighbor IP
          const edgeData: any = { 
            id: eid, 
            from: a, 
            to: b, 
            label: targetInterface, // Set initial label
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
            const [a, b] = [target, neighborId].sort()
            const neighborIpAddress = rawNeighbor
            if (target === a) {
              existingEdge.interfaceA = targetInterface
              existingEdge.neighborIpA = neighborIpAddress
            } else {
              existingEdge.interfaceB = targetInterface
              existingEdge.neighborIpB = neighborIpAddress
            }
            // Update label to show both interfaces if both are known
            if (existingEdge.interfaceA && existingEdge.interfaceB) {
              existingEdge.label = `${existingEdge.interfaceA} ↔ ${existingEdge.interfaceB}`
            } else {
              existingEdge.label = existingEdge.interfaceA || existingEdge.interfaceB || 'eth0'
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
        
        // Create a short label for source display
        let sourceDisplayLabel = rawSource
        if (typeof rawSource === 'string') {
          if (rawSource.includes(':')) {
            sourceDisplayLabel = `Node ${sourceId}`
          } else if (rawSource.startsWith('Node') && rawSource.length > 4) {
            sourceDisplayLabel = `Node ${sourceId}`
          }
        }
        
        addNode(sourceId, { 
          type: 'source', 
          nextHop: nextHopId || undefined, 
          viaInterface: incomingInterface, 
          fullAddress: sourceFull,
          nodeName: nodeIdToNodeName.get(sourceId) || rawSource, // Get original node name
          label: sourceDisplayLabel,
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

    // Final pass: ensure all direct edges have proper labels showing interface info
    for (const edge of edges) {
      if (edge.edgeType === 'direct') {
        if (edge.interfaceA && edge.interfaceB) {
          edge.label = `${edge.interfaceA} ↔ ${edge.interfaceB}`
        } else if (edge.interfaceA || edge.interfaceB) {
          edge.label = edge.interfaceA || edge.interfaceB
        } else if (!edge.label) {
          edge.label = 'eth0'
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

    let tooltip = `${node.label || node.name || "Node"}`
    
    // Add all local IPs if available
    if (node.allLocalIps && node.allLocalIps.length > 0) {
      tooltip += `\n\nLocal IPs:`
      node.allLocalIps.forEach((ipInfo: any) => {
        const shortIp = ipInfo.ip ? ipInfo.ip.split(':').pop() : ipInfo.ip
        const iface = ipInfo.interface || 'eth0' // Default to eth0 if interface not specified
        tooltip += `\n  ${iface}: ${shortIp}`
      })
    }
    
    tooltip += `\n\nRX: ${rx}
TX: ${tx}
Traffic: ${traffic}
Latency: ${latency}`

    return tooltip
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
