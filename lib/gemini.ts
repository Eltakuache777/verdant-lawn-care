// AI design-concept generation via Google's Gemini image editing API — swapped
// in from Stability AI after real customer results were consistently poor
// (generic scenes that didn't resemble the actual uploaded yard, or barely
// changed at all). Verified directly against the real API before deploying:
// see conversation history — this produces far more coherent, photorealistic
// edits than Stability's sd3 model did.
import { resizeForApi } from "./imageProcessing";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent";

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
    generationConfig: { responseModalities: ["IMAGE"] },
  };

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const parts: any[] = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData || p.inline_data);
  const inline = imagePart?.inlineData || imagePart?.inline_data;
  if (!inline?.data) {
    throw new Error(`Gemini did not return an image: ${JSON.stringify(data).slice(0, 500)}`);
  }

  return Buffer.from(inline.data, "base64");
}
