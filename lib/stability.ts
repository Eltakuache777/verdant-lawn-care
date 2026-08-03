// Real AI design-concept generation via Stability AI's image-to-image API.
// Each call transforms one input photo into one landscaping design concept —
// this is called in a loop to produce a tier's full concept count.
import sharp from "sharp";

const STABILITY_URL = "https://api.stability.ai/v2beta/stable-image/generate/core";
const IMAGE_TO_VIDEO_URL = "https://api.stability.ai/v2beta/image-to-video";
const imageToVideoResultUrl = (id: string) => `https://api.stability.ai/v2beta/image-to-video/result/${id}`;

export async function generateDesignConcept(
  inputImage: Buffer,
  prompt: string,
  strength = 0.65
): Promise<Buffer> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error("STABILITY_API_KEY isn't configured");
  }

  const formData = new FormData();
  formData.append("image", new Blob([inputImage]), "input.png");
  formData.append(
    "prompt",
    `Professional landscape design concept, photorealistic: ${prompt}`
  );
  formData.append("mode", "image-to-image");
  formData.append("strength", String(strength));
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

// Turns one already-generated concept image into a short (a few seconds)
// motion video via Stable Video Diffusion. Async job API: submit, then poll
// for the result. SVD requires an exact input resolution, so the concept
// image is cover-cropped to 1024x576 first.
export async function generateDesignVideo(conceptImage: Buffer): Promise<Buffer> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error("STABILITY_API_KEY isn't configured");
  }

  const resized = await sharp(conceptImage).resize(1024, 576, { fit: "cover" }).png().toBuffer();

  const formData = new FormData();
  formData.append("image", new Blob([resized]), "concept.png");
  formData.append("seed", "0");
  formData.append("cfg_scale", "1.8");
  formData.append("motion_bucket_id", "127");

  const startRes = await fetch(IMAGE_TO_VIDEO_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`Stability AI image-to-video start error ${startRes.status}: ${text}`);
  }
  const { id } = await startRes.json();

  const maxAttempts = 30;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(imageToVideoResultUrl(id), {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "video/*" },
    });
    if (pollRes.status === 202) continue;
    if (!pollRes.ok) {
      const text = await pollRes.text();
      throw new Error(`Stability AI image-to-video result error ${pollRes.status}: ${text}`);
    }
    return Buffer.from(await pollRes.arrayBuffer());
  }
  throw new Error("Stability AI image-to-video timed out");
}
