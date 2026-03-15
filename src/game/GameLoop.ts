import { Scene, Vector3 } from "@babylonjs/core";
import { Player } from "./entities/Player";
import { AI, type AIMode } from "./entities/AI";
import { InputManager } from "./InputManager";
import { CharacterState } from "./entities/Character";

export type GameState = "COUNTDOWN" | "BATTLE" | "GAMEOVER" | "PAUSED";

export class GameLoop {
    private scene: Scene;
    private p1: Player;
    private p2: Character;
    private vsPlayer: boolean = false;
    private inputManager: InputManager;
    private prevState: GameState = "COUNTDOWN";
    
    private gameState: GameState = "COUNTDOWN";
    private countdownTimer: number = 3.5;
    private battleTimer: number = 99;

    // Menu State
    private menuSelectedRow: number = 0;
    private currentAiMode: AIMode = "STAND";

    constructor(scene: Scene) {
        this.scene = scene;
        this.inputManager = new InputManager();
        this.p1 = new Player(scene, this.inputManager, 0);
        // Default to AI
        this.p2 = new AI(scene);
        (this.p2 as AI).setTarget(this.p1);

        this.scene.onBeforeRenderObservable.add(() => {
            this.update();
        });
    }

    public toggleVsPlayer(): void {
        this.vsPlayer = !this.vsPlayer;
        this.resetGame();
    }

    public isVsPlayer(): boolean { return this.vsPlayer; }

    public resetGame(): void {
        this.p1.mesh.dispose();
        this.p2.mesh.dispose();
        
        this.p1 = new Player(this.scene, this.inputManager, 0);
        if (this.vsPlayer) {
            this.p2 = new Player(this.scene, this.inputManager, 1);
        } else {
            this.p2 = new AI(this.scene);
            (this.p2 as AI).setTarget(this.p1);
            (this.p2 as AI).setMode(this.currentAiMode);
        }
        
        this.gameState = "COUNTDOWN";
        this.countdownTimer = 3.5;
        this.battleTimer = 99;
    }

    private update(): void {
        const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

        // Handle Pause Toggle
        if (this.inputManager.isJustPressed("pause", 0) || this.inputManager.isJustPressed("pause", 1)) {
            if (this.gameState === "PAUSED") {
                this.gameState = this.prevState;
            } else {
                this.prevState = this.gameState;
                this.gameState = "PAUSED";
                this.menuSelectedRow = 0;
            }
        }

        if (this.gameState === "PAUSED") {
            this.handleMenuNavigation();
            this.inputManager.postUpdate();
            return;
        }

        if (this.gameState === "COUNTDOWN") {
            this.countdownTimer -= deltaTime;
            if (this.countdownTimer <= 0.5) {
                this.gameState = "BATTLE";
            }
        } else if (this.gameState === "BATTLE") {
            if (this.countdownTimer > -2) this.countdownTimer -= deltaTime;
            
            this.battleTimer -= deltaTime;
            if (this.battleTimer <= 0) {
                this.battleTimer = 0;
                this.gameState = "GAMEOVER";
            }
        }

        this.p1.faceTarget(this.p2.mesh.position);
        this.p2.faceTarget(this.p1.mesh.position);

        if (this.gameState === "BATTLE") {
            this.p1.update(deltaTime);
            this.p2.update(deltaTime);
            if (this.p1.getHealth() <= 0 || this.p2.getHealth() <= 0) {
                this.gameState = "GAMEOVER";
            }
        } else if (this.gameState === "GAMEOVER") {
            if (this.inputManager.isRestartPressed()) {
                window.location.reload();
            }
        } else {
            this.p1.update(0);
            this.p2.update(0);
        }

        this.resolveCharacterCollisions();
        this.limitInArena(this.p1.mesh.position);
        this.limitInArena(this.p2.mesh.position);
        this.checkCollisions();

        this.inputManager.postUpdate();
    }

