import { Scene, Mesh, MeshBuilder, Vector3, StandardMaterial, Color3, TransformNode, Animation, Quaternion } from "@babylonjs/core";

export const CharacterState = {
    IDLE: 0,
    RUNNING: 1,
    ATTACKING: 2,
    HIT: 3,
    STUNNED: 4,
    KO: 5,
    JUMPING: 6,
    CROUCHING: 7
} as const;

export type CharacterState = typeof CharacterState[keyof typeof CharacterState];

export class Character {
    public mesh: TransformNode;
    public state: CharacterState = CharacterState.IDLE;
    protected scene: Scene;
    protected body: Mesh;
    protected head: Mesh;
    protected ears: Mesh[] = [];
    protected leftPaw: Mesh | null = null;
    protected rightPaw: Mesh | null = null;
    protected health: number = 100;
    protected trailMeshes: { root: TransformNode, mat: StandardMaterial, alpha: number }[] = [];
    protected trailTimer: number = 0;

    protected velocityY: number = 0;
    protected gravity: number = -20;
    protected jumpForce: number = 10;
    protected isGrounded: boolean = true;
    
    protected targetPosition: Vector3 = new Vector3(0, 0, 0);

    constructor(name: string, scene: Scene, color: Color3) {
        this.scene = scene;
        this.mesh = new TransformNode(name, scene);
        this.body = this.createCatMesh(name, color);
        this.body.parent = this.mesh;
        this.head = this.mesh.getChildMeshes().find(m => m.name.includes("head")) as Mesh;
    }

    private createCatMesh(name: string, color: Color3): Mesh {
        const material = new StandardMaterial(`${name}-mat`, this.scene);
        material.diffuseColor = color;
        const body = MeshBuilder.CreateBox(`${name}-body`, { width: 1, height: 1, depth: 1.5 }, this.scene);
        body.position.y = 0.5;
        body.material = material;
        const head = MeshBuilder.CreateBox(`${name}-head`, { size: 0.8 }, this.scene);
        head.position.y = 1.3;
        head.position.z = 0.6;
        head.material = material;
        head.parent = body;
        const earSize = 0.3;
        const leftEar = MeshBuilder.CreateBox(`${name}-ear-l`, { size: earSize }, this.scene);
        leftEar.position.y = 0.4; leftEar.position.x = -0.25; leftEar.rotation.z = Math.PI / 4;
        leftEar.material = material; leftEar.parent = head;
        const rightEar = MeshBuilder.CreateBox(`${name}-ear-r`, { size: earSize }, this.scene);
        rightEar.position.y = 0.4; rightEar.position.x = 0.25; rightEar.rotation.z = -Math.PI / 4;
        rightEar.material = material; rightEar.parent = head;
        const pawSize = 0.3;
        this.leftPaw = MeshBuilder.CreateBox(`${name}-paw-l`, { size: pawSize }, this.scene);
        this.leftPaw.position.set(-0.4, 0.4, 0.8); this.leftPaw.material = material; this.leftPaw.parent = body;
        this.rightPaw = MeshBuilder.CreateBox(`${name}-paw-r`, { size: pawSize }, this.scene);
        this.rightPaw.position.set(0.4, 0.4, 0.8); this.rightPaw.material = material; this.rightPaw.parent = body;
        const tail = MeshBuilder.CreateBox(`${name}-tail`, { width: 0.2, height: 0.2, depth: 1 }, this.scene);
        tail.position.y = 0.3; tail.position.z = -0.7; tail.rotation.x = -Math.PI / 4;
        tail.material = material; tail.parent = body;
        return body;
    }

    public faceTarget(targetPos: Vector3): void {
        this.targetPosition = targetPos;
        const diff = targetPos.subtract(this.mesh.position);
        this.mesh.rotation.y = Math.atan2(diff.x, diff.z);
    }

    public move(forwardAmount: number, sideStepAmount: number, deltaTime: number): void {
        if (this.state === CharacterState.KO || this.state === CharacterState.STUNNED) return;

        const speed = 7;
        const sideStepRotateSpeed = 1.5; // Radians per second
        
        // 1. Forward/Backward Movement
        if (Math.abs(forwardAmount) > 0.01) {
            const forward = this.targetPosition.subtract(this.mesh.position).normalize();
            forward.y = 0;
            this.mesh.position.addInPlace(forward.scale(forwardAmount * speed * deltaTime));
        }

        // 2. Circular Side-Stepping
        if (Math.abs(sideStepAmount) > 0.01) {
            const rotationAngle = -sideStepAmount * sideStepRotateSpeed * deltaTime;
            const offset = this.mesh.position.subtract(this.targetPosition);
            const matrix = new Quaternion();
            Quaternion.RotationAxisToRef(Vector3.Up(), rotationAngle, matrix);
            const rotatedOffset = new Vector3();
            offset.rotateByQuaternionToRef(matrix, rotatedOffset);
            this.mesh.position.copyFrom(this.targetPosition.add(rotatedOffset));
        }

        // Update State
        if (Math.abs(forwardAmount) > 0.1 || Math.abs(sideStepAmount) > 0.1) {
            if (this.isGrounded && this.state !== CharacterState.ATTACKING) {
                this.state = CharacterState.RUNNING;
            }
        } else if (this.isGrounded && this.state !== CharacterState.ATTACKING && this.state !== CharacterState.CROUCHING) {
            this.state = CharacterState.IDLE;
        }
    }

    public jump(): void {
        if (this.isGrounded && this.state !== CharacterState.KO) {
            this.velocityY = this.jumpForce;
            this.isGrounded = false;
            this.state = CharacterState.JUMPING;
        }
    }

