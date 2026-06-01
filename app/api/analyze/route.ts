import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transit, line, origin, dest, time, day, purpose, weather } = body;

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

CURRENT WEATHER IN NYC: ${weather ? `${weather.temperature}°F, ${weather.condition}, precipitation: ${weather.precipitation}in` : 'Unknown'}
${weather?.isRaining ? 'NOTE: It is currently raining — expect 15-25% higher ridership as people avoid walking.' : ''}
${weather?.isSnowing ? 'NOTE: It is snowing — expect 20-35% higher ridership and significant delays.' : ''}
${weather?.isStormy ? 'NOTE: There is a thunderstorm — expect severe crowding and possible service disruptions.' : ''}
${weather?.temperature < 20 ? 'NOTE: Extreme cold — expect higher ridership as people avoid walking.' : ''}
${weather?.temperature > 90 ? 'NOTE: Extreme heat — expect higher ridership as people seek air conditioning.' : ''}

CURRENT WEATHER IN NYC: ${weather ? `${weather.temperature}°F, ${weather.condition}, precipitation: ${weather.precipitation}in` : 'Unknown'}
${weather?.isRaining ? 'NOTE: It is currently raining — expect 15-25% higher ridership as people avoid walking.' : ''}
${weather?.isSnowing ? 'NOTE: It is snowing — expect 20-35% higher ridership and significant delays.' : ''}
${weather?.isStormy ? 'NOTE: There is a thunderstorm — expect severe crowding and possible service disruptions.' : ''}
${weather?.temperature < 20 ? 'NOTE: Extreme cold — expect higher ridership as people avoid walking.' : ''}
${weather?.temperature > 90 ? 'NOTE: Extreme heat — expect higher ridership as people seek air conditioning.' : ''}

IMPORTANT: All times in your response must use 12-hour format with AM/PM (e.g. "4:30 PM", "8:15 AM"). Never use 24-hour military time.

Return exactly this JSON structure with real values:
{
  "crowdScore": 75,
  "crowdLabel": "Busy",
  "estimatedDuration": "28 min",
  "estimatedWait": "4 min",
  "aiSummary": "Two sentences about crowd situation and best strategy for this specific route.",
  "timeline": [
    {"time": "4:00 PM", "crowd": 60},
    {"time": "4:30 PM", "crowd": 75},
    {"time": "5:00 PM", "crowd": 85},
    {"time": "5:30 PM", "crowd": 90},
    {"time": "6:00 PM", "crowd": 80},
    {"time": "6:30 PM", "crowd": 60},
    {"time": "7:00 PM", "crowd": 40}
  ],
  "departureSuggestions": [
    {"time": "4:15 PM", "crowd": 55},
    {"time": "5:00 PM", "crowd": 85},
    {"time": "6:45 PM", "crowd": 45}
  ],
  "tips": [
    {"icon": "train", "tip": "Specific tip about this exact route", "detail": "Supporting detail"},
    {"icon": "clock", "tip": "Timing insight for this line", "detail": "Supporting detail"},
    {"icon": "map-pin", "tip": "Platform or car boarding tip", "detail": "Supporting detail"}
  ]
}

Fill in real values based on actual MTA patterns for this specific line, time, and day. The timeline should cover a 2-hour window around the departure time. Make tips highly specific to this route. Remember: 12-hour time only.`;

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

    // Sort by crowd score so lowest is always first (best option)
    if (data.departureSuggestions) {
      data.departureSuggestions.sort((a: { crowd: number }, b: { crowd: number }) => a.crowd - b.crowd);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Analyze error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
