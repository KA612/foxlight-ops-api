// apps/ops-web/src/PlaybookGuidance.jsx

import React from "react";

function mapLabel(mapping, raw) {
    if (!raw) return "–";
    return mapping[raw] || raw.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
  

function bucketConfidence(confidence) {
  if (confidence == null) return "unknown";

  if (typeof confidence === "number") {
    if (confidence < 0.4) return "low";
    if (confidence < 0.7) return "medium";
    return "high";
  }

  const normalized = String(confidence).toLowerCase();
  if (normalized.startsWith("low")) return "low";
  if (normalized.startsWith("med")) return "medium";
  if (normalized.startsWith("high")) return "high";
  return "unknown";
}

function isHighFalseSignal(falseSignalScore) {
  if (falseSignalScore == null) return false;
  return falseSignalScore >= 0.6;
}

function parseMaterialityWindow(timeToMateriality) {
  if (!timeToMateriality) return null;

  if (typeof timeToMateriality === "number") {
    if (timeToMateriality <= 3) return "lt3h";
    if (timeToMateriality <= 6) return "3-6h";
    if (timeToMateriality <= 12) return "6-12h";
    return "gt12h";
  }

  const s = String(timeToMateriality);
  if (s.includes("0-3")) return "lt3h";
  if (s.includes("3-6")) return "3-6h";
  if (s.includes("6-12")) return "6-12h";
  if (s.includes("3-12")) return "3-12h";
  if (s.includes("12+")) return "gt12h";
  return null;
}

function buildImmediateActions({
  severity,
  prognosis,
  stabilityIndex,
  scope,
  confidenceBucket,
  falseSignalScore,
}) {
  const items = [];

  if (severity === "P0" || severity === "P1") {
    items.push(
      "Treat this as an active, high-priority incident. Ensure primary on-call is engaged and owns mitigation."
    );
  }

  if (severity === "P2" || severity === "P3" || !severity) {
    items.push(
      "Maintain this as an open incident. Do not downgrade severity until the trajectory is clearly stable."
    );
  }

  if (stabilityIndex != null && stabilityIndex < 0.4) {
    items.push(
      "Investigate immediate drivers of instability. Prioritize mitigation over optimization work."
    );
  }

  if (prognosis === "worsening") {
    items.push(
      "Assume conditions may deteriorate. Prepare to escalate severity or engagement level if metrics worsen."
    );
  } else if (prognosis === "uncertain") {
    items.push(
      "Keep the incident in an active watch state. Avoid premature de-escalation while signals remain ambiguous."
    );
  }

  if (scope === "multi_region") {
    items.push(
      "Focus mitigation on currently affected regions and surfaces. Coordinate debugging across regions and avoid making global changes without clarity."
    );
  } else if (scope === "regional") {
    items.push(
      "Focus mitigation within the affected region first. Avoid cross-region or system-wide action until visibility improves."
    );
  } else if (scope === "cross-region") {
    items.push(
      "Treat this as a coordinated multi-region condition, not a localized anomaly. Align mitigation steps across impacted regions."
    );
  } else {
    // default: localized
    items.push(
      "Focus mitigation on the affected surface first. Defer global changes until localized behavior is understood."
    );
  }
  

  if (isHighFalseSignal(falseSignalScore)) {
    items.push(
      "Balance mitigation work with validation of signal quality. Avoid unnecessary broad changes if noise is suspected."
    );
  } else if (falseSignalScore != null) {
    items.push(
      "Bias toward treating this as a real incident. Do not fully attribute symptoms to monitoring noise."
    );
  }

  if (confidenceBucket === "low") {
    items.push(
      "Interpret recommendations as advisory, not prescriptive. Validate with additional telemetry where possible."
    );
  } else if (confidenceBucket === "high") {
    items.push(
      "Act decisively on the current state. Defer experimental changes that are not directly tied to mitigation."
    );
  }

  return items;
}

function buildVerificationChecklist({ scope, affectedSurfaces, prognosis }) {
  const items = [];

  const lower = (s) => (typeof s === "string" ? s.toLowerCase() : s);
  const hasDb =
    affectedSurfaces?.some((s) =>
      ["db", "database", "postgres", "mysql"].includes(lower(s))
    ) ?? false;
  const hasApi =
    affectedSurfaces?.some((s) =>
      ["api", "gateway", "edge"].includes(lower(s))
    ) ?? false;
  const hasQueue =
    affectedSurfaces?.some((s) =>
      ["queue", "kafka", "pubsub"].includes(lower(s))
    ) ?? false;

  if (hasDb) {
    items.push(
      "Verify database latency, connection pool utilization, and any throttling or lock contention."
    );
  }

  if (hasApi) {
    items.push(
      "Validate API timeout rate, retry behavior, and upstream dependency health for the affected endpoints."
    );
  }

  if (hasQueue) {
    items.push(
      "Check message backlog, consumer lag, and any dead-letter queue growth for abnormal patterns."
    );
  }

  if (scope === "localized") {
    items.push(
      "Confirm that replicas or sibling regions do not exhibit the same symptom pattern."
    );
  } else if (scope === "cross-region") {
    items.push(
      "Compare metrics across regions to determine whether the issue originates upstream of regional boundaries."
    );
  }

  if (prognosis === "uncertain") {
    items.push(
      "Compare current metrics against recent baseline to distinguish transient spikes from structural degradation."
    );
  }

  items.push(
    "Validate that monitoring and alerting are not introducing duplicate or amplified signals that distort perception."
  );

  return items;
}

function buildEscalationTriggers({
  severity,
  stabilityIndex,
  prognosis,
  scope,
  materialityWindow,
  confidenceBucket,
}) {
  const items = [];

  if (scope === "multi_region") {
    items.push(
      "If symptoms deepen across regions or begin affecting additional control planes, escalate severity by one level."
    );
    items.push(
      "If cross-region instability persists across check intervals or impacts multiple services, widen responder set and escalate."
    );
  }
  
  else if (scope === "regional") {
    items.push(
      "If symptoms spread to additional availability zones or begin cascading into other regions, escalate severity by one level."
    );
  }
  
  else if (scope === "cross-region") {
    items.push(
      "If impact extends to additional services (e.g., API and database both degrading), escalate to at least P1 if not already."
    );
    items.push(
      "If independent regions start exhibiting correlated failures, widen engagement and escalate."
    );
  }
  
  else {
    // default: localized
    items.push(
      "If symptoms appear in an additional region or availability zone, escalate severity by one level."
    );
  }
  

  if (stabilityIndex != null && stabilityIndex < 0.25) {
    items.push(
      "If stability remains below 25% for more than one measurement interval, escalate paging and incident ownership."
    );
  }

  if (prognosis === "worsening") {
    items.push(
      "If degradation continues across two consecutive measurement windows, escalate and widen the responder set."
    );
  }

  if (materialityWindow === "lt3h" || materialityWindow === "3-6h") {
    items.push(
      "If leading indicators suggest material customer impact within the next few hours, escalate even if severity is P3."
    );
  }

  if (confidenceBucket === "high") {
    items.push(
      "If high-confidence predictors indicate escalation risk, act before external complaints accumulate."
    );
  }

  return items;
}

function buildOperationalPosture({
  prognosis,
  stabilityIndex,
  scope,
  falseSignalScore,
}) {
  const items = [];

  if (prognosis === "uncertain") {
    items.push(
      "Maintain a heightened monitoring posture. Do not declare the incident resolved until the trajectory stabilizes."
    );
  } else if (prognosis === "stable") {
    items.push(
      "Allow for cautious optimism, but keep the incident open until stability holds across multiple check intervals."
    );
  }

  if (stabilityIndex != null && stabilityIndex >= 0.4 && stabilityIndex < 0.7) {
    items.push(
      "Continue active observation with periodic deep dives into the main contributing signals."
    );
  }

  if (isHighFalseSignal(falseSignalScore)) {
    items.push(
      "Explore monitoring, configuration, or deployment changes that may have introduced spurious alerts."
    );
  }

  if (scope === "multi_region") {
    items.push(
      "Coordinate mitigation across affected regions to stabilize interactions, not just isolate failure surfaces."
    );
    items.push(
      "Avoid region-wide or vendor-impacting changes unless the cross-region pattern is clearly understood."
    );
  }
  
  else if (scope === "regional") {
    items.push(
      "Contain instability within the affected region while validating that no other regions are drifting."
    );
    items.push(
      "Avoid cross-region actions that could distort signal interpretation."
    );
  }
  
  else if (scope === "cross-region") {
    items.push(
      "Treat this as a distributed issue rather than a single-region anomaly. Maintain coordinated observation and mitigation."
    );
    items.push(
      "Avoid any per-region shortcuts that might worsen cross-region interference."
    );
  }
  
  else {
    // default: localized
    items.push(
      "Adopt a containment-first posture: limit scope, protect adjacent systems, and avoid unnecessary global actions."
    );
  }

  return items;
}


function buildCommunicationGuidance({ scope, materialityWindow, prognosis }) {
  const items = [];

  items.push(
    "Keep internal stakeholders informed of current severity, scope, and expected time to impact."
  );

  if (materialityWindow === "lt3h" || materialityWindow === "3-6h") {
    items.push(
      "Issue an internal advisory that customer-visible impact is plausible within the short term if degradation continues."
    );
  }

  if (scope === "cross-region") {
    items.push(
      "Prepare external communication for a broad customer segment if multiple regions or surfaces are materially impacted."
    );
  } else if (scope === "localized") {
    items.push(
      "Target any external advisory to only the affected region or customer cohort to avoid unnecessary alarm."
    );
  }

  if (prognosis === "uncertain") {
    items.push(
      "Avoid definitive 'all clear' language until metrics have clearly converged to baseline."
    );
  }

  return items;
}

 export default function PlaybookGuidance({ incident }) {
  // Guard: if nothing is passed, don't render anything.
  if (!incident) return null;

  // Derive primitives from the unified incident object.
  const severity =
    incident?.tier2?.severity_label ?? incident?.tier2?.severityLabel ?? null;

  const stabilityIndex =
    incident?.tier10?.stability_index ??
    incident?.risk_state?.stability_index ??
    null;

  // Prefer Phase-7 prognosis if present, then fall back to Tier-2, then trajectory, then "uncertain"
const prognosisKey =
incident?.prognosis?.prognosis_label ??
incident?.tier2?.prognosis_label ??
incident?.tier2?.trajectory_label ??
"uncertain";


const tier2 = incident?.tier2 ?? null;   //  <<---- ADD THIS LINE  

  const confidence = incident?.risk_state?.ops_score ?? null;

// Use tier6.propagation_scope first, then fall back to older fields
const rawScope =
  incident?.tier6?.propagation_scope ??
  incident?.pattern?.pattern_scope ??
  incident?.pattern?.scope_label ??
  incident?.tier6?.scope_label ??
  null;

const normalizeScope = (value) => {
  if (!value) return null;
  const v = String(value).toLowerCase().replace(/\s+/g, "_");

  if (v === "multi_region" || v === "multi-region") return "multi_region";
  if (v === "cross_region" || v === "cross-region") return "cross_region";
  if (v === "regional" || v === "region") return "regional";
  if (v === "localized" || v === "local") return "localized";

  return null;
};

const scope = normalizeScope(rawScope) ?? "localized";




  const timeToMateriality =
    incident?.tier2?.ttm_bucket ?? incident?.tier2?.ttmBucket ?? null;

  const falseSignalScore =
    incident?.false_signal?.false_signal_score ??
    incident?.false_signal?.falseSignalScore ??
    null;

  const affectedSurfaces = [
    incident?.tier2?.incident_type_label,
    incident?.tier2?.source_label,
    incident?.tier3?.surface_label,
  ].filter(Boolean);

  const confidenceBucket = bucketConfidence(confidence);
  const materialityWindow = parseMaterialityWindow(timeToMateriality);

  console.log("CANONICAL_SCOPE =>", JSON.stringify(scope));

  const immediateActions = buildImmediateActions({
    severity,
    prognosis: prognosisKey,
    stabilityIndex,
    scope,
    confidenceBucket,
    falseSignalScore,
  });
  
  const verificationChecklist = buildVerificationChecklist({
    scope,
    affectedSurfaces,
    prognosis: prognosisKey,
  });
  
  const escalationTriggers = buildEscalationTriggers({
    severity,
    stabilityIndex,
    prognosis: prognosisKey,
    scope,
    materialityWindow,
    confidenceBucket,
  });
  
  const operationalPosture = buildOperationalPosture({
    prognosis: prognosisKey,
    stabilityIndex,
    scope,
    falseSignalScore,
  });
  
  const communicationGuidance = buildCommunicationGuidance({
    scope,
    materialityWindow,
    prognosis: prognosisKey,
  });  

  const hasAnyContent =
  immediateActions.length ||
  verificationChecklist.length ||
  escalationTriggers.length ||
  operationalPosture.length ||
  communicationGuidance.length;

// Trajectory summary for the strip (derived from incident)
const trajectorySummary =
  incident?.trajectory_summary?.trend_label ??
  incident?.trajectory_summary?.trend ??
  null;

// For the summary strip
const stabilityLabel =
  typeof stabilityIndex === "number"
    ? `${Math.round(stabilityIndex * 100)}%`
    : null;

    let trajectorySummaryLabel = trajectorySummary
    ? mapLabel({}, trajectorySummary)
    : null;
  
  // Micro-clean: "Oscillating Or Uncertain" -> "Oscillating / Uncertain"
  if (trajectorySummaryLabel) {
    trajectorySummaryLabel = trajectorySummaryLabel.replace(" Or ", " / ");
  }

const prognosisLabel = prognosisKey ? mapLabel({}, prognosisKey) : null;


const anyGuidance = hasAnyContent;



    if (!anyGuidance) {
        return (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[13px] text-[#0B0D23] opacity-70">
              No deterministic playbook recommendations apply to this incident state.
            </p>
          </div>
        );
      }
      
      return (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <h2 className="text-base font-semibold uppercase tracking-wide text-[#0B0D23]">
            Playbook Guidance
          </h2>
          <p className="mt-1 text-sm text-[#0B0D23]">
            Deterministic recommendations based on current severity, stability, scope, and prognosis.
          </p>
      
          {/* Lightweight semantic summary strip */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#0B0D23] opacity-70">
  {stabilityLabel && <span>Stability: {stabilityLabel}</span>}

  {trajectorySummaryLabel && (
    <span>• Trajectory: {trajectorySummaryLabel}</span>
  )}

  {prognosisLabel && (
    <span>• Prognosis: {prognosisLabel}</span>
  )}

  {tier2?.ttm_bucket && (
    <span>• Time Horizon: {tier2.ttm_bucket}</span>
  )}
</div>


      <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-slate-100 bg-[#F5F7FA] p-4 text-[#0B0D23]">
          <h3 className="text-[13px] font-semibold text-[#0B0D23]">Immediate Actions</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-[#0B0D23]">
            {immediateActions.map((item, idx) => (
              <li key={`immediate-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-100 bg-[#F5F7FA] p-4 text-[#0B0D23]">
          <h3 className="text-[13px] font-semibold text-[#0B0D23]">Verification Checklist</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-[#0B0D23]">
            {verificationChecklist.map((item, idx) => (
              <li key={`verify-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-100 bg-[#F5F7FA] p-4 text-[#0B0D23]">
          <h3 className="text-[13px] font-semibold text-[#0B0D23]">Conditional Escalation Triggers</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-[#0B0D23]">
            {escalationTriggers.map((item, idx) => (
              <li key={`escalate-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-100 bg-[#F5F7FA] p-4 text-[#0B0D23]">
          <h3 className="text-[13px] font-semibold text-[#0B0D23]">Operational Posture</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-[#0B0D23]">
            {operationalPosture.map((item, idx) => (
              <li key={`posture-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-2 rounded-lg border border-slate-100 bg-[#F5F7FA] bg-white p-4 text-[#0B0D23]">
          <h3 className="text-[13px] font-semibold text-[#0B0D23]">Communication Guidance</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-[#0B0D23]">
            {communicationGuidance.map((item, idx) => (
              <li key={`comm-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
