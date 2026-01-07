# Pathfinding Algorithm

This document explains the pathfinding implementation in `utils/dataAdapter.ts`.

## Overview

The pathfinding system uses a **two-tier approach**:

1. **Route-based pathfinding** (primary) - Uses `routeInfo` from network data
2. **BFS pathfinding** (fallback) - Graph traversal when route info unavailable

## Entry Point: `findAllPaths()`

```typescript
findAllPaths(
  nodes: VisNode[],
  edges: VisEdge[],
  sourceId: string,
  targetId: string,
  backendJson?: any
): { pathNodes: string[], pathEdges: string[] }
```

### Algorithm Flow

```
                    ┌──────────────────────┐
                    │   findAllPaths()     │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Direct connection?  │
                    │  (single-hop check)  │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │ YES            │                │ NO
              ▼                │                ▼
    ┌─────────────────┐        │      ┌─────────────────────┐
    │ Return direct   │        │      │ Has backendJson     │
    │ path & edges    │        │      │ with routeInfo?     │
    └─────────────────┘        │      └──────────┬──────────┘
                               │                 │
                               │    ┌────────────┼────────────┐
                               │    │ YES        │            │ NO
                               │    ▼            │            ▼
                               │  ┌──────────────┴───┐  ┌─────────────┐
                               │  │findPathUsing     │  │findPathBFS()│
                               │  │RouteInfo()       │  │(graph search)│
                               │  └──────────────────┘  └─────────────┘
                               │           │                    │
                               └───────────┴────────────────────┘
                                           │
                               ┌───────────▼───────────┐
                               │  Collect ALL parallel │
                               │  edges for each hop   │
                               └───────────────────────┘
```

## Step 1: Direct Connection Check

Before any complex pathfinding, check if source and target are directly connected:

```typescript
// Check for direct edge between source and target
const directEdges = edges.filter(e =>
  (e.from === sourceId && e.to === targetId) ||
  (e.from === targetId && e.to === sourceId)
);

if (directEdges.length > 0) {
  return {
    pathNodes: [sourceId, targetId],
    pathEdges: directEdges.map(e => e.id)  // Include ALL parallel edges
  };
}
```

## Step 2: Route-Based Pathfinding

If `backendJson` contains `routeInfo`, use route-based pathfinding.

### `findPathUsingRouteInfo()`

This traces the path **backwards** from target to source using routing tables:

```typescript
function findPathUsingRouteInfo(
  sourceId: string,
  targetId: string,
  backendJson: any
): string[] | null
```

### Algorithm Steps

```
1. Build lookup: nodeId → routeInfo array
2. Start at TARGET node
3. Loop:
   a. Find routeInfo entry where sourceNode matches SOURCE
   b. Extract iifNeighNode (next hop toward source)
   c. Add current node to path
   d. Move to iifNeighNode
   e. If reached SOURCE, done!
4. Reverse path (was target→source, need source→target)
```

### Example: Path from `14cd` to `f453`

**Network:**
```
14cd ←→ 1576 ←→ f453
```

**Step-by-step:**

| Step | Current | Looking for | routeInfo says | Next hop |
|------|---------|-------------|----------------|----------|
| 1 | f453 | source=14cd | iifNeighNode=1576 | 1576 |
| 2 | 1576 | source=14cd | iifNeighNode=14cd | 14cd ✓ |

**Reverse path:** `[f453, 1576, 14cd]` → `[14cd, 1576, f453]`

## Step 3: BFS Fallback

If route info is unavailable, fall back to breadth-first search:

### `findPathBFS()`

```typescript
function findPathBFS(
  edges: VisEdge[],
  sourceId: string,
  targetId: string
): string[] | null
```

### Algorithm

