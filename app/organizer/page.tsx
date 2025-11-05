"use client"

import { useState } from "react"
import Link from "next/link"

export default function OrganizerPage() {
  const [participantCount, setParticipantCount] = useState(10)
  const [title, setTitle] = useState("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const handleCreateSession = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantCount, title }),
      })

      if (!response.ok) {
        throw new Error("Failed to create session")
      }

      const data = await response.json()
      const newSessionId = data.sessionId
      setSessionId(newSessionId)

      // シェアURL生成
      const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
      setShareUrl(`${baseUrl}/participant?sessionId=${newSessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  const handleCopyUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      alert("URLをコピーしました")
    }
  }

  if (sessionId) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">開催者</h1>
            <p className="text-gray-600">セッションID: {sessionId}</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4">参加者へシェア</h2>
            <div className="bg-gray-100 p-4 rounded mb-4 break-all">
              <p className="text-sm text-gray-600 mb-2">このURLを参加者に共有してください：</p>
              <p className="font-mono text-sm">{shareUrl}</p>
            </div>
            <button
              onClick={handleCopyUrl}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
            >
              URLをコピー
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">参加者情報</h2>
            <p className="text-gray-600 mb-4">参加者が準備できるのを待っています...</p>
            <Link
              href={`/organizer/${sessionId}`}
              className="inline-block px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              開催者ページへ進む
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">開催者として始める</h1>
          <p className="text-gray-600">参加者数を設定してセッションを作成してください</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              タイトル（任意）
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：1日目、朝の部、マルシェA枠"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-600 mt-1">くじびきを識別しやすくするためのタイトルを入力できます</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              参加者数: <span className="text-2xl font-bold text-blue-600">{participantCount}</span>
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={participantCount}
              onChange={(e) => setParticipantCount(parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-sm text-gray-600 mt-2">1〜100人まで設定できます</p>
          </div>

          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded mb-6">
              {error}
            </div>
          )}

          <button
            onClick={handleCreateSession}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "作成中..." : "セッション作成"}
          </button>

          <Link
            href="/"
            className="block text-center mt-4 text-gray-600 hover:text-gray-900"
          >
            戻る
          </Link>
        </div>
      </div>
    </main>
  )
}
