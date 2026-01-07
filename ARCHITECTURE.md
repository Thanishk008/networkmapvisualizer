# Architecture & Codebase Guide

This document describes the directory structure, key components, and how the network map visualization works.

## Directory Structure

```
networkmapvisualizer/
├── app/                          # Next.js App Router
│   ├── globals.css               # Global styles, CSS variables, dark/light themes
│   ├── layout.tsx                # Root layout with theme provider
│   └── page.tsx                  # Main application page
│
├── components/                   # React components
│   ├── BackendNetworkExample.tsx # Main container: data loading, path selection UI
│   ├── NetworkMap.tsx            # Core visualization: canvas rendering, animations
│   ├── DarkModeToggle.tsx        # Theme toggle button
│   ├── ErrorBoundary.tsx         # Error handling wrapper
│   ├── InfoPanel.tsx             # Information panel overlay
│   ├── NodeDetailsPanel.tsx      # Node details side panel (click a node to open)
│   ├── SearchableSelect.tsx      # Searchable dropdown for source/target selection
│   ├── StatisticsDisplay.tsx     # Hover tooltip for node statistics
│   ├── theme-provider.tsx        # Theme context provider
│   └── ui/                       # shadcn/ui component library
│       ├── button.tsx
│       ├── card.tsx
│       ├── select.tsx
│       └── ...                   # Other UI primitives
│
├── config/                       # Configuration files
│   └── datasets.ts               # Dataset definitions (maps names to data/position files)
│
├── hooks/                        # Custom React hooks
│   ├── use-mobile.ts             # Mobile detection hook
│   └── use-toast.ts              # Toast notification hook
│
├── lib/                          # Utility libraries
│   └── utils.ts                  # Tailwind class merge utilities (cn function)
│
├── public/                       # Static assets and network data files
│   ├── new_12_data.json          # 12-node network topology
│   ├── new_28_data.json          # 28-node network topology
│   ├── new_150_data.json         # 150-node network topology
│   ├── query_new_12node.json     # 12-node positions (x, y coordinates)
│   ├── query_new_28node.json     # 28-node positions
│   └── query_new_150node.json    # 150-node positions
│
├── styles/                       # Additional stylesheets
│   └── globals.css               # Legacy global styles
│
├── utils/                        # Core utilities
│   └── dataAdapter.ts            # Data conversion and pathfinding algorithms
│
├── src/                          # Legacy Vite app structure (not used by Next.js)
│
├── package.json                  # Dependencies and npm scripts
├── pnpm-lock.yaml                # Lockfile (prefer pnpm install)
├── tsconfig.json                 # TypeScript configuration
├── next.config.mjs               # Next.js configuration
└── postcss.config.mjs            # PostCSS/Tailwind configuration
```

## Key Components Explained

### `app/page.tsx` - Main Application Page
The root page that orchestrates the entire application:
- Manages dark mode state and applies `dark` class to document
- Renders header with "Show Info" and "Refresh Data" buttons
- Contains dataset selector dropdown (12/28/150 nodes)
- Wraps `BackendNetworkExample` in error boundary
- Shows `NodeDetailsPanel` when a node is clicked

### `components/BackendNetworkExample.tsx` - Data & Interaction Container
Handles all data operations and user interactions (~700 lines):

**Data Loading:**
- Fetches JSON from `public/` based on selected dataset
- Converts raw data via `NetworkDataAdapter.convertPhysicalOnly()`
- Stores both raw backend data and converted vis-network format

**Path Selection UI:**
- Two searchable dropdowns: Source and Target node selection
- "Show Path" button triggers pathfinding
- "Clear Path" button resets highlighting
- Error handling for invalid paths

**State Management:**
- `networkData`: Converted nodes/edges for vis-network
- `rawBackendData`: Original JSON (needed for route-based pathfinding)
- `highlightedPathInfo`: Currently highlighted path (nodes + edges)
- `selectedSource`/`selectedTarget`: User's path selections

### `components/NetworkMap.tsx` - Visualization Engine
The core visualization component (~1700 lines). This is where the magic happens.

#### Structure Overview
```
NetworkMap.tsx
├── vis-network options configuration
├── Animation state (refs for progress, timing)
├── useEffect: Animation loop for light trails
├── useEffect: Network creation and canvas rendering
│   ├── Position calculation from query file
│   ├── Interface box drawing (e0, e1, u0, u1)
│   ├── Edge routing with collision avoidance
│   ├── Path highlighting
│   └── Light trail animation rendering
└── Event handlers (hover, click, blur)
```

#### Interface Box System
Each node displays its network interfaces as small labeled boxes:
```
        ┌────┐
        │ e0 │  ← eth0 (Top)
        └────┘
          │
┌────┐  ┌──────────┐  ┌────┐
│ u1 │──│ Node xyz │──│ e1 │  ← eth1 (Right)
└────┘  └──────────┘  └────┘
  ↑       │            
usb1     │
(Left)   │
        ┌────┐
        │ u0 │  ← usb0 (Bottom)
        └────┘
```

#### Edge Routing System
Edges connect interface boxes (not node centers) using orthogonal paths:
1. **Start Point**: Center of source interface box edge
2. **Routing**: Right-angle turns that avoid node exclusion zones
3. **Lane System**: Prevents overlapping parallel lines
4. **End Point**: Center of target interface box edge

