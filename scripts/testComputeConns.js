const path = require('path'); const fs = require('fs'); const adapter = require(path.join(__dirname, '..', 'utils', 'dataAdapter.ts'));
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'sample-backend-data.json'), 'utf8'));
const phys = adapter.NetworkDataAdapter.convertPhysicalOnly(raw);

function computeConnectedInterfaces(nodeId, rawBackendData){
  if (!nodeId || !rawBackendData) return [];
  const canonicalId = (nodeId && nodeId.toString().includes(':')) ? adapter.NetworkDataAdapter.extractLastHex(nodeId) : nodeId;
  const phys = adapter.NetworkDataAdapter.convertPhysicalOnly(rawBackendData);
  const edges = phys.edges || [];
  const conns = [];

  for (const e of edges) {
    if (e.edgeType === 'direct') {
      if (e.from === canonicalId) conns.push({ interface: e.label || 'unknown', neighbor: e.to })
      else if (e.to === canonicalId) conns.push({ interface: e.label || 'unknown', neighbor: e.from })
    }
    if (e.edgeType === 'route') {
      const iface = (e.label || '').toString().replace(/^via\s*/i, '') || 'route'
      if (e.from === canonicalId) {
        const neigh = e.nextHop || e.to
        if (neigh) conns.push({ interface: iface, neighbor: neigh })
      } else if (e.to === canonicalId) {
        conns.push({ interface: iface, neighbor: e.from })
      }
    }
  }

  const seen = new Set(); const dedup = [];
  for(const c of conns){ const iface=(c.interface||'').toString().trim(); const neigh=(c.neighbor||'').toString().trim(); if(!neigh) continue; const key = `${iface.toLowerCase()}::${neigh.toLowerCase()}`; if(!seen.has(key)){ seen.add(key); dedup.push({ interface: iface||'unknown', neighbor: neigh }); } }
  dedup.sort((a,b)=>a.interface.localeCompare(b.interface)||a.neighbor.localeCompare(b.neighbor));
  return dedup;
}

console.log('compute for 14cd:', computeConnectedInterfaces('14cd', raw));
console.log('compute for fireapp-VirtualBox:', computeConnectedInterfaces('fireapp-VirtualBox', raw));
console.log('physical edges:', JSON.stringify(phys.edges, null, 2));
