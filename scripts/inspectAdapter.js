const fs = require('fs')
const path = require('path')
const adapter = require(path.join(__dirname, '..', 'utils', 'dataAdapter.ts'))

const payload = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'sample-backend-data.json'), 'utf8'))
const phys = adapter.NetworkDataAdapter.convertPhysicalOnly(payload)
console.log('physical nodes:', JSON.stringify(phys.nodes, null, 2))
console.log('physical edges:', JSON.stringify(phys.edges, null, 2))
const sourceNodes = (phys.edges || []).filter(e => e.edgeType === 'route').map(e => ({ id: e.from, label: `Node ${e.from}` })).filter((n, i, a) => n.id && i === a.findIndex(x => x.id === n.id))
console.log('sourceNodes:', JSON.stringify(sourceNodes, null, 2))

const nodeId = '14cd'
const conns = []
// Only show physical (direct) connections, exclude route edges
for (const e of phys.edges) {
  if (e.edgeType === 'direct') {
    if (e.from === nodeId) {
      // Skip self-connections
      if (e.to !== nodeId) conns.push({ interface: e.label, neighbor: e.to })
    } else if (e.to === nodeId) {
      // Skip self-connections
      if (e.from !== nodeId) conns.push({ interface: e.label, neighbor: e.from })
    }
  }
}
// Deduplicate
const seen = new Set()
const dedup = []
for (const c of conns) {
  const key = `${(c.interface || '').toLowerCase()}::${(c.neighbor || '').toLowerCase()}`
  if (!seen.has(key)) {
    seen.add(key)
    dedup.push(c)
  }
}
console.log(`connections for ${nodeId} (physical only):`, JSON.stringify(dedup, null, 2))

// Test all nodes
console.log('\n=== All Node Connections (Physical Only) ===')
for (const node of phys.nodes) {
  const nid = node.id
  const nconns = []
  for (const e of phys.edges) {
    if (e.edgeType === 'direct') {
      if (e.from === nid && e.to !== nid) {
        // Use interfaceA for the 'from' endpoint
        const iface = e.interfaceA || e.label
        nconns.push({ interface: iface, neighbor: e.to })
      }
      else if (e.to === nid && e.from !== nid) {
        // Use interfaceB for the 'to' endpoint
        const iface = e.interfaceB || e.label
        nconns.push({ interface: iface, neighbor: e.from })
      }
    }
  }
  const nseen = new Set()
  const ndedup = []
  for (const c of nconns) {
    const key = `${(c.interface || '').toLowerCase()}::${(c.neighbor || '').toLowerCase()}`
    if (!nseen.has(key)) {
      nseen.add(key)
      ndedup.push(c)
    }
  }
  console.log(`${nid}:`, JSON.stringify(ndedup, null, 2))
}

// Test pathfinding with route_info
console.log('\n=== Pathfinding Tests (Using route_info) ===')
try {
  const testPaths = [
    // Forward direction tests
    { source: '14cd', target: 'fireapp-VirtualBox' },
    { source: 'f453', target: 'fireapp-VirtualBox' },
    { source: '1576', target: 'fireapp-VirtualBox' },
    // Reverse direction tests
    { source: 'fireapp-VirtualBox', target: '14cd' },
    { source: 'fireapp-VirtualBox', target: 'f453' },
    { source: 'fireapp-VirtualBox', target: '1576' },
    // Multi-hop tests
    { source: 'f453', target: '14cd' },
    { source: '14cd', target: 'f453' }
  ]
  
  for (const test of testPaths) {
    try {
      const result = adapter.NetworkDataAdapter.findPath(phys.nodes, phys.edges, test.source, test.target, payload)
      console.log(`Path from ${test.source} → ${test.target}:`)
      console.log(`  Nodes: ${result.pathNodes.join(' → ')}`)
      console.log(`  Edges: ${result.pathEdges.join(', ')}`)
    } catch (err) {
      console.log(`Path from ${test.source} → ${test.target}: ERROR - ${err.message}`)
    }
  }
} catch (err) {
  console.log('Pathfinding test failed:', err.message)
}

