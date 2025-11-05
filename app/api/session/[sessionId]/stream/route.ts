import { getSession, subscribe } from "@/lib/session-manager"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  console.log(`[Stream] EventSource requested for session: ${sessionId}`)

  const session = await getSession(sessionId)

  if (!session) {
    console.error(`[Stream] Session not found: ${sessionId}`)
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    )
  }

  console.log(`[Stream] Session found, starting EventSource for: ${sessionId}`)

  // Server-Sent Eventsのストリームをセットアップ
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // 初期状態を送信
      const initialData = {
        event: "session-state",
        data: {
          id: session.id,
          title: session.title,
          participantCount: session.participantCount,
          participants: Array.from(session.participants.values()).map((p) => ({
            id: p.id,
            name: p.name,
            position: p.position,
            ready: p.ready,
            result: p.result,
          })),
          started: session.started,
          selectedPositions: Array.from(session.selectedPositions),
        },
        timestamp: new Date().toISOString(),
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`))

      // 購読登録
      const unsubscribe = subscribe(sessionId, (message) => {
        controller.enqueue(encoder.encode(`data: ${message}\n\n`))
      })

      // キャンセルハンドラ
      const cleanup = () => {
        unsubscribe()
        controller.close()
      }

      // リクエストがキャンセルされた時
      request.signal.addEventListener("abort", cleanup)
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
