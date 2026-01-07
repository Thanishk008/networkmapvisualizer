# Network Map Visualizer

An interactive network topology visualization tool for IPv6 multicast routing networks. Built with Next.js, React, and vis-network.

## Features

- **Interactive Network Visualization**: Pan, zoom, and explore network topology
- **Multi-Path Highlighting**: Select source and target nodes to visualize routing paths
- **Animated Light Trails**: Visual animation showing data flow direction along paths
- **Dark/Light Mode**: Toggle between themes
- **Multiple Datasets**: Switch between different network configurations (12, 28, 150 nodes)
- **Node Details Panel**: Click on nodes to view detailed interface and routing information
- **Interface-Level Visualization**: See individual network interfaces (eth0, eth1, usb0, usb1) as labeled boxes

## Prerequisites

- **Node.js**: Version 18.x or 20.x recommended
- **Package Manager**: `pnpm` (recommended), `npm`, or `yarn`
- **Git**: For cloning the repository

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd networkmapvisualizer
```

### 2. Install Dependencies

The project uses `pnpm` (lockfile included). Choose one:

```bash
# Recommended (uses pnpm-lock.yaml)
pnpm install

# Alternative: npm
npm install

# Alternative: yarn
yarn install
```

### 3. Run Development Server

```bash
pnpm dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production

```bash
pnpm build
pnpm start
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server on port 3000 |
| `pnpm build` | Build for production |
| `pnpm start` | Run production server |
| `pnpm lint` | Run ESLint |

## Using the Application

1. **Select Dataset**: Use the dropdown to choose a network configuration (12, 28, or 150 nodes)
2. **Explore**: Pan and zoom the network map using mouse
3. **View Node Details**: Click on any node to see its interfaces and connections
4. **Highlight Path**: Select source and target nodes from dropdowns, then click "Show Path"
5. **Toggle Theme**: Click the sun/moon icon to switch dark/light mode
6. **Refresh Data**: Click "Refresh Data" button to reload network topology

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Module resolution errors | Delete `node_modules` and reinstall with `pnpm install` |
| Port already in use | Run on different port: `PORT=3001 pnpm dev` |
| Build errors | Run `pnpm build` to see detailed TypeScript/lint errors |
| Network not rendering | Check browser console for data loading errors |

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Codebase structure and how the network map works
- [PATHFINDING.md](./PATHFINDING.md) - Pathfinding algorithm explanation with examples
- [ROUTE_INFO_TABLE.md](./ROUTE_INFO_TABLE.md) - Routing table format and usage

## Tech Stack

- **Framework**: Next.js 15 with React 19
- **Visualization**: vis-network, vis-data
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI, shadcn/ui
- **Language**: TypeScript
