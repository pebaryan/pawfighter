import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, Animation, Engine } from "@babylonjs/core";
import { Player } from "./entities/Player";
import { AI, type AIMode } from "./entities/AI";
import { InputManager } from "./InputManager";
import { CharacterState } from "./entities/Character";

export type GameState = "MAIN_MENU" | "COUNTDOWN" | "BATTLE" | "GAMEOVER" | "PAUSED";

export class GameLoop {
    private scene: Scene;
    private p1: Player;
    private p2: Character;
    private vsPlayer: boolean = false;
    private inputManager: InputManager;
    private prevState: GameState = "MAIN_MENU";
    
    private gameState: GameState = "MAIN_MENU";
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
        (this.p2 as AI).setMode(this.currentAiMode);

        this.scene.onBeforeRenderObservable.add(() => {
            this.update();
        });
    }

    public startGame(): void {
        if (this.gameState === "MAIN_MENU") {
            this.gameState = "COUNTDOWN";
            this.resetGame();
        }
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
        
        this.countdownTimer = 3.5;
        this.battleTimer = 99;
        // Don't change gameState if we are in MAIN_MENU or PAUSED
        if (this.gameState !== "MAIN_MENU" && this.gameState !== "PAUSED") {
            this.gameState = "COUNTDOWN";
        }
    }

    private update(): void {
        const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

        if (this.gameState === "MAIN_MENU") {
            this.handleMenuNavigation();
            this.inputManager.postUpdate();
            return;
        }

        // Handle Pause Toggle
        if (this.inputManager.isJustPressed("pause", 0) || this.inputManager.isJustPressed("pause", 1)) {
            if (this.gameState === "PAUSED") {
                this.gameState = this.prevState;
            } else if (this.gameState !== "GAMEOVER" && this.gameState !== "COUNTDOWN") {
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

            this.checkWaterHazard(this.p1, deltaTime);
            this.checkWaterHazard(this.p2, deltaTime);
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

    private checkWaterHazard(char: Character, deltaTime: number): void {
        const dist = Math.sqrt(char.mesh.position.x ** 2 + char.mesh.position.z ** 2);
        const waterLevel = -0.8;
        if (dist < 16 && char.mesh.position.y < waterLevel + 0.5) {
            char.takeDamage(1.5 * deltaTime);
            if (Math.random() < 0.05) {
                this.spawnSplashVFX(char.mesh.position.clone());
            }
        }
    }

    private spawnSplashVFX(position: Vector3): void {
        const splash = MeshBuilder.CreateTorus("splash", { diameter: 1.0, thickness: 0.1 }, this.scene);
        position.y = -0.8;
        splash.position.copyFrom(position);
        const mat = new StandardMaterial("splashMat", this.scene);
        mat.diffuseColor = new Color3(0.4, 0.6, 1.0);
        mat.alpha = 0.6;
        splash.material = mat;
        const anim = new Animation("splashAnim", "scaling", 60, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        anim.setKeys([{ frame: 0, value: new Vector3(0.5, 0.5, 0.5) }, { frame: 20, value: new Vector3(2.5, 0.1, 2.5) }]);
        const animAlpha = new Animation("splashAlpha", "material.alpha", 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        animAlpha.setKeys([{ frame: 0, value: 0.6 }, { frame: 20, value: 0 }]);
        splash.animations = [anim, animAlpha];
        this.scene.beginAnimation(splash, 0, 20, false, 1, () => {
            splash.dispose();
            mat.dispose();
        });
    }

    private handleMenuNavigation(): void {
        const up = this.inputManager.isJustPressed("up", 0) || this.inputManager.isJustPressed("up", 1);
        const down = this.inputManager.isJustPressed("down", 0) || this.inputManager.isJustPressed("down", 1);
        const left = this.inputManager.isJustPressed("left", 0) || this.inputManager.isJustPressed("left", 1);
        const right = this.inputManager.isJustPressed("right", 0) || this.inputManager.isJustPressed("right", 1);
        const select = this.inputManager.isJustPressed("attack", 0) || this.inputManager.isJustPressed("attack", 1);

        const isMainMenu = this.gameState === "MAIN_MENU";
        const maxRow = isMainMenu ? 1 : (this.vsPlayer ? 1 : 2); 
        const resumeRow = isMainMenu ? 1 : (this.vsPlayer ? 1 : 2);

        if (up) this.menuSelectedRow = (this.menuSelectedRow > 0) ? this.menuSelectedRow - 1 : resumeRow;
        if (down) this.menuSelectedRow = (this.menuSelectedRow < resumeRow) ? this.menuSelectedRow + 1 : 0;

        if (this.menuSelectedRow === 0) {
            if (left || right) this.toggleVsPlayer();
        } else if (!isMainMenu && this.menuSelectedRow === 1 && !this.vsPlayer) {
            const modes: AIMode[] = ["STAND", "CROUCH", "BLOCK", "DEFEND", "OFFENSE"];
            let idx = modes.indexOf(this.currentAiMode);
            if (left) idx = (idx - 1 + modes.length) % modes.length;
            if (right) idx = (idx + 1) % modes.length;
            this.currentAiMode = modes[idx];
            (this.p2 as AI).setMode(this.currentAiMode);
        }

        if (select) {
            if (this.menuSelectedRow === resumeRow) {
                if (isMainMenu) this.startGame();
                else this.gameState = this.prevState;
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
        if (this.p1.state === CharacterState.ATTACKING && !this.p1.hasHitThisAttack) {
            const distance = Vector3.Distance(this.p1.mesh.position, this.p2.mesh.position);
            const heightDiff = Math.abs(this.p1.mesh.position.y - this.p2.mesh.position.y);
            if (distance < attackDistance && heightDiff < 1.0 && this.p2.state !== CharacterState.HIT && this.p2.state !== CharacterState.ROLLING) {
                this.p1.hasHitThisAttack = true;
                const isBlocking = this.p2.state === CharacterState.BLOCKING;
                if (this.p1.counterTimer > 0) {
                    this.p2.takeDamage(15); this.p2.triggerRoll(this.p1.mesh.position);
                    this.spawnHitVFX(this.p2.mesh.position.add(new Vector3(0, 1, 0)), false, true);
                } else if (isBlocking) {
                    this.p2.takeDamage(2); this.p2.counterTimer = 0.6;
                    this.spawnHitVFX(this.p2.mesh.position.add(new Vector3(0, 1, 0)), true);
                } else {
                    this.p2.takeDamage(this.p2.state === CharacterState.CROUCHING ? 2 : 10);
                    this.spawnHitVFX(this.p2.mesh.position.add(new Vector3(0, 1, 0)), false);
                }
            }
        }
        if (this.p2.state === CharacterState.ATTACKING && !this.p2.hasHitThisAttack) {
            const distance = Vector3.Distance(this.p2.mesh.position, this.p1.mesh.position);
            const heightDiff = Math.abs(this.p1.mesh.position.y - this.p2.mesh.position.y);
            if (distance < attackDistance && heightDiff < 1.0 && this.p1.state !== CharacterState.HIT && this.p1.state !== CharacterState.ROLLING) {
                this.p2.hasHitThisAttack = true;
                const isBlocking = this.p1.state === CharacterState.BLOCKING;
                if (this.p2.counterTimer > 0) {
                    this.p1.takeDamage(15); this.p1.triggerRoll(this.p2.mesh.position);
                    this.spawnHitVFX(this.p1.mesh.position.add(new Vector3(0, 1, 0)), false, true);
                } else if (isBlocking) {
                    this.p1.takeDamage(2); this.p1.counterTimer = 0.6;
                    this.spawnHitVFX(this.p1.mesh.position.add(new Vector3(0, 1, 0)), true);
                } else {
                    this.p1.takeDamage(this.p1.state === CharacterState.CROUCHING ? 2 : 10);
                    this.spawnHitVFX(this.p1.mesh.position.add(new Vector3(0, 1, 0)), false);
                }
            }
        }
    }

    private spawnHitVFX(position: Vector3, isBlocked: boolean = false, isCounter: boolean = false): void {
        const star = MeshBuilder.CreateTorusKnot("hitVFX", { radius: 0.6, tube: 0.08, radialSegments: 32, tubularSegments: 12, p: 2, q: 3 }, this.scene);
        star.position.copyFrom(position);
        star.renderingGroupId = 2;
        const mat = new StandardMaterial("hitMat", this.scene);
        if (isCounter) mat.emissiveColor = new Color3(1, 0.2, 0.2); 
        else if (isBlocked) mat.emissiveColor = new Color3(0.5, 0.8, 1);
        else mat.emissiveColor = new Color3(1, 0.8, 0.2);
        mat.disableLighting = true; mat.alpha = 0.8; mat.alphaMode = Engine.ALPHA_ADD; mat.zOffset = -10;
        star.material = mat;
        const animScale = new Animation("hitScale", "scaling", 60, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        animScale.setKeys([{ frame: 0, value: new Vector3(0.1, 0.1, 0.1) }, { frame: 5, value: new Vector3(1.5, 1.5, 1.5) }, { frame: 10, value: new Vector3(0, 0, 0) }]);
        const animRotate = new Animation("hitRotate", "rotation.z", 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        animRotate.setKeys([{ frame: 0, value: 0 }, { frame: 10, value: Math.PI }]);
        star.animations = [animScale, animRotate];
        this.scene.beginAnimation(star, 0, 10, false, 2, () => { star.dispose(); mat.dispose(); });
    }

    public getPlayerData() { return { health: this.p1.getHealth(), state: this.p1.state, pos: this.p1.mesh.position }; }
    public getAIData() { return { health: this.p2.getHealth(), state: this.p2.state, pos: this.p2.mesh.position }; }
    public getCountdownValue(): string {
        if (this.countdownTimer > 2.5) return "3"; if (this.countdownTimer > 1.5) return "2"; if (this.countdownTimer > 0.5) return "1"; if (this.countdownTimer > -0.5) return "FIGHT!"; 
        return "";
    }
    public getBattleTimer(): number { return Math.max(0, Math.ceil(this.battleTimer)); }
    public getGameState(): GameState { return this.gameState; }
    public getGamepadStatus(playerIndex: number): string { return this.inputManager.getGamepadStatus(playerIndex); }
    public getMenuState() { return { row: this.menuSelectedRow, aiMode: this.currentAiMode }; }
}
