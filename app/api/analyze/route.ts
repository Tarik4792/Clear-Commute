import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transit, line, origin, dest, time, day, purpose } = body;

    if (!transit || !line || !time || !day) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const transitLabel: Record<string, string> = {
      subway: "NYC Subway",
      bus: "MTA Bus",
      lirr: "LIRR",
      mnr: "Metro-North",
      sir: "Staten Island Railway",
      path: "PATH Train",
    };

    const prompt = `You are ClearCommute, an expert on MTA transit crowd patterns in NYC/NJ. Analyze this commute and respond ONLY with valid JSON, no markdown, no extra text.

Transit: ${transitLabel[transit] || transit}
Line: ${line}
From: ${origin || "origin station"}
To: ${dest || "destination"}
Depart: ${time} on ${day}
Purpose: ${purpose}

Return exactly this JSON structure with real values:
{
  "crowdScore": <integer 0-100>,
  "crowdLabel": "<Light|Moderate|Busy|Very Crowded>",
  "estimatedDuration": "<e.g. 28 min>",
  "estimatedWait": "<e.g. 4 min>",
  "aiSummary": "<2 sentences about crowd situation and best strategy for this specific route>",
  "timeline": [
    {"time": "<HH:MM>", "crowd": <0-100>},
    {"time": "<HH:MM>", "crowd": <0-100>},
    {"time": "<HH:MM>", "crowd": <0-100>},
    {"time": "<HH:MM>", "crowd": <0-100>},
    {"time": "<HH:MM>", "crowd": <0-100>},
    {"time": "<HH:MM>", "crowd": <0-100>},
    {"time": "<HH:MM>", "crowd": <0-100>}
  ],
  "departureSuggestions": [
    {"time": "<HH:MM>", "crowd": <0-100>, "tag": "best"},
    {"time": "<HH:MM>", "crowd": <0-100>, "tag": "ok"},
    {"time": "<HH:MM>", "crowd": <0-100>, "tag": "busy"}
  ],
  "tips": [
    {"icon": "train", "tip": "<specific tip about this exact route>", "detail": "<supporting detail>"},
    {"icon": "clock", "tip": "<timing insight for this line>", "detail": "<supporting detail>"},
    {"icon": "map-pin", "tip": "<platform or car boarding tip>", "detail": "<supporting detail>"}
  ]
}

Base all values on real MTA patterns for this specific line, time, and day. The timeline should cover a 2-hour window around the departure time. Make tips highly specific to this route.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Analyze error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
