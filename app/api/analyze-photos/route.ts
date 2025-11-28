import { NextResponse } from "next/server";

export const maxDuration = 60; // Allow up to 60 seconds for analysis

export async function POST(req: Request) {
  try {
    const { thumbnails, prompt } = await req.json();

    if (!thumbnails || !Array.isArray(thumbnails)) {
      return NextResponse.json(
        { error: "Thumbnails array required" },
        { status: 400 }
      );
    }

    // Prepare content for GPT-4 Vision
    const content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } }
    > = [
      {
        type: "text",
        text: prompt || "Analyze these property photos and categorize them."
      }
    ];

    // Add all thumbnails
    for (const thumbnail of thumbnails) {
      content.push({
        type: "image_url",
        image_url: {
          url: thumbnail,
          detail: "low" // Use low detail for faster analysis
        }
      });
    }

    // Call OpenAI API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content
          }
        ],
        max_tokens: 2000
      })
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error("OpenAI API error:", error);
      return NextResponse.json(
        { error: "Photo analysis failed" },
        { status: 500 }
      );
    }

    const data = await openaiResponse.json();
    const responseText = data.choices[0].message.content;

    // Parse JSON response
    let analysis;
    try {
      // Remove markdown code blocks if present
      let cleanText = responseText.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      }
      analysis = JSON.parse(cleanText);
    } catch (parseError) {
      console.error("Failed to parse GPT response:", responseText);
      return NextResponse.json(
        { error: "Invalid response format from AI" },
        { status: 500 }
      );
    }

    return NextResponse.json({ analysis });

  } catch (error) {
    console.error("Error in photo analysis:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
