import { Scene, Color3, Vector3, ArcRotateCamera } from "@babylonjs/core";
import { Character, CharacterState } from "./Character";
import { InputManager } from "../InputManager";

export class Player extends Character {
    private inputManager: InputManager;
    private attackCooldown: boolean = false;
    private playerIndex: number;

    constructor(scene: Scene, inputManager: InputManager, playerIndex: number = 0) {
        const color = playerIndex === 0 ? new Color3(1, 0.8, 0.4) : new Color3(0.4, 0.8, 1);
        super(playerIndex === 0 ? "player1" : "player2", scene, color);
        this.inputManager = inputManager;
        this.playerIndex = playerIndex;
        this.mesh.position.x = playerIndex === 0 ? -5 : 5;
    }

    public update(deltaTime: number): void {
        if (this.state === CharacterState.KO) return;

        const moveInput = this.inputManager.getMovementDirection(this.playerIndex);
        const sideStepInput = this.inputManager.getSideStepDirection(this.playerIndex);
        
        if (moveInput.y < -0.5) this.crouch(true); else this.crouch(false);
        if (moveInput.y > 0.5) this.jump();

        // 2D Controls (Toward/Away relative to screen)
        let forwardAmount = 0;
        if (moveInput.x !== 0) {
            const camera = this.scene.activeCamera as ArcRotateCamera;
            if (camera) {
                const toward = this.targetPosition.subtract(this.mesh.position).normalize();
                toward.y = 0;
                const camForward = camera.getTarget().subtract(camera.position).normalize();
                camForward.y = 0;
                const camRight = Vector3.Cross(camForward, Vector3.Up()).normalize();
                const dot = Vector3.Dot(toward, camRight);
                
                // Final fix for screen-space movement
                forwardAmount = (moveInput.x * dot < 0) ? Math.abs(moveInput.x) : -Math.abs(moveInput.x);
            } else {
                const isOnLeft = this.mesh.position.x < this.targetPosition.x; 
                forwardAmount = isOnLeft ? moveInput.x : -moveInput.x;
            }
        }

        if (this.state !== CharacterState.ATTACKING && this.state !== CharacterState.CROUCHING) {
            this.move(forwardAmount, sideStepInput, deltaTime);
        }

        if (this.inputManager.isAttacking(this.playerIndex) && !this.attackCooldown) this.attack();

        super.update(deltaTime);
    }

    public attack(): void {
        if (this.state === CharacterState.ATTACKING || this.state === CharacterState.JUMPING) return;
        this.state = CharacterState.ATTACKING;
        this.attackCooldown = true;
        this.playAttackAnimation();
        setTimeout(() => {
            this.state = CharacterState.IDLE;
            setTimeout(() => { this.attackCooldown = false; }, 200);
        }, 150);
    }
}
