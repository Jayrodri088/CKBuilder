export type DobTrait = {
  name: string;
  value: string;
};

export type DobObject = {
  dna: string;
  seed: number[];
  pattern: string;
  decoder: string;
  traits: DobTrait[];
  palette: {
    background: string;
    primary: string;
    secondary: string;
    accent: string;
  };
  shape: "orb" | "crystal" | "wave" | "sigil";
  intensity: number;
};

const PALETTES = [
  ["#0b1020", "#86efac", "#22d3ee", "#fef08a"],
  ["#17110f", "#fb7185", "#f97316", "#fde68a"],
  ["#111827", "#a78bfa", "#60a5fa", "#f0abfc"],
  ["#061414", "#2dd4bf", "#84cc16", "#ccfbf1"],
] as const;

const SHAPES: DobObject["shape"][] = ["orb", "crystal", "wave", "sigil"];
const AURAS = ["Quiet", "Bright", "Volatile", "Deep", "Glass", "Solar"];
const TEXTURES = ["Smooth", "Ridged", "Layered", "Liquid", "Grain", "Static"];

export function normalizeDna(input: string): string {
  const trimmed = input.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]+$/.test(trimmed)) {
    throw new Error("DNA must be hex.");
  }
  if (trimmed.length < 16) {
    throw new Error("DNA needs at least 8 bytes.");
  }
  return `0x${trimmed.slice(0, 32).padEnd(32, "0").toLowerCase()}`;
}

export function bytesFromDna(dna: string): number[] {
  const hex = normalizeDna(dna).slice(2);
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

export function decodeDob(dnaInput: string): DobObject {
  const dna = normalizeDna(dnaInput);
  const seed = bytesFromDna(dna);
  const paletteRaw = PALETTES[seed[0] % PALETTES.length];
  const shape = SHAPES[seed[1] % SHAPES.length];
  const intensity = 30 + (seed[2] % 61);
  const aura = AURAS[seed[3] % AURAS.length];
  const texture = TEXTURES[seed[4] % TEXTURES.length];
  const ringCount = 2 + (seed[5] % 5);
  const symmetry = 3 + (seed[6] % 9);
  const serial = seed.slice(8, 14).map((value) => value.toString(16).padStart(2, "0")).join("");

  return {
    dna,
    seed,
    pattern: "dob/1:ckbuilder-observatory",
    decoder: "deterministic-byte-slices",
    palette: {
      background: paletteRaw[0],
      primary: paletteRaw[1],
      secondary: paletteRaw[2],
      accent: paletteRaw[3],
    },
    shape,
    intensity,
    traits: [
      { name: "Shape", value: shape },
      { name: "Aura", value: aura },
      { name: "Texture", value: texture },
      { name: "Rings", value: String(ringCount) },
      { name: "Symmetry", value: String(symmetry) },
      { name: "Serial", value: serial },
    ],
  };
}

export function renderDobSvg(object: DobObject): string {
  const { palette, shape, intensity, seed } = object;
  const opacity = (intensity / 100).toFixed(2);
  const ringCount = Number(object.traits.find((trait) => trait.name === "Rings")?.value ?? "3");
  const symmetry = Number(object.traits.find((trait) => trait.name === "Symmetry")?.value ?? "6");

  const rings = Array.from({ length: ringCount }, (_, index) => {
    const radius = 28 + index * 18;
    return `<circle cx="160" cy="160" r="${radius}" fill="none" stroke="${index % 2 ? palette.secondary : palette.primary}" stroke-width="2" opacity="${0.18 + index * 0.08}" />`;
  }).join("");

  const spokes = Array.from({ length: symmetry }, (_, index) => {
    const angle = (Math.PI * 2 * index) / symmetry;
    const x = 160 + Math.cos(angle) * (66 + (seed[index % seed.length] % 18));
    const y = 160 + Math.sin(angle) * (66 + (seed[(index + 3) % seed.length] % 18));
    return `<line x1="160" y1="160" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${palette.accent}" stroke-width="1.6" opacity="0.55" />`;
  }).join("");

  const core =
    shape === "crystal"
      ? `<polygon points="160,70 224,160 160,250 96,160" fill="${palette.primary}" opacity="${opacity}" />`
      : shape === "wave"
        ? `<path d="M78 166 C112 100 140 224 174 156 C201 102 230 198 250 132" fill="none" stroke="${palette.primary}" stroke-width="17" stroke-linecap="round" opacity="${opacity}" />`
        : shape === "sigil"
          ? `<path d="M160 74 L206 132 L236 198 L160 244 L84 198 L114 132 Z" fill="${palette.primary}" opacity="${opacity}" />`
          : `<circle cx="160" cy="160" r="62" fill="${palette.primary}" opacity="${opacity}" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="DOB preview">
  <rect width="320" height="320" fill="${palette.background}" />
  <circle cx="160" cy="160" r="126" fill="${palette.secondary}" opacity="0.08" />
  ${rings}
  ${spokes}
  ${core}
  <circle cx="160" cy="160" r="10" fill="${palette.accent}" />
</svg>`;
}
