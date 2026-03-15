import React, { useEffect, useRef, useState } from "react";
import { SceneManager } from "../game/SceneManager";
import { HUD } from "./HUD";
import { GameLoop } from "../game/GameLoop";

export const GameCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneManagerRef = useRef<SceneManager | null>(null);
    const [gameLoop, setGameLoop] = useState<GameLoop | null>(null);

    useEffect(() => {
        if (canvasRef.current) {
            const sm = new SceneManager(canvasRef.current);
            sceneManagerRef.current = sm;
            setGameLoop(sm.getGameLoop());
        }

        return () => {
            if (sceneManagerRef.current) {
                sceneManagerRef.current.dispose();
            }
        };
    }, []);

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <canvas
                ref={canvasRef}
                style={{ width: "100%", height: "100%", display: "block" }}
            />
            <HUD gameLoop={gameLoop} />
        </div>
    );
};
