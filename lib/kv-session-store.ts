import { Session } from "./session-manager"

// Vercel KVのインポート（環境に応じて利用可能かチェック）
let kv: any = null
try {
  // 動的インポートでKVを読み込む（本番環境でのみ利用可能）
  const kvModule = require("@vercel/kv")
  kv = kvModule.kv
} catch (error) {
  console.log("[KVSessionStore] Vercel KV not available, using fallback")
}

const SESSION_PREFIX = "session:"
const SESSION_TTL = 7200 // 2時間（秒単位）

/**
 * KVにセッションを保存
 */
export async function saveSessionToKV(session: Session): Promise<boolean> {
  if (!kv) return false

  try {
    const data = {
      id: session.id,
      participantCount: session.participantCount,
      participants: Array.from(session.participants.entries()),
      started: session.started,
      results: Array.from(session.results.entries()),
      selectedPositions: Array.from(session.selectedPositions),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }

    // Vercel KVは自動的にJSONシリアライズするため、JSON.stringify()不要
    await kv.set(`${SESSION_PREFIX}${session.id}`, data, {
      ex: SESSION_TTL,
    })

    console.log(`[KVSessionStore] Saved session to KV: ${session.id}`)
    return true
  } catch (error) {
    console.error(`[KVSessionStore] Error saving session ${session.id}:`, error)
    return false
  }
}

/**
 * KVからセッションを読み込み
 */
export async function loadSessionFromKV(sessionId: string): Promise<Session | null> {
  if (!kv) return null

  try {
    // Vercel KVは自動的にJSONデシリアライズするため、JSON.parse()不要
    const data = await kv.get(`${SESSION_PREFIX}${sessionId}`)
    if (!data) {
      console.log(`[KVSessionStore] Session not found in KV: ${sessionId}`)
      return null
    }

    const session: Session = {
      id: data.id,
      participantCount: data.participantCount,
      participants: new Map(data.participants),
      started: data.started,
      results: new Map(data.results),
      selectedPositions: new Set(data.selectedPositions),
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    }

    console.log(`[KVSessionStore] Loaded session from KV: ${sessionId}`)
    return session
  } catch (error) {
    console.error(`[KVSessionStore] Error loading session ${sessionId}:`, error)
    return null
  }
}

/**
 * KVからセッションを削除
 */
export async function deleteSessionFromKV(sessionId: string): Promise<boolean> {
  if (!kv) return false

  try {
    await kv.del(`${SESSION_PREFIX}${sessionId}`)
    console.log(`[KVSessionStore] Deleted session from KV: ${sessionId}`)
    return true
  } catch (error) {
    console.error(`[KVSessionStore] Error deleting session ${sessionId}:`, error)
    return false
  }
}

/**
 * KVのセッションのTTLを更新（ハートビート用）
 */
export async function refreshSessionTTL(sessionId: string): Promise<boolean> {
  if (!kv) return false

  try {
    const dataStr = await kv.get(`${SESSION_PREFIX}${sessionId}`)
    if (!dataStr) return false

    // TTLをリフレッシュ
    await kv.expire(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL)
    console.log(`[KVSessionStore] Refreshed TTL for session: ${sessionId}`)
    return true
  } catch (error) {
    console.error(`[KVSessionStore] Error refreshing TTL for ${sessionId}:`, error)
    return false
  }
}

/**
 * KVが利用可能かチェック
 */
export function isKVAvailable(): boolean {
  return kv !== null
}

/**
 * すべてのセッションキーを取得（クリーンアップ用）
 * 注意: KVにはscanコマンドがないため、個別に管理が必要
 */
export async function getAllSessionKeys(): Promise<string[]> {
  if (!kv) return []

  try {
    // Vercel KVはRedisベースだが、scanコマンドが制限されている場合がある
    // そのため、別途セッションIDリストをKVで管理する方法を推奨
    const sessionList = await kv.get("session_list")
    return sessionList ? JSON.parse(sessionList as string) : []
  } catch (error) {
    console.error("[KVSessionStore] Error getting session keys:", error)
    return []
  }
}

/**
 * セッションリストにセッションIDを追加
 */
export async function addSessionToList(sessionId: string): Promise<void> {
  if (!kv) return

  try {
    const sessionList = await getAllSessionKeys()
    if (!sessionList.includes(sessionId)) {
      sessionList.push(sessionId)
      await kv.set("session_list", JSON.stringify(sessionList))
    }
  } catch (error) {
    console.error("[KVSessionStore] Error adding session to list:", error)
  }
}

/**
 * セッションリストからセッションIDを削除
 */
export async function removeSessionFromList(sessionId: string): Promise<void> {
  if (!kv) return

  try {
    const sessionList = await getAllSessionKeys()
    const filtered = sessionList.filter((id) => id !== sessionId)
    await kv.set("session_list", JSON.stringify(filtered))
  } catch (error) {
    console.error("[KVSessionStore] Error removing session from list:", error)
  }
}
