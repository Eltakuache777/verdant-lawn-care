// Short (and, for the Premium tier, extended) video clips for AI design
// concepts, via Google's Veo (same account/key as lib/gemini.ts's image
// generation). Verified directly against the real API before wiring in:
// model id confirmed via ListModels rather than guessed (a prior wrong
// guess 404'd), and the extension-chaining approach for durations beyond a
// single generation's 8-second cap was verified end-to-end too (8s clip ->
// one extension call -> confirmed 15s output via ffprobe).
//
// Video generation is async: submit a job (predictLongRunning), poll the
// returned operation until done. A single generation maxes out around 8
// seconds; going longer means feeding the previous result's video object
// back in as the "video" field alongside a new prompt, which each add
// ~7 more seconds to a single merged output file.

const MODEL = "veo-3.1-fast-generate-preview";
const START_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predictLongRunning`;
const SECONDS_PER_EXTENSION = 7;
const INITIAL_CLIP_SECONDS = 8;

type VeoVideoRef = { uri: string };

async function submitAndPoll(apiKey: string, instance: Record<string, unknown>): Promise<VeoVideoRef> {
  const startRes = await fetch(START_URL, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ instances: [instance] }),
  });
  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`Veo start error ${startRes.status}: ${text}`);
  }
  const { name: operationName } = await startRes.json();
  if (!operationName) {
    throw new Error("Veo did not return an operation name");
  }

  const maxAttempts = 40; // up to ~3.5 minutes per hop — video generation isn't instant
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
      const video = pollData.response?.generateVideoResponse?.generatedSamples?.[0]?.video;
      if (!video?.uri) {
        throw new Error(`Veo finished but returned no video: ${JSON.stringify(pollData).slice(0, 500)}`);
      }
      return video;
    }
  }
  throw new Error("Veo video generation timed out");
}

export async function generateDesignVideo(
  conceptImage: Buffer,
  prompt: string,
  targetDurationSeconds = 8
): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY isn't configured");
  }

  let video = await submitAndPoll(apiKey, {
    prompt: `Slow cinematic pan across this landscaped yard: ${prompt}. Smooth camera movement, photorealistic, no people.`,
    image: { inlineData: { mimeType: "image/png", data: conceptImage.toString("base64") } },
  });

  let currentDuration = INITIAL_CLIP_SECONDS;
  while (currentDuration < targetDurationSeconds) {
    video = await submitAndPoll(apiKey, {
      prompt: "Continue the same slow cinematic pan, revealing more of the yard. Smooth camera movement, photorealistic, no people.",
      video,
    });
    currentDuration += SECONDS_PER_EXTENSION;
  }

  const downloadRes = await fetch(video.uri, { headers: { "x-goog-api-key": apiKey } });
  if (!downloadRes.ok) {
    throw new Error(`Veo video download error ${downloadRes.status}`);
  }
  return Buffer.from(await downloadRes.arrayBuffer());
}
