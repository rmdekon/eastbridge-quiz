/**
 * Original, school-safe SVG illustrations used by the three sample quizzes.
 * Self-contained data URLs keep the demo working fully offline.
 */
const encode = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;

const frame = (inner: string, bgA: string, bgB: string, label?: string) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="640" height="400" fill="url(#bg)"/>
  <circle cx="90" cy="60" r="90" fill="#ffffff" opacity="0.07"/>
  <circle cx="580" cy="350" r="120" fill="#ffffff" opacity="0.06"/>
  ${inner}
  ${label ? `<text x="320" y="374" text-anchor="middle" font-family="Nunito, Verdana, sans-serif" font-size="17" font-weight="700" fill="#ffffff" opacity="0.85">${label}</text>` : ''}
</svg>`;


/** Small option thumbnails (answer images). Transparent-friendly, 240×240. */
const optionIcon = (inner: string) =>
  encode(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" role="img">
  <rect width="240" height="240" rx="28" fill="#0f2b52"/>
  ${inner}
</svg>`);

const OPTION_ICONS = {
  square: optionIcon('<rect x="70" y="70" width="100" height="100" rx="8" fill="#C8973A" stroke="#ffffff" stroke-width="6"/>'),
  triangle: optionIcon('<polygon points="120,58 190,182 50,182" fill="#C8973A" stroke="#ffffff" stroke-width="6"/>'),
  circle: optionIcon('<circle cx="120" cy="120" r="62" fill="#C8973A" stroke="#ffffff" stroke-width="6"/>'),
  pentagon: optionIcon('<polygon points="120,52 191,104 164,188 76,188 49,104" fill="#C8973A" stroke="#ffffff" stroke-width="6"/>'),
};

