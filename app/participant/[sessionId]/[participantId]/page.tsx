"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

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

export default function ParticipantSessionPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const participantId = params.participantId as string

  const [session, setSession] = useState<SessionState | null>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingReady, setMarkingReady] = useState(false)
  const [autoReadyDone, setAutoReadyDone] = useState(false)

  const fetchSessionState = useCallback(async () => {
    try {
      const response = await fetch(`/api/session/${sessionId}`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("セッションが見つかりません。セッションIDを確認してください。")
        } else if (response.status === 500) {
          throw new Error("サーバーエラーが発生しました。しばらく待ってからリロードしてください。")
        } else {
          throw new Error(`セッション取得エラー (ステータス: ${response.status})`)
        }
      }
      const data = await response.json()
      setSession(data)
      const p = data.participants.find((p: Participant) => p.id === participantId)
      if (!p) {
        throw new Error("あなたの参加者情報が見つかりません。")
      }
      setParticipant(p)
      if (p) setReady(p.ready)
      setError(null)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "不明なエラーが発生しました"
      setError(errorMsg)
      console.error("Fetch session state error:", errorMsg)
    } finally {
      setLoading(false)
    }
  }, [sessionId, participantId])

  useEffect(() => {
    let isMounted = true
    let eventSource: EventSource | null = null
    let reconnectAttempts = 0
    const maxReconnectAttempts = 5
    let heartbeatInterval: NodeJS.Timeout | null = null

    const sendHeartbeat = async () => {
      try {
        const response = await fetch(`/api/session/${sessionId}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
        if (!response.ok) {
          console.warn("Heartbeat failed:", response.status)
        }
      } catch (err) {
        console.error("Heartbeat error:", err)
      }
    }

    const setupEventSource = () => {
      eventSource = new EventSource(`/api/session/${sessionId}/stream`)

      eventSource.onmessage = (event) => {
        if (!isMounted) return
        const message = JSON.parse(event.data)

        if (message.event === "session-state") {
          setSession(message.data)
          const p = message.data.participants.find(
            (p: Participant) => p.id === participantId
          )
          setParticipant(p)
          if (p) setReady(p.ready)
        } else if (message.event === "session-started") {
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
        } else if (message.event === "participant-ready") {
          if (message.data.participantId === participantId) {
            setReady(true)
            setParticipant((prev) =>
              prev ? { ...prev, ready: true } : prev
            )
          }
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
          console.log(`Reconnecting EventSource in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`)
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
  }, [sessionId, participantId, fetchSessionState])


  const handleMarkReady = async () => {
    if (ready) return

    setMarkingReady(true)
    try {
      const response = await fetch(`/api/session/${sessionId}/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        if (response.status === 404) {
          throw new Error("セッションが見つかりません。")
        } else if (response.status === 400) {
          throw new Error(data.error || "準備完了の処理に失敗しました。")
        } else if (response.status === 500) {
          throw new Error("サーバーエラーが発生しました。")
        } else {
          throw new Error(`準備完了エラー (ステータス: ${response.status})`)
        }
      }
      setError(null)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "準備完了に失敗しました"
      setError(errorMsg)
      console.error("Mark ready error:", errorMsg)
    } finally {
      setMarkingReady(false)
    }
  }

  // ページロード完了時に自動的に準備完了にする
  useEffect(() => {
    const markReady = async () => {
      if (!loading && !ready && !autoReadyDone && !markingReady) {
        setAutoReadyDone(true)
        setMarkingReady(true)
        try {
          console.log(`[AutoReady] Marking ready for participant ${participantId} in session ${sessionId}`)
          const response = await fetch(`/api/session/${sessionId}/ready`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ participantId }),
          })

          console.log(`[AutoReady] Response status: ${response.status}`)

          if (response.ok) {
            setReady(true)
            console.log(`[AutoReady] Successfully marked ready`)
          } else {
            const errorData = await response.json().catch(() => ({}))
            console.error(`[AutoReady] Error response (${response.status}):`, errorData)
            // Retry after 2 seconds (don't show error to user)
            setTimeout(() => {
              setAutoReadyDone(false)
              setMarkingReady(false)
            }, 2000)
          }
        } catch (err) {
          console.error(`[AutoReady] Catch error:`, err)
          // Retry after 2 seconds (don't show error to user)
          setTimeout(() => {
            setAutoReadyDone(false)
            setMarkingReady(false)
          }, 2000)
        } finally {
          setMarkingReady(false)
        }
      }
    }

    markReady()
  }, [loading, ready, autoReadyDone, sessionId, participantId, markingReady])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-100 p-8">
        <div className="text-center">
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </main>
    )
  }

  const handleRetry = async () => {
    setError(null)
    setLoading(true)
    await fetchSessionState()
  }

  if (!participant || !session) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-100 p-8">
        <div className="text-center">
          <p className="text-red-600 mb-4 text-lg font-semibold">セッションエラー</p>
          <p className="text-gray-700 mb-6">{error || "参加者情報が見つかりません"}</p>
          <button
            onClick={handleRetry}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
          >
            リトライ
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{session.title}</h1>
          <p className="text-gray-600">ようこそ、{participant.name}さん</p>
        </div>

        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-700 p-4 rounded mb-6">
            <p className="font-semibold mb-2">エラーが発生しました</p>
            <p className="mb-4">{error}</p>
            <button
              onClick={handleRetry}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
            >
              リトライ
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">あなたの情報</p>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded">
              <p className="text-xl font-semibold text-gray-900">{participant.name}</p>
              <p className="text-sm text-gray-600 mt-2">位置: {participant.position}</p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">セッション状況</p>
            <p className="text-lg font-semibold text-gray-900">
              {session.participants.length} / {session.participantCount} 人が参加中
            </p>
          </div>

          {!session.started && !ready && (
            <button
              onClick={handleMarkReady}
              disabled={markingReady}
              className="w-full bg-green-600 text-white py-3 rounded font-semibold hover:bg-green-700 transition disabled:opacity-50"
            >
              {markingReady ? "準備中..." : "準備完了"}
            </button>
          )}

          {ready && !session.started && (
            <div className="bg-green-100 text-green-700 p-4 rounded font-semibold text-center">
              準備完了！開催者がスタートするのを待っています...
            </div>
          )}

          {session.started && participant.result && (
            <div className="text-center">
              <p className="text-gray-600 mb-4">あなたのくじ結果</p>
              <div className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white rounded-lg p-12">
                <p className="text-8xl font-bold mb-4">{participant.result}</p>
                <p className="text-xl">あなたの番号です</p>
              </div>
            </div>
          )}
        </div>

        {session.started && (
          <div className="text-center">
            <Link href="/" className="text-blue-600 hover:underline">
              ホームに戻る
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
