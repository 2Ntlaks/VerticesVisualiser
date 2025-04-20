// DOM Elements
const shapeSelect = document.getElementById("shapeSelect");
const inputCanvas = document.getElementById("inputCanvas");
const glCanvas = document.getElementById("glCanvas");
const primitiveName = document.getElementById("primitiveName");
const maxVerticesSpan = document.getElementById("maxVertices");
const colorPicker = document.getElementById("colorPicker");
const resetBtn = document.getElementById("resetBtn");
const undoBtn = document.getElementById("undoBtn");
const codeSnippet = document.getElementById("codeSnippet");
const copyCodeBtn = document.getElementById("copyCodeBtn");

// Shape configuration
const shapes = {
  point: { vertices: 1, primitive: "gl.POINTS", drawMode: "POINTS" },
  line: { vertices: 2, primitive: "gl.LINES", drawMode: "LINES" },
  line_strip: {
    vertices: 10,
    primitive: "gl.LINE_STRIP",
    drawMode: "LINE_STRIP",
  },
  line_loop: { vertices: 10, primitive: "gl.LINE_LOOP", drawMode: "LINE_LOOP" },
  triangle: { vertices: 3, primitive: "gl.TRIANGLES", drawMode: "TRIANGLES" },
  triangle_strip: {
    vertices: 10,
    primitive: "gl.TRIANGLE_STRIP",
    drawMode: "TRIANGLE_STRIP",
  },
  triangle_fan: {
    vertices: 10,
    primitive: "gl.TRIANGLE_FAN",
    drawMode: "TRIANGLE_FAN",
  },
  rectangle: {
    vertices: 4,
    primitive: "gl.TRIANGLE_FAN",
    drawMode: "TRIANGLE_FAN",
  },
  pentagon: {
    vertices: 5,
    primitive: "gl.TRIANGLE_FAN",
    drawMode: "TRIANGLE_FAN",
  },
  hexagon: {
    vertices: 6,
    primitive: "gl.TRIANGLE_FAN",
    drawMode: "TRIANGLE_FAN",
  },
  octagon: {
    vertices: 8,
    primitive: "gl.TRIANGLE_FAN",
    drawMode: "TRIANGLE_FAN",
  },
};

// Initialize state
let shapeType = "point";
let maxVertices = shapes[shapeType].vertices;
let vertices = [];
let isMouseOverCanvas = false;
let mousePosition = { x: 0, y: 0 };

// Update maxVertices display
maxVerticesSpan.textContent = maxVertices;

// Set up 2D and WebGL contexts
const ctx = inputCanvas.getContext("2d");
const gl = glCanvas.getContext("webgl");
if (!gl) {
  alert(
    "WebGL is not supported in this browser. Please use a WebGL-compatible browser."
  );
  throw new Error("WebGL not supported");
}

// WebGL shader setup with color support
const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec4 a_color;
    varying vec4 v_color;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0); // z = 0 for 2D
        gl_PointSize = 10.0;
        v_color = a_color;
    }
`;
const fragmentShaderSource = `
    precision mediump float;
    varying vec4 v_color;
    void main() {
        gl_FragColor = v_color;
    }
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Create and link WebGL program
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(
  gl,
  gl.FRAGMENT_SHADER,
  fragmentShaderSource
);
const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  console.error("Program linking error:", gl.getProgramInfoLog(program));
}
gl.useProgram(program);

// Set up WebGL attributes
const positionLocation = gl.getAttribLocation(program, "a_position");
const colorLocation = gl.getAttribLocation(program, "a_color");
gl.enableVertexAttribArray(positionLocation);
gl.enableVertexAttribArray(colorLocation);
const positionBuffer = gl.createBuffer();
const colorBuffer = gl.createBuffer();
gl.viewport(0, 0, glCanvas.width, glCanvas.height);
gl.clearColor(1.0, 1.0, 1.0, 1.0);

// Helper function: Convert hex color to RGB
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b, a: 1.0 };
}

