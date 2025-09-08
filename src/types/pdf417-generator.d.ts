// src/types/pdf417-generator.d.ts
declare module "pdf417-generator" {
  export function draw(
    data: string,
    canvas: HTMLCanvasElement,
    options?: Record<string, unknown>
  ): void;
}
