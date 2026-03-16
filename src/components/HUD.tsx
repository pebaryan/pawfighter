import React, { useEffect, useState } from "react";
import { GameLoop } from "../game/GameLoop";
import type { AIMode } from "../game/entities/AI";

interface HUDProps {
    gameLoop: GameLoop | null;
}

export const HUD: React.FC<HUDProps> = ({ gameLoop }) => {
    const [playerHealth, setPlayerHealth] = useState(100);
    const [aiHealth, setAiHealth] = useState(100);
    const [currentAiMode, setCurrentAiMode] = useState<AIMode>("STAND");
    const [countdown, setCountdown] = useState("");
    const [timer, setTimer] = useState(99);
    const [vsPlayer, setVsPlayer] = useState(false);
    const [p1Gamepad, setP1Gamepad] = useState("Disconnected");
    const [p2Gamepad, setP2Gamepad] = useState("Disconnected");
    const [gameState, setGameState] = useState<string>("MAIN_MENU");
    const [selectedRow, setSelectedRow] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            if (gameLoop) {
                const playerData = gameLoop.getPlayerData();
                const aiData = gameLoop.getAIData();
                setPlayerHealth(playerData.health);
                setAiHealth(aiData.health);
                setCountdown(gameLoop.getCountdownValue());
                setTimer(gameLoop.getBattleTimer());
                setVsPlayer(gameLoop.isVsPlayer());
                setP1Gamepad(gameLoop.getGamepadStatus(0));
                setP2Gamepad(gameLoop.getGamepadStatus(1));
                setGameState(gameLoop.getGameState());
                
                const menuState = gameLoop.getMenuState();
                setSelectedRow(menuState.row);
                setCurrentAiMode(menuState.aiMode);
            }
        }, 100);
        return () => clearInterval(interval);
    }, [gameLoop]);

    const handleStart = () => {
        if (gameLoop) gameLoop.startGame();
    };

    const resumeGame = () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { 'key': 'escape' }));
    };

    const toggleVsMode = () => {
        if (gameLoop) gameLoop.toggleVsPlayer();
    };

    const getBtnClass = (row: number, active: boolean) => {
        let cls = active ? "active" : "";
        if (selectedRow === row) {
            cls += " selected";
        }
        return cls;
    };

    const getAiBtnClass = (mode: AIMode) => {
        let cls = currentAiMode === mode ? "active" : "";
        if (selectedRow === 1 && currentAiMode === mode) {
            cls += " selected";
        }
        return cls;
    };

    if (gameState === "MAIN_MENU") {
        return (
            <div className="hud">
                <div className="main-menu-overlay">
                    <div className="main-menu-content">
                        <h1 className="game-title">PAW FIGHTER</h1>
                        <p className="game-subtitle">The Furriest Combat Engine</p>
                        
                        <div className="menu-sections-wrapper">
                            <div className={`menu-section ${selectedRow === 0 ? "row-selected" : ""}`}>
                                <label>Match Type:</label>
                                <div className="btn-group">
                                    <button className={getBtnClass(0, !vsPlayer)} onClick={toggleVsMode}>VS AI</button>
                                    <button className={getBtnClass(0, vsPlayer)} onClick={toggleVsMode}>VS PLAYER</button>
                                </div>
                            </div>

                            <div className={`menu-section ${selectedRow === 1 ? "row-selected" : ""}`}>
                                <button className={`start-btn ${selectedRow === 1 ? "selected" : ""}`} onClick={handleStart}>START MATCH</button>
                            </div>
                        </div>

                        <div className="controls-footer">
                            <p>Use D-PAD / WASD to Navigate | A / SPACE to Select</p>
                            <div className="gp-status-row">
                                <span>P1: {p1Gamepad}</span>
                                <span>P2: {p2Gamepad}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="hud">
            <div className="top-ui">
                <div className="health-section player">
                    <div className="name">PLAYER 1</div>
                    <div className="fancy-bar">
                        <div className="fancy-fill" style={{ width: `${Math.max(0, playerHealth)}%` }}></div>
                        <div className="health-text">{Math.max(0, Math.floor(playerHealth))}</div>
                    </div>
                </div>

                <div className="timer-section">
                    <div className="timer-box">{timer}</div>
                </div>

                <div className="health-section ai">
                    <div className="name">{vsPlayer ? "PLAYER 2" : "AI CAT"}</div>
                    <div className="fancy-bar">
                        <div className="fancy-fill" style={{ width: `${Math.max(0, aiHealth)}%` }}></div>
                        <div className="health-text">{Math.max(0, Math.floor(aiHealth))}</div>
                    </div>
                </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", color: "white", fontSize: "10px", marginTop: "5px", padding: "0 20px" }}>
                <div>GP1: <span style={{ color: p1Gamepad === "Disconnected" ? "#ff4444" : "#44ff44" }}>{p1Gamepad}</span></div>
                <div>GP2: <span style={{ color: p2Gamepad === "Disconnected" ? "#ff4444" : "#44ff44" }}>{p2Gamepad}</span></div>
            </div>

            {gameState === "PAUSED" && (
                <div className="pause-overlay">
                    <div className="pause-menu">
                        <h2>PAUSED</h2>
                        
                        <div className={`menu-section ${selectedRow === 0 ? "row-selected" : ""}`}>
                            <label>Opponent Type:</label>
                            <div className="btn-group">
                                <button className={getBtnClass(0, !vsPlayer)} onClick={toggleVsMode}>AI</button>
                                <button className={getBtnClass(0, vsPlayer)} onClick={toggleVsMode}>P2</button>
                            </div>
                        </div>

                        {!vsPlayer && (
                            <div className={`menu-section ${selectedRow === 1 ? "row-selected" : ""}`}>
                                <label>AI Mode:</label>
                                <div className="btn-group vertical">
                                    <button className={getAiBtnClass("STAND")}>STAND</button>
                                    <button className={getAiBtnClass("CROUCH")}>CROUCH</button>
                                    <button className={getAiBtnClass("BLOCK")}>BLOCK</button>
                                    <button className={getAiBtnClass("DEFEND")}>DEFEND</button>
                                    <button className={getAiBtnClass("OFFENSE")}>OFFENSE</button>
                                </div>
                            </div>
                        )}

                        <div className={`menu-section ${selectedRow === (vsPlayer ? 1 : 2) ? "row-selected" : ""}`}>
                            <button className={`resume-btn ${selectedRow === (vsPlayer ? 1 : 2) ? "selected" : ""}`} onClick={resumeGame}>RESUME</button>
                        </div>
                    </div>
                </div>
            )}

            {countdown && (
                <div className={`countdown-overlay ${countdown === "FIGHT!" ? "fight" : ""}`}>
                    {countdown}
                </div>
            )}

            <div className="controls-hint">
                P1: WASD (Move) | Q/E (Side-step) | SPACE (Attack) <br/>
                {vsPlayer ? "P2: IJKL (Move) | U/O (Side-step) | ENTER (Attack)" : "ESC / START to Pause"} <br/>
                Gamepad: L-Stick (Move) | LT/RT (Side-step) | A (Attack)
            </div>

            {(playerHealth <= 0 || aiHealth <= 0 || timer <= 0) && (
                <div className="game-over">
                    {timer <= 0 ? "TIME UP!" : (playerHealth <= 0 ? (vsPlayer ? "PLAYER 2 WINS!" : "AI WINS!") : "PLAYER 1 WINS!")}
                    <br />
                    <button onClick={() => window.location.reload()}>RESTART</button>
                </div>
            )}
        </div>
    );
};
