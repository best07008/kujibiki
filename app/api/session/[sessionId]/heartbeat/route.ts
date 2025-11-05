import { getSession } from "@/lib/session-manager"
import { saveSession } from "@/lib/file-session-store"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const session = getSession(sessionId)

    if (!session) {
      // セッションが見つからない場合も 200 OK で返す（クライアントに404で再試行させない）
      console.warn(`[Heartbeat] Session not found: ${sessionId}`)
      return NextResponse.json({
        success: false,
        sessionId,
        message: "Session not found",
      })
    }

    // セッションの updatedAt を更新してクリーンアップ対象から除外
    session.updatedAt = new Date()
    saveSession(session)

    return NextResponse.json({
      success: true,
      sessionId,
      timestamp: session.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error("Error in heartbeat:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to process heartbeat",
    })
  }
}
