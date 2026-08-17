const fs = require('fs');
const { execSync } = require('child_process');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient (Deep Professional Titanium Slate) -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="60%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#090D16"/>
    </linearGradient>

    <!-- Ring Gradient (Crisp Platinum / Titanium White) -->
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="50%" stop-color="#F1F5F9"/>
      <stop offset="100%" stop-color="#CBD5E1"/>
    </linearGradient>

    <!-- Subtle Bevel Shadow -->
    <filter id="dialShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Full Bleed Background -->
  <rect width="512" height="512" fill="url(#bgGrad)" />

  <!-- Subtle Outer Precision Ring -->
  <circle cx="256" cy="272" r="162" fill="none" stroke="#334155" stroke-width="1.5" stroke-dasharray="4 8" opacity="0.6"/>

  <!-- Main Stopwatch Housing & Dial strictly within Safe Zone -->
  <g filter="url(#dialShadow)">
    <!-- Top Crown Button -->
    <rect x="238" y="96" width="36" height="24" rx="5" fill="#F8FAFC" />
    <rect x="246" y="120" width="20" height="12" fill="#94A3B8" />

    <!-- Top Right Lap / Split Button -->
    <rect x="342" y="132" width="16" height="22" rx="4" transform="rotate(38 350 143)" fill="#E2E8F0" opacity="0.9" />

    <!-- Outer Bezel Ring -->
    <circle cx="256" cy="272" r="136" fill="#0B0F19" stroke="url(#ringGrad)" stroke-width="8" />

    <!-- Inner Dial Track -->
    <circle cx="256" cy="272" r="120" fill="#131B2E" stroke="#1E293B" stroke-width="2" />

    <!-- Major Precision Ticks (White) -->
    <line x1="256" y1="160" x2="256" y2="176" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" />
    <line x1="368" y1="272" x2="352" y2="272" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" />
    <line x1="256" y1="384" x2="256" y2="368" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" />
    <line x1="144" y1="272" x2="160" y2="272" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" />

    <!-- Minor Precision Ticks (Silver) -->
    <line x1="335" y1="193" x2="324" y2="204" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" />
    <line x1="335" y1="351" x2="324" y2="340" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" />
    <line x1="177" y1="351" x2="188" y2="340" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" />
    <line x1="177" y1="193" x2="188" y2="204" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" />

    <!-- 12-Hour Sub-track Arc in White -->
    <path d="M 256 162 A 110 110 0 0 1 366 272" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.9" />

    <!-- Minimalist Precision Hands (Pure White & Steel) -->
    <!-- Hour Hand -->
    <line x1="256" y1="272" x2="298" y2="230" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" />
    
    <!-- Minute / Chrono Hand -->
    <line x1="256" y1="272" x2="256" y2="180" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" />
    <circle cx="256" cy="180" r="3" fill="#FFFFFF" />

    <!-- Center Pivot Pin -->
    <circle cx="256" cy="272" r="7" fill="#FFFFFF" />
    <circle cx="256" cy="272" r="3" fill="#0F172A" />
  </g>
</svg>`;

fs.writeFileSync('icon.svg', svgContent, 'utf8');

console.log('Generating PNG icons with sharp-cli...');
execSync('npx -y sharp-cli -i icon.svg -o icon-512.png resize 512 512', { stdio: 'inherit' });
execSync('npx -y sharp-cli -i icon.svg -o icon-192.png resize 192 192', { stdio: 'inherit' });
execSync('npx -y sharp-cli -i icon.svg -o apple-touch-icon.png resize 180 180', { stdio: 'inherit' });
console.log('All icons generated successfully!');