// Draw grid on input canvas
function drawGrid() {
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= inputCanvas.width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, inputCanvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= inputCanvas.height; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(inputCanvas.width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, inputCanvas.height / 2);
  ctx.lineTo(inputCanvas.width, inputCanvas.height / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(inputCanvas.width / 2, 0);
  ctx.lineTo(inputCanvas.width / 2, inputCanvas.height);
  ctx.stroke();
  ctx.fillStyle = "#999";
  ctx.beginPath();
  ctx.arc(inputCanvas.width / 2, inputCanvas.height / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#666";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    "(0,0) in NDC",
    inputCanvas.width / 2,
    inputCanvas.height / 2 + 20
  );
  ctx.textAlign = "left";
  ctx.fillText("(-1,1)", 10, 15);
  ctx.textAlign = "right";
  ctx.fillText("(1,1)", inputCanvas.width - 10, 15);
  ctx.textAlign = "left";
  ctx.fillText("(-1,-1)", 10, inputCanvas.height - 5);
  ctx.textAlign = "right";
  ctx.fillText("(1,-1)", inputCanvas.width - 10, inputCanvas.height - 5);
}

// Draw connections between vertices
function drawEdgeConnections() {
  if (vertices.length <= 1 && shapeType !== "point") return;
  ctx.lineWidth = 2;
  const drawMode = shapes[shapeType].drawMode;
  switch (drawMode) {
    case "LINES":
      ctx.strokeStyle = "rgba(0, 102, 204, 0.7)";
      for (let i = 0; i < vertices.length - 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(vertices[i].pixelX, vertices[i].pixelY);
        if (vertices[i + 1]) {
          ctx.lineTo(vertices[i + 1].pixelX, vertices[i + 1].pixelY);
        }
        ctx.stroke();
      }
      break;
    case "LINE_STRIP":
      ctx.strokeStyle = "rgba(0, 102, 204, 0.7)";
      ctx.beginPath();
      ctx.moveTo(vertices[0].pixelX, vertices[0].pixelY);
      for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].pixelX, vertices[i].pixelY);
      }
      ctx.stroke();
      break;
    case "LINE_LOOP":
      ctx.strokeStyle = "rgba(0, 102, 204, 0.7)";
      ctx.beginPath();
      ctx.moveTo(vertices[0].pixelX, vertices[0].pixelY);
      for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].pixelX, vertices[i].pixelY);
      }
      if (vertices.length >= 2) {
        ctx.lineTo(vertices[0].pixelX, vertices[0].pixelY);
      }
      ctx.stroke();
      break;
    case "TRIANGLES":
      ctx.strokeStyle = "rgba(0, 153, 0, 0.7)";
      for (let i = 0; i < vertices.length - 2; i += 3) {
        if (vertices[i + 2]) {
          ctx.beginPath();
          ctx.moveTo(vertices[i].pixelX, vertices[i].pixelY);
          ctx.lineTo(vertices[i + 1].pixelX, vertices[i + 1].pixelY);
          ctx.lineTo(vertices[i + 2].pixelX, vertices[i + 2].pixelY);
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = "rgba(0, 153, 0, 0.1)";
          ctx.fill();
        }
      }
      break;
    case "TRIANGLE_STRIP":
      ctx.strokeStyle = "rgba(204, 102, 0, 0.7)";
      for (let i = 0; i < vertices.length - 2; i++) {
        ctx.beginPath();
        ctx.moveTo(vertices[i].pixelX, vertices[i].pixelY);
        ctx.lineTo(vertices[i + 1].pixelX, vertices[i + 1].pixelY);
        ctx.lineTo(vertices[i + 2].pixelX, vertices[i + 2].pixelY);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = "rgba(204, 102, 0, 0.1)";
        ctx.fill();
      }
      break;
    case "TRIANGLE_FAN":
      ctx.strokeStyle = "rgba(153, 0, 204, 0.7)";
      if (vertices.length >= 3) {
        for (let i = 1; i < vertices.length - 1; i++) {
          ctx.beginPath();
          ctx.moveTo(vertices[0].pixelX, vertices[0].pixelY);
          ctx.lineTo(vertices[i].pixelX, vertices[i].pixelY);
          ctx.lineTo(vertices[i + 1].pixelX, vertices[i + 1].pixelY);
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = "rgba(153, 0, 204, 0.1)";
          ctx.fill();
        }
      }
      break;
    default:
      break;
  }
}

