// グローバル型定義
declare global {
  var globalSessions: Map<string, any> | undefined
  var globalSubscribers: Map<string, Set<any>> | undefined
  var __cleanupInterval: NodeJS.Timeout | undefined
  var __inMemoryKVStore: any | undefined
}

// グローバルシングルトン sessions store
export const getSessions = () => {
  if (!global.globalSessions) {
    global.globalSessions = new Map()
  }
  return global.globalSessions
}

export const getSubscribers = () => {
  if (!global.globalSubscribers) {
    global.globalSubscribers = new Map()
  }
  return global.globalSubscribers
}
