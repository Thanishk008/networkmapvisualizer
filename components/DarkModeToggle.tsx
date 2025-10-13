"use client"

import { Moon, Sun } from "lucide-react"

interface DarkModeToggleProps {
  darkMode: boolean
  onToggle: () => void
}

export default function DarkModeToggle({ darkMode, onToggle }: DarkModeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-lg hover:shadow-xl transition-all duration-300"
      aria-label="Toggle dark mode"
    >
      {darkMode ? (
        <>
          <Sun className="w-5 h-5 text-yellow-400" />
          <span className="text-sm font-medium">Light</span>
        </>
      ) : (
        <>
          <Moon className="w-5 h-5 text-slate-700" />
          <span className="text-sm font-medium">Dark</span>
        </>
      )}
    </button>
  )
}