// Update the code snippet
function updateCodeSnippet() {
  let code = "";

  // Add primitive type info
  code += `// Use ${shapes[shapeType].primitive} for this shape\n\n`;

  // Add vertices
  if (vertices.length > 0) {
    // Position vertices - with z=0
    code += `// Vertex positions (x, y, z) in Normalized Device Coordinates (NDC)\n`;
    code += `const vertices = [\n`;
    vertices.forEach((v, i) => {
      code += `  ${v.ndcX.toFixed(2)}, ${v.ndcY.toFixed(
        2
      )}, 0.0,  // Vertex ${i}\n`;
    });
    code += `];\n\n`;

    // Color vertices - rgb only
    code += `// Vertex colors (r, g, b)\n`;
    code += `const colors = [\n`;
    vertices.forEach((v, i) => {
      code += `  ${v.color.r.toFixed(2)}, ${v.color.g.toFixed(
        2
      )}, ${v.color.b.toFixed(2)},  // Vertex ${i}\n`;
    });
    code += `];\n\n`;

    // Just the drawing call - nothing else
    code += `// Drawing code\n`;
    code += `gl.drawArrays(${shapes[shapeType].primitive}, 0, ${vertices.length});\n`;
  } else {
    code += `// Click on the canvas to add vertices\n`;
    code += `// Once you add vertices, code will be generated here\n`;
  }

  codeSnippet.textContent = code;
}

// Update the entire display
function updateDisplay() {
  ctx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
  drawGrid();
  drawEdgeConnections();
  ctx.fillStyle = "blue";
  vertices.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(v.pixelX, v.pixelY, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(i, v.pixelX, v.pixelY); // Use zero-based indexing
    ctx.fillStyle = "blue";
  });
  updateCodeSnippet();
  primitiveName.textContent = shapes[shapeType].primitive;
  updateWebGL();
}

// Render shapes or points in WebGL
function updateWebGL() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (vertices.length === 0) return;
  const positionData = vertices.flatMap((v) => [v.ndcX, v.ndcY]);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(positionData),
    gl.STATIC_DRAW
  );
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  const colorData = vertices.flatMap((v) => [
    v.color.r,
    v.color.g,
    v.color.b,
    v.color.a,
  ]);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorData), gl.STATIC_DRAW);
  gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);
  const minVertices = shapeType === "point" ? 1 : 2;
  if (vertices.length >= minVertices) {
    gl.drawArrays(gl[shapes[shapeType].drawMode], 0, vertices.length);
  } else {
    gl.drawArrays(gl.POINTS, 0, vertices.length);
  }
}

// Show preview of where vertex would be placed
function drawVertexPreview(x, y) {
  if (vertices.length >= maxVertices) return;
  const ndcX = (2 * x) / inputCanvas.width - 1;
  const ndcY = 1 - (2 * y) / inputCanvas.height;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = colorPicker.value;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = "black";
  ctx.font = "12px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`Pixel: (${x.toFixed(0)}, ${y.toFixed(0)})`, x + 10, y - 10);
  ctx.fillText(`NDC: (${ndcX.toFixed(2)}, ${ndcY.toFixed(2)})`, x + 10, y + 10);
  ctx.restore();
}

// Handle shape selection change
shapeSelect.addEventListener("change", () => {
  shapeType = shapeSelect.value;
  maxVertices = shapes[shapeType].vertices;
  maxVerticesSpan.textContent = maxVertices;
  vertices = [];
  updateDisplay();
});

// Handle canvas clicks to add vertices
inputCanvas.addEventListener("click", (event) => {
  if (vertices.length >= maxVertices) return;
  const rect = inputCanvas.getBoundingClientRect();
  const pixelX = event.clientX - rect.left;
  const pixelY = event.clientY - rect.top;
  const ndcX = (2 * pixelX) / inputCanvas.width - 1;
  const ndcY = 1 - (2 * pixelY) / inputCanvas.height;
  const color = hexToRgb(colorPicker.value);
  vertices.push({ pixelX, pixelY, ndcX, ndcY, color });
  updateDisplay();
});

// Mouse move to show vertex preview
inputCanvas.addEventListener("mousemove", (event) => {
  if (vertices.length >= maxVertices) return;
  const rect = inputCanvas.getBoundingClientRect();
  mousePosition.x = event.clientX - rect.left;
  mousePosition.y = event.clientY - rect.top;
  updateDisplay();
  if (isMouseOverCanvas) {
    drawVertexPreview(mousePosition.x, mousePosition.y);
  }
});

// Handle mouse enter/leave for previews
inputCanvas.addEventListener("mouseenter", () => {
  isMouseOverCanvas = true;
  updateDisplay();
});

