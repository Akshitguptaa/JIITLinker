import "./globals.css"

import { useState, useEffect, type KeyboardEvent } from "react"
import {
  Trash2,
  Power,
  Wifi,
  PlusCircle,
  LogOut,
  GripVertical,
  History,
  Settings as SettingsIcon,
  Home
} from "lucide-react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "react-beautiful-dnd"

import { Button } from "~components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "~components/ui/card"
import { Input } from "~components/ui/input"
import { Badge } from "~components/ui/badge"
import { Separator } from "~components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "~components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~components/ui/tabs"

import {
  type Credential,
  type Settings,
  type ConnectionLog,
  getCredentials,
  addCredential,
  removeCredential,
  getExtensionState,
  saveCredentials,
  getSettings,
  saveSettings,
  getLogs,
  clearLogs
} from "~utils/storage"

type StatusMessage =
  | { type: "STATUS_UPDATE"; status: string; isRunning: boolean }
  | { type: "SPEED_UPDATE"; speed: string }

type BadgeVariant = "default" | "destructive" | "outline" | "secondary"

function statusToBadgeVariant(status: string, connected: boolean): BadgeVariant {
  if (connected) return "default"
  const s = status.toLowerCase()
  if (s.includes("failed") || s.includes("stopped") || s.includes("no credentials"))
    return "destructive"
  if (s.includes("testing") || s.includes("attempting") || s.includes("starting"))
    return "outline"
  return "secondary"
}

