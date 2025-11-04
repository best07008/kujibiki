import { startSession, getSession } from "@/lib/session-manager"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    const success = startSession(sessionId)

    if (!success) {
      return NextResponse.json(
        { error: "Cannot start session. Not all participants are ready." },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error starting session:", error)
    return NextResponse.json(
      { error: "Failed to start session" },
      { status: 500 }
    )
  }
}