inputCanvas.addEventListener("mouseleave", () => {
  isMouseOverCanvas = false;
  updateDisplay();
});

// Reset button functionality
resetBtn.addEventListener("click", () => {
  vertices = [];
  updateDisplay();
});

// Undo button functionality
undoBtn.addEventListener("click", () => {
  if (vertices.length > 0) {
    vertices.pop();
    updateDisplay();
  }
});

// Copy code button functionality
copyCodeBtn.addEventListener("click", () => {
  const code = codeSnippet.textContent;
  navigator.clipboard
    .writeText(code)
    .then(() => {
      copyCodeBtn.textContent = "Copied!";
      setTimeout(() => {
        copyCodeBtn.textContent = "Copy to Clipboard";
      }, 1500);
    })
    .catch((err) => {
      console.error("Could not copy text: ", err);
      copyCodeBtn.textContent = "Failed to copy";
      setTimeout(() => {
        copyCodeBtn.textContent = "Copy to Clipboard";
      }, 1500);
    });
});

// Keyboard shortcuts
document.addEventListener("keydown", (event) => {
  if (event.target.tagName !== "INPUT" && event.target.tagName !== "TEXTAREA") {
    if (event.key === "z" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (vertices.length > 0) {
        vertices.pop();
        updateDisplay();
      }
    } else if (event.key === "r" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      vertices = [];
      updateDisplay();
    }
  }
});

// Add educational tooltips
function addTooltip(element, text) {
  element.title = text;
}
addTooltip(
  inputCanvas,
  "Click to place vertices. The grid shows pixel coordinates, with (0,0) NDC at center."
);
addTooltip(
  glCanvas,
  "This shows your shape in WebGL's normalized device coordinates (NDC) where (-1,-1) is bottom-left and (1,1) is top-right."
);
addTooltip(
  shapeSelect,
  "Select a primitive type to create. Each primitive connects vertices in different ways."
);
addTooltip(
  colorPicker,
  "Choose a color for new vertices. WebGL requires color values from 0.0 to 1.0."
);
addTooltip(resetBtn, "Clear all vertices and start over.");
addTooltip(undoBtn, "Remove the last vertex you placed.");
addTooltip(
  copyCodeBtn,
  "Copy the WebGL code to your clipboard for use in your own projects."
);
// Primitive explanations
const primitiveExplanations = {
  point:
    "POINTS: Each vertex is drawn as a single point. Size is controlled by gl_PointSize in the vertex shader.",
  line: "LINES: Connects vertices in pairs (0-1, 2-3, etc.) to form independent line segments. Requires an even number of vertices.",
  line_strip:
    "LINE_STRIP: Connects each vertex to the next one in sequence, forming a continuous line. Efficient for drawing curves.",
  line_loop:
    "LINE_LOOP: Similar to LINE_STRIP, but also connects the last vertex back to the first, forming a closed loop.",
  triangle:
    "TRIANGLES: Groups vertices in sets of three to form independent triangles. Vertices are connected in order (0-1-2, 3-4-5, etc.)",
  triangle_strip:
    "TRIANGLE_STRIP: Creates a triangle from each new vertex and the previous two vertices. Efficient for mesh structures and terrain.",
  triangle_fan:
    "TRIANGLE_FAN: Creates triangles connecting each new vertex to the first vertex and the previous vertex. Good for radial shapes.",
  rectangle:
    "RECTANGLE: Uses TRIANGLE_FAN with 4 vertices. The first vertex is the center point, with the remaining vertices defining the corners.",
  pentagon:
    "PENTAGON: Uses TRIANGLE_FAN with 5 vertices. The first vertex is the center, with the remaining vertices defining the perimeter.",
  hexagon:
    "HEXAGON: Uses TRIANGLE_FAN with 6 vertices. The first vertex is the center, with the remaining vertices defining the perimeter.",
  octagon:
    "OCTAGON: Uses TRIANGLE_FAN with 8 vertices. The first vertex is the center, with the remaining vertices defining the perimeter.",
};

// Create explanation panel
const explanationPanel = document.createElement("div");
explanationPanel.id = "explanationPanel";
explanationPanel.className =
  "bg-blue-50 p-4 rounded-md shadow-md mb-4 text-gray-800";
