# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Core Development Workflow
\`\`\`bash
# Install dependencies
npm install

# Start development server (runs on localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
\`\`\`

### Testing and Quality
- Currently no test suite configured - tests would typically be run with `npm test`
- ESLint is configured for code quality and React best practices
- The project uses modern React patterns with hooks and functional components

## Project Architecture

### Core Technology Stack
- **Framework**: React 19 with Vite as build tool
- **Visualization**: vis-network and vis-data for network topology rendering
- **Styling**: CSS with custom components, no CSS framework
- **Additional Libraries**: D3.js and @xyflow/react (available but not actively used)

### Component Architecture
The application follows a clean component-based architecture:

#### Main Components
- **`App.jsx`**: Root component managing global state (hovered nodes, mouse position) and rendering the main layout
- **`NetworkMap.jsx`**: Core visualization component using vis-network library
- **`StatisticsDisplay.jsx`**: Floating tooltip component showing node statistics on hover

#### Key Architectural Patterns
- **Data Adapter Pattern**: `NetworkDataAdapter` class provides flexible data format conversion
- **Event-driven UI**: Uses callback props for node interactions (hover, click)
- **Controlled Components**: All interactive state managed in parent components

### Data Flow Architecture

#### Data Transformation Pipeline
1. **Raw Data Input** → Various formats supported (nodes/edges, topology, devices)
2. **NetworkDataAdapter** → Normalizes data to vis-network format
3. **vis-network DataSet** → Reactive data structures for visualization
4. **NetworkMap Component** → Renders interactive network visualization

#### Supported Data Formats
The `NetworkDataAdapter` can handle multiple input formats:
- **Standard**: `{nodes: [], edges: []}`
- **Topology**: `{topology: {devices: [], connections: []}}`
- **Device-based**: `{devices: [{id, name, connections: []}]}`

### Visualization Features
- **Interactive Network Topology**: zoom, hover interactions
- **Real-time Statistics**: Node selection displays RX/TX rates, traffic, latency, uptime
- **Color-coded Node Types**: Source (green), Destination (pink), Intermediate (orange), Router/Switch (blue)
- **Dynamic Edge Styling**: Width and color based on traffic levels
- **Physics Simulation**: Automatic node positioning

### State Management
- Uses React's built-in state management with hooks
- Global state limited to UI interactions (hover states, mouse position)
- Network data is immutable after initial load
- Event callbacks propagate user interactions up to parent components

### Integration Points

#### Adding New Data Sources
To integrate with external data sources:
1. Create new format handler in `NetworkDataAdapter`
2. Add data processing logic in relevant `process*()` methods
3. Ensure data includes required fields: `id`, `label` for nodes; `from`, `to` for edges

#### Customizing Visualization
Key customization points in `NetworkMap.jsx`:
- **Node styling**: Modify `options.nodes` and `options.groups`
- **Edge styling**: Customize `options.edges` configuration
- **Physics behavior**: Adjust `options.physics` settings
- **Interaction behavior**: Configure `options.interaction`

#### Extending Statistics Display
The `StatisticsDisplay` component can be extended to show additional metrics by:
1. Adding new properties to node data objects
2. Updating `StatisticsDisplay.jsx` to render new metrics
3. Modifying tooltip generation in `NetworkDataAdapter.generateNodeTooltip()`

### File Structure Context
\`\`\`
src/
├── App.jsx                    # Main application component
├── components/
│   ├── NetworkMap.jsx         # Core network visualization
│   └── StatisticsDisplay.jsx  # Hover statistics tooltip
└── utils/
    └── dataAdapter.js         # Data format conversion utilities
\`\`\`

### Development Guidelines

#### Working with Network Data
- All network data should flow through `NetworkDataAdapter` for consistency
- Node IDs must be unique across the entire network
- Edge definitions require valid `from` and `to` node references
- Statistics fields (rx, tx, traffic, latency) should include units in the string values

#### Component Modification
- `NetworkMap` component manages vis-network instance lifecycle - be careful with useEffect dependencies
- Event handlers are set up once per network instance - avoid recreating them unnecessarily
- The vis-network instance is stored in a ref and should be cleaned up properly

#### Styling Approach
- Uses inline styles for dynamic positioning (StatisticsDisplay)
- CSS classes for static styling in App.css and index.css
- vis-network styling configured through options object, not CSS

### Performance Considerations
- vis-network handles large networks efficiently, but consider data pagination for 1000+ nodes
- Mouse event handlers are optimized with useCallback
- Physics simulation can be disabled for static layouts to improve performance

## Backend Integration

### C++ Network Data Processor
The project integrates with a C++ backend service (`confrpc.cpp`) that processes real network routing data:

#### Data Flow Pipeline
1. **Network Files Processing**: C++ service reads routing information from:
   - `mroute.txt`: Multicast routing table data
   - `neigh.txt`: Neighbor discovery information  
   - `ifconfig.txt`: Network interface configuration

2. **Data Transformation**: Processes IPv6 network topology using:
   - Regex parsing for structured data extraction
   - Hex-based node identification (last 4 hex digits of IPv6 addresses)
   - Interface-to-neighbor mapping for network relationships

3. **JSON Output**: Generates `output.txt` containing network topology in JSON format

#### Integration with React Frontend
\`\`\`javascript
// Example: Loading backend-generated network data
fetch('/api/network-data') // or load from output.txt
  .then(response => response.json())
  .then(backendData => {
    // Transform backend JSON to NetworkDataAdapter format
    const networkData = NetworkDataAdapter.convertFromBackend(backendData);
    // Use with NetworkMap component
  });
\`\`\`

#### Backend Data Format Characteristics
- **Node Identification**: Uses 4-character hex strings (e.g., "1bf6", "ea6")
- **IPv6 Focus**: Designed for IPv6 network topologies
- **Multicast Routing**: Specifically processes multicast group `ff1e::112`
- **Interface Types**: Supports eth0, eth1, usb0, usb1 network interfaces
- **Protobuf Integration**: Uses Protocol Buffers for structured data serialization

#### Extending NetworkDataAdapter for Backend Integration
To integrate the C++ backend output, extend the `NetworkDataAdapter` class:

\`\`\`javascript
// Add to NetworkDataAdapter class
static convertFromBackend(backendJson) {
  // Transform backend JSON format to vis-network compatible format
  const nodes = backendJson.network_map?.node_route_infos?.map(nodeInfo => ({
    id: nodeInfo.node_name,
    label: `Node ${nodeInfo.node_name}`,
    type: 'router',
    // Map backend route and neighbor info to node properties
    routes: nodeInfo.route_infos,
    neighbors: nodeInfo.neigh_infos
  })) || [];
  
  // Generate edges from routing and neighbor information
  const edges = [];
  // Process backend routing data to create network connections
  
  return { nodes, edges };
}
\`\`\`

### Real-time Network Monitoring
The backend processor can be used for:
- **Live Network Topology**: Regular processing of current routing tables
- **Network Change Detection**: Monitoring routing table updates
- **Performance Metrics**: Extracting network performance data from routing information

### Testing Backend Integration

#### Available Components
- **`App.jsx`**: Main application with toggle between sample and backend data
- **`BackendNetworkExample.jsx`**: Dedicated component for backend data visualization
- **Sample Data File**: `public/sample-backend-data.json` contains example backend output

#### Testing the Integration
1. **Start the development server**: `npm run dev`
2. **Toggle Data Sources**: Use the "Switch to Backend Data" button in the UI
3. **Sample Backend Data**: The app includes sample backend JSON for testing
4. **Console Logging**: Check browser console for data conversion logs

#### Backend Data Structure
Based on your actual `output.txt`, the system processes:
\`\`\`json
{
  "status": "SUCCESS",
  "network_map": {
    "node_route_infos": [
      {
        "node_name": "1493",
        "neigh_infos": [
          {"interface": "eth0", "neigh_node": "ea6"},
          {"interface": "usb0", "neigh_node": "4b0a"}
        ],
        "route_infos": [
          {
            "incoming_interface": "eth0",
            "iif_neigh_node": "2001:db8::2b0:19ff:fe7a:ea6",
            "source_node": "e78e"
          }
        ]
      }
    ]
  }
}
\`\`\`

#### Production Backend Integration
To connect to your actual C++ backend:
1. **API Endpoint**: Update `BackendNetworkExample.jsx` fetch URL to your backend service
2. **File Upload**: Allow users to upload `output.txt` files directly
3. **WebSocket**: For real-time updates from the C++ routing processor
4. **Polling**: Regular API calls to fetch updated topology data
