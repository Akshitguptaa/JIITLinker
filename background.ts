import { getCredentials, getExtensionState, setExtensionState } from "~utils/storage"

const LOGIN_URL = "http://172.16.68.6:8090/httpclient.html"
const LOGOUT_URL = "http://172.16.68.6:8090/logout.xml"
const PING_URL = "http://www.google.com/generate_204"
const SPEED_TEST_URL = "https://sabnzbd.org/tests/internetspeed/10MB.bin"
const SPEED_TEST_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ALARM_NAME = "autoLoginAlarm"

async function login(username, password) {
  const payload = new URLSearchParams({
    mode: "191",
    username: username,
    password: password,
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

    const xmlText = await response.text()
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, "application/xml")
    const message = xmlDoc.querySelector("message")?.textContent || ""

    if (
      message.includes("You are signed in as") ||
      message.includes("You have successfully logged in")
    ) {
      return { success: true }
    }
    return { success: false }
  } catch (error) {
    console.error("Login request failed:", error)
    return { success: false }
  }
}

async function logout() {
  const { currentCredentialIndex } = await getExtensionState()
  const credentials = await getCredentials()

  if (credentials.length === 0 || currentCredentialIndex === -1) {
    return { success: false, message: "No active user to log out." }
  }

  const username = credentials[currentCredentialIndex].username
  const payload = new URLSearchParams({
    mode: "193",
    username: username,
    a: Date.now().toString()
  })

  try {
    await fetch(LOGOUT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload,
      signal: AbortSignal.timeout(5000)
    })
    return { success: true }
  } catch (error) {
    console.error("Logout request failed:", error)
    return { success: false, message: error.message }
  }
}

async function measureSpeed() {
  try {
    const startTime = performance.now()
    await fetch(SPEED_TEST_URL, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store"
    }).then((res) => res.blob())
    const endTime = performance.now()

    const durationInSeconds = (endTime - startTime) / 1000
    if (durationInSeconds < 0.1) return "Test too fast to measure."

    const bitsLoaded = SPEED_TEST_FILE_SIZE_BYTES * 8
    const speedBps = bitsLoaded / durationInSeconds
    const speedMbps = (speedBps / (1024 * 1024)).toFixed(2)

    return `${speedMbps} Mbps`
  } catch (error) {
    console.error("Speed test failed:", error)
    if (error.name === "TimeoutError") {
      return "Test timed out."
    }
    return "Speed test failed."
  }
}

async function updateStatus(status, isRunning) {
  await setExtensionState({ status, isRunning })
  chrome.runtime
    .sendMessage({ type: "STATUS_UPDATE", status, isRunning })
    .catch(() => {})
}

async function stopService(statusMessage) {
  chrome.alarms.clear(ALARM_NAME)
  await setExtensionState({ isRunning: false, currentCredentialIndex: -1 })
  await updateStatus(statusMessage, false)
}

async function runLoginCycle() {
  const { isRunning: wasRunning } = await getExtensionState()
  if (!wasRunning) return

  const isConnected = await fetch(PING_URL, {
    method: "GET",
    mode: "no-cors",
    signal: AbortSignal.timeout(3000)
  })
    .then(() => true)
    .catch(() => false)

  if (isConnected) {
    const { status } = await getExtensionState()
    if (!status.toLowerCase().includes("connected")) {
      await updateStatus("Connected", true)
    }
    return
  }

  const credentials = await getCredentials()
  if (credentials.length === 0) {
    await stopService("No credentials.")
    return
  }

  let { currentCredentialIndex } = await getExtensionState()
  currentCredentialIndex =
    currentCredentialIndex === -1 ? 0 : currentCredentialIndex

  let hasConnectedSuccessfully = false

  for (let i = 0; i < credentials.length; i++) {
    const state = await getExtensionState()
    if (!state.isRunning) return

    const testIndex = (currentCredentialIndex + i) % credentials.length
    const credential = credentials[testIndex]

    await updateStatus(
      `Testing: ${testIndex + 1}/${credentials.length} (${credential.username})`,
      true
    )

    const result = await login(credential.username, credential.password)

    if (result.success) {
      await updateStatus(
        `Connected with ID ${testIndex + 1} (${credential.username})`,
        true
      )
      await setExtensionState({ currentCredentialIndex: testIndex })
      hasConnectedSuccessfully = true
      break
    }
  }

  if (!hasConnectedSuccessfully) {
    await updateStatus(
      `All ${credentials.length} IDs failed. Retrying...`,
      true
    )
    await setExtensionState({ currentCredentialIndex: 0 })
  }
}

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.action === "start") {
    await setExtensionState({ isRunning: true, currentCredentialIndex: 0 })
    await updateStatus("Service starting...", true)
    runLoginCycle()
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 })
  } else if (message.action === "stop") {
    await stopService("Service stopped by user.")
  } else if (message.action === "disconnect") {
    await logout()
    await stopService("Disconnected by user.")
  } else if (message.action === "checkSpeed") {
    const speed = await measureSpeed()
    chrome.runtime.sendMessage({ type: "SPEED_UPDATE", speed }).catch(() => {})
  }
  return true
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    runLoginCycle()
  }
})

chrome.runtime.onStartup.addListener(async () => {
  const { isRunning } = await getExtensionState()
  if (isRunning) {
    runLoginCycle()
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 })
  }
})