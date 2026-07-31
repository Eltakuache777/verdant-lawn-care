import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation } from "@/lib/email";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Real tools the assistant can actually call against your real database —
// this is what makes it able to book appointments instead of just chatting about them.
// web_search is Anthropic's own server-side tool: Claude runs the search and folds
// the result into its answer within the same call, so there's nothing for us to execute.
const tools: (Anthropic.Tool | { type: string; name: string; max_uses?: number })[] = [
  { type: "web_search_20250305", name: "web_search", max_uses: 3 },
  {
    name: "check_availability",
    description: "Check open appointment slots for a given date",
    input_schema: {
      type: "object",
      properties: { date: { type: "string", description: "YYYY-MM-DD" } },
      required: ["date"],
    },
  },
  {
    name: "create_booking",
    description: "Book an appointment for a customer, for one or more services",
    input_schema: {
      type: "object",
      properties: {
        customerName: { type: "string" },
        customerEmail: { type: "string" },
        services: {
          type: "array",
          items: {
            type: "string",
            enum: ["Mowing", "Tree Trimming", "Landscaping Project", "Fence Building", "Pressure Washing", "Bin Cleaning", "Bush Trimming"],
          },
          minItems: 1,
        },
        address: { type: "string" },
        scheduledFor: { type: "string", description: "ISO datetime" },
        isEmergency: { type: "boolean" },
      },
      required: ["customerName", "customerEmail", "services", "address", "scheduledFor"],
    },
  },
];

async function checkAvailability(date: string) {
  const dayStart = new Date(date + "T00:00:00");
  const dayEnd = new Date(date + "T23:59:59");
  const existing = await prisma.booking.findMany({
    where: { scheduledFor: { gte: dayStart, lte: dayEnd } },
  });
  const bookedHours = existing.map((b) => new Date(b.scheduledFor).getHours());
  const openHours = [8, 9, 10, 11, 13, 14, 15, 16].filter((h) => !bookedHours.includes(h));
  return { date, openHours };
}

async function createBookingFromAssistant(input: any) {
  const requested: string[] = input.services ?? [];
  const services = await prisma.service.findMany({ where: { name: { in: requested } } });
  const foundNames = new Set(services.map((s) => s.name));
  const missing = requested.filter((name) => !foundNames.has(name));
  if (missing.length > 0) return { error: `Unknown service(s): ${missing.join(", ")}` };

  const customer = await prisma.customer.upsert({
    where: { email: input.customerEmail },
    update: { name: input.customerName },
    create: { name: input.customerName, email: input.customerEmail },
  });

  const basePrice = services.reduce((sum, s) => sum + s.basePrice, 0);
  const emergencyFee = input.isEmergency ? 15 : 0;
  const booking = await prisma.booking.create({
    data: {
      customerId: customer.id,
      services: requested,
      address: input.address,
      scheduledFor: new Date(input.scheduledFor),
      isEmergency: !!input.isEmergency,
      emergencyFee,
      basePrice,
      totalPrice: basePrice + emergencyFee,
    },
  });

  try {
    await sendBookingConfirmation({
      customerName: customer.name,
      customerEmail: customer.email,
      services: booking.services,
      address: booking.address,
      scheduledFor: booking.scheduledFor,
      totalPrice: booking.totalPrice,
    });
  } catch (err) {
    console.error("Failed to send booking confirmation email:", err);
  }

  return { confirmed: true, bookingId: booking.id, total: booking.totalPrice };
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json(); // [{ role: "user"|"assistant", content: "..." }]

  let response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system:
      "You are Verdant Lawn Care's scheduling assistant. Help customers book mowing, tree trimming, landscaping, fence building, pressure washing, bin cleaning, or bush trimming — customers can book more than one service in the same appointment. Use check_availability before proposing a time, and create_booking once the customer confirms. If a customer asks the price of a specific material, plant, or tree (e.g. \"how much for a Japanese maple\" or \"cost of river rock\") that isn't one of our own services, use web_search to find a current typical price and give a brief estimate — make clear it's a rough estimate from the web, not our own price. Be concise and friendly.",
    messages,
    tools: tools as Anthropic.Tool[],
  });

  // Claude can request several tool calls in the same turn (e.g. checking
  // multiple dates at once) — every tool_use block needs a matching
  // tool_result in the next message, or the API rejects the whole request.
  while (response.stop_reason === "tool_use") {
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    const toolResults = await Promise.all(
      toolUses.map(async (toolUse) => {
        let result;
        if (toolUse.name === "check_availability") {
          result = await checkAvailability((toolUse.input as any).date);
        } else if (toolUse.name === "create_booking") {
          result = await createBookingFromAssistant(toolUse.input);
        }
        return {
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        };
      })
    );

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system:
        "You are Verdant Lawn Care's scheduling assistant. Help customers book mowing, tree trimming, landscaping, fence building, pressure washing, bin cleaning, or bush trimming — customers can book more than one service in the same appointment. Use check_availability before proposing a time, and create_booking once the customer confirms. If a customer asks the price of a specific material, plant, or tree (e.g. \"how much for a Japanese maple\" or \"cost of river rock\") that isn't one of our own services, use web_search to find a current typical price and give a brief estimate — make clear it's a rough estimate from the web, not our own price. Be concise and friendly.",
      messages,
      tools: tools as Anthropic.Tool[],
    });
  }

  // Web search can produce multiple text segments interleaved with search blocks
  // (e.g. "Let me check..." then results), so join all of them rather than
  // taking just the first.
  const reply = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n");
  return NextResponse.json({ reply });
}
