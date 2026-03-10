export interface Credential {
  readonly username: string
  readonly password: string
}

export interface Settings {
  pingIntervalMs: number
  autoStart: boolean
}

export interface ConnectionLog {
  id: string
  timestamp: number
  status: string
  latencyMs?: number
}

export interface ExtensionState {
  isRunning: boolean
  status: string
  currentCredentialIndex: number
}

const INITIAL_STATE: ExtensionState = {
  isRunning: false,
  status: "Service stopped.",
  currentCredentialIndex: -1
}

const DEFAULT_SETTINGS: Settings = {
  pingIntervalMs: 60000, // 60 seconds
  autoStart: true
}

export async function getCredentials(): Promise<Credential[]> {
  const { credentials = [] } = await chrome.storage.local.get("credentials")
  return credentials
}

export async function saveCredentials(credentials: Credential[]) {
  await chrome.storage.local.set({ credentials })
}

export async function addCredential(newCred: Credential) {
  const credentials = await getCredentials()
  if (credentials.some((c) => c.username === newCred.username)) {
    throw new Error("This username already exists.")
  }
  await saveCredentials([...credentials, newCred])
}

export async function removeCredential(username: string) {
  const credentials = await getCredentials()
  await saveCredentials(credentials.filter((c) => c.username !== username))
}

export async function getExtensionState(): Promise<ExtensionState> {
  const { extensionState = INITIAL_STATE } =
    await chrome.storage.local.get("extensionState")
  return extensionState
}

export async function setExtensionState(patch: Partial<ExtensionState>) {
  const current = await getExtensionState()
  await chrome.storage.local.set({
    extensionState: { ...current, ...patch }
  })
}

export async function getSettings(): Promise<Settings> {
  const { settings = DEFAULT_SETTINGS } = await chrome.storage.local.get("settings")
  return { ...DEFAULT_SETTINGS, ...settings }
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = await getSettings()
  await chrome.storage.local.set({
    settings: { ...current, ...patch }
  })
}

export async function getLogs(): Promise<ConnectionLog[]> {
  const { logs = [] } = await chrome.storage.local.get("logs")
  return logs
}

export async function addLog(status: string, latencyMs?: number) {
  const logs = await getLogs()
  const newLog: ConnectionLog = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    status,
    latencyMs
  }

  // Keep only the last 6 logs
  logs.unshift(newLog)
  if (logs.length > 6) {
    logs.length = 6
  }

  await chrome.storage.local.set({ logs })
}

export async function clearLogs() {
  await chrome.storage.local.set({ logs: [] })
}