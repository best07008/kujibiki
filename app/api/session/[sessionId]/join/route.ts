import { joinSession } from "@/lib/session-manager"
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

    // joinSession内部でKVから最新の状態を読み込むようになったので、ここでの事前読み込みは不要
    const result = await joinSession(sessionId, name.trim(), position)

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
