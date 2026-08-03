// Real AI design-concept generation via Stability AI's image-to-image API.
// Each call transforms one input photo into one landscaping design concept —
// this is called in a loop to produce a tier's full concept count.
import { resizeForApi } from "./imageProcessing";

// stable-image/generate/core is text-to-image ONLY — it silently ignores the
// "image"/"mode"/"strength" fields instead of erroring, which is why concepts
// looked nothing like the customer's actual yard. sd3 is the endpoint that
// actually supports image-to-image editing of an uploaded photo.
const STABILITY_URL = "https://api.stability.ai/v2beta/stable-image/generate/sd3";

export async function generateDesignConcept(
  inputImage: Buffer,
  prompt: string,
  strength = 0.45
): Promise<Buffer> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error("STABILITY_API_KEY isn't configured");
  }

  // Phone camera photos routinely exceed SD3's accepted pixel-count limit and
  // arrive as HEIC/JPEG at full resolution — resize before sending. Also
  // falls back to heic-convert if the file is a raw, still-undecoded HEIC.
  const resizedInput = await resizeForApi(inputImage, 1536);

  const formData = new FormData();
  formData.append("image", new Blob([resizedInput]), "input.png");
  formData.append(
    "prompt",
    `Photorealistic professional landscaping redesign, apply these exact changes to the yard in the photo: ${prompt}. Keep the same house, fence, and camera angle — this is the same yard, just improved, not a different property.`
  );
  formData.append(
    "negative_prompt",
    "different house, different property, different camera angle, unchanged from original, no visible changes"
  );
  formData.append("mode", "image-to-image");
  formData.append("strength", String(strength));
  formData.append("model", "sd3.5-large");
  formData.append("output_format", "png");

  const res = await fetch(STABILITY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stability AI error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (data.finish_reason !== "SUCCESS") {
    throw new Error(`Stability AI did not succeed: ${data.finish_reason}`);
  }

  return Buffer.from(data.image, "base64");
}
