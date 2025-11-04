import { getSession } from "@/lib/session-manager"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  console.log(`[GetSession API] Fetching session: ${sessionId}`)

  const session = await getSession(sessionId)
  console.log(`[GetSession API] Session found:`, !!session)

  if (!session) {
    console.log(`[GetSession API] Session not found for ID: ${sessionId}`)
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    )
  }

  return NextResponse.json({
    id: session.id,
    participantCount: session.participantCount,
    started: session.started,
    participants: Array.from(session.participants.values()).map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      ready: p.ready,
      result: p.result,
    })),
    selectedPositions: Array.from(session.selectedPositions),
    results: session.started ? Object.fromEntries(session.results) : null,
  })
}
