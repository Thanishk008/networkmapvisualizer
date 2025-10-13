
import React, { useState, useEffect, useCallback } from 'react';
import NetworkMap from './NetworkMap';
import StatisticsDisplay from './StatisticsDisplay';
import { NetworkDataAdapter } from '../utils/dataAdapter';

const BackendNetworkExample = (props) => {
  const [networkData, setNetworkData] = useState(null);
  const [fullData, setFullData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [pathResult, setPathResult] = useState(null);
  const [pathError, setPathError] = useState('');
  const { darkMode } = props;

  // Load backend data on component mount
  useEffect(() => {
    const loadBackendData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await NetworkDataAdapter.loadFromBackendFile('/sample-backend-data.json');
        console.log('DEBUG: Loaded backend data:', data);
        if (!data || !data.network_map || !data.network_map.node_route_infos) {
          setError('Backend data is missing or malformed. Check data.json');
          setNetworkData(null);
          return;
        }
        setFullData(data);
        // Only physical connections by default
        const physData = NetworkDataAdapter.convertPhysicalOnly(data);
        setNetworkData(NetworkDataAdapter.convertToVisNetwork(physData));
      } catch (err) {
        console.error('Failed to load backend data:', err);
        setError(`Failed to load network data: ${err.message}`);
        setNetworkData(null);
      } finally {
        setLoading(false);
      }
    };
    loadBackendData();
  }, []);

  const handleNodeHover = useCallback((nodeData) => {
    console.log('Node hovered:', nodeData);
    setHoveredNode(nodeData);
  }, []);

  const handleNodeClick = useCallback((nodeData) => {
    setSelectedNode(nodeData);
    if (nodeData && networkData) {
      // Always use the legend highlight color for both border and background
      const highlightColor = getComputedStyle(document.documentElement).getPropertyValue('--color-legend-highlight').trim();
      const nodes = networkData.nodes.map(n => n.id === nodeData.id ? {
        ...n,
        color: {
          background: highlightColor,
          border: highlightColor
        },
        borderWidth: 4
      } : {
        ...n,
        color: n.color && typeof n.color === 'object' ? { ...n.color, background: n.color.background, border: n.color.border } : n.color,
        borderWidth: 2
      });
      setNetworkData({ ...networkData, nodes });
    }
    console.log('Backend Network - Node clicked:', nodeData);
  }, [networkData]);

  const handleMouseMove = useCallback((event) => {
    setMousePosition({ x: event.clientX + 10, y: event.clientY + 10 });
  }, []);

  const handleRefreshData = async () => {
    setLoading(true);
    try {
      setError(null);
      // In production, this would fetch fresh data from your C++ backend
      // For now, reload the sample backend data
      const data = await NetworkDataAdapter.loadFromBackendFile('/sample-backend-data.json');
      const visData = NetworkDataAdapter.convertToVisNetwork(data);
      setNetworkData(visData);
    } catch (err) {
      setError(`Failed to refresh network data: ${err.message}`);
      setNetworkData(null);
    } finally {
      setLoading(false);
    }
  };

  // UI: Select source node to highlight path
  const allNodes = fullData?.nodes || [];
  const sourceNodes = allNodes;
  const targetNodes = allNodes;

  // Always call hooks at top level
  useEffect(() => {
    const loadBackendData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await NetworkDataAdapter.loadFromBackendFile('/sample-backend-data.json');
        setFullData(data);
        // Only physical connections by default
        const physData = NetworkDataAdapter.convertPhysicalOnly(data);
        setNetworkData(NetworkDataAdapter.convertToVisNetwork(physData));
      } catch (err) {
        console.error('Failed to load backend data:', err);
        setError(`Failed to load network data: ${err.message}`);
        setNetworkData(null);
      } finally {
        setLoading(false);
      }
    };
    loadBackendData();
  }, []);

  useEffect(() => {
    setPathError('');
    setPathResult(null);
    if (!selectedSource || !selectedTarget || !fullData) {
      // Show only physical connections
      if (fullData) {
        setNetworkData(NetworkDataAdapter.convertToVisNetwork(NetworkDataAdapter.convertPhysicalOnly(fullData)));
      }
      return;
    }
    try {
      // Find path using utility
      const physData = NetworkDataAdapter.convertPhysicalOnly(fullData);
      const { pathEdges, pathNodes } = NetworkDataAdapter.findPath(physData.nodes, physData.edges, selectedSource, selectedTarget);
      setPathResult({ pathEdges, pathNodes });
      // Highlight path in vis data
      const highlightColor = getComputedStyle(document.documentElement).getPropertyValue('--color-legend-highlight').trim() || (darkMode ? '#FFD166' : '#FF6B6B');
      const highlightEdgeStyle = { color: highlightColor, width: 6, dashes: true, shadow: true };
      const highlightNodeStyle = { color: { background: highlightColor, border: highlightColor }, borderWidth: 4 };
      const nodes = physData.nodes.map(n => pathNodes.includes(n.id) ? { ...n, ...highlightNodeStyle } : n);
      const edges = physData.edges.map(e => pathEdges.includes(e.id) ? { ...e, ...highlightEdgeStyle } : e);
      setNetworkData(NetworkDataAdapter.convertToVisNetwork({ nodes, edges }));
    } catch (err) {
      setPathError(err.message);
      setNetworkData(NetworkDataAdapter.convertToVisNetwork(NetworkDataAdapter.convertPhysicalOnly(fullData)));
    }
  }, [selectedSource, selectedTarget, fullData, darkMode]);

  // Set theme attribute for CSS variables
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        fontSize: '18px'
      }}>
        Loading network topology...
      </div>
    );
  }

  return (
    <div onMouseMove={handleMouseMove} style={{ width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '10px', backgroundColor: darkMode ? '#333' : '#f5f5f5', borderRadius: '5px', boxShadow: darkMode ? '0 2px 8px #111' : '0 2px 8px #ccc' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '2rem', color: darkMode ? '#FFD166' : '#333' }}>Network Map</h2>
          <p style={{ margin: '5px 0', color: darkMode ? '#bbb' : '#666', fontSize: '15px' }}>Select both a <b>source</b> and <b>target</b> node to visualize the path. Click a node to view diagnostics and highlight it.</p>
        </div>
        <div className="network-controls">
          <div>
            <h2 className="network-title" style={{ margin: 0, fontWeight: 700, fontSize: '2rem', color: darkMode ? '#FFD166' : '#333' }}>Network Map</h2>
            <p className="network-subtitle" style={{ margin: '5px 0', color: darkMode ? '#bbb' : '#666', fontSize: '15px' }}>Select both a source and target node to highlight the path.</p>
          </div>
          <div className="source-selector" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label htmlFor="source-select" className="source-label" style={{ fontWeight: 500 }}>Source:</label>
            <select id="source-select" className="source-select" value={selectedSource} onChange={e => setSelectedSource(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '15px', background: darkMode ? '#222' : '#fff', color: darkMode ? '#FFD166' : '#222' }}>
              <option value="">-- Select Source Node --</option>
              {sourceNodes.map(node => (
                <option key={node.id} value={node.id}>{node.label}</option>
              ))}
            </select>
            <label htmlFor="target-select" className="target-label" style={{ fontWeight: 500, marginLeft: '10px' }}>Target:</label>
            <select id="target-select" className="target-select" value={selectedTarget} onChange={e => setSelectedTarget(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '15px', background: darkMode ? '#222' : '#fff', color: darkMode ? '#FFD166' : '#222' }}>
              <option value="">-- Select Target Node --</option>
              {targetNodes.map(node => (
                <option key={node.id} value={node.id}>{node.label}</option>
              ))}
            </select>
          </div>
          <button className="refresh-button" onClick={handleRefreshData} disabled={loading} style={{ padding: '8px 16px', backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, marginLeft: '20px' }}>
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      {pathError && (
        <div style={{ padding: '10px', background: '#ffebee', color: '#c62828', borderRadius: '6px', margin: '10px 0', border: '1px solid #ffcdd2', fontSize: '14px' }}>
          <strong>Path Error:</strong> {pathError}
        </div>
      )}
        <button onClick={handleRefreshData} disabled={loading} style={{ padding: '8px 16px', backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, marginLeft: '20px' }}>
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '15px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '8px', marginBottom: '15px', border: '1px solid #ffcdd2', fontSize: '14px' }}>
          <strong>Error:</strong> {error}
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#757575' }}>
            Make sure the sample-backend-data.json file is in the public folder and the server is running.
          </div>
        </div>
      )}

      <div className="network-container" style={{ width: '100%', height: '600px', position: 'relative' }}>
        {networkData ? (
          <>
            <NetworkMap networkData={networkData} onNodeHover={handleNodeHover} onNodeClick={handleNodeClick} darkMode={darkMode} selectedNode={selectedNode} />
            {hoveredNode && (
              <StatisticsDisplay
                nodeData={(() => {
                  // Find backend node data
                  const backendNode = fullData && fullData.nodes ? fullData.nodes.find(n => n.id === hoveredNode.id) : null;
                  // Merge vis-network node and backend node data
                  return backendNode ? { ...hoveredNode, ...backendNode } : hoveredNode;
                })()}
                position={mousePosition}
              />
            )}
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontSize: '16px', color: 'var(--color-header)' }}>
            {error ? 'Failed to load network data' : 'No network data available'}
          </div>
        )}
      </div>

      <div className="legend" style={{ marginTop: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontWeight: 600 }}>Legend</h3>
        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', fontSize: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="legend-phys" style={{ width: '16px', height: '16px', borderRadius: '50%' }}></div>
            <span>Physical Connection</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="legend-route" style={{ width: '16px', height: '16px', borderRadius: '50%' }}></div>
            <span>Highlighted Multicast Route</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="legend-phys" style={{ width: '16px', height: '2px', borderRadius: '1px' }}></div>
            <span>Direct Link</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="legend-highlight edge-highlight" style={{ width: '16px', height: '2px', borderRadius: '1px' }}></div>
            <span>Multicast Route Path</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackendNetworkExample;
