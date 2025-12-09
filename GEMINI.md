# Gemini AI World

## Project Overview

Gemini AI World is a visual simulation of AI agents inhabiting a grid-based world. It combines a React-based User Interface (UI) with a Phaser-based Game World to visualize agent interactions, movements, and states.

The application is designed to connect to a backend via Socket.io to receive real-time updates about the world state, but it also includes a robust "Mock Simulation" mode that allows it to run autonomously for demonstration purposes.

### Key Technologies

*   **Frontend Framework:** React 19 (managed via Vite)
*   **Game Engine:** Phaser 3.90
*   **Language:** TypeScript
*   **Real-time Communication:** Socket.io-client
*   **Styling:** Tailwind CSS (inferred from usage)

## Architecture

The application is split into two main layers:

1.  **The Game Layer (Phaser):**
    *   Located in `game/MainScene.ts`.
    *   Responsible for rendering the grid world, agents (sprites), name tags, and animations.
    *   Handles the main loop, input (camera panning), and socket event listening (`server_tick`).
    *   Contains the `MockSimulation` logic to generate fake agent behavior if no server is connected.

2.  **The UI Layer (React):**
    *   Located in `App.tsx` and `components/`.
    *   Renders the Heads-Up Display (HUD) and the Sidebar.
    *   Displays detailed information about selected agents (Bio, Chat logs, Stats).
    *   Communicates with the Phaser scene via callbacks (e.g., `onAgentSelect`).

## Directory Structure

*   **`App.tsx`**: The main React component acting as the container for the game and UI.
*   **`game/`**: Contains Phaser logic.
    *   `MainScene.ts`: The primary game scene.
*   **`components/`**: React UI components (e.g., `GameView`).
*   **`types.ts`**: Shared TypeScript definitions for `AgentData`, `WorldUpdate`, etc.
*   **`src/`**: Contains configuration and potentially other source files (`config/JobRegistry.ts`).
*   **`assets/`**: Static assets (images, spritesheets).

## Building and Running

### Prerequisites
*   Node.js (LTS recommended)

### Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Configuration:**
    *   Create a `.env.local` file in the root directory.
    *   Add your Gemini API key (referenced in README, though primarily used by the backend or potentially for future AI features):
        ```env
        GEMINI_API_KEY=your_key_here
        ```

3.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    Access the app at `http://localhost:3000` (or the port shown in the terminal).

4.  **Build for Production:**
    ```bash
    npm run build
    ```

## Development Conventions

*   **State Management:**
    *   **World State:** Managed by `MainScene.ts` (Phaser) as the "source of truth" for visual position and animation.
    *   **UI State:** Managed by React (`useState` in `App.tsx`) for selected agents and sidebar visibility.
*   **Communication:**
    *   The backend (or mock sim) sends `WorldUpdate` events containing a list of `AgentData`.
    *   The frontend acts as a "view" for this state, interpolating positions between ticks.
*   **Typing:** Strict TypeScript interfaces are defined in `types.ts`. All agent data and updates must adhere to these contracts.
*   **Assets:** Spritesheets are used for characters. A fallback procedural texture generation system exists in `MainScene.ts` to ensure the app is runnable even without external assets.
