<img src="assets/icons/icon650.png" align="right" width="75">

# Gemini-MAL Bridge: Client-Side Context Injection

![Version](https://img.shields.io/badge/version-1.2.0-blue)
![Tech](https://img.shields.io/badge/tech-JavaScript%20%7C%20ManifestV3-yellow)
![Security](https://img.shields.io/badge/security-DOM%20%26%20React%20Safe-green)
![Architecture](https://img.shields.io/badge/architecture-Client--Side%20RAG-purple)

**Gemini-MAL Bridge** is a Chrome Extension that establishes a secure, real-time data bridge between **MyAnimeList (Database)** and **Google Gemini (LLM)**. 

This project solves the "lack of personal context" problem in general-purpose AI models by implementing a **Client-Side Retrieval-Augmented Generation (RAG)** architecture directly within the browser, without requiring external servers.

---

## 🚀 Key Features

### 🧠 Smart Context Management (RAG)
* **Dynamic Injection:** Instead of constantly flooding the context window, it injects user data only when changes are detected or specifically requested via commands.
* **Diffing Engine:** Calculates the "Delta" between the last synced state and the current state to minimize token usage and API calls.
* **Preference Analysis:** Automatically fetches your top-rated anime to build a "Taste Profile," allowing Gemini to make highly personalized recommendations based on what you *loved*, not just what you *watched*.

### 🛡️ Security & Performance
* **SES/Lockdown Bypass:** Uses the `execCommand` protocol to perform safe DOM manipulation that complies with Google's strict security policies (Secure ECMAScript) and preserves React state integrity.
* **Rate Limiting:** Background services implement intelligent cooldown algorithms (5-minute rule) to prevent API bans from MyAnimeList.

### 🎭 Personalized Persona ("Nakama" Mode)
* Injects system instructions alongside data to transform Gemini into a "Nakama" (Companion). It understands anime jargon (*Tsundere, Isekai, Sakuga*) and reacts emotionally to your watch history.

---

## 🛠️ Architecture

The project consists of three main layers:

1.  **Data Layer (Background Service):** Fetches data from MAL API, normalizes dates/scores, and caches it in `chrome.storage` (non-encrypted local cache).
2.  **Logic Layer (Diff Engine):** Monitors tab activity. If the user visits Gemini, it checks for data updates. If no changes are found, it remains silent to save resources.
3.  **Injection Layer (Content Script):**
    * **Shadow Mode:** Silently appends the latest watch history to the conversation context without the user seeing it.
    * **On-Demand Mode:** Detects regex-based commands (e.g., `#plan2w`) to fetch specific lists instantly.

---

## 📦 Installation

Since this extension is not yet on the Chrome Web Store, you can install it manually:

1. **Download:** Go to the [Releases page](https://github.com/Fen1kks/Gemini-MAL-Bridge/releases) and download the file named `Gemini-MAL-Bridge-vX.X.X.zip`.
2. **Unzip:** Extract the downloaded file to a folder on your computer.
3. **Open Chrome Extensions:** Type `chrome://extensions` in your address bar and press Enter.
4. **Enable Developer Mode:** Toggle the switch in the top right corner.
5. **Load Extension:** Click **Load unpacked** and select the folder you just extracted.
6. **Configure:** Click the extension icon and enter your **MAL Client ID** and **Username**.

---

## 🎮 Usage & Commands

You can control the bridge using special commands inside the Gemini chat input:

| Command | Description |
| :--- | :--- |
| **`#plan2w`** | Fetches 50 random anime from your "Plan to Watch" list for recommendations. |
| **`#plan2w10`** | Fetches 10 random anime for a quick pick. |
| **`#anime`** | Forces a full context refresh (Watch History + Favorites + Status). |

---

## ⚙️ Configuration
To get your MyAnimeList Client ID:
1.  Go to [MyAnimeList API Config](https://myanimelist.net/apiconfig).
2.  Create a new app (Select "Web" as App Type).
3.  Copy the **Client ID** and paste it into the extension popup.

---

## 👨‍💻 Developer Note
This project demonstrates how **Client-Side RAG** can be implemented cost-effectively for personal use. It is optimized to work within the constraints of the DOM structure of Google Gemini and Chrome's Manifest V3.

**License:** MIT