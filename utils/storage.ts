export interface Credential {
  username: string
  password: string
}

export interface ExtensionState {
  isRunning: boolean
  status: string
  currentCredentialIndex: number
}

const initialExtensionState: ExtensionState = {
  isRunning: false,
  status: "Service stopped.",
  currentCredentialIndex: -1,
}

export const getCredentials = async (): Promise<Credential[]> => {
  const { credentials = [] } = await chrome.storage.local.get("credentials")
  return credentials
}

const saveCredentials = async (credentials: Credential[]): Promise<void> => {
  await chrome.storage.local.set({ credentials })
}

export const addCredential = async (newCredential: Credential): Promise<void> => {
  const credentials = await getCredentials()
  const isDuplicate = credentials.some(
    (cred) => cred.username === newCredential.username,
  )
  if (isDuplicate) {
    throw new Error("This username already exists.")
  }
  await saveCredentials([...credentials, newCredential])
}

export const removeCredential = async (usernameToRemove: string): Promise<void> => {
  const credentials = await getCredentials()
  const updatedCredentials = credentials.filter(
    (cred) => cred.username !== usernameToRemove,
  )
  await saveCredentials(updatedCredentials)
}

export const getExtensionState = async (): Promise<ExtensionState> => {
  const { extensionState = initialExtensionState } =
    await chrome.storage.local.get("extensionState")
  return extensionState
}

export const setExtensionState = async (
  newState: Partial<ExtensionState>,
): Promise<void> => {
  const currentState = await getExtensionState()
  await chrome.storage.local.set({
    extensionState: { ...currentState, ...newState },
  })
}