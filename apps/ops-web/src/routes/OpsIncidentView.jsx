import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import PlaybookGuidance from "../PlaybookGuidance";

import { safeNormalize } from "../utils/safeNormalize";

// UI_LAYER_NOTE:
// Everything in this file is PRESENTATION-ONLY.
// These helpers exist solely to map model/inference output
// into user-facing display strings.
//
// IMPORTANT:
// - Do NOT reuse for inference, propagation reasoning, scoring, or model training.
// - Do NOT treat return values from these helpers as ground truth.
// - These functions do not alter operational logic; they only present it.



// UI cap limit under ambiguity
function capSurfaces(list, adjacency = null) {
    if (!Array.isArray(list)) return [];
    if (list.length <= 3) return list;
  
    const limit = adjacency && adjacency > 0.60 ? 5 : 3;
    return list.slice(0, limit);
  }
  

function formatPercent(value, decimals = 0) {
  if (value == null || isNaN(value)) return "–";
  return `${(value * 100).toFixed(decimals)}%`;
}

function capitalize(str = "") {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function describeFalseSignal(falseSignal) {
    if (!falseSignal?.pred_label) return "";
  
    switch (falseSignal.pred_label) {
      case "true_incident":
        return "Model classifies this as a real incident rather than noise. Active monitoring is warranted.";
      case "self_resolving":
        return "Signal is likely to resolve without heavy intervention. Monitor, but avoid unnecessary escalation.";
      case "false_alarm":
        return "Signal appears to be noise. Safe to de-escalate while keeping lightweight monitoring in place.";
      default:
        return "";
    }
  }

  function getRegionPatternDisplay(regionLabel, propagationScope) {
    // Rule #6 – Ambiguous as first-class UI state (Region)
    if (isAmbiguousLabel(regionLabel)) {
      return "Ambiguous – region impact unclear";
    }
  
    if (!regionLabel) return "Unknown";
  
    // If model says multi_region but propagation scope is not clearly multi-region/global,
    // represent this as ambiguous instead of asserting "Multi Region".
    if (regionLabel === "multi_region") {
      const scope = propagationScope || "unknown";
  
      if (scope !== "multi_region" && scope !== "global") {
        return "Ambiguous Region";
      }
    }
  
    // Default: use existing label mapping
    return mapLabel(REGION_PATTERN_LABELS, regionLabel);
  }
  

  function getCloudPatternDisplay(cloudLabel, propagationScope, affectedSurfaces) {
    // Rule #6 – Ambiguous as first-class UI state (Cloud)
    if (isAmbiguousLabel(cloudLabel)) {
      return "Ambiguous – cloud pattern unclear";
    }
  
    if (!cloudLabel) return "Unknown";
  
    // If the model calls this multi_cloud but we don't see broad propagation,
    // treat it as ambiguous instead of asserting "Multi-Cloud".
    if (cloudLabel === "multi_cloud") {
      const scope = propagationScope || "unknown";
      const surfaces = Array.isArray(affectedSurfaces) ? affectedSurfaces : [];
  
      const hasBreadth =
        scope === "multi_region" ||
        scope === "global" ||
        surfaces.length >= 3;
  
      if (!hasBreadth) {
        return "Ambiguous Cloud (Conflicting Signals)";
      }
    }
  
    // Default: existing mapping
    return mapLabel(CLOUD_PATTERN_LABELS, cloudLabel);
  }
  

  // UI-only helper: detects ambiguous labels for display purposes.
// Does NOT affect inference, scoring, or escalation.
function isAmbiguousLabel(raw) {
    if (!raw) return false;
    var v = String(raw).toLowerCase();
    // Covers "ambiguous", "region_ambiguous", "scope_ambiguous", etc.
    return v.indexOf("ambig") !== -1;
  }
  


  

  function computeAmbiguityFactor(result) {
    if (!result) return 0;
  
    let factor = 0;
  
    const regionLabel = result?.tier3?.region_label || null;
    const scopeLabel = result?.tier6?.propagation_scope || null;
    const cloudLabel = result?.tier3?.cloud_label || null;
    const surfaces = Array.isArray(result?.tier6?.affected_surfaces)
      ? result.tier6.affected_surfaces
      : [];
    const adjacency = result?.tier6?.adjacency_confidence ?? null;
  
    // Region ambiguity: unknown or clearly not multi/global
    if (!regionLabel || regionLabel === "unknown") {
      factor += 0.15;
    }
  
    // Scope ambiguity: claims multi_region without region backing it
    if (
      scopeLabel === "multi_region" &&
      regionLabel !== "multi_region" &&
      regionLabel !== "global"
    ) {
      factor += 0.15;
    }
  
    // Cloud ambiguity: multi_cloud without broad propagation
    if (cloudLabel === "multi_cloud") {
      const hasBreadth =
        scopeLabel === "multi_region" ||
        scopeLabel === "global" ||
        surfaces.length >= 3;
      if (!hasBreadth) {
        factor += 0.15;
      }
    }
  
    // Surface expansion ambiguity: we had to cap the list
    if (surfaces.length > 3) {
      const limit = adjacency && adjacency > 0.6 ? 5 : 3;
      const cappedCount = Math.min(surfaces.length, limit);
      if (surfaces.length > cappedCount) {
        factor += 0.1;
      }
    }
  
    return Math.min(factor, 0.5);
  }
  
  function getDampenedConfidenceLabel(baseLabel, ambiguityFactor) {
    if (!baseLabel) return "–";
  
    const normalized = baseLabel.toLowerCase();
  
    // If ambiguity is low, keep original label with normal capitalization
    if (ambiguityFactor < 0.25) {
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
  
    // Ambiguity is high enough → dampen one step
    if (normalized === "high") return "Medium (dampened by ambiguity)";
    if (normalized === "medium") return "Low (dampened by ambiguity)";
    return "Low";
  }
  

  function getPropagationScopeDisplay(scopeLabel, regionLabel) {
    // Rule #6 – Ambiguous as first-class UI state (Scope)
    if (isAmbiguousLabel(scopeLabel)) {
      return "Ambiguous – propagation scope not confirmed";
    }
  
    if (!scopeLabel) return "Unknown";
  
    // If scope claims multi_region but region pattern doesn't support it,
    // we treat this as mixed / non-deterministic instead of strong multi-region.
    if (scopeLabel === "multi_region") {
      const region = regionLabel || "unknown";
  
      if (region !== "multi_region" && region !== "global") {
        return "Mixed Locality (Non-deterministic)";
      }
    }
  
    // Default: use existing label mapping
    return mapLabel(PROPAGATION_SCOPE_LABELS, scopeLabel);
  }
  

  
function mapLabel(mapping, raw) {
    if (!raw) return "–";
    return mapping[raw] || raw.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function describeStabilityInteraction(falseSignal, stabilityIndex, stabilityTrend) {
    if (!falseSignal?.pred_label || stabilityIndex == null) return "";
  
    const trend = stabilityTrend || "stable";
  
    // Normalize bands for readability
    let band;
    if (stabilityIndex <= 0.3) band = "low";
    else if (stabilityIndex >= 0.7) band = "high";
    else band = "medium";
  
    const label = falseSignal.pred_label;
  
    // High-level matrix
    if (label === "true_incident") {
      if (band === "low" && trend === "declining") {
        return "System is unstable and trending worse; treat this as a high-urgency incident.";
      }
      if (band === "low") {
        return "System stability is already low; treat this as an active incident and keep mitigation live.";
      }
      if (band === "high" && trend === "improving") {
        return "System is stabilizing, but treat this as a confirmed incident until metrics fully recover.";
      }
      return "Prioritize mitigation over de-escalation until stability clearly improves.";
    }
  
    if (label === "self_resolving") {
      if (band === "high" && trend === "improving") {
        return "High and improving stability; safe to let this self-resolve with light monitoring.";
      }
      if (band === "low" && trend === "declining") {
        return "Signal may self-resolve, but low and worsening stability warrants closer watch.";
      }
      return "Likely to self-resolve; keep lightweight monitoring until stability clearly improves.";
    }
  
    if (label === "false_alarm") {
      if (band === "high" && trend !== "declining") {
        return "Stable system and false-alarm classification; safe to de-escalate while retaining basic observability.";
      }
      if (band === "low" && trend === "declining") {
        return "Model sees a false alarm, but low and worsening stability suggests checking for other root causes.";
      }
      return "Treated as noise, but confirm key metrics before fully de-escalating.";
    }
  
    return "";
  }

  const renderEscalationReason = (reason, scope) => {
    if (reason === "Local or unknown propagation scope") {
      if (scope === "multi_region") return "Multi-region propagation scope";
      if (scope === "regional") return "Regional propagation scope";
      if (scope === "cross_region") return "Cross-region propagation scope";
    }
    return reason;
  };

 
  
  
  const renderPrognosisDriver = (driver, scope) => {
    if (driver === "Local or unknown propagation scope") {
      if (scope === "multi_region") return "Multi-region propagation scope";
      if (scope === "regional") return "Regional propagation scope";
      if (scope === "cross_region") return "Cross-region propagation scope";
    }
    return driver;
  };
    


const FALSE_SIGNAL_LABELS = {
  false_alarm: "False Alarm",
  self_resolving: "Self-Resolving",
  true_incident: "True Incident",
};
const CLOUD_PATTERN_LABELS = {
    single_cloud: "Single Cloud",
    multi_cloud: "Multi-Cloud",
    edge: "Edge / CDN",
    unknown: "Unknown",
  };
  
  const REGION_PATTERN_LABELS = {
    single_region: "Single Region",
    multi_region: "Multi-Region",
    global: "Global",
    localized: "Localized",
    unknown: "Unknown",
  };

  const PROPAGATION_SCOPE_LABELS = {
    none: "None",
    regional: "Regional",
    global: "Global",
    edge: "Edge",
    unknown: "Unknown",
  };
  
  const SURFACE_LABELS = {
    api: "API",
    auth: "Auth / Login",
    web: "Web Frontend",
    mobile: "Mobile Apps",
    database: "Database",
    storage: "Storage",
    messaging: "Messaging / Queues",
    edge_network: "Edge / CDN",
    internal_tools: "Internal Tools",
  };
  
  const INCIDENT_TYPE_LABELS = {
    api: "API",
    auth: "Auth",
    database: "Database",
    cache: "Cache",
    network: "Network",
    other: "Other",
  };

  const ESCALATION_LABELS = {
    low: "Low",
    medium: "Medium",
    high: "High",
  };
  

export default function OpsIncidentView() {
  const [input, setInput] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const hasResult = !!result;
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("http://localhost:5901/api/ops/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident_text: input,
          env: "cloud",      // backend expects `env`; we default to cloud v1
          source: source || null, // harmless extra field; backend just ignores it
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `API error: ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Unable to analyze incident. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const opsScore = result?.risk_state?.ops_score ?? null;
  const stability = result?.tier10?.stability_index ?? null;
  const isCriticalUnstable = stability != null && stability < 0.25;
  const isHighOpsRisk = opsScore != null && opsScore >= 0.7;
  const falseSignal = result?.false_signal ?? null;
  
  const cloudLabelRaw = result?.tier3?.cloud_label || null;
  
  const falseSignalScore =
    falseSignal && typeof falseSignal.false_signal_score === "number"
      ? falseSignal.false_signal_score
      : null;
  
  const trueIncidentConfidence =
    falseSignalScore != null ? 1 - falseSignalScore : null;
  
  const falseSignalExplanation = describeFalseSignal(falseSignal);

  const stabilityTrend = result?.tier10?.stability_trend ?? null;

const stabilityInteraction = describeStabilityInteraction(
  falseSignal,
  stability,
  stabilityTrend
);

  const escalation = result?.escalation ?? null;
  const prognosis = result?.prognosis ?? null;
  const prognosisDisplay =
  prognosis?.prognosis_label === "likely_worsening"
    ? "Likely Worsening"
    : prognosis?.prognosis_label === "improving_or_stable"
    ? "Improving or Stable"
    : prognosis
    ? "Uncertain"
    : null;

  const normalized = result ? safeNormalize(result) : null;
  const trajectorySummary = result?.trajectory_summary ?? null;
  const isWorseningFast =
  trajectorySummary?.trajectory_label === "worsening_fast";
  const affectedSurfaces = trajectorySummary?.affected_surfaces ?? [];
  const hasMultipleSurfaces = affectedSurfaces.length > 1;
  const ambiguityFactor = computeAmbiguityFactor(result);


  return (
    <div className="bg-white min-h-screen flex flex-col items-center py-10 px-4">
      <Helmet>
        <title>Foxlight – Ops</title>
      </Helmet>

      <div className="bg-[#0B0D23] text-[#CDB088] w-full max-w-6xl p-6 rounded-xl shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl tracking-widest mb-4">FOXLIGHT</h1>
        </div>

        <div className="bg-[#7c8494] p-6 rounded-xl shadow space-y-6">
          <h2 className="text-[20px] text-[#CDB088] tracking-widest uppercase mb-8 flex items-center space-x-2">
            <img
              src="/icons/foxlight-icon-blue-800.png"
              alt="Foxlight Icon"
              className="w-[56px] h-[56px] object-contain -ml-1"
            />
            <span>Ops – Incident View</span>
          </h2>

          {/* Input area */}
          <div>
            <h3 className="text-[18px] text-white mb-2">Paste Incident Summary</h3>
            <textarea
              className="w-full p-4 border border-gray-300 rounded-xl text-base text-black placeholder-gray-400"
              rows="6"
              placeholder="Paste Cloudflare / AWS / Azure / CrowdStrike incident summary, status page entry, or Slack incident note here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>

          <select
            className="w-full p-3 border border-gray-300 rounded-xl text-sm text-black"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">Select Source (Optional)</option>
            <option value="status_page">Status Page</option>
            <option value="slack">Slack</option>
            <option value="pagerduty">PagerDuty</option>
            <option value="postmortem">Postmortem</option>
            <option value="unknown">Unknown</option>
          </select>

          <button
            className={`flex items-center gap-2 px-4 py-2 rounded transition font-normal ${
              loading || !input.trim()
                ? "bg-[#CDB088] text-[#0B0D23] opacity-50 cursor-not-allowed"
                : "bg-[#CDB088] text-[#0B0D23] hover:bg-[#05102D] hover:text-white"
            }`}
            onClick={handleAnalyze}
            disabled={loading || !input.trim()}
          >
            <img
              src="/icons/lightbulb.png"
              alt="Lightbulb Icon"
              className="w-6 h-6 drop-shadow-md"
            />
            {loading ? "Analyzing..." : "Run Ops Analysis"}
          </button>

          {error && (
            <p className="text-red-200 bg-red-800/40 border border-red-400 text-sm px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          {/* Results */}
          {hasResult && !error && (
            <>
              {/* Unified snapshot – Tier 1 + Tier 10 in one glance */}
              <div className="bg-white text-[#0B0D23] p-6 rounded-xl shadow-md">
                <h2 className="text-[18px] font-semibold mb-4">
                  Ops Snapshot – Unified View
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Ops risk score */}
                  <div>
                    <p className="text-[14px] font-medium mb-1">
                      Ops Risk Score
                    </p>
                    <p className="text-[24px] font-semibold mb-2">
                      {opsScore != null ? formatPercent(opsScore, 1) : "–"}
                    </p>
                    <div className="w-full h-3 bg-gray-200 rounded-full">
                      <div
                        className="h-3 rounded-full"
                        style={{
                          width: opsScore != null ? `${opsScore * 100}%` : "0%",
                          backgroundImage:
                            "linear-gradient(90deg, #e0e7ff 0%, #0b0d23 100%)",
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Higher = higher operational risk across environment.
                    </p>

                  {isHighOpsRisk && (
  <p className="text-xs font-semibold text-red-700 mt-1">
    Elevated systemic risk — treat current state as fragile.
  </p>
)}
                  </div>





                  {/* Stability index */}
                  <div>
                    <p className="text-[14px] font-medium mb-1">
                      Stability Index
                    </p>
                    <p className="text-[24px] font-semibold mb-2">
  {stability != null ? (
    isCriticalUnstable ? (
      <>
        {formatPercent(stability, 1)}{" "}
        <span className="text-[14px] font-medium text-gray-600">
          (Critical Unstable)
        </span>
      </>
    ) : (
      formatPercent(stability, 1)
    )
  ) : (
    "–"
  )}
</p>

                    <div className="w-full h-3 bg-gray-200 rounded-full">
                      <div
                        className="h-3 rounded-full"
                        style={{
                          width: stability != null ? `${stability * 100}%` : "0%",
                          backgroundImage:
                            "linear-gradient(90deg, #fef3c7 0%, #b45309 100%)",
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Lower values + declining trend = unstable system state.
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Trend:{" "}
                      <span className="font-semibold">
                        {result?.tier10?.stability_trend
                          ? capitalize(result.tier10.stability_trend)
                          : "–"}
                      </span>
                    </p>
                  </div>

                  {/* Environment */}
                  <div>
                    <p className="text-[14px] font-medium mb-1">
                      Environment & Surface
                    </p>
                    <p className="text-[16px] mb-1">
                      <strong>Env:</strong>{" "}
                      {result?.risk_state?.env
                        ? capitalize(result.risk_state.env)
                        : "–"}
                    </p>
                    <p className="text-[16px] mb-1">
                      <strong>Surface State:</strong>{" "}
                      {result?.tier7?.surface_state_label
                        ? capitalize(result.tier7.surface_state_label)
                        : "–"}
                    </p>
                    <p className="text-[14px] text-gray-600">
                      {result?.tier7?.surface_notes ||
                        "No additional surface notes."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tier 2 – Severity / Trajectory / TTM */}
              <div className="bg-white text-[#0B0D23] p-6 rounded-xl shadow-md">
                <h3 className="text-[18px] font-semibold mb-4">
                  Tier 2 – Severity & Trajectory
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[16px]">
                  <p>
                    <strong>Severity:</strong>{" "}
                    {result?.tier2?.severity_label || "–"}
                  </p>
                  <p>
                    <strong>Trajectory:</strong>{" "}
                    {result?.tier2?.trajectory_label
                      ? capitalize(result.tier2.trajectory_label)
                      : "–"}
                  </p>
                  <p>
                    <strong>Time to Materiality:</strong>{" "}
                    {result?.tier2?.ttm_bucket || "–"}
                  </p>
                  <p>
                    <strong>Primary Source:</strong>{" "}
                    {result?.tier2?.source_label
                      ? capitalize(result.tier2.source_label)
                      : "–"}
                  </p>
                  <p>
  <strong>Incident Type:</strong>{" "}
  {result?.tier2?.incident_type_label
    ? mapLabel(INCIDENT_TYPE_LABELS, result.tier2.incident_type_label)
    : "–"}
</p>
                </div>
              </div>

                            {/* Escalation Risk */}
                            <div className="bg-white text-[#0B0D23] p-6 rounded-xl shadow-md">
                <h3 className="text-[18px] font-semibold mb-4">
                  Escalation Risk
                </h3>
                {escalation ? (
                  <>
                    <p className="text-[16px] mb-2">
  <strong>Level:</strong>{" "}
  {ESCALATION_LABELS[escalation.escalation_label] ||
    capitalize(escalation.escalation_label || "")}
</p>


                    <p className="text-[14px] mb-3">
                      <strong>Escalation Score:</strong>{" "}
                      {typeof escalation.escalation_score === "number"
                        ? formatPercent(escalation.escalation_score, 0)
                        : "–"}
                    </p>
                    <div className="w-full h-3 bg-gray-200 rounded-full mb-3">
                      <div
                        className="h-3 rounded-full"
                        style={{
                          width:
                            typeof escalation.escalation_score === "number"
                              ? `${Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    escalation.escalation_score * 100
                                  )
                                )}%`
                              : "0%",
                          backgroundImage:
                            "linear-gradient(90deg, #fee2e2 0%, #b91c1c 100%)",
                        }}
                      ></div>
                    </div>
                    {Array.isArray(escalation.reasons) &&
                      escalation.reasons.length > 0 && (
                        <div>
                          <p className="text-[14px] font-medium mb-1">
                            Rationale:
                          </p>
                          <ul className="list-disc list-inside text-[14px] text-gray-700">
                            {escalation.reasons.map((reason, idx) => (
  <li key={idx}>
    {renderEscalationReason(
      reason,
      result?.tier6?.propagation_scope ?? "localized"
    )}
  </li>
))}

                          </ul>
                        </div>
                      )}
                  </>
                ) : (
                  <p className="text-[16px]">
                    No escalation assessment available for this incident.
                  </p>
                )}
              </div>

              {/* Phase 7 – Prognosis */}
{prognosis && (
  <div className="bg-white text-[#0B0D23] p-6 rounded-xl shadow-md">
    <h3 className="text-[18px] font-semibold mb-4">
      Prognosis – Worsening Likelihood
    </h3>

    <p className="mb-1 text-[16px]">
  <strong>Prognosis:</strong>{" "}
  {prognosisDisplay ?? "Uncertain"}
</p>


    <p className="mb-2 text-[16px]">
      <strong>Worsening Likelihood:</strong>{" "}
      {formatPercent(prognosis.worsening_likelihood ?? 0, 1)}
    </p>

    <p className="mb-4 text-[14px] text-gray-600">
      <strong>Confidence:</strong>{" "}
      {getDampenedConfidenceLabel(prognosis.confidence || "", ambiguityFactor)}
    </p>

    {/* Bar */}
    <div className="w-full h-3 bg-gray-200 rounded-full mb-4">
      <div
        className="h-3 rounded-full"
        style={{
          width: `${(prognosis.worsening_likelihood || 0) * 100}%`,
          backgroundImage:
            "linear-gradient(90deg, #fee2e2 0%, #b91c1c 100%)",
        }}
      ></div>
    </div>

    {/* Drivers / rationale */}
    {Array.isArray(prognosis.drivers) && prognosis.drivers.length > 0 && (
  <>
    <p className="text-[14px] font-medium mb-1">Drivers:</p>
    <ul className="list-disc list-inside text-[14px] text-gray-700 space-y-1">
      {prognosis.drivers
        .filter(
          (reason) => reason !== "Local or unknown propagation scope"
        )
        .map((reason, idx) => (
          <li key={idx}>{reason}</li>
        ))}
    </ul>
  </>
)}


  </div>
)}

{/* Trajectory Summary – Phase 8 */}
{trajectorySummary && (
  <div className="bg-white text-[#0B0D23] p-6 rounded-xl shadow-md">
    <h3 className="text-[18px] font-semibold mb-4">
      Trajectory Summary
    </h3>

    <p className="mb-1">
      <strong>Trend:</strong>{" "}
      {(() => {
        switch (trajectorySummary.trend_label) {
          case "worsening_fast":
            return "Worsening Fast";
          case "worsening_slow":
            return "Worsening Slowly";
          case "improving_fast":
            return "Improving Fast";
          case "improving_slow":
            return "Improving Slowly";
          default:
            return "Oscillating / Uncertain";
        }
      })()}
    </p>

    {isWorseningFast && (
  <p className="text-xs font-semibold text-red-700 mt-1">
    Trajectory is worsening fast — treat this as high urgency.
  </p>
)}


    <p className="mb-1">
      <strong>Confidence:</strong>{" "}
      {trajectorySummary.confidence
        ? trajectorySummary.confidence.charAt(0).toUpperCase() +
          trajectorySummary.confidence.slice(1)
        : "–"}
    </p>

    <p className="mb-3">
      <strong>Trajectory Score:</strong>{" "}
      {trajectorySummary.trajectory_score != null
        ? (trajectorySummary.trajectory_score * 100).toFixed(0) + "%"
        : "–"}
    </p>

    <div className="w-full h-3 bg-gray-200 rounded-full mb-4">
      <div
        className="h-3 rounded-full"
        style={{
          width: `${
            ((trajectorySummary.trajectory_score ?? 0) + 1) * 50
          }%`, // map [-1,1] -> [0,100]
          backgroundImage:
            "linear-gradient(90deg, #e0e7ff 0%, #0b0d23 100%)",
        }}
      ></div>
    </div>

    <p className="text-[14px] text-gray-700 mb-3">
      {trajectorySummary.narrative}
    </p>

    {Array.isArray(trajectorySummary.drivers) &&
      trajectorySummary.drivers.length > 0 && (
        <div>
          <p className="text-[14px] font-medium mb-1">Drivers:</p>
          <ul className="list-disc list-inside text-[14px] text-gray-700">
            {trajectorySummary.drivers.map((d, idx) => (
              <li key={idx}>{d}</li>
            ))}
          </ul>
        </div>
      )}
  </div>
)}



              {/* Tiers 3–6: topology + propagation */}
<div className="bg-white text-[#0B0D23] p-6 rounded-xl shadow-md">
  <h3 className="text-[18px] font-semibold mb-4">
    Tiers 3–6 – Topology & Propagation
  </h3>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[16px]">
    {/* Left column: cloud / region / SaaS */}
    <div className="space-y-1">
      <p className="flex items-center gap-2">
        <span>
        <strong>Cloud Pattern:</strong>{" "}
{getCloudPatternDisplay(
  result?.tier3?.cloud_label,
  result?.tier6?.propagation_scope,
  result?.tier6?.affected_surfaces
)}

        </span>
        {cloudLabelRaw === "unknown" && (
          <span className="relative inline-flex items-center group">
            <span className="text-xs text-gray-500 border border-gray-400 rounded-full px-1.5 py-0.5 cursor-default">
              ?
            </span>
            <span
              className="
                absolute left-1/2 -translate-x-1/2 top-full mt-1
                w-64 text-xs leading-snug
                bg-[#0B0D23] text-white
                px-2 py-1 rounded shadow-lg
                opacity-0 group-hover:opacity-100
                pointer-events-none z-10
              "
            >
              No cloud vendor detected in the incident summary. Region alone is
              not enough to determine provider.
            </span>
          </span>
        )}
      </p>

      <p>
  <strong>Region Pattern:</strong>{" "}
  {getRegionPatternDisplay(
    result?.tier3?.region_label,
    result?.tier6?.propagation_scope
  )}
</p>


      <p>
  <strong>SaaS Correlation:</strong>{" "}
  {Array.isArray(result?.tier4?.saas_correlation) &&
  result.tier4.saas_correlation.length > 0
    ? result.tier4.saas_correlation.join(", ")
    : "None Detected"}
</p>

    </div>

    {/* Right column: propagation scope + surfaces */}
<div>
<p className="mb-1">
  <strong>Propagation Scope:</strong>{" "}
  {getPropagationScopeDisplay(
    result?.tier6?.propagation_scope,
    result?.tier3?.region_label
  )}
</p>


  {Array.isArray(result?.tier6?.affected_surfaces) &&
  result.tier6.affected_surfaces.length > 0 ? (
    result.tier6.affected_surfaces.length === 1 ? (
      // Single surface → inline with label
      <p className="mb-2">
        <strong>Affected Surfaces:</strong>{" "}
        {mapLabel(SURFACE_LABELS, result.tier6.affected_surfaces[0])}
        <span className="text-xs text-gray-600"> (Single Surface)</span>
      </p>
    ) : (
      // Multiple surfaces → label + bullets
      <>
        <p className="mb-2">
          <strong>Affected Surfaces:</strong>
        </p>
        <ul className="list-disc list-inside">
        {capSurfaces(
  result.tier6.affected_surfaces,
  result?.tier6?.adjacency_confidence ?? null
).map((surface, idx) => (
  <li key={idx}>{mapLabel(SURFACE_LABELS, surface)}</li>
))}

{result.tier6.affected_surfaces.length >
  capSurfaces(
    result.tier6.affected_surfaces,
    result?.tier6?.adjacency_confidence ?? null
  ).length && (
    <li className="text-gray-500 italic">
      + {result.tier6.affected_surfaces.length -
        capSurfaces(
          result.tier6.affected_surfaces,
          result?.tier6?.adjacency_confidence ?? null
        ).length} more (ambiguous)
    </li>
  )}


        </ul>
      </>
    )
  ) : (
    // None
    <p className="mb-2">
      <strong>Affected Surfaces:</strong> None identified.
    </p>
  )}
</div>


  </div>
</div>


              {/* False-signal view */}
<div className="bg-white text-[#0B0D23] p-6 rounded-xl shadow-md">
  <h3 className="text-[18px] font-semibold mb-4">
    False-Signal Classification
  </h3>
  {falseSignal ? (
    <>
      <p className="text-[16px] mb-2">
        <strong>Predicted Class:</strong>{" "}
        {FALSE_SIGNAL_LABELS[falseSignal.pred_label] ||
          capitalize(falseSignal.pred_label)}
      </p>

      <p className="text-[16px] mb-1">
        <strong>True-Incident Confidence:</strong>{" "}
        {trueIncidentConfidence != null
          ? formatPercent(trueIncidentConfidence, 1)
          : "–"}
      </p>

      <p className="text-[14px] text-gray-600 mb-4">
        <strong>False-Signal Score:</strong>{" "}
        {falseSignalScore != null
          ? `${formatPercent(falseSignalScore, 1)}`
          : "–"}{" "}
        <span className="text-gray-500">
          (aggregate weight on false alarm + self-resolving)
        </span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {falseSignal.class_probs &&
          Object.entries(falseSignal.class_probs).map(([label, value]) => (
            <div key={label}>
              <p className="text-[14px] mb-1">
                {FALSE_SIGNAL_LABELS[label] || capitalize(label)}{" "}
                ({formatPercent(value, 1)})
              </p>
              <div className="w-full h-3 bg-gray-200 rounded-full">
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: `${(value || 0) * 100}%`,
                    backgroundImage:
                      "linear-gradient(90deg, #e0e7ff 0%, #0b0d23 100%)",
                  }}
                ></div>
              </div>
            </div>
          ))}
      </div>

      {falseSignalExplanation && (
        <p className="text-[14px] text-gray-600 mt-4">
          {falseSignalExplanation}
        </p>
      )}
      {stabilityInteraction && (
  <p className="text-[13px] text-gray-500 mt-1">
    {stabilityInteraction}
  </p>
)}
    </>
  ) : (
    <p className="text-[16px]">
      No false-signal analysis available.
    </p>
  )}
</div>

<PlaybookGuidance incident={result} />


            </>
          )}
        </div>
      </div>
    </div>
  );
}