```typescript
// Build adjacency list from edges
const adjacency = new Map<string, string[]>();
for (const edge of edges) {
  if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
  if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
  adjacency.get(edge.from)!.push(edge.to);
  adjacency.get(edge.to)!.push(edge.from);
}

// BFS traversal
const queue: string[] = [sourceId];
const visited = new Set<string>([sourceId]);
const parent = new Map<string, string>();

while (queue.length > 0) {
  const current = queue.shift()!;
  
  if (current === targetId) {
    // Reconstruct path from parent map
    return reconstructPath(parent, sourceId, targetId);
  }
  
  for (const neighbor of adjacency.get(current) || []) {
    if (!visited.has(neighbor)) {
      visited.add(neighbor);
      parent.set(neighbor, current);
      queue.push(neighbor);
    }
  }
}

return null; // No path found
```

## Step 4: Collect Parallel Edges

After finding the path nodes, collect **all edges** between consecutive nodes:

```typescript
function collectPathEdges(
  pathNodes: string[],
  edges: VisEdge[]
): string[] {
  const pathEdges: string[] = [];
  
  for (let i = 0; i < pathNodes.length - 1; i++) {
    const from = pathNodes[i];
    const to = pathNodes[i + 1];
    
    // Find ALL edges between these nodes (parallel edges)
    const edgesBetween = edges.filter(e =>
      (e.from === from && e.to === to) ||
      (e.from === to && e.to === from)
    );
    
    for (const edge of edgesBetween) {
      pathEdges.push(edge.id);
    }
  }
  
  return pathEdges;
}
```

> **Why parallel edges?** Two nodes may have multiple connections (e.g., eth0↔eth0 and eth1↔usb0). The visualization highlights all of them.

## Node ID Normalization

Node IDs are normalized to 4-character hex strings:

```typescript
function normalizeId(rawId: string): { id: string, fullAddress: string } {
  // IPv6: "2001:db8::f453" → "f453"
  // Node format: "Node00b0197af453" → "f453"
  // Short hex: "f453" → "f453"
  
  // Extract last 4 hex characters
  const match = rawId.match(/([0-9a-f]{4})$/i);
  return {
    id: match ? match[1].toLowerCase() : rawId,
    fullAddress: rawId
  };
}
```

## Error Handling

The pathfinding handles various edge cases:

| Case | Handling |
|------|----------|
| Same source and target | Return `{ pathNodes: [sourceId], pathEdges: [] }` |
| No path exists | Return `{ pathNodes: [], pathEdges: [] }` |
| Missing route info | Automatically fall back to BFS |
| Loop in route table | Detected via `visited` set, returns null |
| Invalid node ID | `normalizeId()` returns original as fallback |

## Usage in Components

### BackendNetworkExample.tsx

```typescript
const handleShowPath = () => {
  if (!selectedSource || !selectedTarget || !networkData) return;
  
  const result = NetworkDataAdapter.findAllPaths(
    networkData.nodes,
    networkData.edges,
    selectedSource,
    selectedTarget,
    rawBackendData  // Pass raw JSON for route-based pathfinding
  );
  
  if (result.pathNodes.length > 0) {
    setHighlightedPathInfo({
      pathNodes: result.pathNodes,
      pathEdges: result.pathEdges
    });
  } else {
    // Show error: no path found
  }
};
```

### NetworkMap.tsx

The `highlightedPathInfo` prop triggers:
1. Path edges drawn with bright color (yellow/coral)
2. Non-path edges dimmed and dashed
3. Light trail animation along path

## Performance

| Operation | Complexity |
|-----------|------------|
| Direct check | O(E) where E = edge count |
| Route-based | O(P × R) where P = path length, R = route entries |
| BFS | O(V + E) where V = nodes, E = edges |
| Edge collection | O(P × E) |

For typical networks (< 200 nodes), all operations complete in < 10ms.

## Related Documentation

- [ROUTE_INFO_TABLE.md](./ROUTE_INFO_TABLE.md) - Route info data structure
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall codebase architecture
- [utils/dataAdapter.ts](./utils/dataAdapter.ts) - Source implementation
