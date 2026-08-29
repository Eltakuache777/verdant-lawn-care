// AI design-concept generation via Google's Gemini image editing API — swapped
// in from Stability AI after real customer results were consistently poor
// (generic scenes that didn't resemble the actual uploaded yard, or barely
// changed at all). Verified directly against the real API before deploying:
// see conversation history — this produces far more coherent, photorealistic
// edits than Stability's sd3 model did.
import { resizeForApi } from "./imageProcessing";
import { createReadStream } from "fs";
import { stat } from "fs/promises";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_URL = `${GEMINI_BASE}/models/gemini-3.1-flash-image:generateContent`;
const GEMINI_FILES_UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";

// Gemini's image model returns 503 UNAVAILABLE during demand spikes fairly
// routinely ("usually temporary" per their own error message) and 429 on
// rate limits — retry a few times with backoff so one transient blip doesn't
// abort an entire batch of concepts (especially the 15/50-concept tiers).
const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_ATTEMPTS = 4;

// fetch() has no default timeout -- if Gemini accepts the connection but
// then stalls (no error, no response, just silence), this would otherwise
// hang forever with no way to recover, blocking whatever sequential batch
// is awaiting it (found via a real hang: the catalog image verification
// endpoint got stuck past 240s on a single request). A per-attempt timeout
// turns that into a normal retryable failure instead.
const REQUEST_TIMEOUT_MS = 45000;

async function callGeminiUrl(apiKey: string, url: string, body: unknown): Promise<Response> {
  let lastRes: Response | null = null;
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok || !RETRYABLE_STATUS.has(res.status)) return res;
      lastRes = res;
    } catch (err) {
      lastErr = err; // timeout or network error -- treat like a retryable status
    }
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
  if (lastRes) return lastRes;
  throw lastErr instanceof Error ? lastErr : new Error("Gemini request failed after retries");
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

// Pure text-to-image, no input photo -- used to generate a representative
// product photo for a materials-catalog entry (a type of mulch, a tree
// species, etc.), never scraped from another site to avoid copyright issues.
export async function generateStockPhoto(prompt: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY isn't configured");
  }

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
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

// Shared text/vision model used for two things: (1) letting a customer
// attach a silent walkthrough video of their yard as extra visual reference
// (the image editor above can only take a still photo, so a separate call
// "watches" the video and describes what it sees, folded into the prompt),
// and (2) listing out the materials/plants visible in a finished concept
// image (see describeConceptMaterials below).
const VISION_MODEL_FALLBACK = "gemini-3.1-flash";
let cachedVisionModel: string | null = null;

// A model existing in the list (and even claiming to support generateContent)
// doesn't mean it'll actually work — Google keeps sunset models listed and
// they 404 with "no longer available to new users" the moment you call them
// (learned the hard way: the naive first-match fallback here once picked
// gemini-2.5-flash, which did exactly that). So every candidate gets a real
// probe call, tried newest-version-first, until one actually succeeds.
async function probeModel(apiKey: string, model: string): Promise<boolean> {
  try {
    const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return res.status !== 404;
  } catch {
    return false; // timeout or network error -- treat like "not available", try the next candidate
  }
}

