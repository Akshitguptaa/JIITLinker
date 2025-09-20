import "./globals.css"
import { useState, useEffect } from "react"
import { Trash2, Power, Wifi, PlusCircle, LogOut, GripVertical } from "lucide-react"
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd"

import { Button } from "~components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~components/ui/card"
import { Input } from "~components/ui/input"
import { Badge } from "~components/ui/badge"
import { Separator } from "~components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~components/ui/tooltip"

import { type Credential, getCredentials, addCredential, removeCredential, getExtensionState, saveCredentials } from "~utils/storage"

function IndexPopup() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState("Loading...")
  const [speed, setSpeed] = useState<string | null>(null)
  const [isTestingSpeed, setIsTestingSpeed] = useState(false)

  const isConnected = status.toLowerCase().includes("connected")

  useEffect(() => {
    const loadData = async () => {
      setCredentials(await getCredentials())
      const state = await getExtensionState()
      setIsRunning(state.isRunning)
      setStatus(state.status)
    }
    loadData()

    const messageListener = (message: any) => {
      if (message.type === 'STATUS_UPDATE') {
        setStatus(message.status)
        setIsRunning(message.isRunning)
      }
      if (message.type === 'SPEED_UPDATE') {
        setSpeed(message.speed)
        setIsTestingSpeed(false)
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);

    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, [])

  const handleAdd = async () => {
    setError(null);
    if (!username || !password) {
      setError("Username and password cannot be empty.");
      return
    }
    try {
      await addCredential({ username, password })
      setCredentials(await getCredentials())
      setUsername("")
      setPassword("")
    } catch (err: any) {
      setError(err.message);
    }
  }

  const handleRemove = async (userToRemove: string) => {
    await removeCredential(userToRemove)
    setCredentials(await getCredentials())
  }

  const handleToggle = () => {
    chrome.runtime.sendMessage({ action: isRunning ? "stop" : "start" });
  }

  const handleDisconnect = () => {
    chrome.runtime.sendMessage({ action: "disconnect" });
  }

  const handleCheckSpeed = () => {
    setIsTestingSpeed(true);
    setSpeed(null);
    chrome.runtime.sendMessage({ action: "checkSpeed" });
  }

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(credentials);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setCredentials(items);
    saveCredentials(items);
  };

  const getStatusVariant = (): "default" | "destructive" | "outline" | "secondary" => {
    if (isConnected) return "default";
    if (status.toLowerCase().includes("failed") || status.toLowerCase().includes("stopped") || status.toLowerCase().includes("no credentials")) return "destructive";
    if (status.toLowerCase().includes("testing") || status.toLowerCase().includes("attempting")) return "outline";
    return "secondary";
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
                  <Power className={`h-5 w-5 ${isRunning ? "text-green-400" : "text-red-500"}`} />
                  <span className="font-semibold text-sm">Service Status</span>
                </div>
                <div className="flex items-center space-x-2">
                  {isConnected && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={handleDisconnect} className="gap-1.5">
                          <LogOut className="h-4 w-4" /> Disconnect
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Log out from the portal</p></TooltipContent>
                    </Tooltip>
                  )}
                  <Button
                    variant={isRunning ? "destructive" : "default"}
                    size="sm"
                    onClick={handleToggle}
                    className="w-[80px]"
                  >
                    {isRunning ? "Stop" : "Start"}
                  </Button>
                </div>
              </div>
              <Badge variant={getStatusVariant()} className="w-full text-center block">{status}</Badge>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wifi className="h-5 w-5 text-blue-400" />
                  <span className="font-semibold text-sm">
                    {speed ? `Speed: ${speed}` : "Network Speed"}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCheckSpeed}
                  disabled={isTestingSpeed}
                  className="w-[100px]"
                >
                  {isTestingSpeed ? "Testing..." : "Check"}
                </Button>
              </div>
            </div>
            
            <Separator />

            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">CREDENTIALS</h3>
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
                    <Button variant="ghost" size="icon" onClick={handleAdd}><PlusCircle className="h-5 w-5" /></Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Add Credential</p></TooltipContent>
                </Tooltip>
              </div>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
            </div>

            {credentials.length > 0 && (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="credentials">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 pt-2">
                      {credentials.map((cred, index) => (
                        <Draggable key={cred.username} draggableId={cred.username} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted/80 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-mono">{cred.username}</span>
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => handleRemove(cred.username)}>
                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
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
          </CardContent>
        </Card>
      </main>
    </TooltipProvider>
  )
}

export default IndexPopup