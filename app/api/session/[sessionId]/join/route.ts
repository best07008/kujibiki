import { joinSession, getSession } from "@/lib/session-manager"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const { name, position } = await request.json()

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Invalid name" },
        { status: 400 }
      )
    }

    if (typeof position !== "number" || position < 0) {
      return NextResponse.json(
        { error: "Invalid position" },
        { status: 400 }
      )
    }

    // セッションがメモリにない場合、KVから読み込む
    await getSession(sessionId)

    const result = joinSession(sessionId, name.trim(), position)

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to join session", code: result.code },
        { status: 400 }
      )
    }

    return NextResponse.json({ participantId: result.participantId })
  } catch (error) {
    console.error("Error joining session:", error)
    return NextResponse.json(
      { error: "Failed to join session" },
      { status: 500 }
    )
  }
}
