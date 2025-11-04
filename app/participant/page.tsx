"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"

interface SessionInfo {
  participantCount: number
  selectedPositions?: number[]
}

function ParticipantPageContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams?.get("sessionId") || ""
  const [name, setName] = useState("")
  const [position, setPosition] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)

  useEffect(() => {
    // リダイレクト処理
    if (participantId) {
      const timer = setTimeout(() => {
        window.location.href = `/participant/${sessionId}/${participantId}`
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [participantId, sessionId])

  useEffect(() => {
    // セッション情報を取得
    const fetchSessionInfo = async () => {
      try {
        const response = await fetch(`/api/session/${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          setSessionInfo(data)
        } else {
          setError("セッションが見つかりません")
        }
      } catch (err) {
        setError("セッション情報を取得できませんでした")
      } finally {
        setLoadingSession(false)
      }
    }

    if (sessionId) {
      fetchSessionInfo()
    } else {
      setLoadingSession(false)
    }
  }, [sessionId])

  const getErrorMessage = (errorCode: string): string => {
    const errorMessages: { [key: string]: string } = {
      POSITION_ALREADY_TAKEN: "この番号は選択済みです",
      INVALID_POSITION: "無効な番号です",
      PARTICIPANT_LIMIT_REACHED: "参加者数の上限に達しています",
      SESSION_NOT_FOUND: "セッションが見つかりません",
    }
    return errorMessages[errorCode] || "セッションへの参加に失敗しました"
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !sessionId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/session/${sessionId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          position: parseInt(position.toString()),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        const errorMessage = getErrorMessage(data.code)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setParticipantId(data.participantId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  if (!sessionId) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-100 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold text-red-600 mb-4">セッションが見つかりません</h1>
            <p className="text-gray-600 mb-6">有効なセッションIDを持つURLにアクセスしてください</p>
          </div>
        </div>
      </main>
    )
  }

  if (loadingSession) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-100 p-8">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </main>
    )
  }

  if (participantId) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-100 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
            <h2 className="text-2xl font-bold text-green-600 mb-4">結果ページへ進みます...</h2>
            <p className="text-gray-600">少々お待ちください</p>
          </div>
        </div>
      </main>
    )
  }

  const maxPosition = sessionInfo?.participantCount || 10

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">参加者として参加</h1>
          <p className="text-gray-600">セッションID: <span className="font-semibold">{sessionId}</span></p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleJoin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                名前
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="あなたの名前を入力してください"
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                始める番号を選択：<span className="text-3xl font-bold text-green-600">{position}</span>
              </label>
              <p className="text-xs text-gray-600 mb-3">1 ～ {maxPosition} の番号から選んでください</p>

              {/* ボタングリッド表示 */}
              <div className="grid grid-cols-5 gap-2 mb-6">
                {Array.from({ length: maxPosition }, (_, i) => i + 1).map((num) => {
                  const isSelected = sessionInfo?.selectedPositions?.includes(num) || false
                  const isCurrentlySelected = position === num

                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        if (!isSelected) {
                          setPosition(num)
                        }
                      }}
                      disabled={isSelected && !isCurrentlySelected}
                      className={`py-3 rounded font-semibold transition ${
                        isCurrentlySelected
                          ? "bg-green-600 text-white ring-2 ring-green-300"
                          : isSelected
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      title={isSelected && !isCurrentlySelected ? "この番号は既に選ばれています" : undefined}
                    >
                      {num}
                    </button>
                  )
                })}
              </div>

              {/* フォールバック用スライダー */}
              {maxPosition > 20 && (
                <>
                  <p className="text-xs text-gray-500 mb-2">または</p>
                  <input
                    type="range"
                    min="1"
                    max={maxPosition}
                    value={position}
                    onChange={(e) => setPosition(parseInt(e.target.value))}
                    className="w-full"
                  />
                </>
              )}
            </div>

            {error && (
              <div className="bg-red-100 text-red-700 p-4 rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full bg-green-600 text-white py-3 rounded font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "参加中..." : "参加する"}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

export default function ParticipantPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-100 p-8">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </main>
      }
    >
      <ParticipantPageContent />
    </Suspense>
  )
}
