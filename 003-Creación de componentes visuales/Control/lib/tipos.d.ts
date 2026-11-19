// Declaraciones mínimas para que VS Code no marque como error las
// librerías copiadas en lib/, que no traen tipos: sus valores son `any`.
declare module "@mediapipe/tasks-vision";

declare module "three" {
  const THREE: any;
  export = THREE;
  namespace THREE {
    type Group = any;
    type InstancedMesh = any;
    type Mesh = any;
    type Object3D = any;
    type ShaderMaterial = any;
    type Uniform<T = any> = any;
    type Vector3 = any;
    type WebGLRenderer = any;
  }
}
