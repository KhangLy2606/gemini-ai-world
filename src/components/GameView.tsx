
import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { MainScene } from '../game/MainScene';
import { AgentData } from '../types';

interface GameViewProps {
  onAgentSelect: (agent: AgentData) => void;
  onConversationUpdate?: (detail: any) => void;
}

export const GameView: React.FC<GameViewProps> = ({ onAgentSelect, onConversationUpdate }) => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onAgentSelectRef = useRef(onAgentSelect);
  const onConversationUpdateRef = useRef(onConversationUpdate);

  // Keep the ref current to avoid re-initializing game on prop change
  useEffect(() => {
    onAgentSelectRef.current = onAgentSelect;
    onConversationUpdateRef.current = onConversationUpdate;
  }, [onAgentSelect, onConversationUpdate]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Strict Mode Double-Render Fix
    if (gameRef.current) {
        return; 
    }

    // Ensure valid dimensions to prevent "Framebuffer status: Incomplete Attachment"
    const width = containerRef.current.clientWidth || window.innerWidth || 1024;
    const height = containerRef.current.clientHeight || window.innerHeight || 768;

    // 2. Phaser Configuration
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: width,
      height: height,
      pixelArt: true, // Critical for retro/tile look
      backgroundColor: '#3a5a3a', // Lighter green-tinted background for better visibility
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0, x: 0 }, // Top-down, no gravity
        },
      },
      scene: [], // Initialize with empty scene list to prevent auto-start race conditions
    };

    // 3. Initialize Game
    const game = new Phaser.Game(config);
    gameRef.current = game;

    // 4. Add and Start Scene manually with props
    // This avoids the "start -> stop -> start" cycle that causes texture loading race conditions
    game.scene.add('MainScene', MainScene, true, { 
        onAgentSelect: (agent: AgentData) => onAgentSelectRef.current(agent),
        onConversationUpdate: (detail: any) => onConversationUpdateRef.current && onConversationUpdateRef.current(detail)
    });

    // Handle Window/Container Resize
    const resizeObserver = new ResizeObserver((entries) => {
        if (!gameRef.current || !entries[0]) return;
        
        const { width, height } = entries[0].contentRect;
        
        if (width > 0 && height > 0) {
            gameRef.current.scale.resize(width, height);
        }
    });

    if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
    }

    // 5. Cleanup
    return () => {
      resizeObserver.disconnect();
      
      if (gameRef.current) {
        // The MainScene handles socket disconnection via its own SHUTDOWN event listener
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures run-once behavior

  return (
    <div 
      ref={containerRef} 
      id="game-container"
      className="w-full h-full overflow-hidden relative bg-black"
    >
        {/* Placeholder for loading state if needed */}
    </div>
  );
};