explanationPanel.innerHTML = `<p>${primitiveExplanations[shapeType]}</p>`;

// Insert after the controls container
document
  .querySelector(".flex.items-center.mb-4.space-x-2")
  .closest("div")
  .appendChild(explanationPanel);

// Update explanation when shape changes
function updateExplanation() {
  explanationPanel.innerHTML = `<p>${primitiveExplanations[shapeType]}</p>`;
}

// Modify shapeSelect event listener
const originalShapeSelectListener = shapeSelect.onchange;
shapeSelect.addEventListener("change", () => {
  updateExplanation();
});

// Initial explanation update
updateExplanation();
// Create demo button
const demoBtn = document.createElement("button");
demoBtn.id = "demoBtn";
demoBtn.className =
  "px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none ml-2";
demoBtn.textContent = "Auto Demo";
document
  .querySelector(".flex.items-center.mb-4.space-x-2")
  .appendChild(demoBtn);

// Demo vertex positions for different primitives
const demoPositions = {
  point: [{ x: 200, y: 200 }],
  line: [
    { x: 150, y: 200 },
    { x: 250, y: 200 },
  ],
  line_strip: [
    { x: 100, y: 200 },
    { x: 150, y: 150 },
    { x: 200, y: 200 },
    { x: 250, y: 150 },
    { x: 300, y: 200 },
  ],
  line_loop: [
    { x: 200, y: 150 },
    { x: 250, y: 200 },
    { x: 200, y: 250 },
    { x: 150, y: 200 },
  ],
  triangle: [
    { x: 200, y: 150 },
    { x: 250, y: 250 },
    { x: 150, y: 250 },
  ],
  triangle_strip: [
    { x: 100, y: 150 },
    { x: 100, y: 250 },
    { x: 200, y: 150 },
    { x: 200, y: 250 },
    { x: 300, y: 150 },
    { x: 300, y: 250 },
  ],
  triangle_fan: [
    { x: 200, y: 200 }, // Center
    { x: 200, y: 100 },
    { x: 300, y: 150 },
    { x: 300, y: 250 },
    { x: 200, y: 300 },
    { x: 100, y: 250 },
    { x: 100, y: 150 },
  ],
  rectangle: [
    { x: 200, y: 200 }, // Center
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 300 },
    { x: 100, y: 300 },
  ],
  pentagon: [
    { x: 200, y: 200 }, // Center
    { x: 200, y: 100 },
    { x: 280, y: 150 },
    { x: 250, y: 250 },
    { x: 150, y: 250 },
    { x: 120, y: 150 },
  ],
  hexagon: [
    { x: 200, y: 200 }, // Center
    { x: 200, y: 100 },
    { x: 270, y: 130 },
    { x: 270, y: 270 },
    { x: 200, y: 300 },
    { x: 130, y: 270 },
    { x: 130, y: 130 },
  ],
  octagon: [
    { x: 200, y: 200 }, // Center
    { x: 200, y: 100 },
    { x: 270, y: 130 },
    { x: 300, y: 200 },
    { x: 270, y: 270 },
    { x: 200, y: 300 },
    { x: 130, y: 270 },
    { x: 100, y: 200 },
    { x: 130, y: 130 },
  ],
};

// Animation state
let demoVertexIndex = 0;
let demoAnimationId = null;
let isAnimating = false;

// Run the demo animation
function runDemo() {
  if (isAnimating) {
    // Stop the current animation if running
    clearTimeout(demoAnimationId);
    vertices = [];
    updateDisplay();
    isAnimating = false;
    demoBtn.textContent = "Auto Demo";
    return;
  }

  // Start a new animation
  vertices = [];
  demoVertexIndex = 0;
  isAnimating = true;
  demoBtn.textContent = "Stop Demo";
  addNextDemoVertex();
}

