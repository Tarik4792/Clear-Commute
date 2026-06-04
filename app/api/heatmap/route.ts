import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { transit, line, origin, dest } = await req.json();
    if (!line) return NextResponse.json({ error: "Missing line" }, { status: 400 });

    const prompt = `You are ClearCommute, an expert on MTA NYC subway crowd patterns.
    
Generate a weekly crowd heatmap for this route:
Transit: ${transit}
Line: ${line}
From: ${origin || "any station"}
To: ${dest || "any station"}

Return ONLY valid JSON, no markdown:
{
  "heatmap": {
    "Monday":    [<24 integers 0-100 for hours 0-23>],
    "Tuesday":   [<24 integers 0-100>],
    "Wednesday": [<24 integers 0-100>],
    "Thursday":  [<24 integers 0-100>],
    "Friday":    [<24 integers 0-100>],
    "Saturday":  [<24 integers 0-100>],
    "Sunday":    [<24 integers 0-100>]
  },
  "peakDay": "<day with highest overall crowding>",
  "peakHour": "<hour range with highest crowding e.g. 8-9 AM>",
  "lightestDay": "<day with lowest overall crowding>",
  "lightestHour": "<hour range with lowest crowding e.g. 10-11 AM>"
}

Base values on real NYC MTA ridership patterns for the ${line} line. Rush hours (8-9 AM, 5-6 PM) on weekdays should be high. Weekends lower overall. Overnight hours (1-5 AM) near 0.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Heatmap error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
