import React, { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';

// Network visualization options (outside component to avoid re-renders)
const networkOptions = {
  nodes: {
    shape: 'dot',
    size: 20,
    font: {
      size: 14,
      color: '#333'
    },
    borderWidth: 2,
    color: {
      border: '#2B7CE9',
      background: '#97C2FC',
      highlight: {
        border: '#2B7CE9',
        background: '#D2E5FF'
      }
    }
  },
  edges: {
    width: 2,
    color: { color: '#848484' },
    smooth: {
      type: 'continuous',
      roundness: 0.2
    },
    arrows: {
      to: {
        enabled: true,
        scaleFactor: 1
      }
    }
  },
  groups: {
    central: { color: { background: '#FF6B6B', border: '#E55656' }, size: 25 },
    neighbor: { color: { background: '#4ECDC4', border: '#45B7B8' }, size: 20 },
    source: { color: { background: '#45B7D1', border: '#3A9BC1' }, size: 15 },
    router: { color: { background: '#87CEEB', border: '#4682B4' }, size: 20 }
  },
  physics: {
    enabled: false
  },
  layout: {
    randomSeed: 2
  },
  interaction: {
    hover: true,
    tooltipDelay: 300,
    hideEdgesOnDrag: false,
    hideNodesOnDrag: false
  }
};

const NetworkMap = ({ networkData, onNodeHover, onNodeClick }) => {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    if (containerRef.current && networkData) {
      const network = new Network(containerRef.current, networkData, networkOptions);
      networkRef.current = network;

      // Event handlers
      network.on('hoverNode', (event) => {
        const nodeId = event.node;
        const nodeData = networkData.nodes.get(nodeId);
        if (onNodeHover) {
          onNodeHover(nodeData);
        }
      });

      network.on('click', (event) => {
        if (event.nodes.length > 0) {
          const nodeId = event.nodes[0];
          const nodeData = networkData.nodes.get(nodeId);
          setSelectedNode(nodeData);
          if (onNodeClick) {
            onNodeClick(nodeData);
          }
        }
      });

      network.on('blurNode', () => {
        if (onNodeHover) {
          onNodeHover(null);
        }
      });

      return () => {
        if (networkRef.current) {
          networkRef.current.destroy();
        }
      };
    }
    }, [networkData, onNodeHover, onNodeClick]);

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {selectedNode && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'white',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '5px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        }}>
          <h4>Selected Node: {selectedNode.label}</h4>
          <p>{selectedNode.title}</p>
        </div>
      )}
    </div>
  );
};

export default NetworkMap;
