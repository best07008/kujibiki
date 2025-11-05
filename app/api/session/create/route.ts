import { createSession } from "@/lib/session-manager"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { participantCount, title } = await request.json()

    if (!participantCount || participantCount < 1 || participantCount > 100) {
      return NextResponse.json(
        { error: "Invalid participant count" },
        { status: 400 }
      )
    }

    const sessionId = createSession(participantCount, title || "")
    return NextResponse.json({ sessionId })
  } catch (error) {
    console.error("Error creating session:", error)
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    )
  }
}
