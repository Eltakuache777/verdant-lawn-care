import { NextResponse } from "next/server";

// TEMPORARY diagnostic route — investigating a ByteString header error in AI
// design video generation. Reports only metadata about the key, never the
// key itself. Delete after diagnosis.
export async function GET() {
  const key = process.env.STABILITY_API_KEY ?? "";
  const badIndexes: { index: number; code: number }[] = [];
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    if (code > 255) badIndexes.push({ index: i, code });
  }
  return NextResponse.json({
    length: key.length,
    hasNonByteStringChars: badIndexes.length > 0,
    badIndexes,
    firstTwoChars: key.slice(0, 2),
    lastTwoChars: key.slice(-2),
  });
}
