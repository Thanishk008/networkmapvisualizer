import React from 'react';

const StatisticsDisplay = ({ nodeData, position }) => {
  if (!nodeData) return null;

  const stats = {
    id: nodeData.id,
    label: nodeData.label,
    type: nodeData.type,
    interface: nodeData.interface,
    routeCount: nodeData.routeCount,
    neighborCount: nodeData.neighborCount,
    nextHop: nodeData.nextHop,
    viaInterface: nodeData.viaInterface,
    fullNextHopAddress: nodeData.fullNextHopAddress
  };

  const containerStyle = {
    position: 'fixed',
    left: position?.x || 20,
    top: position?.y || 20,
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '15px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 1000,
    minWidth: '200px',
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px'
  };

  const headerStyle = {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#333',
    borderBottom: '1px solid #eee',
    paddingBottom: '5px'
  };

  const statRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '5px'
  };

  const labelStyle = {
    fontWeight: 'bold',
    color: '#666'
  };

  const valueStyle = {
    color: '#333'
  };


  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        {stats.type === 'central' ? 'Central Router' : 
         stats.type === 'neighbor' ? 'Neighbor Node' : 
         stats.type === 'source' ? 'Source Node' : 'Network Node'}: {stats.id}
      </div>
      
      <div style={statRowStyle}>
        <span style={labelStyle}>Node ID:</span>
        <span style={valueStyle}>{stats.id}</span>
      </div>
      
      <div style={statRowStyle}>
        <span style={labelStyle}>Node Type:</span>
        <span style={valueStyle}>{stats.type || 'Unknown'}</span>
      </div>
      
      {stats.interface && (
        <div style={statRowStyle}>
          <span style={labelStyle}>Interface:</span>
          <span style={valueStyle}>{stats.interface}</span>
        </div>
      )}
      
      {stats.routeCount !== undefined && (
        <div style={statRowStyle}>
          <span style={labelStyle}>Routes:</span>
          <span style={valueStyle}>{stats.routeCount}</span>
        </div>
      )}
      
      {stats.neighborCount !== undefined && (
        <div style={statRowStyle}>
          <span style={labelStyle}>Neighbors:</span>
          <span style={valueStyle}>{stats.neighborCount}</span>
        </div>
      )}
      
      {stats.nextHop && (
        <div style={statRowStyle}>
          <span style={labelStyle}>Next Hop:</span>
          <span style={valueStyle}>{stats.nextHop}</span>
        </div>
      )}
      
      {stats.viaInterface && (
        <div style={statRowStyle}>
          <span style={labelStyle}>Via Interface:</span>
          <span style={valueStyle}>{stats.viaInterface}</span>
        </div>
      )}
      
      {stats.fullNextHopAddress && (
        <div style={{...statRowStyle, marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #eee'}}>
          <span style={labelStyle}>Full Address:</span>
          <span style={{...valueStyle, fontSize: '10px', wordBreak: 'break-all'}}>{stats.fullNextHopAddress}</span>
        </div>
      )}
    </div>
  );
};

export default StatisticsDisplay;