    public crouch(isCrouching: boolean): void {
        if (!this.isGrounded || this.state === CharacterState.KO) return;
        if (isCrouching) {
            this.state = CharacterState.CROUCHING;
            this.body.scaling.y = 0.6; this.body.position.y = 0.3;
        } else if (this.state === CharacterState.CROUCHING) {
            this.state = CharacterState.IDLE;
            this.body.scaling.y = 1.0; this.body.position.y = 0.5;
        }
    }

    public takeDamage(amount: number): void {
        this.health -= amount;
        if (this.health <= 0) {
            this.state = CharacterState.KO;
            this.onKO();
        } else {
            this.state = CharacterState.HIT;
            setTimeout(() => { if (this.state === CharacterState.HIT) this.state = CharacterState.IDLE; }, 200);
        }
    }

    public getHealth(): number { return this.health; }
    private onKO(): void { this.mesh.rotation.z = Math.PI / 2; }

    public update(deltaTime: number): void {
        // Sample terrain height
        const terrain = this.scene.getMeshByName("terrain");
        let groundHeight = 0;
        if (terrain) {
            const ground = terrain as any;
            if (ground.getHeightAtCoordinates) {
                groundHeight = ground.getHeightAtCoordinates(this.mesh.position.x, this.mesh.position.z);
            }
        }

        // Apply Gravity
        if (!this.isGrounded) {
            this.velocityY += this.gravity * deltaTime;
            this.mesh.position.y += this.velocityY * deltaTime;

            if (this.mesh.position.y <= groundHeight) {
                this.mesh.position.y = groundHeight;
                this.isGrounded = true;
                this.velocityY = 0;
                if (this.state === CharacterState.JUMPING) this.state = CharacterState.IDLE;
            }
        } else {
            this.mesh.position.y = groundHeight;
        }

        if (this.state === CharacterState.RUNNING) {
            this.body.position.y = 0.5 + Math.sin(Date.now() * 0.015) * 0.1;
        } else if (this.state === CharacterState.IDLE) {
            this.body.position.y = 0.5;
        }

        // Shadow Trail Logic - Run at the END of update to capture final frame pose
        this.updateTrails(deltaTime);
        if (this.state === CharacterState.RUNNING || this.state === CharacterState.JUMPING || this.state === CharacterState.ATTACKING) {
            this.trailTimer += deltaTime;
            if (this.trailTimer > 0.05) {
                this.spawnTrail();
                this.trailTimer = 0;
            }
        }
    }

    private updateTrails(deltaTime: number): void {
        for (let i = this.trailMeshes.length - 1; i >= 0; i--) {
            const t = this.trailMeshes[i];
            t.alpha -= deltaTime * 2.5; // Fade slightly faster for cleaner look
            t.mat.alpha = t.alpha;
            
            if (t.alpha <= 0) {
                t.root.dispose(false, true); // Recurse to dispose all piece clones
                t.mat.dispose();
                this.trailMeshes.splice(i, 1);
            }
        }
    }

    protected spawnTrail(): void {
        // Force world matrix update for the entire hierarchy to ensure absolute accuracy
        this.mesh.computeWorldMatrix(true);

        const trailGroup = new TransformNode("trailSnapshot", this.scene);
        const trailMat = new StandardMaterial("trailMat", this.scene);
        const sourceMat = this.body.material as StandardMaterial;
        
        // Slightly different tint for the trail
        trailMat.diffuseColor = sourceMat ? sourceMat.diffuseColor.clone().scale(1.2) : Color3.Gray();
        trailMat.alpha = 0.4;
        trailMat.transparencyMode = 2; // ALPHABLEND

        // Flatten the hierarchy into the trailGroup using world coordinates
        const parts = [this.body, ...this.body.getChildMeshes()];
        parts.forEach(source => {
            if (source instanceof Mesh) {
                // Clone without children (doNotCloneChildren = true)
                const clone = source.clone(source.name + "_trail", trailGroup, true);
                if (clone) {
                    clone.material = trailMat;
                    clone.isPickable = false;
                    clone.receiveShadows = false;
                    
                    // Capture EXACT world pose
                    const wm = source.getWorldMatrix();
                    clone.position = Vector3.Zero();
                    clone.rotationQuaternion = new Quaternion();
                    clone.scaling = Vector3.One();
                    wm.decompose(clone.scaling, clone.rotationQuaternion, clone.position);
                }
            }
        });

        this.trailMeshes.push({ root: trailGroup, mat: trailMat, alpha: 0.4 });
    }

    protected playAttackAnimation(): void {
        if (!this.leftPaw || !this.rightPaw) return;
        const useRight = Math.random() > 0.5;
        const paw = useRight ? this.rightPaw : this.leftPaw;
        const originalZ = paw.position.z;
        const anim = new Animation("pawStrike", "position.z", 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        anim.setKeys([{ frame: 0, value: originalZ }, { frame: 5, value: originalZ + 1.2 }, { frame: 10, value: originalZ }]);
        paw.animations = [anim];
        this.scene.beginAnimation(paw, 0, 10, false, 2);
        const bodyAnim = new Animation("wiggle", "rotation.y", 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        bodyAnim.setKeys([{ frame: 0, value: 0 }, { frame: 5, value: useRight ? -0.2 : 0.2 }, { frame: 10, value: 0 }]);
        this.body.animations = [bodyAnim];
        this.scene.beginAnimation(this.body, 0, 10, false, 2);
    }
}
