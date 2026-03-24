import type { Rect } from "../types";

// Utility : AABB intersection / containment
export function rectIntersects(a: Rect, b: Rect): boolean {
    return !(
        a.x + a.w <= b.x ||
        b.x + b.w <= a.x ||
        a.y + a.h <= b.y ||
        b.y + b.h <= a.y
    );
}
export function rectContains(a: Rect, b: Rect): boolean {
    // does A fully contain B?
    return (
        a.x <= b.x &&
        a.y <= b.y &&
        a.x + a.w >= b.x + b.w &&
        a.y + a.h >= b.y + b.h
    );
}
// Compute view rectangle in *world* coordinates from uniforms used in vertex shader
// Shader does: position' = (pos + u_translation) * u_scale
// then position' must be in [-u_resolution/2, u_resolution/2] to be inside the viewport
export function computeViewRect(
    u_resolution: { x: number; y: number },
    u_translation: { x: number; y: number },
    u_scale: number,
): Rect {
    const halfW = u_resolution.x / (2 * u_scale);
    const halfH = u_resolution.y / (2 * u_scale);

    const left = -halfW - u_translation.x;
    const right = halfW - u_translation.x;
    const top = -halfH - u_translation.y;
    const bottom = halfH - u_translation.y;

    return { x: left, y: top, w: right - left, h: bottom - top };
}