function IndexPopup() {
  const [activeTab, setActiveTab] = useState("home")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const [credentials, setCredentials] = useState<Credential[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState("Loading...")
  const [speed, setSpeed] = useState<string | null>(null)
  const [isTestingSpeed, setIsTestingSpeed] = useState(false)

  const [settings, setSettings] = useState<Settings>({ pingIntervalMs: 60000, autoStart: true })
  const [logs, setLogs] = useState<ConnectionLog[]>([])

  const isConnected = status.toLowerCase().includes("connected")

  useEffect(() => {
    async function load() {
      setCredentials(await getCredentials())
      const state = await getExtensionState()
      setIsRunning(state.isRunning)
      setStatus(state.status)
      setSettings(await getSettings())
      setLogs(await getLogs())
    }
    load()

    function onMessage(message: StatusMessage) {
      if (message.type === "STATUS_UPDATE") {
        setStatus(message.status)
        setIsRunning(message.isRunning)
      }
      if (message.type === "SPEED_UPDATE") {
        setSpeed(message.speed)
        setIsTestingSpeed(false)
      }
    }

    chrome.runtime.onMessage.addListener(onMessage)

    // Listen to storage changes to instantly update logs
    function onStorageChange(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) {
      if (areaName === "local" && changes.logs) {
        setLogs(changes.logs.newValue || [])
      }
    }
    chrome.storage.local.onChanged.addListener(onStorageChange)

    // Refresh logs every 3 seconds as a fallback
    const logInterval = setInterval(async () => {
      setLogs(await getLogs())
    }, 3000)

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage)
      chrome.storage.local.onChanged.removeListener(onStorageChange)
      clearInterval(logInterval)
    }
  }, [])

  async function handleAdd() {
    setError(null)
    if (!username || !password) {
      setError("Username and password cannot be empty.")
      return
    }
    try {
      await addCredential({ username, password })
      setCredentials(await getCredentials())
      setUsername("")
      setPassword("")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  async function handleRemove(user: string) {
    await removeCredential(user)
    setCredentials(await getCredentials())
  }

  function handleToggle() {
    chrome.runtime.sendMessage({ action: isRunning ? "stop" : "start" })
  }

  function handleDisconnect() {
    chrome.runtime.sendMessage({ action: "disconnect" })
  }

  function handleCheckSpeed() {
    setIsTestingSpeed(true)
    setSpeed(null)
    chrome.runtime.sendMessage({ action: "checkSpeed" })
  }

  function handleManualPing() {
    chrome.runtime.sendMessage({ action: "manualCheck" })
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") handleAdd()
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const items = Array.from(credentials)
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    setCredentials(items)
    saveCredentials(items)
  }

  async function handleSaveSettings(key: keyof Settings, value: any) {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    await saveSettings({ [key]: value })
  }

  async function handleClearLogs() {
    await clearLogs()
    setLogs([])
  }

  return (
    <TooltipProvider>
      <main className="dark w-[380px] h-[550px] font-sans bg-background text-foreground flex flex-col">
        <Card className="border-none rounded-none shadow-none flex-1 flex flex-col h-full bg-background overflow-hidden relative">

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
            <CardHeader className="text-center pb-2 pt-6 flex-shrink-0">
              <CardTitle className="text-2xl font-bold bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">
                JIITLinker
              </CardTitle>
              <TabsList className="grid w-full grid-cols-3 mt-4">
                <TabsTrigger value="home"><Home className="w-4 h-4 mr-2" />Home</TabsTrigger>
                <TabsTrigger value="history"><History className="w-4 h-4 mr-2" />History</TabsTrigger>
                <TabsTrigger value="settings"><SettingsIcon className="w-4 h-4 mr-2" />Settings</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto pb-4 custom-scrollbar">

              {/* --- HOME TAB --- */}
              <TabsContent value="home" className="space-y-4 mt-0 border-none">
                <div className="p-4 rounded-xl bg-card border shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Power className={`h-5 w-5 transition-colors ${isRunning ? "text-green-500" : "text-destructive"}`} />
                      <span className="font-semibold text-sm">Service Status</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isConnected && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={handleDisconnect} className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive">
                              <LogOut className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Log out from portal</p></TooltipContent>
                        </Tooltip>
                      )}

                      {isRunning && !status.toLowerCase().includes("testing") && !status.toLowerCase().includes("forcing") && (
                        <Button variant="ghost" size="icon" onClick={handleManualPing} className="h-8 w-8 hover:text-blue-400 mr-2">
                          <Wifi className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        variant={isRunning ? "destructive" : "default"}
                        size="sm"
                        onClick={handleToggle}
                        className="w-[80px] shadow-sm"
                      >
                        {isRunning ? "Stop" : "Start"}
                      </Button>
                    </div>
                  </div>
                  <Badge
                    variant={statusToBadgeVariant(status, isConnected)}
                    className="w-full justify-center text-xs py-1 transition-all"
                  >
                    {status}
                  </Badge>
                </div>

                <div className="p-4 rounded-xl bg-card border shadow-sm flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Wifi className="h-5 w-5 text-blue-500" />
                    <span className="font-semibold text-sm">
                      {speed ? `${speed}` : "Network Speed"}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCheckSpeed}
                    disabled={isTestingSpeed}
                    className="w-[90px] shadow-sm"
                  >
                    {isTestingSpeed ? "Testing..." : "Test"}
                  </Button>
                </div>

                <Separator className="my-2 opacity-50" />

                <div className="space-y-3">
                  <h3 className="font-semibold text-xs tracking-wider text-muted-foreground uppercase">Credentials</h3>
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="bg-card h-9"
                    />
                    <Input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="bg-card h-9"
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" size="icon" onClick={handleAdd} className="h-9 w-9 shrink-0">
                          <PlusCircle className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Add Credential</p></TooltipContent>
                    </Tooltip>
                  </div>
                  {error && <p className="text-xs text-destructive text-center font-medium">{error}</p>}
                </div>

                {credentials.length > 0 && (
                  <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="credentials">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 pt-1">
                          {credentials.map((cred, index) => (
                            <Draggable key={cred.username} draggableId={cred.username} index={index}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className="flex items-center justify-between p-2 rounded-lg bg-card border shadow-sm group hover:border-muted-foreground/30 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100" />
                                    <span className="text-sm font-medium">{cred.username}</span>
                                  </div>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemove(cred.username)}>
                                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Remove</p></TooltipContent>
                                  </Tooltip>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
              </TabsContent>

              {/* --- HISTORY TAB --- */}
              <TabsContent value="history" className="space-y-4 mt-0 border-none h-full">
                <div className="flex flex-col h-full space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Connection Logs</h3>
                    <Button variant="ghost" size="sm" onClick={handleClearLogs} className="h-8 text-xs text-muted-foreground hover:text-destructive">
                      Clear Logs
                    </Button>
                  </div>

                  <div className="flex-1 rounded-xl border bg-card overflow-hidden flex flex-col max-h-[350px]">
                    {logs.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center justify-center h-full">
                        <History className="h-8 w-8 mb-2 opacity-20" />
                        No connection events yet.
                      </div>
                    ) : (
                      <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {logs.map((log) => {
                          const date = new Date(log.timestamp)
                          const isSuccess = log.status.toLowerCase().includes("connected") || log.status.toLowerCase().includes("started")
                          const isFail = log.status.toLowerCase().includes("fail") || log.status.toLowerCase().includes("stopped")

                          return (
                            <div key={log.id} className="text-xs p-2 rounded-md hover:bg-muted/50 flex justify-between items-start gap-2 border-b border-border/50 last:border-0 transition-colors">
                              <div className="flex flex-col gap-1">
                                <span className={`font-medium ${isSuccess ? 'text-green-500' : isFail ? 'text-destructive' : 'text-foreground'}`}>
                                  {log.status}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* --- SETTINGS TAB --- */}
              <TabsContent value="settings" className="space-y-4 mt-0 border-none">
                <div className="space-y-4">

                  <div className="p-4 rounded-xl border bg-card space-y-3">
                    <div className="space-y-1">
                      <h4 className="font-medium text-sm">Ping Interval</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        How often the extension checks connection status while running.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "15 seconds", value: 15000 },
                        { label: "30 seconds", value: 30000 },
                        { label: "1 minute (Default)", value: 60000 },
                        { label: "5 minutes", value: 300000 }
                      ].map((opt) => (
                        <Button
                          key={opt.value}
                          variant={settings.pingIntervalMs === opt.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleSaveSettings("pingIntervalMs", opt.value)}
                          className="w-full text-xs justify-start"
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border bg-card flex items-center justify-between cursor-pointer" onClick={() => handleSaveSettings("autoStart", !settings.autoStart)}>
                    <div className="space-y-0.5">
                      <h4 className="font-medium text-sm">Auto-Start Service</h4>
                      <p className="text-xs text-muted-foreground">Start background worker on launch</p>
                    </div>
                    <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-[2px] ${settings.autoStart ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                      <div className={`w-4 h-4 rounded-full bg-background transition-transform shadow-sm ${settings.autoStart ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </div>

                </div>
              </TabsContent>

            </CardContent>
          </Tabs>
        </Card>
      </main>
    </TooltipProvider>
  )
}

export default IndexPopup