    private handleMenuNavigation(): void {
        const up = this.inputManager.isJustPressed("up", 0) || this.inputManager.isJustPressed("up", 1);
        const down = this.inputManager.isJustPressed("down", 0) || this.inputManager.isJustPressed("down", 1);
        const left = this.inputManager.isJustPressed("left", 0) || this.inputManager.isJustPressed("left", 1);
        const right = this.inputManager.isJustPressed("right", 0) || this.inputManager.isJustPressed("right", 1);
        const select = this.inputManager.isJustPressed("attack", 0) || this.inputManager.isJustPressed("attack", 1);

        const maxRow = this.vsPlayer ? 1 : 2; // 0: Type, 1: Mode (AI only), 2: Resume
        const resumeRow = this.vsPlayer ? 1 : 2;

        if (up) this.menuSelectedRow = (this.menuSelectedRow > 0) ? this.menuSelectedRow - 1 : resumeRow;
        if (down) this.menuSelectedRow = (this.menuSelectedRow < resumeRow) ? this.menuSelectedRow + 1 : 0;

        if (this.menuSelectedRow === 0) {
            if (left || right) this.toggleVsPlayer();
        } else if (this.menuSelectedRow === 1 && !this.vsPlayer) {
            const modes: AIMode[] = ["STAND", "CROUCH", "DEFEND", "OFFENSE"];
            let idx = modes.indexOf(this.currentAiMode);
            if (left) idx = (idx - 1 + modes.length) % modes.length;
            if (right) idx = (idx + 1) % modes.length;
            this.currentAiMode = modes[idx];
            (this.p2 as AI).setMode(this.currentAiMode);
        }

        if (select) {
            if (this.menuSelectedRow === resumeRow) {
                this.gameState = this.prevState;
            } else if (this.menuSelectedRow === 0) {
                this.toggleVsPlayer();
            }
        }
    }

    private resolveCharacterCollisions(): void {
        const minDistance = 1.2;
        const p1PosXZ = new Vector3(this.p1.mesh.position.x, 0, this.p1.mesh.position.z);
        const p2PosXZ = new Vector3(this.p2.mesh.position.x, 0, this.p2.mesh.position.z);
        let distVec = p1PosXZ.subtract(p2PosXZ);
        let distance = distVec.length();
        
        if (distance < 0.01) {
            distVec = new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
            distance = 0.1;
        }

        if (distance < minDistance) {
            const overlap = minDistance - distance;
            const pushDir = distVec.normalize();
            const pushAmount = overlap / 2;
            this.p1.mesh.position.x += pushDir.x * pushAmount;
            this.p1.mesh.position.z += pushDir.z * pushAmount;
            this.p2.mesh.position.x -= pushDir.x * pushAmount;
            this.p2.mesh.position.z -= pushDir.z * pushAmount;
        }
    }

    private limitInArena(pos: Vector3): void {
        const bound = 45;
        pos.x = Math.max(-bound, Math.min(bound, pos.x));
        pos.z = Math.max(-bound, Math.min(bound, pos.z));
    }

    private checkCollisions(): void {
        if (this.gameState !== "BATTLE") return;
        const attackDistance = 2.2;
        if (this.p1.state === CharacterState.ATTACKING) {
            const distance = Vector3.Distance(this.p1.mesh.position, this.p2.mesh.position);
            const heightDiff = Math.abs(this.p1.mesh.position.y - this.p2.mesh.position.y);
            if (distance < attackDistance && heightDiff < 1.0 && this.p2.state !== CharacterState.HIT) {
                this.p2.takeDamage(this.p2.state === CharacterState.CROUCHING ? 2 : 10);
            }
        }
        if (this.p2.state === CharacterState.ATTACKING) {
            const distance = Vector3.Distance(this.p2.mesh.position, this.p1.mesh.position);
            const heightDiff = Math.abs(this.p1.mesh.position.y - this.p2.mesh.position.y);
            if (distance < attackDistance && heightDiff < 1.0 && this.p1.state !== CharacterState.HIT) {
                this.p1.takeDamage(this.p1.state === CharacterState.CROUCHING ? 2 : 10);
            }
        }
    }

    public getPlayerData() { return { health: this.p1.getHealth(), state: this.p1.state, pos: this.p1.mesh.position }; }
    public getAIData() { return { health: this.p2.getHealth(), state: this.p2.state, pos: this.p2.mesh.position }; }
    public getCountdownValue(): string {
        if (this.countdownTimer > 2.5) return "3";
        if (this.countdownTimer > 1.5) return "2";
        if (this.countdownTimer > 0.5) return "1";
        if (this.countdownTimer > -0.5) return "FIGHT!"; 
        return "";
    }

    public getBattleTimer(): number { return Math.max(0, Math.ceil(this.battleTimer)); }
    public getGameState(): GameState { return this.gameState; }
    public getGamepadStatus(playerIndex: number): string { return this.inputManager.getGamepadStatus(playerIndex); }
    public getMenuState() { return { row: this.menuSelectedRow, aiMode: this.currentAiMode }; }
}
