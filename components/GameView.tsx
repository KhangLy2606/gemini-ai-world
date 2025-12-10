import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { MainScene } from '../game/MainScene';
import { AgentData } from '../types';

interface GameViewProps {
  onAgentSelect: (agent: AgentData) => void;
}

export const GameView: React.FC<GameViewProps> = ({ onAgentSelect }) => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onAgentSelectRef = useRef(onAgentSelect);

  // Keep the ref current to avoid re-initializing game on prop change
  useEffect(() => {
    onAgentSelectRef.current = onAgentSelect;
  }, [onAgentSelect]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Strict Mode Double-Render Fix
    if (gameRef.current) {
        return; 
    }

    // 2. Phaser Configuration
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      pixelArt: true, // Critical for retro/tile look
      backgroundColor: '#3a5a3a', // Lighter green-tinted background for better visibility
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0, x: 0 }, // Top-down, no gravity
        },
      },
      scene: [MainScene], // Load our scene
    };

    // 3. Initialize Game
    const game = new Phaser.Game(config);
    gameRef.current = game;

    // 4. Pass the callback to the running scene
    game.events.once('ready', () => {
        // Stop the auto-started scene and restart with our React props
        game.scene.stop('MainScene');
        game.scene.start('MainScene', { 
            onAgentSelect: (agent: AgentData) => onAgentSelectRef.current(agent) 
        });
    });

    // Handle Window Resize
    const handleResize = () => {
        if (gameRef.current && containerRef.current) {
            gameRef.current.scale.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        }
    };
    window.addEventListener('resize', handleResize);

    // 5. Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      
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