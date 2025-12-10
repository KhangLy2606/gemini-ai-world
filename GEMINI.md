# Gemini AI World

## Project Overview

Gemini AI World is a visual simulation of AI agents inhabiting a grid-based world. It combines a React-based User Interface (UI) with a Phaser-based Game World to visualize agent interactions, movements, and states.

The application is designed to connect to a backend via Socket.io to receive real-time updates about the world state, but it also includes a robust "Mock Simulation" mode that allows it to run autonomously for demonstration purposes.

### Key Technologies

- **Frontend Framework:** React 19 (managed via Vite)
- **Game Engine:** Phaser 3.90
- **Language:** TypeScript
- **Real-time Communication:** Socket.io-client
- **Styling:** Tailwind CSS (inferred from usage)

## Architecture

The application is split into two main layers:

1.  **The Game Layer (Phaser):**

    - Located in `game/MainScene.ts`.
    - Responsible for rendering the grid world, agents (static sprites), name tags, and position interpolation.
    - Handles the main loop, input (camera panning/zoom), and socket event listening (`server_tick`).
    - Contains the `MockSimulation` logic to generate fake agent behavior if no server is connected.
    - **Note:** Uses single-frame static sprites (no directional animations).

2.  **The UI Layer (React):**
    - Located in `App.tsx` and `components/`.
    - Renders the Heads-Up Display (HUD) and the Sidebar.
    - Displays detailed information about selected agents (Bio, Chat logs, Stats).
    - Communicates with the Phaser scene via callbacks (e.g., `onAgentSelect`).

## Character System

The game uses a **single-frame character system** where each character is represented by a 32x32px front-facing sprite.

### CharacterRegistry (`src/config/CharacterRegistry.ts`)

Central registry that maps character IDs to their sprite assets:

```typescript
interface CharacterDefinition {
  id: string; // Unique identifier (e.g., 'TECH_DEV_MALE')
  name: string; // Display name
  category: CharacterCategory; // 'tech' | 'health' | 'service' | 'edu' | 'creative' | 'custom'
  spriteKey: string; // Phaser texture key
  spritePath: string; // Asset path for loading
  frameIndex: number; // Frame index in spritesheet
}
```

### Adding Custom Characters

1. **Using the Ingestion Tool:**

   ```bash
   npm run ingest:character -- --file <path.png> --id <ID> --category custom --name "Display Name"
   ```

   - Validates 32x32px PNG dimensions
   - Copies to `public/assets/custom/`
   - Generates registry entry code

2. **Manual Registration:**
   Add entry to `CHARACTER_REGISTRY` in `CharacterRegistry.ts`

### Agent Data (`types.ts`)

Agents can specify their character via:

- `spriteKey`: Custom character ID from CharacterRegistry
- `job`: Legacy job role (falls back to CharacterRegistry lookup)

## Directory Structure

- **`App.tsx`**: The main React component acting as the container for the game and UI.
- **`game/`**: Contains Phaser logic.
  - `MainScene.ts`: The primary game scene.
- **`components/`**: React UI components (e.g., `GameView`).
- **`types.ts`**: Shared TypeScript definitions for `AgentData`, `WorldUpdate`, etc.
- **`src/config/`**: Configuration registries.
  - `CharacterRegistry.ts`: Character sprite definitions
  - `JobRegistry.ts`: Legacy job role mappings (backward compatibility)
- **`tools/`**: Development utilities.
  - `ingest-character.ts`: Character sprite validation and ingestion
- **`public/assets/`**: Static assets (images, spritesheets).
  - `custom/`: Custom character sprites

## Building and Running

### Prerequisites

- Node.js (LTS recommended)

### Setup

1.  **Install Dependencies:**

    ```bash
    npm install
    ```

2.  **Environment Configuration:**

    - Create a `.env.local` file in the root directory.
    - Add your Gemini API key (referenced in README, though primarily used by the backend or potentially for future AI features):
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

- **State Management:**
  - **World State:** Managed by `MainScene.ts` (Phaser) as the "source of truth" for visual position.
  - **Mock Agents:** Stored in `this.mockAgents` class property for persistence across ticks.
  - **UI State:** Managed by React (`useState` in `App.tsx`) for selected agents and sidebar visibility.
- **Communication:**
  - The backend (or mock sim) sends `WorldUpdate` events containing a list of `AgentData`.
  - The frontend acts as a "view" for this state, interpolating positions between ticks.
- **Typing:** Strict TypeScript interfaces are defined in `types.ts`. All agent data and updates must adhere to these contracts.
- **Assets:** Single-frame sprites are used for characters. A fallback procedural texture generation system exists in `MainScene.ts` to ensure the app is runnable even without external assets.
- **Character Sprites:** Always 32x32px, front-facing only (no directional animations).