#### Path Highlighting
When a path is highlighted:
- Path edges: Bright color, solid line, thick (3px)
- Other edges: Dimmed, dashed line, thin (1px)
- Parallel edges: All edges between same node pair highlighted

#### Light Trail Animation
Animated dots traveling along highlighted path:
1. Progress tracked in `animationProgressRef` (0 to 1)
2. Duration scales with path length
3. Draws gradient "comet" effect at current position
4. Groups parallel edges at each hop (animate simultaneously)
5. Animation persists through dark mode toggle

### `utils/dataAdapter.ts` - Data Processing Engine
Handles all data transformation and pathfinding (~1000 lines).

#### Key Methods

**`convertPhysicalOnly(backendJson)`**
Converts backend JSON to vis-network format:
```typescript
// Input: Backend JSON with networkMap.nodeRouteInfo
// Output: { nodes: [...], edges: [...] }

// Node extraction:
// - nodeName → id (short hex, e.g., "f453")
// - Creates label "Node f453"
// - Stores fullAddress for tooltip

// Edge creation:
// - From neighIpInfo entries
// - Bidirectional (from-to and to-from stored)
// - Interface info preserved (interfaceA, interfaceB)
```

**`findAllPaths(nodes, edges, sourceId, targetId, backendJson)`**
Main pathfinding entry point:
```typescript
// 1. Check for direct connection (single hop)
// 2. If backendJson has routeInfo → use route-based pathfinding
// 3. Fallback → BFS pathfinding
// 4. Returns { pathNodes: string[], pathEdges: string[] }
```

See [PATHFINDING.md](./PATHFINDING.md) for algorithm details.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interaction                          │
│  (Select dataset, Choose source/target, Click "Show Path")       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BackendNetworkExample.tsx                     │
│  1. Fetch JSON from public/                                      │
│  2. Convert via NetworkDataAdapter.convertPhysicalOnly()         │
│  3. Store networkData + rawBackendData                           │
│  4. On "Show Path": call findAllPaths()                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       NetworkMap.tsx                             │
│  1. Create vis-network instance                                  │
│  2. Load positions from query file                               │
│  3. Custom afterDrawing: draw interfaces + edges                 │
│  4. If highlightedPath: draw animation                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Canvas Output                             │
│  - Nodes with interface boxes                                    │
│  - Orthogonal edge routing                                       │
│  - Path highlighting + light trail animation                     │
└─────────────────────────────────────────────────────────────────┘
```

## Network Data Format

### Input JSON Structure (Backend Format)
```json
{
  "networkMap": {
    "nodeRouteInfo": [
      {
        "nodeName": "Node00b0197af453",
        "localIpInfo": [
          { "localInterface": "eth0", "localIp": "2001:db8::f453" }
        ],
        "neighIpInfo": [
          { 
            "localInterface": "eth0",
            "neighInterface": "eth0", 
            "neighNode": "2001:db8::1576"
          }
        ],
        "routeInfo": [
          {
            "sourceNode": "2001:db8::14cd",
            "incomingInterface": "eth1",
            "iifNeighNode": "2001:db8::1576"
          }
        ]
      }
    ]
  }
}
```

### Converted vis-network Format
```javascript
{
  nodes: [
    { 
      id: "f453", 
      label: "Node f453", 
      fullAddress: "2001:db8::f453",
      type: "target"
    }
  ],
  edges: [
    { 
      id: "direct-f453-1576",
      from: "f453", 
      to: "1576",
      edgeType: "direct",
      interfaceA: "eth0",  // f453's interface
      interfaceB: "eth0"   // 1576's interface
    }
  ]
}
```

## Adding New Datasets

1. **Create data files** in `public/`:
   - `new_XX_data.json` - Network topology (nodeRouteInfo format)
   - `query_new_XXnode.json` - Node positions `[{id, x, y}, ...]`

2. **Register in `config/datasets.ts`**:
   ```typescript
   export const DATASETS: Record<DatasetName, DatasetConfig> = {
     "My New Network": {
       dataFile: "/new_XX_data.json",
       positionsFile: "/query_new_XXnode.json"
     },
     // ... existing datasets
   }
   
   export type DatasetName = "My New Network" | "EST4 12 Node" | ...
   ```

3. **Dataset appears** automatically in the dropdown selector

## Styling System

### Theme Variables (`app/globals.css`)
```css
:root {
  --background: #ffffff;
  --foreground: #1a1a1a;
  --color-legend-phys: #4ECDC4;      /* Node/edge teal color */
  --color-legend-highlight: #FFD166; /* Highlighted path color */
}

.dark {
  --background: #0d1117;             /* GitHub dark background */
  --foreground: #c9d1d9;
  --color-legend-highlight: #FFD166;
}
```

### Canvas Colors (NetworkMap.tsx)
```typescript
// Interface boxes
ctx.fillStyle = darkModeRef.current ? '#161b22' : '#e8f4f8';
ctx.strokeStyle = '#4ECDC4';  // Teal border

// Highlighted path edges
edgeColor = darkModeRef.current ? '#FFD166' : '#FF6B6B';

// Dimmed edges (not on path)
edgeColor = darkModeRef.current ? '#444' : '#ddd';
```

## Performance Notes

- **Physics disabled**: Static layout for predictable positioning
- **Animation refs**: Uses `useRef` to avoid re-renders during animation
- **Dark mode toggle**: Only triggers redraw, not network recreation
- **Large networks**: Tested with 150 nodes; edge routing scales linearly
