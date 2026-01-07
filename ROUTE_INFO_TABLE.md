# Route Info Table

This document explains how the **route_info** table works in the network data and how it's used for pathfinding.

## Overview

Each node in the network maintains a `routeInfo` (or `route_info`) array that describes how traffic from different source nodes reaches it. This is essentially a **reverse routing table**—it tells you "if traffic is coming from source X, it arrived via neighbor Y on interface Z."

## Route Info Entry Structure

```json
{
  "sourceNode": "2001:db8::14cd",
  "incomingInterface": "eth0",
  "iifNeighNode": "2001:db8::1576"
}
```

| Field | Description |
|-------|-------------|
| `sourceNode` | The ultimate **source** of the traffic (where it originated) |
| `incomingInterface` | The interface on the current node where traffic arrives |
| `iifNeighNode` | The **immediate neighbor** from which traffic arrives (IIF = Incoming Interface) |

> **Key Insight**: `iifNeighNode` is the next hop when tracing backwards from target to source.

## Example Network

Consider this 4-node network:

```
           ┌──────────────┐
           │  f453        │
           │  (eth0,eth1) │
           └──────┬───────┘
                  │ eth1↔eth0
                  │
           ┌──────┴───────┐
           │  1576        │
           │  (eth0,usb1) │
           └──┬───────┬───┘
              │       │
     eth0↔usb0│       │usb1↔usb0
              │       │
    ┌─────────┴─┐   ┌─┴─────────┐
    │  host     │   │  14cd     │
    │  (usb0)   │   │  (usb0)   │
    └───────────┘   └───────────┘
```

## Route Info Tables by Node

### Node: host
How traffic from other nodes reaches `host`:

| Source | Incoming Interface | Via Neighbor | Meaning |
|--------|-------------------|--------------|---------|
| 1576   | usb0 | 1576 | Direct neighbor |
| 14cd   | usb0 | 1576 | 14cd → 1576 → host |
| f453   | usb0 | 1576 | f453 → 1576 → host |

### Node: 1576
How traffic from other nodes reaches `1576`:

| Source | Incoming Interface | Via Neighbor | Meaning |
|--------|-------------------|--------------|---------|
| host   | eth0 | host | Direct neighbor |
| 14cd   | usb1 | 14cd | Direct neighbor |
| f453   | eth1 | f453 | Direct neighbor |

### Node: f453
How traffic from other nodes reaches `f453`:

| Source | Incoming Interface | Via Neighbor | Meaning |
|--------|-------------------|--------------|---------|
| 1576   | eth1 | 1576 | Direct neighbor |
| host   | eth1 | 1576 | host → 1576 → f453 |
| 14cd   | eth1 | 1576 | 14cd → 1576 → f453 |

### Node: 14cd
How traffic from other nodes reaches `14cd`:

| Source | Incoming Interface | Via Neighbor | Meaning |
|--------|-------------------|--------------|---------|
| 1576   | usb0 | 1576 | Direct neighbor |
| host   | usb0 | 1576 | host → 1576 → 14cd |
| f453   | usb0 | 1576 | f453 → 1576 → 14cd |

## How Pathfinding Uses This Data

The algorithm in `utils/dataAdapter.ts` uses route_info for **reverse path tracing**:

### Algorithm: `findPathUsingRouteInfo()`

```
1. Start at the TARGET node
2. Look up target's routeInfo for an entry where sourceNode matches SOURCE
3. Extract iifNeighNode (the neighbor closer to source)
4. Move to that neighbor, repeat step 2
5. Continue until reaching SOURCE
6. Reverse the collected path (was target→source, need source→target)
```

### Example: Finding path 14cd → f453

**Step 1**: Start at target `f453`, look for source `14cd`
```json
// f453's routeInfo entry for source 14cd:
{
  "sourceNode": "14cd",
  "incomingInterface": "eth1",
  "iifNeighNode": "1576"
}
```
→ Next hop toward source is `1576`

**Step 2**: At `1576`, look for source `14cd`
```json
// 1576's routeInfo entry for source 14cd:
{
  "sourceNode": "14cd",
  "incomingInterface": "usb1",
  "iifNeighNode": "14cd"
}
```
→ Next hop is `14cd` (reached source!)

**Result**: Reverse path `[f453, 1576, 14cd]` → Final path: `14cd → 1576 → f453`

## JSON Format in Data Files

The route info appears in the backend JSON under each node:

```json
{
  "networkMap": {
    "nodeRouteInfo": [
      {
        "nodeName": "Node00b0197af453",
        "localIpInfo": [...],
        "neighIpInfo": [...],
        "routeInfo": [
          {
            "sourceNode": "2001:db8::14cd",
            "incomingInterface": "eth1",
            "iifNeighNode": "2001:db8::1576"
          },
          {
            "sourceNode": "2001:db8::1576",
            "incomingInterface": "eth1", 
            "iifNeighNode": "2001:db8::1576"
          }
        ]
      }
    ]
  }
}
```

## Fallback: BFS Pathfinding

If `routeInfo` is not available (missing or empty), the system falls back to **BFS (Breadth-First Search)** graph traversal. This happens automatically in `findAllPaths()`.

## Benefits of Route-Based Pathfinding

| Benefit | Description |
|---------|-------------|
| **Accurate** | Shows actual network routing, not just shortest path |
| **Realistic** | Matches how traffic actually flows |
| **Deterministic** | Same source/target always gives same path |
| **No computation** | Just table lookups, O(n) where n = path length |

## Related Files

- [PATHFINDING.md](./PATHFINDING.md) - Full pathfinding algorithm explanation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Codebase structure and data flow
- [utils/dataAdapter.ts](./utils/dataAdapter.ts) - Implementation source code
