import { useEffect, useMemo, useState, type CSSProperties } from 'react';

type EffectKind = 'smoke' | 'lightning' | 'flame' | 'rocket';

type Burst = {
  id: string;
  kind: EffectKind;
  x: number;
  y: number;
  width: number;
  height: number;
  duration: number;
};

const EFFECT_CONFIG: Record<EffectKind, { width: number; height: number; duration: number }> = {
  smoke: { width: 320, height: 180, duration: 1000 },
  lightning: { width: 240, height: 240, duration: 2000 },
  flame: { width: 240, height: 240, duration: 2000 },
  rocket: { width: 250, height: 250, duration: 3000 },
};

function svgMarkup(kind: EffectKind, id: string) {
  if (kind === 'smoke') {
    return `
      <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bananazGlow-${id}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffe600" stop-opacity="0.9"/>
            <stop offset="45%" stop-color="#d6d000" stop-opacity="0.35"/>
            <stop offset="80%" stop-color="#70ff00" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
          </radialGradient>
          <filter id="smoke-${id}">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="8" result="noise">
              <animate attributeName="baseFrequency" dur="9s" values="0.014;0.022;0.017;0.014" repeatCount="indefinite"/>
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="55" xChannelSelector="R" yChannelSelector="G"/>
            <feGaussianBlur stdDeviation="18"/>
          </filter>
        </defs>
        <g filter="url(#smoke-${id})" opacity="0.75">
          <ellipse cx="360" cy="190" rx="250" ry="95" fill="url(#bananazGlow-${id})">
            <animate attributeName="opacity" dur="6s" values="0.45;0.85;0.55;0.45" repeatCount="indefinite"/>
          </ellipse>
          <ellipse cx="470" cy="210" rx="190" ry="70" fill="url(#bananazGlow-${id})" opacity="0.55">
            <animateTransform attributeName="transform" type="translate" dur="10s" values="-20 0; 25 -10; -20 0" repeatCount="indefinite"/>
          </ellipse>
        </g>
      </svg>
    `;
  }

  if (kind === 'lightning') {
    return `
      <svg viewBox="0 0 420 420" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="electricGlow-${id}" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="softGlow"/>
            <feGaussianBlur stdDeviation="14" result="wideGlow"/>
            <feMerge>
              <feMergeNode in="wideGlow"/>
              <feMergeNode in="softGlow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id="boltGradient-${id}" x1="190" y1="38" x2="232" y2="370" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FFF46B"/>
            <stop offset="42%" stop-color="#FFE100"/>
            <stop offset="72%" stop-color="#B6FF00"/>
            <stop offset="100%" stop-color="#39FF14"/>
          </linearGradient>
          <radialGradient id="impactGlow-${id}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FFE600" stop-opacity="0.9"/>
            <stop offset="45%" stop-color="#B6FF00" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#39FF14" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="212" cy="314" r="82" fill="url(#impactGlow-${id})" opacity="0">
          <animate attributeName="opacity" values="0;0.85;0" dur="700ms" begin="0s" fill="freeze"/>
          <animate attributeName="r" values="18;96;124" dur="700ms" begin="0s" fill="freeze"/>
        </circle>
        <path d="M232 34 L136 206 H199 L164 386 L292 174 H220 L232 34Z" fill="url(#boltGradient-${id})" filter="url(#electricGlow-${id})" opacity="0">
          <animate attributeName="opacity" values="0;1;0.65;1;0" keyTimes="0;0.12;0.22;0.38;1" dur="900ms" begin="0s" fill="freeze"/>
          <animateTransform attributeName="transform" type="scale" values="0.85;1.08;0.98;1" dur="420ms" begin="0s" additive="sum" fill="freeze"/>
        </path>
        <path d="M223 66 L163 198 H216 L190 320 L263 188 H216 L223 66Z" fill="#FFFFFF" opacity="0">
          <animate attributeName="opacity" values="0;0.95;0.2;0.8;0" keyTimes="0;0.1;0.24;0.34;1" dur="650ms" begin="0s" fill="freeze"/>
        </path>
        <g stroke="#B6FF00" stroke-width="5" stroke-linecap="round" filter="url(#electricGlow-${id})" opacity="0">
          <path d="M145 238 L92 218 L123 202"/>
          <path d="M264 238 L335 214 L297 200"/>
          <path d="M178 326 L112 350"/>
          <path d="M248 318 L317 354"/>
          <animate attributeName="opacity" values="0;1;0" dur="520ms" begin="120ms" fill="freeze"/>
        </g>
        <g fill="#FFE600" opacity="0">
          <circle cx="104" cy="218" r="4"/>
          <circle cx="320" cy="218" r="3.5"/>
          <circle cx="118" cy="348" r="3"/>
          <circle cx="304" cy="354" r="4"/>
          <circle cx="210" cy="365" r="3"/>
          <animate attributeName="opacity" values="0;1;0" dur="720ms" begin="180ms" fill="freeze"/>
        </g>
      </svg>
    `;
  }

  if (kind === 'flame') {
    return `
      <svg viewBox="0 0 420 420" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="flameGlow-${id}" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="7" result="softGlow"/>
            <feGaussianBlur stdDeviation="20" result="wideGlow"/>
            <feMerge>
              <feMergeNode in="wideGlow"/>
              <feMergeNode in="softGlow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="heatWave-${id}" x="-40%" y="-40%" width="180%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.045" numOctaves="3" seed="9" result="heatNoise">
              <animate attributeName="baseFrequency" dur="2.8s" values="0.018 0.045;0.026 0.065;0.015 0.038;0.018 0.045" repeatCount="indefinite"/>
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="heatNoise" scale="10" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
          <linearGradient id="outerFlame-${id}" x1="210" y1="44" x2="210" y2="374" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FFF46B"/>
            <stop offset="25%" stop-color="#FFE100"/>
            <stop offset="58%" stop-color="#FF8A00"/>
            <stop offset="100%" stop-color="#FF3D00"/>
          </linearGradient>
          <linearGradient id="innerFlame-${id}" x1="210" y1="130" x2="210" y2="342" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FFFFFF"/>
            <stop offset="35%" stop-color="#FFF46B"/>
            <stop offset="72%" stop-color="#B6FF00"/>
            <stop offset="100%" stop-color="#39FF14"/>
          </linearGradient>
          <radialGradient id="baseGlow-${id}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FFE600" stop-opacity="0.85"/>
            <stop offset="45%" stop-color="#FF8A00" stop-opacity="0.35"/>
            <stop offset="80%" stop-color="#39FF14" stop-opacity="0.16"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <ellipse cx="210" cy="322" rx="106" ry="58" fill="url(#baseGlow-${id})" opacity="0.6">
          <animate attributeName="opacity" dur="1.5s" values="0.35;0.75;0.45;0.7;0.35" repeatCount="indefinite"/>
          <animate attributeName="rx" dur="1.7s" values="82;118;96;106;82" repeatCount="indefinite"/>
        </ellipse>
        <g filter="url(#flameGlow-${id})">
          <path d="M213 38 C247 92 320 137 291 226 C277 270 314 300 267 347 C238 377 184 377 154 348 C106 301 143 262 128 218 C104 149 169 119 181 73 C187 104 211 118 213 38Z" fill="url(#outerFlame-${id})" opacity="0.92" filter="url(#heatWave-${id})">
            <animate attributeName="d" dur="1.35s" repeatCount="indefinite" values="M213 38 C247 92 320 137 291 226 C277 270 314 300 267 347 C238 377 184 377 154 348 C106 301 143 262 128 218 C104 149 169 119 181 73 C187 104 211 118 213 38Z;M206 42 C257 91 306 145 286 222 C274 270 323 301 260 350 C230 376 177 371 151 344 C113 304 135 264 125 214 C112 150 176 113 187 69 C191 111 217 121 206 42Z;M216 36 C241 89 326 142 294 231 C281 274 306 301 271 345 C241 380 181 378 149 350 C101 309 149 263 130 221 C105 154 164 122 179 76 C185 101 207 116 216 36Z;M213 38 C247 92 320 137 291 226 C277 270 314 300 267 347 C238 377 184 377 154 348 C106 301 143 262 128 218 C104 149 169 119 181 73 C187 104 211 118 213 38Z"/>
          </path>
          <path d="M214 104 C245 150 272 184 258 236 C249 270 283 295 247 326 C223 348 185 348 163 323 C133 290 162 265 151 230 C136 181 185 163 190 120 C198 151 219 154 214 104Z" fill="#FFE100" opacity="0.74" filter="url(#heatWave-${id})">
            <animate attributeName="opacity" dur="1.1s" values="0.52;0.82;0.62;0.9;0.52" repeatCount="indefinite"/>
          </path>
          <path d="M211 158 C232 192 243 218 232 257 C225 281 249 297 226 316 C209 330 184 325 173 307 C154 276 181 258 174 232 C166 198 198 191 199 164 C205 184 216 185 211 158Z" fill="url(#innerFlame-${id})" opacity="0.85" filter="url(#heatWave-${id})">
            <animate attributeName="opacity" dur="850ms" values="0.45;0.95;0.62;1;0.45" repeatCount="indefinite"/>
            <animateTransform attributeName="transform" type="scale" dur="950ms" values="0.96;1.04;0.98;1.06;0.96" additive="sum" repeatCount="indefinite"/>
          </path>
        </g>
        <g fill="#FFE600" filter="url(#flameGlow-${id})" opacity="0.75">
          <circle cx="143" cy="205" r="3"><animate attributeName="cy" values="205;145;105" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite"/></circle>
          <circle cx="279" cy="225" r="2.5"><animate attributeName="cy" values="225;172;122" dur="1.5s" begin="300ms" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="1.5s" begin="300ms" repeatCount="indefinite"/></circle>
          <circle cx="185" cy="246" r="2.8"><animate attributeName="cy" values="246;188;136" dur="1.65s" begin="600ms" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="1.65s" begin="600ms" repeatCount="indefinite"/></circle>
          <circle cx="238" cy="260" r="3.2"><animate attributeName="cy" values="260;198;150" dur="1.9s" begin="900ms" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="1.9s" begin="900ms" repeatCount="indefinite"/></circle>
        </g>
        <circle cx="210" cy="318" r="82" stroke="#B6FF00" stroke-width="3" opacity="0" filter="url(#flameGlow-${id})">
          <animate attributeName="opacity" values="0;0.65;0" dur="900ms" begin="0s" repeatCount="indefinite"/>
          <animate attributeName="r" values="42;96;124" dur="900ms" begin="0s" repeatCount="indefinite"/>
        </circle>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 420 420" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="rocketGlow-${id}" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="softGlow"/>
          <feGaussianBlur stdDeviation="13" result="wideGlow"/>
          <feMerge>
            <feMergeNode in="wideGlow"/>
            <feMergeNode in="softGlow"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="flameDistort-${id}" x="-70%" y="-70%" width="240%" height="240%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03 0.075" numOctaves="3" seed="12" result="noise">
            <animate attributeName="baseFrequency" dur="1.3s" values="0.03 0.075;0.045 0.095;0.022 0.06;0.03 0.075" repeatCount="indefinite"/>
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <linearGradient id="rocketBody-${id}" x1="210" y1="54" x2="210" y2="270" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="38%" stop-color="#F3F3F3"/>
          <stop offset="70%" stop-color="#CFCFCF"/>
          <stop offset="100%" stop-color="#6C6C6C"/>
        </linearGradient>
        <linearGradient id="rocketTrim-${id}" x1="164" y1="120" x2="258" y2="260" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFF46B"/>
          <stop offset="46%" stop-color="#FFE100"/>
          <stop offset="100%" stop-color="#B6FF00"/>
        </linearGradient>
        <linearGradient id="flameMain-${id}" x1="210" y1="250" x2="210" y2="390" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="22%" stop-color="#FFF46B"/>
          <stop offset="54%" stop-color="#FFE100"/>
          <stop offset="78%" stop-color="#FF8A00"/>
          <stop offset="100%" stop-color="#39FF14"/>
        </linearGradient>
        <radialGradient id="blastGlow-${id}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFE600" stop-opacity="0.9"/>
          <stop offset="45%" stop-color="#B6FF00" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#39FF14" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="210" cy="336" rx="76" ry="42" fill="url(#blastGlow-${id})" opacity="0.55">
        <animate attributeName="opacity" dur="1.2s" values="0.25;0.75;0.35;0.65;0.25" repeatCount="indefinite"/>
        <animate attributeName="rx" dur="1.2s" values="58;94;70;86;58" repeatCount="indefinite"/>
      </ellipse>
      <g filter="url(#rocketGlow-${id})">
        <animateTransform attributeName="transform" type="translate" dur="1.4s" values="0 8; 0 -8; 0 4; 0 -5; 0 8" repeatCount="indefinite"/>
        <g filter="url(#flameDistort-${id})">
          <path d="M190 266 C176 298 184 334 210 386 C236 334 245 298 230 266 C221 284 199 284 190 266Z" fill="url(#flameMain-${id})" opacity="0.92">
            <animate attributeName="d" dur="700ms" repeatCount="indefinite" values="M190 266 C176 298 184 334 210 386 C236 334 245 298 230 266 C221 284 199 284 190 266Z;M187 264 C170 306 191 330 210 392 C229 330 252 306 233 264 C220 292 201 288 187 264Z;M194 266 C182 292 178 338 210 378 C242 338 238 292 226 266 C220 280 200 280 194 266Z;M190 266 C176 298 184 334 210 386 C236 334 245 298 230 266 C221 284 199 284 190 266Z"/>
          </path>
          <path d="M200 282 C192 304 198 330 210 356 C222 330 228 304 220 282 C215 292 205 292 200 282Z" fill="#39FF14" opacity="0.7">
            <animate attributeName="opacity" dur="500ms" values="0.35;0.9;0.45;0.85;0.35" repeatCount="indefinite"/>
          </path>
        </g>
        <path d="M174 210 L126 282 C121 291 128 301 138 298 L184 282 Z" fill="url(#rocketTrim-${id})" opacity="0.92"/>
        <path d="M246 210 L294 282 C299 291 292 301 282 298 L236 282 Z" fill="url(#rocketTrim-${id})" opacity="0.92"/>
        <path d="M210 42 C254 88 270 159 248 254 C238 290 182 290 172 254 C150 159 166 88 210 42Z" fill="url(#rocketBody-${id})"/>
        <path d="M170 232 C188 244 232 244 250 232 C249 243 247 251 244 260 C225 274 195 274 176 260 C173 251 171 243 170 232Z" fill="url(#rocketTrim-${id})" opacity="0.95"/>
        <circle cx="210" cy="144" r="34" fill="#151515" stroke="#FFE600" stroke-width="6"/>
        <circle cx="210" cy="144" r="20" fill="#B6FF00" opacity="0.7">
          <animate attributeName="opacity" dur="1.1s" values="0.35;0.85;0.5;0.9;0.35" repeatCount="indefinite"/>
        </circle>
        <path d="M210 42 C224 58 237 81 245 108 C229 96 192 96 175 108 C183 81 196 58 210 42Z" fill="#FFE100" opacity="0.85"/>
        <path d="M195 82 C180 126 177 182 188 238" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" opacity="0.35"/>
      </g>
      <g stroke-linecap="round" filter="url(#rocketGlow-${id})">
        <path d="M142 308 L104 326" stroke="#FFE600" stroke-width="5"><animate attributeName="opacity" values="0;1;0" dur="650ms" repeatCount="indefinite"/></path>
        <path d="M128 344 L82 366" stroke="#39FF14" stroke-width="4"><animate attributeName="opacity" values="0;0.9;0" dur="800ms" begin="150ms" repeatCount="indefinite"/></path>
        <path d="M160 360 L132 396" stroke="#FFF46B" stroke-width="4"><animate attributeName="opacity" values="0;1;0" dur="900ms" begin="300ms" repeatCount="indefinite"/></path>
      </g>
      <g stroke-linecap="round" filter="url(#rocketGlow-${id})">
        <path d="M278 308 L316 326" stroke="#FFE600" stroke-width="5"><animate attributeName="opacity" values="0;1;0" dur="700ms" begin="100ms" repeatCount="indefinite"/></path>
        <path d="M292 344 L338 366" stroke="#39FF14" stroke-width="4"><animate attributeName="opacity" values="0;0.9;0" dur="820ms" begin="220ms" repeatCount="indefinite"/></path>
        <path d="M260 360 L288 396" stroke="#FFF46B" stroke-width="4"><animate attributeName="opacity" values="0;1;0" dur="940ms" begin="380ms" repeatCount="indefinite"/></path>
      </g>
      <g fill="#FFE600" filter="url(#rocketGlow-${id})">
        <circle cx="116" cy="316" r="3"><animate attributeName="cy" values="316;352;388" dur="1.1s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0.6;0" dur="1.1s" repeatCount="indefinite"/></circle>
        <circle cx="300" cy="318" r="3.5"><animate attributeName="cy" values="318;354;390" dur="1.25s" begin="120ms" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0.65;0" dur="1.25s" begin="120ms" repeatCount="indefinite"/></circle>
        <circle cx="178" cy="354" r="2.8"><animate attributeName="cy" values="354;382;410" dur="900ms" begin="260ms" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0.55;0" dur="900ms" begin="260ms" repeatCount="indefinite"/></circle>
        <circle cx="242" cy="354" r="2.8"><animate attributeName="cy" values="354;382;410" dur="940ms" begin="360ms" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0.55;0" dur="940ms" begin="360ms" repeatCount="indefinite"/></circle>
      </g>
      <ellipse cx="210" cy="340" rx="54" ry="18" stroke="#B6FF00" stroke-width="4" opacity="0" filter="url(#rocketGlow-${id})">
        <animate attributeName="opacity" values="0;0.75;0" dur="1.1s" repeatCount="indefinite"/>
        <animate attributeName="rx" values="40;92;128" dur="1.1s" repeatCount="indefinite"/>
        <animate attributeName="ry" values="12;28;42" dur="1.1s" repeatCount="indefinite"/>
      </ellipse>
    </svg>
  `;
}

export function BananazFxLayer() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  useEffect(() => {
    if (reduceMotion) return;

    const spawn = (kind: EffectKind, x: number, y: number) => {
      const config = EFFECT_CONFIG[kind];
      const id = `${kind}-${Math.random().toString(36).slice(2, 10)}`;
      const burst: Burst = {
        id,
        kind,
        x,
        y,
        width: config.width,
        height: config.height,
        duration: config.duration,
      };

      setBursts((current) => [...current, burst]);
      window.setTimeout(() => {
        setBursts((current) => current.filter((item) => item.id !== id));
      }, config.duration);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;

      const target = event.target.closest<HTMLElement>('[data-fx], button, a, [role="button"]');
      if (!target) return;

      spawn('smoke', event.clientX, event.clientY);

      const kind = target.dataset.fx as EffectKind | undefined;
      if (!kind || !(kind in EFFECT_CONFIG)) return;

      const anchor = target.dataset.fxAnchor === 'pointer' ? 'pointer' : 'center';
      const rect = target.getBoundingClientRect();
      const x = anchor === 'pointer' ? event.clientX : rect.left + rect.width / 2;
      const y = anchor === 'pointer' ? event.clientY : rect.top + rect.height / 2;

      spawn(kind, x, y);
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return (
    <div className="bananaz-fx-layer" aria-hidden="true">
      {bursts.map((burst) => (
        <div
          key={burst.id}
          className={`bananaz-fx-burst bananaz-fx-${burst.kind}`}
          style={
            {
              left: `${burst.x}px`,
              top: `${burst.y}px`,
              width: `${burst.width}px`,
              height: `${burst.height}px`,
              '--fx-duration': `${burst.duration}ms`,
            } as CSSProperties
          }
          dangerouslySetInnerHTML={{ __html: svgMarkup(burst.kind, burst.id) }}
        />
      ))}
    </div>
  );
}
