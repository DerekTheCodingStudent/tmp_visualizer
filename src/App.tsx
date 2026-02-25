import React, { useEffect, useRef, useState } from 'react';
import './App.css';

// TypeScript interfaces for our data
interface BarData {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

// Shader Source Code
const VS_SOURCE = `
  attribute vec2 a_position;
  uniform vec2 u_resolution;
  uniform vec2 u_translation;
  uniform float u_scale;
  void main() {
    vec2 center = u_resolution / 2.0;
    vec2 position = (a_position - center + u_translation) * u_scale + center;
    vec2 zeroToOne = position / u_resolution;
    vec2 clipSpace = (zeroToOne * 2.0) - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  }
`;

const FS_SOURCE = `
  precision mediump float;
  uniform vec4 u_color;
  void main() { gl_FragColor = u_color; }
`;

const BarChart: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState<number>(1.0);
  const [translation, setTranslation] = useState({ x: 0, y: 0 });

  const bars: BarData[] = [
    { x: -150, y: 50, w: 60, h: 10, label: "10 People" },
    { x: -30, y: 50, w: 60, h: 50, label: "50 People" },
    { x: 90, y: 50, w: 60, h: 100, label: "100 People" }
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    // Helper to compile shaders
    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, VS_SOURCE));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, FS_SOURCE));
    gl.linkProgram(program);

    const positionLoc = gl.getAttribLocation(program, "a_position");
    const resLoc = gl.getUniformLocation(program, "u_resolution");
    const transLoc = gl.getUniformLocation(program, "u_translation");
    const scaleLoc = gl.getUniformLocation(program, "u_scale");
    const colorLoc = gl.getUniformLocation(program, "u_color");

    const buffer = gl.createBuffer();

    const draw = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.05, 0.05, 0.05, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);

      gl.enableVertexAttribArray(positionLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform2f(transLoc, translation.x, translation.y);
      gl.uniform1f(scaleLoc, scale);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw Border
      gl.uniform4f(colorLoc, 0.4, 0.4, 0.4, 1.0);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        cx - 200, cy + 50, cx + 200, cy + 50, cx + 200, cy - 110, cx - 200, cy - 110
      ]), gl.STATIC_DRAW);
      gl.drawArrays(gl.LINE_LOOP, 0, 4);

      // Draw Bars
      bars.forEach(bar => {
        const x1 = bar.x + cx, x2 = bar.x + bar.w + cx;
        const y1 = bar.y + cy, y2 = bar.y - bar.h + cy;
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
          x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2
        ]), gl.STATIC_DRAW);
        gl.uniform4f(colorLoc, 0.0, 1.0, 0.8, 1.0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      });
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const zoomIntensity = 0.001;
      const delta = -e.deltaY * zoomIntensity;
      const newScale = Math.max(0.1, Math.min(scale * (1 + delta), 20));

      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      // Choose anchor point
      const anchorX = e.deltaY < 0 ? e.clientX - cx : 0;
      const anchorY = e.deltaY < 0 ? e.clientY - cy : 0;

      const worldX = anchorX / scale - translation.x;
      const worldY = anchorY / scale - translation.y;

      setTranslation({
        x: anchorX / newScale - worldX,
        y: anchorY / newScale - worldY
      });

      setScale(newScale);
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', draw);
    draw();

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', draw);
    };
  }, [scale, translation]);

  return (
    <div className="webgl-container">
      <canvas ref={canvasRef} />
      <div className="ui-overlay">
        {bars.map((bar, i) => {
          const cx = window.innerWidth / 2;
          const cy = window.innerHeight / 2;
          const left = cx + (bar.x + bar.w / 2 + translation.x) * scale;
          const top = cy + (bar.y + 15 + translation.y) * scale;
          return (
            <div key={i} className="label" style={{ left, top }}>
              {bar.label}
            </div>
          );
        })}
      </div>
      <div className="controls">
        <div className="zoom-indicator">ZOOM: {scale.toFixed(2)}x</div>
        <button onClick={() => { setScale(1.0); setTranslation({ x: 0, y: 0 }); }}>
          RESET VIEW
        </button>
      </div>
    </div>
  );
};

export default BarChart;