// AI design-concept generation via Google's Gemini image editing API — swapped
// in from Stability AI after real customer results were consistently poor
// (generic scenes that didn't resemble the actual uploaded yard, or barely
// changed at all). Verified directly against the real API before deploying:
// see conversation history — this produces far more coherent, photorealistic
// edits than Stability's sd3 model did.
import { resizeForApi } from "./imageProcessing";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_URL = `${GEMINI_BASE}/models/gemini-3.1-flash-image:generateContent`;
const GEMINI_FILES_UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";

// Gemini's image model returns 503 UNAVAILABLE during demand spikes fairly
// routinely ("usually temporary" per their own error message) and 429 on
// rate limits — retry a few times with backoff so one transient blip doesn't
// abort an entire batch of concepts (especially the 15/50-concept tiers).
const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_ATTEMPTS = 4;

async function callGeminiUrl(apiKey: string, url: string, body: unknown): Promise<Response> {
  let lastRes: Response | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
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

async function callGemini(apiKey: string, body: unknown): Promise<Response> {
  return callGeminiUrl(apiKey, GEMINI_URL, body);
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
            // Gemini understands Spanish natively, but customers may type
            // their request in Spanish while everything else here is
            // English — call that out explicitly rather than relying on it
            // being implicit.
            text: `Apply these exact changes to the yard in this photo: ${prompt}. (The request above may be written in English or Spanish — understand and apply it correctly either way.) Keep the same house, fence, structures, and camera angle — this is the same yard, just improved, not a different property. Photorealistic.`,
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

// Lets a customer attach a silent walkthrough video of their yard as extra
// visual reference (not spoken instructions) — the image editor above can
// only take a still photo, so instead we have a separate text/vision Gemini
// model "watch" the video and describe what it sees, then fold that
// description into the prompt alongside whatever the customer typed. A
// video alone still isn't enough to generate from — see the "at least one
// photo" check in app/api/quote/generate/route.ts.
const VIDEO_DESCRIBE_MODEL_FALLBACK = "gemini-3.1-flash";
let cachedVideoDescribeModel: string | null = null;

async function resolveVideoDescribeModel(apiKey: string): Promise<string> {
  if (cachedVideoDescribeModel) return cachedVideoDescribeModel;

  const probeUrl = `${GEMINI_BASE}/models/${VIDEO_DESCRIBE_MODEL_FALLBACK}:generateContent`;
  const probeRes = await fetch(probeUrl, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
  });
  if (probeRes.status !== 404) {
    cachedVideoDescribeModel = VIDEO_DESCRIBE_MODEL_FALLBACK;
    return cachedVideoDescribeModel;
  }

  // The guessed model id doesn't exist on this API version — ask Google what
  // does, same recovery used earlier for the Veo model id being wrong.
  const listRes = await fetch(`${GEMINI_BASE}/models?pageSize=200`, {
    headers: { "x-goog-api-key": apiKey },
  });
  if (!listRes.ok) {
    throw new Error(`Could not resolve a Gemini video model and model listing failed ${listRes.status}`);
  }
  const listData = await listRes.json();
  const candidates: any[] = listData.models ?? [];
  const match = candidates.find(
    (m) =>
      typeof m.name === "string" &&
      m.name.includes("flash") &&
      !m.name.includes("image") &&
      !m.name.includes("tts") &&
      (m.supportedGenerationMethods ?? []).includes("generateContent")
  );
  if (!match) {
    throw new Error("No suitable Gemini text/vision model found for video description");
  }
  const resolved: string = match.name.replace(/^models\//, "");
  cachedVideoDescribeModel = resolved;
  console.log(`describeYardVideo: resolved video model to ${resolved}`);
  return resolved;
}

async function uploadFileToGemini(apiKey: string, buffer: Buffer, mimeType: string): Promise<{ uri: string; mimeType: string }> {
  const startRes = await fetch(GEMINI_FILES_UPLOAD_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(buffer.length),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "yard-walkthrough" } }),
  });
  if (!startRes.ok) {
    throw new Error(`Gemini file upload (start) failed ${startRes.status}: ${await startRes.text()}`);
  }
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error("Gemini file upload did not return an upload URL");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(buffer.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: buffer,
  });
  if (!uploadRes.ok) {
    throw new Error(`Gemini file upload failed ${uploadRes.status}: ${await uploadRes.text()}`);
  }
  let file = (await uploadRes.json()).file;

  // Video files need a short server-side processing pass before Google will
  // let anything reference them — poll until it flips to ACTIVE.
  for (let attempt = 0; attempt < 30 && file.state === "PROCESSING"; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(`${GEMINI_BASE}/${file.name}`, {
      headers: { "x-goog-api-key": apiKey },
    });
    if (!statusRes.ok) {
      throw new Error(`Gemini file status check failed ${statusRes.status}: ${await statusRes.text()}`);
    }
    file = await statusRes.json();
  }
  if (file.state !== "ACTIVE") {
    throw new Error(`Gemini file never finished processing (state: ${file.state})`);
  }

  return { uri: file.uri, mimeType: file.mimeType ?? mimeType };
}

export async function describeYardVideo(videoBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY isn't configured");
  }

  const uploaded = await uploadFileToGemini(apiKey, videoBuffer, mimeType);
  const model = await resolveVideoDescribeModel(apiKey);

  const body = {
    contents: [
      {
        parts: [
          { file_data: { mime_type: uploaded.mimeType, file_uri: uploaded.uri } },
          {
            text: "This is a walkthrough video of a customer's yard, sent to a lawn care & landscaping company as visual reference for a redesign. Describe in a few factual sentences everything relevant to landscaping: grass condition, existing plants/bushes/trees, fences, patios, walkways, structures, and the general layout and size. Only describe what's actually visible — don't invent details. (If anyone is speaking in the video, in English or Spanish, factor in anything relevant they say.)",
          },
        ],
      },
    ],
  };

  const res = await callGeminiUrl(apiKey, `${GEMINI_BASE}/models/${model}:generateContent`, body);
  if (!res.ok) {
    throw new Error(`Gemini video description error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
  if (!text) {
    throw new Error(`Gemini didn't return a video description: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return text.trim();
}
