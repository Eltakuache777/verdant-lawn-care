// Real AI design-concept generation via Stability AI's image-to-image API.
// Each call transforms one input photo into one landscaping design concept —
// this is called in a loop to produce a tier's full concept count.

const STABILITY_URL = "https://api.stability.ai/v2beta/stable-image/generate/core";

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
