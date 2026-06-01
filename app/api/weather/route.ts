import { NextResponse } from "next/server";

const WMO_CODES: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy fog", 51: "Light drizzle", 53: "Drizzle",
  55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Light showers", 81: "Showers", 82: "Heavy showers",
  85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm",
};

export async function GET() {
  try {
    const url = "https://api.open-meteo.com/v1/forecast" +
      "?latitude=40.7128&longitude=-74.0060" +
      "&current=temperature_2m,precipitation,weathercode,windspeed_10m,apparent_temperature" +
      "&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch" +
      "&timezone=America%2FNew_York";

    const res = await fetch(url, { next: { revalidate: 900 } }); // cache 15min
    if (!res.ok) throw new Error(`Weather API returned ${res.status}`);

    const data = await res.json();
    const current = data.current;
    const code = current.weathercode;

    return NextResponse.json({
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      precipitation: current.precipitation,
      windspeed: Math.round(current.windspeed_10m),
      condition: WMO_CODES[code] || "Unknown",
      code,
      isRaining: [51,53,55,61,63,65,80,81,82].includes(code),
      isSnowing: [71,73,75,77,85,86].includes(code),
      isStormy: [95,96,99].includes(code),
      isClear: code <= 2,
    });
  } catch (err) {
    console.error("Weather error:", err);
    return NextResponse.json({ error: "Could not fetch weather" });
  }
}
