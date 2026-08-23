export function safeNormalize(result) {
    if (!result || typeof result !== "object") {
      return { error: "invalid_inference" };
    }
  
    return {
      isValid: true,
      opsScore: result?.risk_state?.ops_score ?? null,
      stability: result?.tier10?.stability_index ?? null,
      stabilityTrend: result?.tier10?.stability_trend ?? null,
      falseSignalScore: result?.false_signal?.false_signal_score ?? null,
      escalationScore: result?.escalation?.escalation_score ?? null,
      prognosisLabel: result?.prognosis?.prognosis_label ?? null,
      trajectorySummary: result?.trajectory_summary?.trend_label ?? null,
      affectedSurfaces: Array.isArray(result?.tier3?.surfaces)
        ? result.tier3.surfaces
        : [],
    };
  }
  