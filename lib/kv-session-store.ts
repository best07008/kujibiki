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
  if (!kv) {
    console.log(`[KVSessionStore] KV is not available (kv is null)`)
    return false
  }

  try {
    // 楽観的ロック: 保存前に現在のversionをチェック
    const currentData = await kv.get(`${SESSION_PREFIX}${session.id}`)

    if (currentData) {
      // セッションが既に存在する場合、versionをチェック
      if (currentData.version !== session.version) {
        console.warn(`[KVSessionStore] Version conflict for session ${session.id}: expected ${session.version}, got ${currentData.version}`)
        return false // 競合検出
      }
    }

    // versionをインクリメント
    const newVersion = session.version + 1

    const data = {
      id: session.id,
      participantCount: session.participantCount,
      participants: Array.from(session.participants.entries()),
      started: session.started,
      results: Array.from(session.results.entries()),
      selectedPositions: Array.from(session.selectedPositions),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      version: newVersion,
    }

    console.log(`[KVSessionStore] Saving session to KV: ${session.id}, participants: ${data.participants.length}, version: ${session.version} -> ${newVersion}`)

    // Vercel KVは自動的にJSONシリアライズするため、JSON.stringify()不要
    await kv.set(`${SESSION_PREFIX}${session.id}`, data, {
      ex: SESSION_TTL,
    })

    console.log(`[KVSessionStore] Successfully saved session to KV: ${session.id}`)
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
  if (!kv) {
    console.log(`[KVSessionStore] KV is not available for load (kv is null)`)
    return null
  }

  try {
    console.log(`[KVSessionStore] Loading session from KV: ${sessionId}`)
    // Vercel KVは自動的にJSONデシリアライズするため、JSON.parse()不要
    const data = await kv.get(`${SESSION_PREFIX}${sessionId}`)
    if (!data) {
      console.log(`[KVSessionStore] Session not found in KV: ${sessionId}`)
      return null
    }

    console.log(`[KVSessionStore] Raw data from KV for ${sessionId}: participants count: ${data.participants?.length || 0}`)

    const session: Session = {
      id: data.id,
      participantCount: data.participantCount,
      participants: new Map(data.participants),
      started: data.started,
      results: new Map(data.results),
      selectedPositions: new Set(data.selectedPositions),
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      version: data.version || 0, // 既存のセッションにversionがない場合は0
    }

    console.log(`[KVSessionStore] Loaded session from KV: ${sessionId}, participants: ${session.participants.size}, selectedPositions: ${Array.from(session.selectedPositions).join(',')}`)
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
    // Vercel KVは配列も自動的にデシリアライズするため、JSON.parse()不要
    const sessionList = await kv.get("session_list")
    return sessionList || []
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
      // Vercel KVは配列も自動的にシリアライズするため、JSON.stringify()不要
      await kv.set("session_list", sessionList)
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
    // Vercel KVは配列も自動的にシリアライズするため、JSON.stringify()不要
    await kv.set("session_list", filtered)
  } catch (error) {
    console.error("[KVSessionStore] Error removing session from list:", error)
  }
}
