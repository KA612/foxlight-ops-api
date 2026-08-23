import "dotenv/config";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";


const app = express();
const PORT = process.env.PORT || 5901;

const OPS_LLADA_API_URL =
  process.env.OPS_LLADA_API_URL || "http://localhost:8100";
  const OPS_LLADA_API_KEY = process.env.OPS_LLADA_API_KEY;

app.use(cors());
app.use(express.json());

app.post("/api/ops/infer", async (req, res) => {
  const { incident_text, env, source } = req.body ?? {};
  const requestId = req.get("X-Request-ID") || randomUUID();
  console.log(`[request_started] request_id=${requestId}`);

  console.log("[/api/ops/infer] incoming payload:", {
    incident_text,
    env,
    source,
  });

  if (!incident_text || !incident_text.trim()) {
    console.warn("[/api/ops/infer] missing incident_text");
    return res.status(400).json({
      error: "incident_text is required",
    });
  }

  try {
    const apiResponse = await fetch(
    `${OPS_LLADA_API_URL}/v1/incidents/analyze`,
  {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
          "X-API-Key": OPS_LLADA_API_KEY,
        },
        body: JSON.stringify({
          incident_text,
          env: env || "cloud",
          source: source || null,
        }),
      }
    );

    const data = await apiResponse.json();

    console.log("[/api/ops/infer] Ops LLaDA API response:", data);

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json(data);
    }

    console.log(
      `[request_completed] request_id=${requestId} status_code=${apiResponse.status}`
    );

    res.setHeader("X-Request-ID", requestId);
    return res.json(data);
  } catch (err) {
    console.error("[/api/ops/infer] Ops LLaDA API error:", err);

    return res.status(500).json({
      error: "Failed to call Ops LLaDA API",
      message: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Ops API listening on port ${PORT}`);
});