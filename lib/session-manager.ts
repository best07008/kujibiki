import { getSessions, getSubscribers } from "./sessions"
import { saveSession as saveSessionToFile, loadSession as loadSessionFromFile, cleanupExpiredSessions } from "./file-session-store"
import {
  saveSessionToKV,
  loadSessionFromKV,
  deleteSessionFromKV,
  addSessionToList,
} from "./kv-session-store"

export interface Participant {
  id: string
  name: string
  position: number
  ready: boolean
  result?: string
}

export interface Session {
  id: string
  participantCount: number
  participants: Map<string, Participant>
  started: boolean
  results: Map<string, string>
  selectedPositions: Set<number> // 選ばれた番号を追跡
  createdAt: Date
  updatedAt: Date
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function generateParticipantId(): string {
  return Math.random().toString(36).substring(2, 10)
}

export function createSession(participantCount: number): string {
  const sessions = getSessions()
  const subscribers = getSubscribers()

  const sessionId = generateSessionId()
  const session: Session = {
    id: sessionId,
    participantCount,
    participants: new Map(),
    started: false,
    results: new Map(),
    selectedPositions: new Set(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  sessions.set(sessionId, session)
  subscribers.set(sessionId, new Set())

  // KVとファイルの両方に保存（フォールバック用）
  saveSession(session)

  console.log(`[SessionManager] Created session: ${sessionId}`)
  return sessionId
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const sessions = getSessions()
  const subscribers = getSubscribers()

  // まずメモリから取得
  let session = sessions.get(sessionId)
  if (session) {
    return session
  }

  // メモリにない場合、KVから読み込む
  console.log(`[SessionManager] Loading session from KV: ${sessionId}`)
  session = await loadSessionFromKV(sessionId)

  // KVにもない場合、ファイルから読み込む（フォールバック）
  if (!session) {
    console.log(`[SessionManager] Loading session from file: ${sessionId}`)
    session = loadSessionFromFile(sessionId)
  }

  if (session) {
    // メモリにキャッシュ
    sessions.set(sessionId, session)
    console.log(`[SessionManager] Session loaded and cached: ${sessionId}, participants: ${session.participants.size}, selectedPositions: ${Array.from(session.selectedPositions).join(',')}`)

    // サブスクライバーセットも確実に作成
    if (!subscribers.has(sessionId)) {
      subscribers.set(sessionId, new Set())
      console.log(`[SessionManager] Subscriber set created for session: ${sessionId}`)
    }
  } else {
    console.log(`[SessionManager] Session not found: ${sessionId}`)
  }

  return session || null
}

// 同期版のgetSession（後方互換性のため）
export function getSessionSync(sessionId: string): Session | null {
  const sessions = getSessions()
  return sessions.get(sessionId) || null
}

// セッション保存のヘルパー関数（非同期）
async function saveSessionAsync(session: Session): Promise<void> {
  console.log(`[SessionManager] saveSessionAsync called - sessionId: ${session.id}, participants: ${session.participants.size}`)
  try {
    // KVに保存を試みる
    const kvSaved = await saveSessionToKV(session)
    if (kvSaved) {
      await addSessionToList(session.id)
      console.log(`[SessionManager] Session saved to KV successfully: ${session.id}, participants: ${session.participants.size}`)
    } else {
      console.warn(`[SessionManager] KV save failed or unavailable for session: ${session.id}, falling back to file storage`)
    }
    // フォールバックとしてファイルにも保存
    saveSessionToFile(session)
  } catch (error) {
    console.error(`[SessionManager] Error in saveSessionAsync for session ${session.id}:`, error)
    // エラーが発生してもファイルには保存を試みる
    saveSessionToFile(session)
  }
}

// セッション保存の同期ラッパー（fire and forget）
function saveSession(session: Session): void {
  saveSessionAsync(session).catch((error) => {
    console.error(`[SessionManager] Background save failed:`, error)
  })
}


export async function joinSession(sessionId: string, name: string, position: number): Promise<{ success: false; code: string } | { success: true; participantId: string }> {
  // 常にKVから最新の状態を読み込む（競合状態を防ぐ）
  const session = await getSession(sessionId)
  console.log(`[SessionManager] Join attempt - sessionId: ${sessionId}, exists: ${!!session}, position: ${position}`)

  if (session) {
    console.log(`[SessionManager] Session loaded - participants: ${session.participants.size}, selectedPositions: ${Array.from(session.selectedPositions).join(',')}`)
  }

  if (!session || session.started) {
    console.log(`[SessionManager] Join failed - session not found or already started`)
    return { success: false, code: "SESSION_NOT_FOUND" }
  }

  // 参加者数の上限チェック
  if (session.participants.size >= session.participantCount) {
    console.log(`[SessionManager] Join failed - participant limit reached (${session.participantCount})`)
    return { success: false, code: "PARTICIPANT_LIMIT_REACHED" }
  }

  // 番号の範囲と整数チェック（1..participantCount）
  if (!Number.isInteger(position) || position < 1 || position > session.participantCount) {
    console.log(`[SessionManager] Join failed - position ${position} out of range`)
    return { success: false, code: "INVALID_POSITION" }
  }

  // 番号が既に選ばれている場合はエラー
  if (session.selectedPositions.has(position)) {
    console.log(`[SessionManager] Join failed - position ${position} already selected`)
    return { success: false, code: "POSITION_ALREADY_TAKEN" }
  }

  const participantId = generateParticipantId()
  const participant: Participant = {
    id: participantId,
    name,
    position,
    ready: false,
  }

  session.participants.set(participantId, participant)
  session.selectedPositions.add(position) // 番号を追跡
  session.updatedAt = new Date()

  console.log(`[SessionManager] Before save - sessionId: ${sessionId}, participants: ${session.participants.size}, selectedPositions: ${Array.from(session.selectedPositions).join(',')}`)

  // すぐにKVに保存して競合を最小化
  await saveSessionAsync(session)
  console.log(`[SessionManager] Participant joined and saved - sessionId: ${sessionId}, participantId: ${participantId}, name: ${name}, position: ${position}, total participants: ${session.participants.size}`)

  notifySubscribers(sessionId, "participant-joined", {
    participantId,
    participant,
  })

  return { success: true, participantId }
}

export async function markParticipantReady(sessionId: string, participantId: string): Promise<boolean> {
  // 常にKVから最新の状態を読み込む
  const session = await getSession(sessionId)
  if (!session) return false

  const participant = session.participants.get(participantId)
  if (!participant) return false

  participant.ready = true
  session.updatedAt = new Date()
  await saveSessionAsync(session)

  notifySubscribers(sessionId, "participant-ready", {
    participantId,
  })

  return true
}

export async function areAllParticipantsReady(sessionId: string): Promise<boolean> {
  const session = await getSession(sessionId)
  if (!session) return false

  if (session.participants.size !== session.participantCount) {
    return false
  }

  return (Array.from(session.participants.values()) as Participant[]).every((p) => p.ready)
}

export async function startSession(sessionId: string): Promise<boolean> {
  const session = await getSession(sessionId)
  if (!session || session.started) return false

  if (!(await areAllParticipantsReady(sessionId))) {
    return false
  }

  session.started = true
  session.updatedAt = new Date()

  // ランダムにくじ結果を割り振る
  const labels = generateLabels(session.participantCount)
  const shuffledLabels = shuffleArray([...labels])
  const participants = Array.from(session.participants.values()) as Participant[]

  participants.forEach((participant, index) => {
    const result = shuffledLabels[index]
    session.results.set(participant.id, result)
    participant.result = result
  })

  await saveSessionAsync(session)

  notifySubscribers(sessionId, "session-started", {
    results: Object.fromEntries(session.results),
  })

  return true
}

export function subscribe(sessionId: string, callback: (data: string) => void): () => void {
  const subscribers = getSubscribers()

  const subs = subscribers.get(sessionId)
  if (!subs) return () => {}

  subs.add(callback)

  return () => {
    subs.delete(callback)
  }
}

function notifySubscribers(sessionId: string, event: string, data: unknown): void {
  const subscribers = getSubscribers()

  const subs = subscribers.get(sessionId)
  if (!subs) return

  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() })
  subs.forEach((callback) => {
    try {
      callback(message)
    } catch (error) {
      console.error("Error calling subscriber callback:", error)
    }
  })
}

function generateLabels(count: number): string[] {
  const labels = []
  for (let i = 0; i < count; i++) {
    if (i < 26) {
      // A-Z (0-25)
      labels.push(String.fromCharCode(65 + i))
    } else if (i < 52) {
      // AA-AZ (26-51)
      labels.push('A' + String.fromCharCode(65 + (i - 26)))
    } else if (i < 78) {
      // BA-BZ (52-77)
      labels.push('B' + String.fromCharCode(65 + (i - 52)))
    } else {
      // CA-CZ (78-100)
      labels.push('C' + String.fromCharCode(65 + (i - 78)))
    }
  }
  return labels
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}


// セッションクリーンアップ（2時間以上更新がなければ削除）
// KVのTTLと同期させる
if (typeof global !== 'undefined' && !global.__cleanupInterval) {
  global.__cleanupInterval = setInterval(() => {
    const sessions = getSessions()
    const subscribers = getSubscribers()
    const now = new Date()
    const maxAge = 7200000 // 2時間（KV_SESSION_TTLと同じ）

    for (const [sessionId, session] of sessions.entries()) {
      if (now.getTime() - session.updatedAt.getTime() > maxAge) {
        console.log(`[SessionManager] Cleaning up expired session from memory: ${sessionId}`)
        sessions.delete(sessionId)
        subscribers.delete(sessionId)

        // KVとファイルからも削除
        deleteSessionFile(sessionId)
        deleteSessionFromKV(sessionId).catch((error) => {
          console.error(`[SessionManager] Error deleting session from KV: ${sessionId}`, error)
        })
      }
    }

    // ファイルベースのセッションもクリーンアップ
    cleanupExpiredSessions(maxAge)
  }, 300000) // 5分ごとにチェック
}

function deleteSessionFile(sessionId: string): void {
  try {
    const fs = require("fs")
    const path = require("path")
    const filePath = path.join(process.cwd(), ".sessions", `${sessionId}.json`)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log(`[SessionManager] Deleted session file: ${sessionId}`)
    }
  } catch (error) {
    console.error(`[SessionManager] Error deleting session file ${sessionId}:`, error)
  }
}
