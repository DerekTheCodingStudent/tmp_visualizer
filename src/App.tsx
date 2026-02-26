import React, { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";

/* ================================
   Types
================================ */

interface LegendItem {
  name: string;
  color: [number, number, number, number];
}

interface BarData {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  segments: number[];
}

interface ChartDefinition {
  legend: LegendItem[];
  bars: BarData[];
}

/* ================================
   Shaders
================================ */

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
void main() {
  gl_FragColor = u_color;
}
`;

/* ================================
   Component
================================ */

const BarChart: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const bufferRef = useRef<WebGLBuffer | null>(null);

  const [bars, setBars] = useState<BarData[]>([]);
  const [legend, setLegend] = useState<LegendItem[]>([]);
  const [scale, setScale] = useState(1);
  const [translation, setTranslation] = useState({ x: 0, y: 0 });
  const [showLegend, setShowLegend] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(true);

  /* ================================
     File Upload
  ================================ */

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const parsed: ChartDefinition = JSON.parse(
          event.target?.result as string
        );

        if (!parsed.bars || !parsed.legend) {
          throw new Error("Invalid chart definition");
        }

        setBars(parsed.bars);
        setLegend(parsed.legend);
        setScale(1);
        setTranslation({ x: 0, y: 0 });
      } catch {
        alert("Invalid JSON format");
      }
    };

    reader.readAsText(file);
  };

  /* ================================
     WebGL Initialization (once)
  ================================ */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) return;

    glRef.current = gl;

    const createShader = (
      gl: WebGLRenderingContext,
      type: number,
      source: string
    ) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, VS_SOURCE));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, FS_SOURCE));
    gl.linkProgram(program);

    programRef.current = program;
    bufferRef.current = gl.createBuffer();
  }, []);

  /* ================================
     Draw Function
  ================================ */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const gl = glRef.current;
    const program = programRef.current;
    const buffer = bufferRef.current;

    if (!canvas || !gl || !program || !buffer) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.05, 0.05, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    const positionLoc = gl.getAttribLocation(program, "a_position");
    const resLoc = gl.getUniformLocation(program, "u_resolution");
    const transLoc = gl.getUniformLocation(program, "u_translation");
    const scaleLoc = gl.getUniformLocation(program, "u_scale");
    const colorLoc = gl.getUniformLocation(program, "u_color");

    gl.enableVertexAttribArray(positionLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resLoc, canvas.width, canvas.height);
    gl.uniform2f(transLoc, translation.x, translation.y);
    gl.uniform1f(scaleLoc, scale);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    /* ===== Draw Border ===== */
    gl.uniform4f(colorLoc, 0.4, 0.4, 0.4, 1.0);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        cx - 300, cy + 100,
        cx + 300, cy + 100,
        cx + 300, cy - 200,
        cx - 300, cy - 200
      ]),
      gl.STATIC_DRAW
    );
    gl.drawArrays(gl.LINE_LOOP, 0, 4);

    /* ===== Draw Stacked Bars ===== */
    bars.forEach((bar) => {
      const total = bar.segments.reduce((a, b) => a + b, 0);
      if (total === 0) return;

      let accumulatedHeight = 0;

      bar.segments.forEach((value, i) => {
        const segmentHeight = (value / total) * bar.h;

        const x1 = bar.x + cx;
        const x2 = bar.x + bar.w + cx;

        const yTop = bar.y - accumulatedHeight + cy;
        const yBottom = bar.y - accumulatedHeight - segmentHeight + cy;

        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([
            x1, yTop,
            x2, yTop,
            x1, yBottom,
            x1, yBottom,
            x2, yTop,
            x2, yBottom
          ]),
          gl.STATIC_DRAW
        );

        const color = legend[i]?.color ?? [1, 1, 1, 1];
        gl.uniform4f(colorLoc, color[0], color[1], color[2], color[3]);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        accumulatedHeight += segmentHeight;
      });
    });
  }, [bars, legend, scale, translation]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  /* ================================
     Zoom Handling
  ================================ */

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const zoomIntensity = 0.001;
      const delta = -e.deltaY * zoomIntensity;
      const newScale = Math.max(0.1, Math.min(scale * (1 + delta), 20));

      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      // Zoom in → anchor to mouse
      const anchorX = e.deltaY < 0 ? e.clientX - cx : 0;
      const anchorY = e.deltaY < 0 ? e.clientY - cy : 0;

      const worldX = anchorX / scale - translation.x;
      const worldY = anchorY / scale - translation.y;

      setTranslation({
        x: anchorX / newScale - worldX,
        y: anchorY / newScale - worldY,
      });

      setScale(newScale);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [scale, translation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input field
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // alt+K → toggle UI
      if (e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setUiVisible(prev => !prev);
      }

      // alt+M → toggle shortcuts panel
      if (e.altKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ================================
     JSX
  ================================ */

  const hasValidData = legend.length > 0 && bars.length > 0;

  return (
    <div className="webgl-container">
      <canvas ref={canvasRef} />
      {uiVisible && (
        <div className="ui-overlay">
          {bars.map((bar, i) => {
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;

            const left =
              cx + (bar.x + bar.w / 2 + translation.x) * scale;
            const top =
              cy + (bar.y + 20 + translation.y) * scale;

            return (
              <div key={i} className="label" style={{ left, top }}>
                {bar.label}
              </div>
            );
          })} 
          </div>
      )}
      {uiVisible && (
        <div className="controls">
          <input type="file" accept=".json" onChange={handleFileUpload} />
          <button
            onClick={() => {
              //if (!hasValidData) return;
              setShowLegend(prev => !prev);
            }}
            disabled={!hasValidData}
            className={!hasValidData ? "disabled-button" : ""}
          >
            {showLegend ? "Hide Legend" : "Show Legend"}
          </button>

          <div className="zoom-indicator">
            ZOOM: {scale.toFixed(2)}x
          </div>

          <button
            onClick={() => {
              setScale(1);
              setTranslation({ x: 0, y: 0 });
            }}
          >
            RESET VIEW
          </button>

          {/* Legend */}
            <div className="legend"
            style={{ display: showLegend ? "flex" : "none" }}
            >
              {legend.map((item, i) => {
                const r = Math.round(item.color[0] * 255);
                const g = Math.round(item.color[1] * 255);
                const b = Math.round(item.color[2] * 255);
                const a = item.color[3];

                return (
                  <div key={i} className="legend-item">
                    <div
                      className="legend-color"
                      style={{
                        backgroundColor: `rgba(${r}, ${g}, ${b}, ${a})`
                      }}
                    />
                    <span>{item.name}</span>
                  </div>
                );
              })}
            </div>
        </div>
      )}
      {showShortcuts && (
        <div className="shortcuts-panel">
          <div className="shortcuts-title">Keyboard Shortcuts</div>
          <div>alt + K → Toggle UI</div>
          <div>alt + M → Toggle Help</div>
          <div>Mouse Wheel → Zoom</div>
        </div>
      )}
    </div>
  );
};

export default BarChart;