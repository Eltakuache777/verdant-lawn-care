// Short video clips for AI design concepts, via Google's Veo (same account/key
// as lib/gemini.ts's image generation). Verified directly against the real
// API before wiring in: see conversation history — model id confirmed via
// ListModels rather than guessed (a prior wrong guess 404'd).
//
// Video generation is async: submit a job (predictLongRunning), poll the
// returned operation until done, then download the resulting file.

const MODEL = "veo-3.1-fast-generate-preview";
const START_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predictLongRunning`;

export async function generateDesignVideo(conceptImage: Buffer, prompt: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY isn't configured");
  }

  const startRes = await fetch(START_URL, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [
        {
          prompt: `Slow cinematic pan across this landscaped yard: ${prompt}. Smooth camera movement, photorealistic, no people.`,
          image: { bytesBase64Encoded: conceptImage.toString("base64"), mimeType: "image/png" },
        },
      ],
    }),
  });
  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`Veo start error ${startRes.status}: ${text}`);
  }
  const { name: operationName } = await startRes.json();
  if (!operationName) {
    throw new Error("Veo did not return an operation name");
  }

  const maxAttempts = 40; // up to ~3.5 minutes — video generation isn't instant
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${operationName}`, {
      headers: { "x-goog-api-key": apiKey },
    });
    if (!pollRes.ok) {
      const text = await pollRes.text();
      throw new Error(`Veo poll error ${pollRes.status}: ${text}`);
    }
    const pollData = await pollRes.json();
    if (pollData.error) {
      throw new Error(`Veo generation failed: ${JSON.stringify(pollData.error)}`);
    }
    if (pollData.done) {
      const videoUri =
        pollData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!videoUri) {
        throw new Error(`Veo finished but returned no video: ${JSON.stringify(pollData).slice(0, 500)}`);
      }
      const downloadRes = await fetch(videoUri, { headers: { "x-goog-api-key": apiKey } });
      if (!downloadRes.ok) {
        throw new Error(`Veo video download error ${downloadRes.status}`);
      }
      return Buffer.from(await downloadRes.arrayBuffer());
    }
  }
  throw new Error("Veo video generation timed out");
}
