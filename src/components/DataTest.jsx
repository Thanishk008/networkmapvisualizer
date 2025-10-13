import React, { useEffect, useState } from 'react';
import { NetworkDataAdapter } from '../utils/dataAdapter';

const DataTest = () => {
  const [status, setStatus] = useState('Loading...');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const testDataLoading = async () => {
      try {
        setStatus('Fetching backend data...');
        
        // First, test if the file is accessible
        const response = await fetch('/sample-backend-data.json');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        setStatus('Parsing JSON...');
        const rawData = await response.json();
        console.log('Raw backend data:', rawData);
        
        setStatus('Converting data...');
        const convertedData = NetworkDataAdapter.convertFromBackend(rawData);
        console.log('Converted data:', convertedData);
        
        setData(convertedData);
        setStatus('Success!');
        
      } catch (err) {
        console.error('Data loading error:', err);
        setError(err.message);
        setStatus('Failed');
      }
    };

    testDataLoading();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Data Loading Test</h2>
      <p><strong>Status:</strong> {status}</p>
      
      {error && (
        <div style={{ 
          background: '#ffebee', 
          color: '#c62828', 
          padding: '10px', 
          borderRadius: '4px',
          marginBottom: '10px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {data && (
        <div style={{ marginTop: '20px' }}>
          <h3>Data Summary:</h3>
          <ul>
            <li>Nodes: {data.nodes?.length || 0}</li>
            <li>Edges: {data.edges?.length || 0}</li>
          </ul>
          
          <h4>Nodes by Type:</h4>
          <ul>
            <li>Central: {data.nodes?.filter(n => n.type === 'central').length || 0}</li>
            <li>Neighbor: {data.nodes?.filter(n => n.type === 'neighbor').length || 0}</li>
            <li>Source: {data.nodes?.filter(n => n.type === 'source').length || 0}</li>
          </ul>
          
          <h4>First Few Nodes:</h4>
          <pre style={{ 
            background: '#f5f5f5', 
            padding: '10px', 
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '200px'
          }}>
            {JSON.stringify(data.nodes?.slice(0, 3), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default DataTest;
