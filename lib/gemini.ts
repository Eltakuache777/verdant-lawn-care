// AI design-concept generation via Google's Gemini image editing API — swapped
// in from Stability AI after real customer results were consistently poor
// (generic scenes that didn't resemble the actual uploaded yard, or barely
// changed at all). Verified directly against the real API before deploying:
// see conversation history — this produces far more coherent, photorealistic
// edits than Stability's sd3 model did.
import { resizeForApi } from "./imageProcessing";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent";

// Gemini's image model returns 503 UNAVAILABLE during demand spikes fairly
// routinely ("usually temporary" per their own error message) and 429 on
// rate limits — retry a few times with backoff so one transient blip doesn't
// abort an entire batch of concepts (especially the 15/50-concept tiers).
const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_ATTEMPTS = 4;

async function callGemini(apiKey: string, body: unknown): Promise<Response> {
  let lastRes: Response | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok || !RETRYABLE_STATUS.has(res.status)) return res;
    lastRes = res;
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
  return lastRes!;
}

export async function generateDesignConcept(inputImage: Buffer, prompt: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY isn't configured");
  }

  // Phone camera photos routinely arrive as HEIC/JPEG at full resolution —
  // resize/normalize before sending, same treatment as the old Stability path.
  const resizedInput = await resizeForApi(inputImage, 1536);

  const body = {
    contents: [
      {
        parts: [
          {
            text: `Apply these exact changes to the yard in this photo: ${prompt}. Keep the same house, fence, structures, and camera angle — this is the same yard, just improved, not a different property. Photorealistic.`,
          },
          { inline_data: { mime_type: "image/png", data: resizedInput.toString("base64") } },
        ],
      },
    ],
    // The API can silently return finishReason "NO_IMAGE" with empty content
    // when only IMAGE modality is requested — including TEXT lets the model
    // explain itself (and sometimes is required for it to return an image at
    // all) instead of refusing with no explanation.
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  };

  const res = await callGemini(apiKey, body);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const parts: any[] = candidate?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData || p.inline_data);
  const inline = imagePart?.inlineData || imagePart?.inline_data;
  if (!inline?.data) {
    const explanation = parts.find((p) => p.text)?.text;
    const reason = candidate?.finishReason ?? data.promptFeedback?.blockReason;
    throw new Error(
      `Gemini did not return an image (${reason ?? "unknown reason"}): ${explanation ?? JSON.stringify(data).slice(0, 500)}`
    );
  }

  return Buffer.from(inline.data, "base64");
}
