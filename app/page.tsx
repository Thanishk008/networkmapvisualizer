"use client"

import { useState, useEffect } from "react"
import BackendNetworkExample from "@/components/BackendNetworkExample"
import DataTest from "@/components/DataTest"
import ErrorBoundary from "@/components/ErrorBoundary"
import DarkModeToggle from "@/components/DarkModeToggle"

export default function Page() {
  const [showInfo, setShowInfo] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

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
        <button onClick={() => setShowInfo(!showInfo)} className="header-button info-button">
          {showInfo ? "Hide Info" : "Show Info"}
        </button>
      </header>

      <main className="app-main">
        {
          <ErrorBoundary>
            <div style={{ width: "100%", minHeight: "400px" }}>
              <BackendNetworkExample darkMode={darkMode} />
            </div>
          </ErrorBoundary>
        }

        {showInfo && (
          <div className="info-panel">
            <h3>Network Topology Information</h3>
            <div className="info-grid">
              <div>
                <h4>Data Source</h4>
                <ul>
                  <li>C++ Backend Processor (confrpc.cpp)</li>
                  <li>IPv6 Multicast Routing Tables</li>
                  <li>Neighbor Discovery Information</li>
                  <li>Interface Configuration Data</li>
                </ul>
              </div>
              <div>
                <h4>Network Details</h4>
                <ul>
                  <li>Central Node: 1493</li>
                  <li>Multicast Group: ff1e::112</li>
                  <li>40+ Source Nodes with Routing Paths</li>
                  <li>4 Direct Neighbor Connections</li>
                </ul>
              </div>
              <div>
                <h4>Visualization Features</h4>
                <ul>
                  <li>Static Network Layout (No Physics)</li>
                  <li>Hover for Node Statistics</li>
                  <li>Color-coded Node Types</li>
                  <li>Interface-specific Connections</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Data from the Fire Panel • Hover over nodes for details</p>
      </footer>
    </div>
  )
}
