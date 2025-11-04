"use client"

import { useEffect, useState } from "react"
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

  useEffect(() => {
    let isMounted = true
    let eventSource: EventSource | null = null

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
        console.error("EventSource error")
        if (eventSource) eventSource.close()
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchSessionState().then(() => {
      if (isMounted) {
        setupEventSource()
      }
    })

    return () => {
      isMounted = false
      if (eventSource) eventSource.close()
    }
  }, [sessionId, participantId])

  const fetchSessionState = async () => {
    try {
      const response = await fetch(`/api/session/${sessionId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch session")
      }
      const data = await response.json()
      setSession(data)
      const p = data.participants.find((p: Participant) => p.id === participantId)
      setParticipant(p)
      if (p) setReady(p.ready)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

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
        throw new Error("Failed to mark as ready")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setMarkingReady(false)
    }
  }

  // Auto mark ready removed - user must click button manually
  // This allows better error handling and user control

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-100 p-8">
        <div className="text-center">
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </main>
    )
  }

  if (!participant || !session) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-100 p-8">
        <div className="text-center">
          <p className="text-red-600">{error || "参加者情報が見つかりません"}</p>
          <Link href="/" className="text-blue-600 hover:underline mt-4">
            ホームに戻る
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">参加者ページ</h1>
          <p className="text-gray-600">ようこそ、{participant.name}さん</p>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded mb-6">
            {error}
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
              準備完了！司会者がスタートするのを待っています...
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