export const IMG = {
  fractionBars: encode(
    frame(
      `<g>
        <text x="320" y="60" text-anchor="middle" font-family="Fredoka, Verdana, sans-serif" font-size="26" fill="#ffffff" opacity="0.9">Three quarters shaded</text>
        <rect x="80" y="110" width="480" height="150" rx="14" fill="#0f2b52" stroke="#C8973A" stroke-width="6"/>
        <rect x="83" y="113" width="354" height="144" rx="10" fill="#C8973A"/>
        <line x1="200" y1="110" x2="200" y2="260" stroke="#0f2b52" stroke-width="6"/>
        <line x1="320" y1="110" x2="320" y2="260" stroke="#0f2b52" stroke-width="6"/>
        <line x1="440" y1="110" x2="440" y2="260" stroke="#0f2b52" stroke-width="6"/>
        <text x="140" y="196" text-anchor="middle" font-family="Nunito, Verdana, sans-serif" font-size="34" font-weight="800" fill="#0f2b52">1/4</text>
        <text x="260" y="196" text-anchor="middle" font-family="Nunito, Verdana, sans-serif" font-size="34" font-weight="800" fill="#0f2b52">1/4</text>
        <text x="380" y="196" text-anchor="middle" font-family="Nunito, Verdana, sans-serif" font-size="34" font-weight="800" fill="#0f2b52">1/4</text>
        <text x="500" y="196" text-anchor="middle" font-family="Nunito, Verdana, sans-serif" font-size="34" font-weight="800" fill="#ffffff">1/4</text>
        <text x="320" y="320" text-anchor="middle" font-family="Fredoka, Verdana, sans-serif" font-size="40" fill="#C8973A">3/4 = 0.75 = 75%</text>
      </g>`,
      '#1B3A6B',
      '#2A7F8F',
    ),
  ),
  triangleShapes: encode(
    frame(
      `<g>
        <polygon points="180,90 300,270 60,270" fill="#C8973A" stroke="#ffffff" stroke-width="6"/>
        <circle cx="470" cy="180" r="90" fill="#2A7F8F" stroke="#ffffff" stroke-width="6"/>
        <rect x="360" y="60" width="60" height="60" fill="#B7CDB3" rx="8"/>
        <text x="180" y="318" text-anchor="middle" font-family="Nunito, Verdana, sans-serif" font-size="20" font-weight="800" fill="#ffffff">3 sides</text>
        <path d="M470 180 L470 90" stroke="#ffffff" stroke-width="4" stroke-dasharray="8 6"/>
        <text x="470" y="140" text-anchor="middle" font-family="Nunito, Verdana, sans-serif" font-size="18" font-weight="700" fill="#ffffff">r</text>
      </g>`,
      '#2A7F8F',
      '#1B3A6B',
      'Which shape has exactly three sides?',
    ),
  ),
  waterCycle: encode(
    frame(
      `<g>
        <rect x="0" y="285" width="640" height="115" fill="#2A7F8F" opacity="0.85"/>
        <path d="M70 285 q30 -70 0 -140 q-30 -40 20 -80" stroke="#B7CDB3" stroke-width="8" fill="none" stroke-linecap="round"/>
        <circle cx="120" cy="60" r="28" fill="#C8973A"/>
        <g fill="#ffffff" opacity="0.9">
          <ellipse cx="330" cy="120" rx="80" ry="34"/><ellipse cx="390" cy="105" rx="55" ry="28"/><ellipse cx="280" cy="108" rx="46" ry="24"/>
        </g>
        <g stroke="#9fd8e3" stroke-width="6" stroke-linecap="round">
          <line x1="300" y1="160" x2="290" y2="205"/><line x1="350" y1="162" x2="338" y2="212"/><line x1="400" y1="158" x2="390" y2="200"/>
        </g>
        <text x="500" y="120" font-family="Fredoka, Verdana, sans-serif" font-size="26" fill="#ffffff">Evaporation</text>
        <path d="M470 150 L440 190" stroke="#ffffff" stroke-width="4" marker-end="url(#a)"/>
      </g>`,
      '#2f6f8f',
      '#1B3A6B',
      'The water cycle moves water between land, air and sea',
    ),
  ),
  plantCell: encode(
    frame(
      `<g>
        <rect x="70" y="60" width="500" height="270" rx="26" fill="#B7CDB3" stroke="#ffffff" stroke-width="8"/>
        <rect x="95" y="85" width="450" height="220" rx="14" fill="#e9f2e6" opacity="0.9"/>
        <ellipse cx="320" cy="195" rx="78" ry="62" fill="#2A7F8F" opacity="0.9"/>
        <circle cx="320" cy="195" r="26" fill="#1B3A6B"/>
        <g fill="#7fbf5f">
          <ellipse cx="175" cy="145" rx="34" ry="18" transform="rotate(-20 175 145)"/>
          <ellipse cx="470" cy="135" rx="34" ry="18" transform="rotate(15 470 135)"/>
          <ellipse cx="175" cy="255" rx="34" ry="18" transform="rotate(20 175 255)"/>
          <ellipse cx="475" cy="255" rx="34" ry="18" transform="rotate(-15 475 255)"/>
        </g>
        <text x="320" y="308" text-anchor="middle" font-family="Nunito, Verdana, sans-serif" font-size="18" font-weight="800" fill="#1B3A6B">Cell wall · chloroplasts · nucleus</text>
      </g>`,
      '#4b7f52',
      '#1B3A6B',
    ),
  ),
  photosynthesis: encode(
    frame(
      `<g>
        <circle cx="110" cy="90" r="46" fill="#C8973A"/>
        <g stroke="#C8973A" stroke-width="6" stroke-linecap="round">
          <line x1="110" y1="18" x2="110" y2="4"/><line x1="110" y1="176" x2="110" y2="190"/><line x1="38" y1="90" x2="24" y2="90"/>
          <line x1="182" y1="90" x2="196" y2="90"/><line x1="58" y1="38" x2="46" y2="26"/><line x1="162" y1="142" x2="174" y2="154"/>
        </g>
        <path d="M250 300 C250 200 300 150 400 140 C400 250 340 300 250 300 Z" fill="#7fbf5f" stroke="#ffffff" stroke-width="5"/>
        <path d="M250 300 L400 140" stroke="#1B3A6B" stroke-width="4" opacity="0.5"/>
        <g font-family="Nunito, Verdana, sans-serif" font-size="22" font-weight="800" fill="#ffffff">
          <text x="470" y="120">CO₂</text><text x="470" y="170">+ H₂O</text>
          <text x="470" y="230" fill="#C8973A">→ glucose</text><text x="470" y="262">+ O₂</text>
        </g>
      </g>`,
      '#20607a',
      '#1B3A6B',
      'Light + carbon dioxide + water → glucose + oxygen',
    ),
  ),
  ciaTriad: encode(
    frame(
      `<g>
        <polygon points="320,60 470,320 170,320" fill="none" stroke="#C8973A" stroke-width="7"/>
        <circle cx="320" cy="66" r="54" fill="#C8973A"/>
        <circle cx="168" cy="316" r="54" fill="#2A7F8F"/>
        <circle cx="472" cy="316" r="54" fill="#B7CDB3"/>
        <g font-family="Nunito, Verdana, sans-serif" font-weight="800" fill="#ffffff" text-anchor="middle">
          <text x="320" y="74" font-size="20">Integrity</text>
          <text x="168" y="324" font-size="20">Confidentiality</text>
          <text x="472" y="324" font-size="20" fill="#1B3A6B">Availability</text>
        </g>
        <text x="320" y="200" text-anchor="middle" font-family="Fredoka, Verdana, sans-serif" font-size="34" fill="#ffffff">C · I · A</text>
      </g>`,
      '#1B3A6B',
      '#132a4d',
      'The CIA triad: the three goals of information security',
    ),
  ),
  malware: encode(
    frame(
      `<g>
        <rect x="150" y="80" width="340" height="220" rx="18" fill="#0f2b52" stroke="#C8973A" stroke-width="6"/>
        <rect x="172" y="104" width="296" height="150" rx="10" fill="#132a4d"/>
        <g stroke="#C8973A" stroke-width="4" opacity="0.8">
          <line x1="150" y1="330" x2="490" y2="330"/>
          <line x1="210" y1="330" x2="210" y2="350"/><line x1="430" y1="330" x2="430" y2="350"/>
        </g>
        <g transform="translate(320 176)">
          <ellipse rx="54" ry="42" fill="#C8973A"/>
          <g stroke="#C8973A" stroke-width="9" stroke-linecap="round">
            <line x1="-60" y1="-30" x2="-92" y2="-52"/><line x1="60" y1="-30" x2="92" y2="-52"/>
            <line x1="-60" y1="30" x2="-92" y2="52"/><line x1="60" y1="30" x2="92" y2="52"/>
            <line x1="-70" y1="0" x2="-104" y2="0"/><line x1="70" y1="0" x2="104" y2="0"/>
          </g>
          <circle cx="-16" cy="-8" r="8" fill="#0f2b52"/><circle cx="16" cy="-8" r="8" fill="#0f2b52"/>
          <path d="M-14 14 Q0 24 14 14" stroke="#0f2b52" stroke-width="5" fill="none" stroke-linecap="round"/>
        </g>
        <text x="320" y="288" text-anchor="middle" font-family="Nunito, Verdana, sans-serif" font-size="18" font-weight="800" fill="#ffffff">Malware = malicious software</text>
      </g>`,
      '#5a1f2b',
      '#2b0f18',
      'Spot the threat: viruses, worms, trojans, ransomware',
    ),
  ),
  phishing: encode(
    frame(
      `<g>
        <rect x="90" y="80" width="460" height="230" rx="16" fill="#ffffff" opacity="0.95"/>
        <rect x="90" y="80" width="460" height="46" rx="16" fill="#1B3A6B"/>
        <circle cx="118" cy="103" r="8" fill="#C8973A"/><circle cx="144" cy="103" r="8" fill="#2A7F8F"/><circle cx="170" cy="103" r="8" fill="#B7CDB3"/>
        <text x="320" y="110" text-anchor="middle" font-family="Nunito, Verdana, sans-serif" font-size="16" font-weight="800" fill="#ffffff">eastbrldge-school.verify-now.top</text>
        <g font-family="Nunito, Verdana, sans-serif" fill="#1B3A6B">
          <text x="120" y="170" font-size="20" font-weight="800">URGENT: Your account expires today!</text>
          <text x="120" y="204" font-size="17">Click here to re-enter your password →</text>
          <rect x="120" y="224" width="180" height="38" rx="8" fill="#C8973A"/>
          <text x="210" y="249" text-anchor="middle" font-size="17" font-weight="800" fill="#ffffff">VERIFY NOW</text>
          <text x="120" y="292" font-size="15" fill="#a33">Spelling mistake in the domain · rushed tone · asks for a password</text>
        </g>
      </g>`,
      '#2b3f6b',
      '#1B3A6B',
      'Phishing: a fake message that pressures you to act',
    ),
  ),
  passwordStrength: encode(
    frame(
      `<g font-family="Nunito, Verdana, sans-serif">
        <text x="320" y="62" text-anchor="middle" font-size="24" font-weight="800" fill="#ffffff">Which password is strongest?</text>
        <g>
          <rect x="70" y="96" width="500" height="58" rx="12" fill="#ffffff" opacity="0.14"/>
          <text x="94" y="132" font-size="24" fill="#ffffff" letter-spacing="3">eagles2010</text>
          <text x="546" y="132" text-anchor="end" font-size="18" font-weight="800" fill="#ffb4a2">weak</text>
        </g>
        <g>
          <rect x="70" y="168" width="500" height="58" rx="12" fill="#ffffff" opacity="0.14"/>
          <text x="94" y="204" font-size="24" fill="#ffffff" letter-spacing="3">Ghana!2010</text>
          <text x="546" y="204" text-anchor="end" font-size="18" font-weight="800" fill="#ffe08a">medium</text>
        </g>
        <g>
          <rect x="70" y="240" width="500" height="58" rx="12" fill="#C8973A"/>
          <text x="94" y="276" font-size="24" fill="#0f2b52" letter-spacing="3" font-weight="700">T4mbo+Kite_92!</text>
          <text x="546" y="276" text-anchor="end" font-size="18" font-weight="800" fill="#0f2b52">strong</text>
        </g>
      </g>`,
      '#1f5c4a',
      '#123b30',
      'Long, unique, mixed characters — never reuse a school password',
    ),
  ),
  backup: encode(
    frame(
      `<g>
        <rect x="100" y="120" width="160" height="110" rx="12" fill="#C8973A"/>
        <rect x="110" y="132" width="140" height="16" rx="6" fill="#0f2b52" opacity="0.4"/>
        <circle cx="180" cy="200" r="18" fill="#0f2b52" opacity="0.5"/>
        <path d="M290 175 L370 175" stroke="#ffffff" stroke-width="6" marker-end="url(#arrow)"/>
        <g fill="#2A7F8F">
          <rect x="400" y="90" width="150" height="62" rx="10"/>
          <rect x="400" y="164" width="150" height="62" rx="10"/>
          <rect x="400" y="238" width="150" height="62" rx="10"/>
        </g>
        <g font-family="Nunito, Verdana, sans-serif" font-size="17" font-weight="800" fill="#ffffff">
          <text x="475" y="128" text-anchor="middle">Copy 1</text>
          <text x="475" y="202" text-anchor="middle">Copy 2</text>
          <text x="475" y="276" text-anchor="middle">Copy 3</text>
        </g>
        <text x="180" y="272" text-anchor="middle" font-family="Fredoka, Verdana, sans-serif" font-size="22" fill="#ffffff">Original data</text>
        <text x="320" y="62" text-anchor="middle" font-family="Fredoka, Verdana, sans-serif" font-size="24" fill="#ffffff">3-2-1 backup rule</text>
      </g>`,
      '#3b2f6b',
      '#221a45',
    ),
  ),
  shapeSquare: OPTION_ICONS.square,
  shapeTriangle: OPTION_ICONS.triangle,
  shapeCircle: OPTION_ICONS.circle,
  shapePentagon: OPTION_ICONS.pentagon,
};

export type SampleImageKey = keyof typeof IMG;
