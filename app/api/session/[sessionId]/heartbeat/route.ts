import { getSession } from "@/lib/session-manager"
import { saveSession as saveSessionToFile } from "@/lib/file-session-store"
import { saveSessionToKV, refreshSessionTTL } from "@/lib/kv-session-store"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const session = await getSession(sessionId)

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

    // KVのTTLを更新（より効率的）
    const kvRefreshed = await refreshSessionTTL(sessionId)
    if (kvRefreshed) {
      console.log(`[Heartbeat] KV TTL refreshed for session: ${sessionId}`)
    } else {
      // KVが利用できない場合は完全に保存し直す
      await saveSessionToKV(session)
      saveSessionToFile(session)
      console.log(`[Heartbeat] Session saved for: ${sessionId}`)
    }

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
