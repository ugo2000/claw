const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'res', 'icons-android');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size;
  const r = size * 0.205; // corner radius ~140/680

  // Background - rounded rect
  ctx.beginPath();
  ctx.roundRect(0, 0, s, s, r);
  ctx.fillStyle = '#0f172a';
  ctx.fill();

  // Dark gradient overlay (top-left to bottom-right)
  const bgGrad = ctx.createLinearGradient(0, 0, s, s);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(1, '#1e3a5f');
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Globe rings
  const gcx = s * 0.5;   // globe center x
  const gcy = s * 0.529; // globe center y
  const gr = s * 0.287;  // globe radius

  ctx.strokeStyle = 'rgba(51,65,85,0.55)';
  ctx.lineWidth = s * 0.010;
  ctx.beginPath();
  ctx.arc(gcx, gcy, gr, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(51,65,85,0.4)';
  ctx.lineWidth = s * 0.0074;
  ctx.beginPath();
  ctx.ellipse(gcx, gcy, gr * 0.487, gr, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(51,65,85,0.35)';
  ctx.lineWidth = s * 0.0074;
  // Horizontal line
  ctx.beginPath();
  ctx.moveTo(gcx - gr, gcy);
  ctx.lineTo(gcx + gr, gcy);
  ctx.stroke();
  // Vertical line
  ctx.beginPath();
  ctx.moveTo(gcx, gcy - gr);
  ctx.lineTo(gcx, gcy + gr);
  ctx.stroke();

  // Claw shape
  const clawCx = s * 0.5;   // claw center x
  const clawCy = s * 0.397; // claw center y
  const scale = s / 680;

  // Claw gradient
  const clawGrad = ctx.createLinearGradient(
    clawCx - 80 * scale,
    clawCy - 80 * scale,
    clawCx + 80 * scale,
    clawCy + 40 * scale
  );
  clawGrad.addColorStop(0, '#3b82f6');
  clawGrad.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = clawGrad;

  // Palm base
  ctx.beginPath();
  ctx.ellipse(clawCx, clawCy - 28 * scale, 58 * scale, 44 * scale, 0, 0, Math.PI * 2);
  ctx.globalAlpha = 0.92;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Draw talons
  function drawTalon(points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0] * scale + clawCx, points[0][1] * scale + clawCy);
    for (let i = 1; i < points.length; i++) {
      if (points[i].length === 4) {
        ctx.quadraticCurveTo(
          points[i][1] * scale + clawCx, points[i][2] * scale + clawCy,
          points[i][3] * scale + clawCx, points[i][4] * scale + clawCy
        );
      } else {
        ctx.lineTo(points[i][0] * scale + clawCx, points[i][1] * scale + clawCy);
      }
    }
    ctx.closePath();
    ctx.fill();
  }

  // Talon 1 - left outer
  drawTalon([
    [-38, -40],
    [-105, -98, -128, -176],
    [-136, -204],
    [-116, -212],
    [-96, -202],
    [-84, -160],
    [-60, -98],
    [-26, -52]
  ]);

  // Talon 2 - left-middle
  drawTalon([
    [16, -56],
    [-45, -120, -46, -194],
    [-43, -222],
    [-22, -224],
    [-6, -216],
    [-6, -174],
    [-6, -114],
    [0, -62]
  ]);

  // Talon 3 - right-middle (main)
  drawTalon([
    [14, -58],
    [20, -138, 40, -214],
    [50, -244],
    [74, -236],
    [94, -220],
    [76, -172],
    [54, -112],
    [28, -58]
  ]);

  // Talon 4 - right outer
  drawTalon([
    [40, -42],
    [94, -86, 134, -138],
    [154, -164],
    [142, -188],
    [122, -180],
    [102, -144],
    [72, -88],
    [48, -46]
  ]);

  // Highlight strokes on claw
  ctx.strokeStyle = 'rgba(96,165,250,0.45)';
  ctx.lineWidth = s * 0.009;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-26 * scale + clawCx, -64 * scale + clawCy);
  ctx.quadraticCurveTo(-60 * scale + clawCx, -114 * scale + clawCy, -74 * scale + clawCx, -162 * scale + clawCy);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(96,165,250,0.35)';
  ctx.beginPath();
  ctx.moveTo(18 * scale + clawCx, -70 * scale + clawCy);
  ctx.quadraticCurveTo(34 * scale + clawCx, -118 * scale + clawCy, 46 * scale + clawCx, -174 * scale + clawCy);
  ctx.stroke();

  // Accent spark (gold dot)
  const sparkGrad = ctx.createRadialGradient(500 * scale, 195 * scale, 0, 500 * scale, 195 * scale, 17 * scale);
  sparkGrad.addColorStop(0, '#f59e0b');
  sparkGrad.addColorStop(1, '#d97706');
  ctx.fillStyle = sparkGrad;
  ctx.beginPath();
  ctx.arc(500 * scale, 195 * scale, 17 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Secondary glow dot
  ctx.fillStyle = 'rgba(252,211,77,0.55)';
  ctx.beginPath();
  ctx.arc(514 * scale, 228 * scale, 10 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Orbit line near spark
  ctx.strokeStyle = 'rgba(71,85,105,0.5)';
  ctx.lineWidth = s * 0.0066;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(440 * scale, 185 * scale);
  ctx.quadraticCurveTo(525 * scale, 145 * scale, 560 * scale, 200 * scale);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

// Generate all required sizes
const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
  'ic_launcher': 192, // also generate full-size source
};

for (const [name, size] of Object.entries(sizes)) {
  const buf = drawIcon(size);
  const filename = name === 'ic_launcher' ? 'ic_launcher.png' : `${name}.png`;
  fs.writeFileSync(path.join(outDir, filename), buf);
  console.log(`Generated ${filename} (${size}x${size})`);
}
console.log('Done! All icons saved to:', outDir);
