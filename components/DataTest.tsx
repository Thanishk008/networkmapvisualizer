"use client"

import { useEffect, useState } from "react"
import { NetworkDataAdapter } from "@/utils/dataAdapter"

export default function DataTest() {
  const [status, setStatus] = useState("Loading...")
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const testDataLoading = async () => {
      try {
        setStatus("Fetching backend data...")

        const response = await fetch("/sample-backend-data.json")
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        setStatus("Parsing JSON...")
        const rawData = await response.json()
        console.log("Raw backend data:", rawData)

        setStatus("Converting data...")
        const convertedData = NetworkDataAdapter.convertFromBackend(rawData)
        console.log("Converted data:", convertedData)

        setData(convertedData)
        setStatus("Success!")
      } catch (err: any) {
        console.error("Data loading error:", err)
        setError(err.message)
        setStatus("Failed")
      }
    }

    testDataLoading()
  }, [])

  return (
    <div className="data-test-container">
      <h2>Data Loading Test</h2>
      <p>
        <strong>Status:</strong> {status}
      </p>

      {error && (
        <div className="error-box">
          <strong>Error:</strong> {error}
        </div>
      )}

      {data && (
        <div className="data-summary">
          <h3>Data Summary:</h3>
          <ul>
            <li>Nodes: {data.nodes?.length || 0}</li>
            <li>Edges: {data.edges?.length || 0}</li>
          </ul>

          <h4>Nodes by Type:</h4>
          <ul>
            <li>Central: {data.nodes?.filter((n: any) => n.type === "central").length || 0}</li>
            <li>Neighbor: {data.nodes?.filter((n: any) => n.type === "neighbor").length || 0}</li>
            <li>Source: {data.nodes?.filter((n: any) => n.type === "source").length || 0}</li>
          </ul>

          <h4>First Few Nodes:</h4>
          <pre className="data-preview">{JSON.stringify(data.nodes?.slice(0, 3), null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
