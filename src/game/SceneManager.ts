import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, DirectionalLight, StandardMaterial, Color3, Color4, ShadowGenerator, Mesh, Texture, VertexData } from "@babylonjs/core";
import { GameLoop } from "./GameLoop";

export class SceneManager {
    private engine: Engine;
    private scene: Scene;
    private camera!: ArcRotateCamera;
    private gameLoop: GameLoop | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.engine = new Engine(canvas, true);
        this.scene = new Scene(this.engine);
        this.scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

        this.setupCamera(canvas);
        this.setupLights();
        this.setupEnvironment();

        this.gameLoop = new GameLoop(this.scene);

        this.engine.runRenderLoop(() => {
            this.updateCamera();
            this.scene.render();
        });

        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    private setupCamera(canvas: HTMLCanvasElement): void {
        // Start with a side-up view
        this.camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 3, 30, Vector3.Zero(), this.scene);
    }

    private updateCamera(): void {
        if (!this.gameLoop) return;
        const p1Data = this.gameLoop.getPlayerData();
        const p2Data = this.gameLoop.getAIData();

        const p1Pos = p1Data.pos;
        const p2Pos = p2Data.pos;

        // Target Midpoint between players
        const midpoint = p1Pos.add(p2Pos).scale(0.5);
        midpoint.y = 1.0; // Slightly lower for better view
        this.camera.setTarget(midpoint);

        // Dynamic Alpha: Calculate the angle of the line between players
        // We want the camera to be perpendicular to the line from P1 to P2
        const diff = p2Pos.subtract(p1Pos);
        const lineAngle = Math.atan2(diff.x, diff.z);
        
        // Correct mapping for Babylon's left-handed system to keep P2 on the right
        let targetAlpha = -lineAngle;

        // Smoothly interpolate alpha
        let deltaAlpha = targetAlpha - this.camera.alpha;
        while (deltaAlpha < -Math.PI) deltaAlpha += Math.PI * 2;
        while (deltaAlpha > Math.PI) deltaAlpha -= Math.PI * 2;
        this.camera.alpha += deltaAlpha * 0.1;

        // Maintain "Side-Up" angle (Beta)
        // PI/2 is horizontal, smaller is from above
        const targetBeta = Math.PI / 2.2; 
        this.camera.beta += (targetBeta - this.camera.beta) * 0.1;

        // Dynamic Radius based on distance
        const distance = Vector3.Distance(p1Pos, p2Pos);
        const targetRadius = Math.max(18, distance * 0.6 + 12);
        this.camera.radius += (targetRadius - this.camera.radius) * 0.05;
    }

    private setupLights(): void {
        const hemiLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), this.scene);
        hemiLight.intensity = 0.5;

        const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), this.scene);
        dirLight.position = new Vector3(20, 40, 20);
        dirLight.intensity = 0.8;

        const shadowGenerator = new ShadowGenerator(1024, dirLight);
        shadowGenerator.useBlurExponentialShadowMap = true;
    }

    private setupEnvironment(): void {
        const terrainSize = 120;
        const terrainSubdivisions = 60;
        const terrain = MeshBuilder.CreateGround("terrain", { width: terrainSize, height: terrainSize, subdivisions: terrainSubdivisions }, this.scene);
        
        const terrainMat = new StandardMaterial("terrainMat", this.scene);
        terrainMat.diffuseColor = new Color3(0.2, 0.4, 0.15);
        terrain.material = terrainMat;

        const positions = terrain.getVerticesData("position");
        if (positions) {
            for (let i = 0; i < positions.length; i += 3) {
                const x = positions[i];
                const z = positions[i + 2];
                const dist = Math.sqrt(x * x + z * z);
                
                if (dist < 15) {
                    positions[i + 1] = -2.5; 
                } else if (dist < 22) {
                    positions[i + 1] = (dist - 22) * 0.35; 
                } else {
                    positions[i + 1] = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.8;
                }
            }
            terrain.setVerticesData("position", positions);
            const normals: number[] = [];
            VertexData.ComputeNormals(positions, terrain.getIndices() as number[], normals);
            terrain.setVerticesData("normal", normals);
        }

        const water = MeshBuilder.CreatePlane("water", { size: 40 }, this.scene);
        water.rotation.x = Math.PI / 2;
        water.position.y = -0.8; 
        
        const waterMat = new StandardMaterial("waterMat", this.scene);
        waterMat.diffuseColor = new Color3(0.1, 0.4, 0.9);
        waterMat.alpha = 0.5;
        waterMat.specularColor = new Color3(1, 1, 1);
        waterMat.backFaceCulling = false;
        water.material = waterMat;

        this.scene.onBeforeRenderObservable.add(() => {
            water.position.y = -0.8 + Math.sin(Date.now() * 0.0015) * 0.06;
        });
    }

    public getScene(): Scene { return this.scene; }
    public getGameLoop(): GameLoop | null { return this.gameLoop; }
    public dispose(): void { this.engine.dispose(); }
}
