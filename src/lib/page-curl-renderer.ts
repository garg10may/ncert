import { curlPoint } from "./page-curl";

const COLUMNS = 96;
const ROWS = 24;
const STRIDE = 6;

/** Draw actual curved geometry, with separate PDF textures on the two sides. */
export function createPageCurl(canvas: HTMLCanvasElement, shadow: HTMLCanvasElement, options: {
  width: number; height: number; forward: boolean; darkPaper: boolean;
  front: HTMLCanvasElement; back: HTMLCanvasElement;
}) {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) return null;
  const resources: (() => void)[] = [];
  try {
    const shader = (type: number, source: string) => {
      const result = gl.createShader(type);
      if (!result) throw new Error("Unable to allocate page shader");
      resources.push(() => gl.deleteShader(result));
      gl.shaderSource(result, source);
      gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result) || "Page shader failed");
      return result;
    };
    const vertex = shader(gl.VERTEX_SHADER, `
      attribute vec3 position;
      attribute vec2 uv;
      attribute float bend;
      varying vec2 texCoord;
      varying float angle;
      void main() { gl_Position = vec4(position, 1.0); texCoord = uv; angle = bend; }
    `);
    const fragment = shader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform sampler2D front;
      uniform sampler2D back;
      uniform bool darkPaper;
      uniform float lift;
      varying vec2 texCoord;
      varying float angle;
      void main() {
        vec3 color = gl_FrontFacing ? texture2D(front, texCoord).rgb : texture2D(back, vec2(1.0-texCoord.x, texCoord.y)).rgb;
        if (darkPaper) {
          vec3 inverted = vec3(.9) - .8 * color;
          color = clamp(vec3(dot(inverted, vec3(-.574,1.43,.144)), dot(inverted,vec3(.426,.43,.144)), dot(inverted,vec3(.426,1.43,-.856))), 0.0, 1.0);
        }
        float curve = sin(angle);
        float light = 1.0 - .24 * curve * curve;
        float highlight = .07 * pow(max(0.0, sin(angle * 2.0)), 6.0);
        color = color * light + vec3(highlight * (darkPaper ? .22 : 1.0));
        if (!gl_FrontFacing) color *= 1.0 - .035 * lift;
        gl_FragColor = vec4(color, 1.0);
      }
    `);
    const program = gl.createProgram();
    if (!program) throw new Error("Unable to allocate page program");
    resources.push(() => gl.deleteProgram(program));
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Unable to link page shader");
    gl.useProgram(program);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = shadow.width = Math.round(options.width * ratio);
    canvas.height = shadow.height = Math.round(options.height * ratio);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const texture = (source: HTMLCanvasElement, unit: number, name: string) => {
      const result = gl.createTexture();
      if (!result) throw new Error("Unable to allocate page texture");
      resources.push(() => gl.deleteTexture(result));
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, result);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform1i(gl.getUniformLocation(program, name), unit);
    };
    texture(options.front, 0, "front"); texture(options.back, 1, "back");
    gl.uniform1i(gl.getUniformLocation(program, "darkPaper"), options.darkPaper ? 1 : 0);
    const liftUniform = gl.getUniformLocation(program, "lift");
    const vertices = new Float32Array((COLUMNS + 1) * (ROWS + 1) * STRIDE);
    const indices: number[] = [];
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLUMNS; col++) {
      const a = row * (COLUMNS + 1) + col, b = a + COLUMNS + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const vertexBuffer = gl.createBuffer(), indexBuffer = gl.createBuffer();
    resources.push(() => { gl.deleteBuffer(vertexBuffer); gl.deleteBuffer(indexBuffer); });
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices.byteLength, gl.DYNAMIC_DRAW);
    for (const [name, size, offset] of [["position", 3, 0], ["uv", 2, 3], ["bend", 1, 5]] as const) {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.frontFace(options.forward ? gl.CW : gl.CCW);
    const sign = options.forward ? 1 : -1;
    const pageWidth = options.width / 2 - 1;
    const aspect = options.height / pageWidth;
    const shadowContext = shadow.getContext("2d");
    return {
      draw(progress: number) {
        const lift = Math.sin(Math.PI * progress);
        for (let row = 0; row <= ROWS; row++) for (let col = 0; col <= COLUMNS; col++) {
          const u = col / COLUMNS, v = row / ROWS;
          const point = curlPoint(u, v, progress, aspect);
          const offset = (row * (COLUMNS + 1) + col) * STRIDE;
          vertices.set([sign * (point.x * pageWidth + Math.cos(Math.PI * progress)) * 2 / options.width,
            1 - point.y * pageWidth * 2 / options.height, -point.z / 2,
            options.forward ? u : 1 - u, v, point.angle], offset);
        }
        if (shadowContext) {
          const ctx = shadowContext;
          ctx.clearRect(0, 0, shadow.width, shadow.height);
          ctx.save(); ctx.scale(ratio, ratio);
          ctx.fillStyle = `rgba(0,0,0,${.18 * lift})`;
          ctx.shadowColor = `rgba(0,0,0,${.28 * lift})`;
          ctx.shadowBlur = (8 + 18 * lift) * ratio;
          ctx.beginPath();
          const edge = (col: number, row: number, first = false) => {
            const offset = (row * (COLUMNS + 1) + col) * STRIDE;
            const depth = -vertices[offset + 2] * 2;
            const x = (vertices[offset] + 1) * options.width / 2 + sign * depth * 24;
            const y = (1 - vertices[offset + 1]) * options.height / 2 + depth * 16;
            if (first) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          };
          for (let c = 0; c <= COLUMNS; c++) edge(c, 0, c === 0);
          for (let r = 1; r <= ROWS; r++) edge(COLUMNS, r);
          for (let c = COLUMNS - 1; c >= 0; c--) edge(c, ROWS);
          for (let r = ROWS - 1; r >= 0; r--) edge(0, r);
          ctx.closePath(); ctx.fill(); ctx.restore();
        }
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniform1f(liftUniform, lift);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      },
      dispose() { resources.reverse().forEach((dispose) => dispose()); gl.getExtension("WEBGL_lose_context")?.loseContext(); },
    };
  } catch {
    resources.reverse().forEach((dispose) => dispose());
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }
}
