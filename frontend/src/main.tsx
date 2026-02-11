/**
 * main.tsx
 *
 * Purpose:
 * - Serves as the entry point for the React application
 * - Bootstraps the React app and mounts it to the DOM
 *
 * Responsibilities:
 * - Creates the React root using ReactDOM
 * - Wraps the application in required global providers
 * - Enables client-side routing via React Router
 * - Renders the root App component
 *
 * Used by:
 * - Vite / React build process
 * - index.html (via the `root` DOM element)
 *
 * Components:
 * - <App />
 *   - The root component containing the application layout and routes
 *
 * Extra notes:
 * - React.StrictMode is enabled to help catch potential issues during development
 * - BrowserRouter enables declarative routing throughout the app
 */

import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App.tsx"
import { AuthProvider } from "@/context/AuthContext"

ReactDOM.createRoot(
  document.getElementById("root")!
).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
