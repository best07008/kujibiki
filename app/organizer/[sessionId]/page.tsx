"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"

interface Participant {
  id: string
  name: string
  position: number
  ready: boolean
  result?: string
}

interface SessionState {
  id: string
  title: string
  participantCount: number
  started: boolean
  participants: Participant[]
}

// CSV 出力関数
const downloadCSV = (session: SessionState | null) => {
  if (!session) return

  // CSV ヘッダー
  const headers = ["名前", "位置", "結果"]

  // CSV データ行
  const rows = session.participants.map((p) => [
    p.name,
    p.position.toString(),
    p.result || "未割り当て",
  ])

  // CSV テキスト生成
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n")

  // BOM を追加（Excel で日本語が正しく表示される）
  const bom = "\uFEFF"
  const csvWithBom = bom + csvContent

  // ダウンロード
  const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `くじ結果_${session.id}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function OrganizerSessionPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const [session, setSession] = useState<SessionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startLoading, setStartLoading] = useState(false)

  const fetchSessionState = useCallback(async () => {
    try {
      const response = await fetch(`/api/session/${sessionId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch session")
      }
      const data = await response.json()
      setSession(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    let isMounted = true
    let eventSource: EventSource | null = null
    let heartbeatInterval: NodeJS.Timeout | null = null
    let reconnectAttempts = 0
    const maxReconnectAttempts = 5

    const sendHeartbeat = async () => {
      try {
        const response = await fetch(`/api/session/${sessionId}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
        if (!response.ok) {
          console.warn("Organizer heartbeat failed:", response.status)
        }
      } catch (err) {
        console.error("Organizer heartbeat error:", err)
      }
    }

    const setupEventSource = () => {
      eventSource = new EventSource(`/api/session/${sessionId}/stream`)

      eventSource.onmessage = (event) => {
        if (!isMounted) return
        const message = JSON.parse(event.data)

        if (message.event === "session-state") {
          setSession(message.data)
        } else if (message.event === "participant-joined") {
          setSession((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              participants: [...prev.participants, message.data.participant],
            }
          })
        } else if (message.event === "participant-ready") {
          setSession((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              participants: prev.participants.map((p) =>
                p.id === message.data.participantId ? { ...p, ready: true } : p
              ),
            }
          })
        } else if (message.event === "session-started") {
          console.log("[EventSource] session-started event received", message.data)
          setSession((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              started: true,
              participants: prev.participants.map((p) => ({
                ...p,
                result: message.data.results[p.id],
              })),
            }
          })
          // Reset loading state when session starts
          console.log("[EventSource] Setting startLoading to false")
          setStartLoading(false)
        }
      }

      eventSource.onerror = () => {
        console.error("EventSource error, attempting to reconnect...")
        if (eventSource) {
          eventSource.close()
          eventSource = null
        }

        if (isMounted && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000)
          console.log(`Organizer reconnecting EventSource in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`)
          setTimeout(() => {
            if (isMounted) setupEventSource()
          }, delay)
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.error("Max reconnect attempts reached")
          setError("セッションへの接続が失われました。ページをリロードしてください。")
        }
      }
    }

    const initializeSession = async () => {
      try {
        await fetchSessionState()
        if (isMounted) {
          reconnectAttempts = 0
          setupEventSource()

          // ハートビートを30秒ごとに送信してセッションを生存させる
          heartbeatInterval = setInterval(sendHeartbeat, 30000)
        }
      } catch (err) {
        console.error("Failed to initialize session:", err)
        if (isMounted) {
          setError("セッション情報の取得に失敗しました")
        }
      }
    }

    initializeSession()

    return () => {
      isMounted = false
      if (eventSource) eventSource.close()
      if (heartbeatInterval) clearInterval(heartbeatInterval)
    }
  }, [sessionId, fetchSessionState])

  const handleStartSession = async () => {
    console.log("[handleStartSession] Button clicked for session:", sessionId)
    console.log("[handleStartSession] Current startLoading state:", startLoading)

    if (startLoading) {
      console.log("[handleStartSession] Already loading, ignoring click")
      return
    }

    setStartLoading(true)
    setError(null)

    console.log("[handleStartSession] Starting session...")
    try {
      const response = await fetch(`/api/session/${sessionId}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      console.log("[handleStartSession] Response status:", response.status)
      const data = await response.json()
      console.log("[handleStartSession] Response data:", data)

      if (!response.ok) {
        console.log("[handleStartSession] Request failed")
        setStartLoading(false)
        setError(data.error || "Failed to start session")
        return
      }

      console.log("[handleStartSession] Request succeeded, waiting for EventSource event...")
      // Success - wait for EventSource to update session state
      // setStartLoading will remain true until session.started becomes true
    } catch (err) {
      console.error("[handleStartSession] Error:", err)
      setStartLoading(false)
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 p-8">
        <div className="text-center">
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 p-8">
        <div className="text-center">
          <p className="text-red-600">{error || "セッションが見つかりません"}</p>
        </div>
      </main>
    )
  }

  const allReady = session.participants.length === session.participantCount &&
    session.participants.every((p) => p.ready)

  console.log("[render] allReady:", allReady, "startLoading:", startLoading, "started:", session.started, "buttonDisabled:", !allReady || startLoading)

  const participantUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/participant?sessionId=${session.id}`
    : ''

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{session.title}</h1>
          <p className="text-gray-600">セッションID: {session.id}</p>
        </div>

        {/* 参加者シェアURL */}
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">参加者へシェア</h3>
          <p className="text-sm text-gray-600 mb-3">このURLを参加者に共有してください</p>
          <div className="bg-white p-4 rounded border border-blue-200 mb-4">
            <p className="text-sm font-mono text-blue-600 break-all">{participantUrl}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(participantUrl)
              alert("URLをコピーしました")
            }}
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition"
          >
            URLをコピー
          </button>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">参加者状況</h2>
              <p className="text-gray-600">
                {session.participants.length} / {session.participantCount} 人が参加
              </p>
            </div>
            {!session.started && (
              <button
                onClick={handleStartSession}
                disabled={!allReady || startLoading}
                className="px-6 py-3 bg-green-600 text-white rounded font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {startLoading ? "スタート中..." : "スタート"}
              </button>
            )}
          </div>

          {!allReady && !session.started && (
            <p className="text-amber-600 mb-4">全員が準備完了するまで待機中...</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {session.participants.map((participant) => (
              <div
                key={participant.id}
                className={`p-4 rounded border-2 ${
                  participant.ready
                    ? "bg-green-50 border-green-300"
                    : "bg-yellow-50 border-yellow-300"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">{participant.name}</p>
                    <p className="text-sm text-gray-600">位置: {participant.position}</p>
                  </div>
                  <div className="text-right">
                    {participant.ready ? (
                      <span className="inline-block px-3 py-1 bg-green-500 text-white text-sm rounded">
                        準備OK
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 bg-yellow-500 text-white text-sm rounded">
                        準備中
                      </span>
                    )}
                  </div>
                </div>
                {session.started && participant.result && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-sm text-gray-600">結果:</p>
                    <p className="text-3xl font-bold text-blue-600">{participant.result}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {session.started && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">最終結果</h2>
            <div className="text-center">
              <p className="text-gray-600 mb-8">すべての参加者にくじ結果が割り振られました</p>
              <div className="flex gap-4 justify-center mb-8">
                <button
                  onClick={() => downloadCSV(session)}
                  className="px-6 py-3 bg-green-600 text-white rounded font-semibold hover:bg-green-700 transition"
                >
                  CSV でダウンロード
                </button>
                <button
                  onClick={() => window.location.href = "/"}
                  className="px-6 py-3 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition"
                >
                  ホームに戻る
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
