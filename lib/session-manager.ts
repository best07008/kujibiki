import { getSessions, getSubscribers } from "./sessions"
import { kvStore } from "./kv-store"

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

  // Persist to KV store (async, don't wait)
  persistSession(sessionId, session).catch(err =>
    console.error(`[SessionManager] Failed to persist session ${sessionId}:`, err)
  )

  console.log(`[SessionManager] Created session: ${sessionId}`)
  return sessionId
}

export function getSession(sessionId: string): Session | null {
  const sessions = getSessions()
  return sessions.get(sessionId) || null
}

export function joinSession(sessionId: string, name: string, position: number): { success: false; code: string } | { success: true; participantId: string } {
  const sessions = getSessions()

  const session = sessions.get(sessionId)
  console.log(`[SessionManager] Join attempt - sessionId: ${sessionId}, exists: ${!!session}, position: ${position}`)
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
  console.log(`[SessionManager] Participant joined - sessionId: ${sessionId}, participantId: ${participantId}, name: ${name}, position: ${position}`)

  // Persist to KV store (async, don't wait)
  persistSession(sessionId, session).catch(err =>
    console.error(`[SessionManager] Failed to persist session after join:`, err)
  )

  notifySubscribers(sessionId, "participant-joined", {
    participantId,
    participant,
  })

  return { success: true, participantId }
}

export function markParticipantReady(sessionId: string, participantId: string): boolean {
  const sessions = getSessions()

  const session = sessions.get(sessionId)
  if (!session) return false

  const participant = session.participants.get(participantId)
  if (!participant) return false

  participant.ready = true
  session.updatedAt = new Date()

  // Persist to KV store (async, don't wait)
  persistSession(sessionId, session).catch(err =>
    console.error(`[SessionManager] Failed to persist session after marking ready:`, err)
  )

  notifySubscribers(sessionId, "participant-ready", {
    participantId,
  })

  return true
}

export function areAllParticipantsReady(sessionId: string): boolean {
  const sessions = getSessions()

  const session = sessions.get(sessionId)
  if (!session) return false

  if (session.participants.size !== session.participantCount) {
    return false
  }

  return (Array.from(session.participants.values()) as Participant[]).every((p) => p.ready)
}

export function startSession(sessionId: string): boolean {
  const sessions = getSessions()

  const session = sessions.get(sessionId)
  if (!session || session.started) return false

  if (!areAllParticipantsReady(sessionId)) {
    return false
  }

  session.started = true
  session.updatedAt = new Date()

  // ランダムにくじ結果を割り振る
  const labels = generateLabels(session.participantCount)
  const shuffledLabels = shuffleArray([...labels])
  const participants = Array.from(session.participants.values())

  participants.forEach((participant, index) => {
    const result = shuffledLabels[index]
    session.results.set(participant.id, result)
    participant.result = result
  })

  // Persist to KV store (async, don't wait)
  persistSession(sessionId, session).catch(err =>
    console.error(`[SessionManager] Failed to persist session after start:`, err)
  )

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

// Helper function to convert Session to serializable format
function sessionToSerializable(session: Session) {
  return {
    id: session.id,
    participantCount: session.participantCount,
    participants: Array.from(session.participants.entries()).map(([id, p]) => [
      id,
      p,
    ]),
    started: session.started,
    results: Array.from(session.results.entries()),
    selectedPositions: Array.from(session.selectedPositions),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  }
}

// Helper function to convert serialized data back to Session
function deserializeSession(data: any): Session {
  return {
    id: data.id,
    participantCount: data.participantCount,
    participants: new Map(data.participants),
    started: data.started,
    results: new Map(data.results),
    selectedPositions: new Set(data.selectedPositions),
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  }
}

// Persist session to KV store (24 hour TTL)
async function persistSession(sessionId: string, session: Session) {
  try {
    const serialized = sessionToSerializable(session)
    await kvStore.set(`session:${sessionId}`, serialized, { ex: 86400 })
  } catch (err) {
    console.error(`[SessionManager] Failed to persist session ${sessionId}:`, err)
  }
}

// Load session from KV store if not in memory
async function loadSessionFromKV(sessionId: string): Promise<Session | null> {
  try {
    const data = await kvStore.get(`session:${sessionId}`)
    if (!data) return null
    return deserializeSession(data)
  } catch (err) {
    console.error(`[SessionManager] Failed to load session ${sessionId}:`, err)
    return null
  }
}

// Restore all sessions from KV store to memory on startup
export async function restoreSessionsFromKV() {
  // This would require storing a list of session IDs in KV
  // For now, we rely on creating new sessions and persisting them
  console.log('[SessionManager] Sessions will be persisted to KV on creation/update')
}

// セッションクリーンアップ（1時間以上更新がなければ削除）
if (typeof global !== 'undefined' && !global.__cleanupInterval) {
  global.__cleanupInterval = setInterval(() => {
    const sessions = getSessions()
    const subscribers = getSubscribers()
    const now = new Date()
    for (const [sessionId, session] of sessions.entries()) {
      if (now.getTime() - session.updatedAt.getTime() > 3600000) {
        sessions.delete(sessionId)
        subscribers.delete(sessionId)
      }
    }
  }, 300000) // 5分ごとにチェック
}
