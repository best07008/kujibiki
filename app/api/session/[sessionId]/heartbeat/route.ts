import { getSession } from "@/lib/session-manager"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const session = getSession(sessionId)

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      )
    }

    // セッションの updatedAt を更新してクリーンアップ対象から除外
    session.updatedAt = new Date()

    return NextResponse.json({
      success: true,
      sessionId,
      timestamp: session.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error("Error in heartbeat:", error)
    return NextResponse.json(
      { error: "Failed to process heartbeat" },
      { status: 500 }
    )
  }
}
