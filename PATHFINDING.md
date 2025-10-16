# Route-Based Pathfinding Implementation

## Overview

The pathfinding algorithm has been updated to use the `route_info` table from the backend JSON data instead of a default graph-based search algorithm. This ensures that paths are determined by the actual routing configuration, not by arbitrary graph traversal.

## How It Works

### 1. Direct Neighbor Detection
- **First**, the algorithm checks if the source and target are directly connected
- If a physical (direct) edge exists between them, it returns a single-hop path
- This handles the case where nodes are immediate neighbors without routing entries

### 2. Route Table Lookup
- **If not direct neighbors**, the algorithm uses the `route_info` table
- Each node's `route_info` contains entries showing how traffic from different sources reaches it
- Each entry has:
  - `source_node`: The ultimate source of traffic
  - `incoming_interface`: The interface where traffic arrives
  - `iif_neigh_node`: The immediate next-hop neighbor

### 3. Backward Path Tracing
The algorithm traces the path **backwards** from target to source:

1. Start at the **target node**
2. Look up the target's `route_info` table
3. Find the entry where `source_node` matches our source
4. Extract the `iif_neigh_node` (next hop toward source)
5. Move to that next hop and repeat
6. Continue until we reach the source node

### 4. Path Construction
- The algorithm builds the path in reverse (target → source)
- Then reverses it to give the final path (source → target)
- Includes both the node sequence and the edge IDs

## Example

For path **14cd → fireapp-VirtualBox**:

### Route Info at fireapp-VirtualBox:
```json
{
  "incoming_interface": "usb0",
  "iif_neigh_node": "2001:197a:1576:0:2b0:19ff:fe7a:1576",
  "source_node": "2001:197a:14cd:0:2b0:19ff:fe7a:14cd"
}
```

### Algorithm Steps:
1. Start at: `fireapp-VirtualBox`
2. Look up route for source `14cd` → find next hop is `1576`
3. Move to: `1576`
4. Look up route for source `14cd` → find next hop is `14cd` (reached source!)
5. Final path: `14cd → 1576 → fireapp-VirtualBox`

## Test Results

```
Path from 14cd → fireapp-VirtualBox:
  Nodes: 14cd → 1576 → fireapp-VirtualBox
  Edges: direct-14cd-1576, direct-1576-fireapp-VirtualBox

Path from f453 → fireapp-VirtualBox:
  Nodes: f453 → fireapp-VirtualBox
  Edges: direct-f453-fireapp-VirtualBox

Path from 1576 → fireapp-VirtualBox:
  Nodes: 1576 → fireapp-VirtualBox
  Edges: direct-1576-fireapp-VirtualBox
```

## Code Location

- **Implementation**: `utils/dataAdapter.ts`
  - `findPath()` - Main entry point
  - `findPathUsingRouteInfo()` - Route-based algorithm
  - `findPathBFS()` - Fallback BFS (if route_info not available)

- **Usage**: `components/BackendNetworkExample.tsx`
  - Calls `findPath()` with the backend JSON to enable route-based pathfinding

## Benefits

✅ **Accurate**: Uses actual routing tables from network configuration  
✅ **Realistic**: Shows how traffic actually flows through the network  
✅ **Direct neighbor support**: Handles single-hop connections automatically  
✅ **Fallback**: Uses BFS if route_info data is not available  
✅ **Loop detection**: Prevents infinite loops in case of routing errors
