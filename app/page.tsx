"use client"

import { useState, useEffect } from "react"
import BackendNetworkExample from "@/components/BackendNetworkExample"
import ErrorBoundary from "@/components/ErrorBoundary"
import DarkModeToggle from "@/components/DarkModeToggle"
import NodeDetailsPanel from "@/components/NodeDetailsPanel"
import InfoPanel from "@/components/InfoPanel"
import { DATASETS, DatasetName } from "@/config/datasets"

export default function Page() {
  const [showInfo, setShowInfo] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<any>(null)
  const [datasetName, setDatasetName] = useState<DatasetName>("EST4 150 Node")

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [darkMode])

  return (
    <div className="app">
      <DarkModeToggle darkMode={darkMode} onToggle={() => setDarkMode(!darkMode)} />

      <header className="app-header">
        <h1>Network Map Visualizer</h1>
        <p>IPv6 Multicast Routing Topology</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '10px' }}>
          <button onClick={() => setShowInfo(!showInfo)} 
          className="header-button header-action action-btn info-button highlight-enabled"
          title = "Toggle information panel"
          >
            {showInfo ? "Hide Info" : "Show Info"}
          </button>
          <button
            onClick={() => window.dispatchEvent(new Event('network-refresh'))}
            className="header-button header-action action-btn refresh-button highlight-enabled"
            title="Refresh network data"
          >
            Refresh Data
          </button>
        </div>
      </header>

      <main className="app-main">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', width: '100%' }}>
          {/* Dataset Selector - Outside the component */}
          <div style={{ flex: '0 0 auto', paddingTop: '8px' }}>
            <select
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value as DatasetName)}
              style={{
                padding: '8px 32px 8px 12px',
                borderRadius: 6,
                border: `1px solid ${darkMode ? '#475569' : '#ccc'}`,
                backgroundColor: darkMode ? '#1e293b' : '#fff',
                color: darkMode ? '#e2e8f0' : '#000',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                outline: 'none',
                minWidth: '160px',
                appearance: 'none' as const,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${darkMode ? '%23e2e8f0' : '%23666'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center'
              }}
            >
              {Object.keys(DATASETS).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Network Map Component */}
          <ErrorBoundary>
            <div style={{ flex: '1 1 auto', minHeight: "400px" }}>
              <BackendNetworkExample 
                darkMode={darkMode} 
                dataFile={DATASETS[datasetName].dataFile}
                positionsFile={DATASETS[datasetName].positionsFile}
                onNodeClick={(nodeData: any) => setSelectedNodeDetails(nodeData)}
              />
            </div>
          </ErrorBoundary>
        </div>

        {/* Side panels */}
        {selectedNodeDetails && (
          <NodeDetailsPanel 
            nodeData={selectedNodeDetails} 
            onClose={() => setSelectedNodeDetails(null)}
            darkMode={darkMode}
          />
        )}

        {showInfo && (
          <InfoPanel darkMode={darkMode} onClose={() => setShowInfo(false)} />
        )}
      </main>

      <footer className="app-footer">
        <p>Data from the Fire Panel • Hover over nodes for details</p>
      </footer>
    </div>
  )
}
