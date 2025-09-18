## JIIT Auto-Login Extension

A simple browser extension to automate the Wi-Fi authentication process.

### Installation & Local Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/akshiguptaa/JIITLinker.git
    cd JIITLinker
    ```

2.  **Prepare the extension for local use:**
    ```bash
    pnpm install && pnpm build
    ```

3.  **Load the extension in Chrome:**
    -   Open your Chrome browser and navigate to `chrome://extensions`.
    -   Enable **Developer mode** using the toggle in the top-right corner.
    -   Click the **"Load unpacked"** button.
    -   Select the `build/chrome-mv3-production` folder from the project directory.
