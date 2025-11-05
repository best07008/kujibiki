import { markParticipantReady } from "@/lib/session-manager"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const { participantId } = await request.json()

    if (!participantId) {
      return NextResponse.json(
        { error: "Missing participantId" },
        { status: 400 }
      )
    }

    const success = await markParticipantReady(sessionId, participantId)

    if (!success) {
      return NextResponse.json(
        { error: "Failed to mark as ready" },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error marking participant as ready:", error)
    return NextResponse.json(
      { error: "Failed to mark as ready" },
      { status: 500 }
    )
  }
}