function versionScore(name: string): number {
  const match = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

async function resolveVisionModel(apiKey: string): Promise<string> {
  if (cachedVisionModel) return cachedVisionModel;

  if (await probeModel(apiKey, VISION_MODEL_FALLBACK)) {
    cachedVisionModel = VISION_MODEL_FALLBACK;
    return cachedVisionModel;
  }

  // The guessed model id doesn't exist (or isn't available) on this API
  // version — ask Google what does, same recovery used earlier for the Veo
  // model id being wrong, but this time actually verify each candidate
  // rather than trusting the first name match.
  const listRes = await fetch(`${GEMINI_BASE}/models?pageSize=200`, {
    headers: { "x-goog-api-key": apiKey },
  });
  if (!listRes.ok) {
    throw new Error(`Could not resolve a Gemini vision model and model listing failed ${listRes.status}`);
  }
  const listData = await listRes.json();
  const candidates: any[] = (listData.models ?? [])
    .filter(
      (m: any) =>
        typeof m.name === "string" &&
        m.name.includes("flash") &&
        !m.name.includes("image") &&
        !m.name.includes("tts") &&
        (m.supportedGenerationMethods ?? []).includes("generateContent")
    )
    .map((m: any) => m.name.replace(/^models\//, ""))
    .sort((a: string, b: string) => versionScore(b) - versionScore(a));

  for (const candidate of candidates) {
    if (await probeModel(apiKey, candidate)) {
      cachedVisionModel = candidate;
      console.log(`resolveVisionModel: resolved to ${candidate}`);
      return candidate;
    }
  }
  throw new Error("No working Gemini text/vision model found");
}

// Reads the video off disk as a stream rather than a full Buffer — the
// Render instance this runs on has 512MB total RAM (same constraint that
// caused a real OOM crash loop earlier over a fully-buffered video upload),
// and this function can be handling a video up to MAX_VIDEO_BYTES (75MB)
// on top of everything else already in flight for the same request. Node's
// fetch accepts a Readable directly as the body (with duplex: "half") so
// the bytes stream straight through without ever holding the whole file in
// memory at once.
async function uploadFileToGemini(apiKey: string, filePath: string, mimeType: string): Promise<{ uri: string; mimeType: string }> {
  const { size } = await stat(filePath);

  const startRes = await fetch(GEMINI_FILES_UPLOAD_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(size),
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
      "Content-Length": String(size),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: createReadStream(filePath),
    duplex: "half",
  } as unknown as RequestInit);
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

export async function describeYardVideo(videoPath: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY isn't configured");
  }

  const uploaded = await uploadFileToGemini(apiKey, videoPath, mimeType);
  const model = await resolveVisionModel(apiKey);

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

// Sanity-checks a materials-catalog picture against its own name/description
// -- the real-photo lookup tiers (Wikipedia lead image, Commons keyword
// search) occasionally return something totally unrelated when a plant/
// material's common name collides with another meaning (e.g. "Cosmos" the
// flower vs. outer space, "Purple Heart" the plant vs. the military medal,
// "Karl Foerster" the grass cultivar vs. the person it's named after).
// Returns null (rather than throwing) on any failure so a bad response
// doesn't wipe out a possibly-fine image -- caller should leave the item
// alone in that case, not treat null as a mismatch. skipReason is attached
// on the null path specifically so a systemic failure (quota exhausted, a
// sunset model id) is distinguishable from an occasional one-off hiccup
// instead of both looking like silent "skipped" items.
export async function verifyCatalogImageMatch(
  imageDataUri: string,
  name: string,
  description: string | null
): Promise<{ matches: boolean; reason: string } | { matches: null; skipReason: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY isn't configured");

  const inlineMatch = imageDataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!inlineMatch) return { matches: null, skipReason: "not a data URI" };

  try {
    const model = await resolveVisionModel(apiKey);
    const body = {
      contents: [
        {
          parts: [
            {
              text: `This image is supposed to show a landscaping/gardening item called "${name}"${description ? ` (${description})` : ""}. Does the image actually show that item -- a real, reasonably accurate depiction of it? Answer with only a JSON object: {"matches": true or false, "reason": "one short sentence"}. Say false if the image shows something unrelated (e.g. a person, building, artwork, unrelated object, or a different item entirely), even if it loosely shares a word with the name.`,
            },
            { inline_data: { mime_type: inlineMatch[1], data: inlineMatch[2] } },
          ],
        },
      ],
    };
    const res = await callGeminiUrl(apiKey, `${GEMINI_BASE}/models/${model}:generateContent`, body);
    if (!res.ok) {
      return { matches: null, skipReason: `Gemini ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    const data = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { matches: null, skipReason: `no JSON in response: ${text.slice(0, 200)}` };
    const parsed = JSON.parse(jsonMatch[0]);
    return { matches: !!parsed.matches, reason: typeof parsed.reason === "string" ? parsed.reason : "" };
  } catch (err: any) {
    return { matches: null, skipReason: err?.message ?? String(err) };
  }
}

// A short "what's in this picture" materials list for a finished design
// concept -- shown alongside each photo/video so a customer can see what
// stone, plants, mulch, etc. it's actually depicting. Runs once per concept
// image (not per video, since a video is generated from its concept image
// and shows the same materials) right after that image is generated.
export async function describeConceptMaterials(conceptImage: Buffer): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY isn't configured");
  }

  const model = await resolveVisionModel(apiKey);
  const body = {
    contents: [
      {
        parts: [
          {
            text: "This is a landscaping design concept image. List the hardscape materials (e.g. flagstone, brick pavers, gravel, boulders, retaining wall block), plants (by common name where recognizable, e.g. boxwood, red mulch bed, ornamental grass), and ground cover (mulch, sod, soil) visible in the image. Format as a short comma-separated list, most prominent items first. Only list what's actually visible -- don't guess at plant species you're not confident about, just describe them generically (e.g. 'flowering shrub') instead.",
          },
          { inline_data: { mime_type: "image/png", data: conceptImage.toString("base64") } },
        ],
      },
    ],
  };

  const res = await callGeminiUrl(apiKey, `${GEMINI_BASE}/models/${model}:generateContent`, body);
  if (!res.ok) {
    throw new Error(`Gemini materials description error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
  if (!text) {
    throw new Error(`Gemini didn't return a materials list: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return text.trim();
}