// Add vertices one by one with animation
function addNextDemoVertex() {
  const positions = demoPositions[shapeType];

  if (demoVertexIndex < positions.length && demoVertexIndex < maxVertices) {
    const pos = positions[demoVertexIndex];
    const pixelX = pos.x;
    const pixelY = pos.y;
    const ndcX = (2 * pixelX) / inputCanvas.width - 1;
    const ndcY = 1 - (2 * pixelY) / inputCanvas.height;

    // Use current color from color picker
    const color = hexToRgb(colorPicker.value);

    vertices.push({ pixelX, pixelY, ndcX, ndcY, color });
    updateDisplay();

    // Highlight the newest vertex
    ctx.beginPath();
    ctx.arc(pixelX, pixelY, 10, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
    ctx.lineWidth = 3;
    ctx.stroke();

    demoVertexIndex++;
    demoAnimationId = setTimeout(addNextDemoVertex, 800); // Add a new vertex every 800ms
  } else {
    // Animation complete
    isAnimating = false;
    demoBtn.textContent = "Auto Demo";
  }
}

// Add event listener to demo button
demoBtn.addEventListener("click", runDemo);

// Add this function to your main.js file, just before updateDisplay()

// Handle responsive canvas resizing
function handleResponsiveCanvases() {
  // Get the actual displayed width of the canvas containers
  const inputContainer = document.querySelector("#inputCanvas").parentElement;
  const glContainer = document.querySelector("#glCanvas").parentElement;

  const containerWidth = Math.min(
    inputContainer.clientWidth,
    glContainer.clientWidth
  );

  // Only proceed if we need to resize
  if (containerWidth < 400) {
    // Calculate the new dimensions to maintain aspect ratio
    const newWidth = containerWidth - 16; // Account for padding
    const newHeight = newWidth; // Keep it square for simplicity

    // Update the display size of the canvases
    inputCanvas.style.width = `${newWidth}px`;
    inputCanvas.style.height = `${newHeight}px`;
    glCanvas.style.width = `${newWidth}px`;
    glCanvas.style.height = `${newHeight}px`;

    // Keep the internal resolution the same for WebGL
    // This is important to maintain consistent drawing behavior
    inputCanvas.width = 400;
    inputCanvas.height = 400;
    glCanvas.width = 400;
    glCanvas.height = 400;
  }
}

// Add resize handler for responsive behavior
window.addEventListener("resize", function () {
  handleResponsiveCanvases();
});

// Initial call to set up responsive sizing
handleResponsiveCanvases();

// Add a meta viewport tag if not already present
// This function adds it programmatically if needed
function ensureViewportMeta() {
  if (!document.querySelector('meta[name="viewport"]')) {
    const meta = document.createElement("meta");
    meta.name = "viewport";
    meta.content =
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    document.head.appendChild(meta);
  }
}

// Call this function early
ensureViewportMeta();

// Add this to your main.js file to make the demo mode more mobile-friendly
// Place this just after the existing demo mode code

// Adjust demo positions based on screen size
function adjustDemoPositionsForScreenSize() {
  // Get current canvas dimensions
  const canvasWidth = inputCanvas.offsetWidth;
  const canvasHeight = inputCanvas.offsetHeight;

  // Only adjust if we're on a smaller screen
  if (canvasWidth < 400) {
    const scaleFactor = canvasWidth / 400;

    // Scale all demo positions
    Object.keys(demoPositions).forEach((shape) => {
      demoPositions[shape] = demoPositions[shape].map((pos) => ({
        x: pos.x * scaleFactor,
        y: pos.y * scaleFactor,
      }));
    });
  }
}

// Call this once after defining demoPositions
adjustDemoPositionsForScreenSize();

// Adjust the vertex preview for mobile displays
function adjustVertexPreviewForMobile(x, y) {
  if (window.innerWidth < 768) {
    // For mobile, show the preview info below the pointer instead of to the right
    ctx.fillText(`Pixel: (${x.toFixed(0)}, ${y.toFixed(0)})`, x - 50, y + 25);
    ctx.fillText(
      `NDC: (${((2 * x) / inputCanvas.width - 1).toFixed(2)}, ${(
        1 -
        (2 * y) / inputCanvas.height
      ).toFixed(2)})`,
      x - 50,
      y + 40
    );
  } else {
    // Standard display for larger screens
    ctx.fillText(`Pixel: (${x.toFixed(0)}, ${y.toFixed(0)})`, x + 10, y - 10);
    ctx.fillText(
      `NDC: (${((2 * x) / inputCanvas.width - 1).toFixed(2)}, ${(
        1 -
        (2 * y) / inputCanvas.height
      ).toFixed(2)})`,
      x + 10,
      y + 10
    );
  }
}

// Modify the existing drawVertexPreview function to use this
// Replace the text drawing code in drawVertexPreview with a call to adjustVertexPreviewForMobile
// Initialize the display
updateDisplay();
