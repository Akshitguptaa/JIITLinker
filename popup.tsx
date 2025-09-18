import "./globals.css"
import { useState, useEffect } from "react"
import { Trash2, Power, Wifi, PlusCircle, LogOut } from "lucide-react"

import { Button } from "~components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~components/ui/card"
import { Input } from "~components/ui/input"
import { Badge } from "~components/ui/badge"
import { Separator } from "~components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~components/ui/tooltip"

import { type Credential, getCredentials, addCredential, removeCredential, getExtensionState } from "~utils/storage"

function IndexPopup() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [isServiceRunning, setIsServiceRunning] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("Loading...")
  const [networkSpeed, setNetworkSpeed] = useState<string | null>(null)
  const [isTestingSpeed, setIsTestingSpeed] = useState(false)

  const isConnected = connectionStatus.toLowerCase().includes("connected")

  useEffect(() => {
    async function loadInitialData() {
      setCredentials(await getCredentials())
      const state = await getExtensionState()
      setIsServiceRunning(state.isRunning)
      setConnectionStatus(state.status)
    }
    loadInitialData()

    function messageListener(message: any) {
      if (message.type === "STATUS_UPDATE") {
        setConnectionStatus(message.status)
        setIsServiceRunning(message.isRunning)
      }
      if (message.type === "SPEED_UPDATE") {
        setNetworkSpeed(message.speed)
        setIsTestingSpeed(false)
      }
    }
    chrome.runtime.onMessage.addListener(messageListener)

    return () => chrome.runtime.onMessage.removeListener(messageListener)
  }, [])

  async function addNewCredential() {
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
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function deleteCredential(userToRemove: string) {
    await removeCredential(userToRemove)
    setCredentials(await getCredentials())
  }

  function toggleLoginService() {
    chrome.runtime.sendMessage({ action: isServiceRunning ? "stop" : "start" })
  }

  function disconnectService() {
    chrome.runtime.sendMessage({ action: "disconnect" })
  }

  function checkNetworkSpeed() {
    setIsTestingSpeed(true)
    setNetworkSpeed(null)
    chrome.runtime.sendMessage({ action: "checkSpeed" })
  }

  function getStatusBadgeVariant() {
    if (isConnected) return "default"
    if (
      connectionStatus.toLowerCase().includes("failed") ||
      connectionStatus.toLowerCase().includes("stopped") ||
      connectionStatus.toLowerCase().includes("no credentials")
    )
      return "destructive"
    if (
      connectionStatus.toLowerCase().includes("testing") ||
      connectionStatus.toLowerCase().includes("attempting")
    )
      return "outline"
    return "secondary"
  }

  return (
    <TooltipProvider>
      <main className="dark w-[380px] p-4 font-sans bg-background text-foreground">
        <Card className="border-none">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">JIIT Auto-Login</CardTitle>
            <CardDescription>Connection Management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Power
                    className={`h-5 w-5 ${isServiceRunning ? "text-green-400" : "text-red-500"}`}
                  />
                  <span className="font-semibold text-sm">Service Status</span>
                </div>
                <div className="flex items-center space-x-2">
                  {isConnected && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={disconnectService}
                          className="gap-1.5">
                          <LogOut className="h-4 w-4" /> Disconnect
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Log out from the portal</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <Button
                    variant={isServiceRunning ? "destructive" : "default"}
                    size="sm"
                    onClick={toggleLoginService}
                    className="w-[80px]">
                    {isServiceRunning ? "Stop" : "Start"}
                  </Button>
                </div>
              </div>
              <Badge
                variant={getStatusBadgeVariant()}
                className="w-full text-center block">
                {connectionStatus}
              </Badge>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wifi className="h-5 w-5 text-blue-400" />
                  <span className="font-semibold text-sm">
                    {networkSpeed ? `Speed: ${networkSpeed}` : "Network Speed"}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={checkNetworkSpeed}
                  disabled={isTestingSpeed}
                  className="w-[100px]">
                  {isTestingSpeed ? "Testing..." : "Check"}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">
                CREDENTIALS
              </h3>
              <div className="flex space-x-2">
                <Input
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-muted/50"
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-muted/50"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={addNewCredential}>
                      <PlusCircle className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add Credential</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
            </div>

            {credentials.length > 0 && (
              <div className="space-y-2 pt-2">
                {credentials.map((credential) => (
                  <div
                    key={credential.username}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted/80 transition-colors">
                    <span className="text-sm font-mono">
                      {credential.username}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCredential(credential.username)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Remove</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </TooltipProvider>
  )
}

export default IndexPopup