import {
  getCredentials,
  getExtensionState,
  setExtensionState,
  getSettings,
  addLog
} from "~utils/storage"

const LOGIN_URL = "http://172.16.68.6:8090/httpclient.html"
const LOGOUT_URL = "http://172.16.68.6:8090/logout.xml"
const PING_URL = "http://www.google.com/generate_204"
const SPEED_TEST_URL = "https://sabnzbd.org/tests/internetspeed/10MB.bin"
const SPEED_TEST_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALARM_NAME = "autoLoginAlarm"

type LoginResult = { success: boolean; message?: string }

type IncomingMessage =
  | { action: "start" }
  | { action: "stop" }
  | { action: "disconnect" }
  | { action: "checkSpeed" }
  | { action: "manualCheck" }

let lastPingTime = 0

async function login(username: string, password: string): Promise<LoginResult> {
  const payload = new URLSearchParams({
    mode: "191",
    username,
    password,
    a: Date.now().toString()
  })

  try {
    const response = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload,
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) return { success: false }

    const xml = await response.text()
    const doc = new DOMParser().parseFromString(xml, "application/xml")
    const message = doc.querySelector("message")?.textContent || ""

    const isLoggedIn =
      message.includes("You are signed in as") ||
      message.includes("You have successfully logged in")

    return { success: isLoggedIn }
  } catch {
    return { success: false }
  }
}

async function logout(): Promise<LoginResult> {
  const { currentCredentialIndex } = await getExtensionState()
  const credentials = await getCredentials()

  if (credentials.length === 0 || currentCredentialIndex === -1) {
    return { success: false, message: "No active user to log out." }
  }

  const payload = new URLSearchParams({
    mode: "193",
    username: credentials[currentCredentialIndex].username,
    a: Date.now().toString()
  })

  try {
    await fetch(LOGOUT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload,
      signal: AbortSignal.timeout(5000)
    })
    await addLog("Disconnected manually")
    return { success: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    await addLog("Log out failed")
    return { success: false, message }
  }
}

async function measureSpeed(): Promise<string> {
  try {
    const start = performance.now()
    await fetch(SPEED_TEST_URL, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store"
    }).then((res) => res.blob())
    const elapsed = (performance.now() - start) / 1000

    if (elapsed < 0.1) return "Test too fast to measure."

    const mbps = ((SPEED_TEST_FILE_SIZE_BYTES * 8) / elapsed / (1024 * 1024)).toFixed(2)
    return `${mbps} Mbps`
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return "Test timed out."
    }
    return "Speed test failed."
  }
}

async function broadcastStatus(status: string, isRunning: boolean) {
  await setExtensionState({ status, isRunning })
  chrome.runtime
    .sendMessage({ type: "STATUS_UPDATE", status, isRunning })
    .catch(() => { })
}

async function stopService(statusMessage: string) {
  chrome.alarms.clear(ALARM_NAME)
  await setExtensionState({ isRunning: false, currentCredentialIndex: -1 })
  await broadcastStatus(statusMessage, false)
  await addLog(statusMessage)
}

async function checkConnectivity(): Promise<{ connected: boolean; latencyMs?: number }> {
  try {
    const start = performance.now()
    await fetch(PING_URL, {
      method: "GET",
      mode: "no-cors",
      signal: AbortSignal.timeout(3000)
    })
    const latency = Math.round(performance.now() - start)
    return { connected: true, latencyMs: latency }
  } catch {
    return { connected: false }
  }
}

async function runLoginCycle(force = false) {
  const state = await getExtensionState()
  if (!state.isRunning) return

  const settings = await getSettings()

  // Throttle ping interval unless forced
  if (!force && Date.now() - lastPingTime < settings.pingIntervalMs) {
    return
  }

  lastPingTime = Date.now()

  const pingResult = await checkConnectivity()

  if (pingResult.connected) {
    const statusMsg = `Connected (${pingResult.latencyMs}ms)`

    // Check if the status has actually changed to avoid spamming the log
    if (!state.status.includes("Connected")) {
      await addLog(statusMsg, pingResult.latencyMs)
    }

    await broadcastStatus(statusMsg, true)
    return
  }

  const credentials = await getCredentials()
  if (credentials.length === 0) {
    await stopService("No credentials.")
    return
  }

  const startIndex = state.currentCredentialIndex === -1 ? 0 : state.currentCredentialIndex

  for (let i = 0; i < credentials.length; i++) {
    const { isRunning } = await getExtensionState()
    if (!isRunning) return

    const index = (startIndex + i) % credentials.length
    const cred = credentials[index]

    await broadcastStatus(
      `Testing: ${index + 1}/${credentials.length} (${cred.username})`,
      true
    )

    const result = await login(cred.username, cred.password)

    if (result.success) {
      await broadcastStatus(
        `Connected with ID ${index + 1} (${cred.username})`,
        true
      )
      await setExtensionState({ currentCredentialIndex: index })
      await addLog(`Logged in as ${cred.username}`)

      // Do an immediate ping to get latency
      const subsequentPing = await checkConnectivity()
      if (subsequentPing.connected) {
        await broadcastStatus(`Connected (${subsequentPing.latencyMs}ms)`, true)
      }
      return
    } else {
      await addLog(`Failed login for ${cred.username}`)
    }
  }

  await broadcastStatus(
    `All ${credentials.length} IDs failed. Retrying...`,
    true
  )
  await setExtensionState({ currentCredentialIndex: 0 })
}

chrome.runtime.onMessage.addListener((message: IncomingMessage, _sender, sendResponse) => {
  const handle = async () => {
    switch (message.action) {
      case "start":
        await setExtensionState({ isRunning: true, currentCredentialIndex: 0 })
        await broadcastStatus("Service starting...", true)
        await addLog("Service started")
        runLoginCycle(true) // Force immediate check
        chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 })
        break
      case "stop":
        await stopService("Service stopped by user.")
        break
      case "disconnect":
        await logout()
        await stopService("Disconnected by user.")
        break
      case "checkSpeed": {
        const speed = await measureSpeed()
        chrome.runtime.sendMessage({ type: "SPEED_UPDATE", speed }).catch(() => { })
        break
      }
      case "manualCheck": {
        await broadcastStatus("Forcing ping...", true)
        setTimeout(() => runLoginCycle(true), 500)
        break
      }
    }
  }

  handle().then(() => sendResponse())
  return true
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    runLoginCycle() // Throttled based on settings.pingIntervalMs
  }
})

chrome.runtime.onStartup.addListener(async () => {
  const { isRunning } = await getExtensionState()
  const settings = await getSettings()

  if (isRunning || settings.autoStart) {
    if (!isRunning) {
      await setExtensionState({ isRunning: true, currentCredentialIndex: 0 })
      await addLog("Auto-started on browser launch")
    }
    runLoginCycle(true)
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 })
  }
})