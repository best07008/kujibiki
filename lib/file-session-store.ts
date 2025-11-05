import { Session } from "./session-manager"
import * as fs from "fs"
import * as path from "path"

const SESSIONS_DIR = path.join(process.cwd(), ".sessions")

// ディレクトリがなければ作成
function ensureDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  }
}

function getSessionPath(sessionId: string): string {
  return path.join(SESSIONS_DIR, `${sessionId}.json`)
}

export function saveSession(session: Session): void {
  try {
    ensureDir()
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
    fs.writeFileSync(getSessionPath(session.id), JSON.stringify(data, null, 2))
  } catch (error) {
    console.error(`[FileSessionStore] Error saving session ${session.id}:`, error)
  }
}

export function loadSession(sessionId: string): Session | null {
  try {
    const filePath = getSessionPath(sessionId)
    if (!fs.existsSync(filePath)) {
      return null
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"))
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
  } catch (error) {
    console.error(`[FileSessionStore] Error loading session ${sessionId}:`, error)
    return null
  }
}

export function deleteSession(sessionId: string): void {
  try {
    const filePath = getSessionPath(sessionId)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (error) {
    console.error(`[FileSessionStore] Error deleting session ${sessionId}:`, error)
  }
}

export function cleanupExpiredSessions(maxAgeMs: number): void {
  try {
    ensureDir()
    const now = Date.now()
    const files = fs.readdirSync(SESSIONS_DIR)

    files.forEach((file) => {
      const filePath = path.join(SESSIONS_DIR, file)
      const stats = fs.statSync(filePath)
      if (now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath)
        const sessionId = file.replace(".json", "")
        console.log(`[FileSessionStore] Cleaned up expired session: ${sessionId}`)
      }
    })
  } catch (error) {
    console.error("[FileSessionStore] Error during cleanup:", error)
  }
}
