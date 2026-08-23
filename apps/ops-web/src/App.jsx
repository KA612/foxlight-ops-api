import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import OpsIncidentView from "./routes/OpsIncidentView.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<OpsIncidentView />} />
      {/* keep this so '/dashboard' doesn't 404 when clicked */}
      <Route path="/dashboard" element={<OpsIncidentView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
