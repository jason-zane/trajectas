export interface ParticleConfig {
  count: number;
  colour: string;
  lineColour: string;
  connectionDistance: number;
  speed: number;
  mouseRadius: number;
  mouseStrength: number;
  sizeRange: [number, number];
  opacityRange: [number, number];
}

/**
 * Section-specific particle configuration.
 *
 * Cream/paper grounds use the deep sage so the mesh actually reads against the
 * background; gold (low-contrast on cream) is reserved for the dark sage
 * `contact` section. Each section nudges count/distance/speed to give the
 * wash a different texture as you scroll.
 */
export const SECTION_CONFIGS: Record<string, ParticleConfig> = {
  hero: {
    count: 170,
    colour: "#2d6a5a",
    lineColour: "rgba(45, 106, 90, 0.22)",
    connectionDistance: 170,
    speed: 0.7,
    mouseRadius: 220,
    mouseStrength: 1.4,
    sizeRange: [1, 3.5],
    opacityRange: [0.25, 0.7],
  },
  problem: {
    count: 130,
    colour: "#2d6a5a",
    lineColour: "rgba(45, 106, 90, 0.18)",
    connectionDistance: 150,
    speed: 0.6,
    mouseRadius: 190,
    mouseStrength: 1.1,
    sizeRange: [1, 3],
    opacityRange: [0.2, 0.6],
  },
  journey: {
    count: 150,
    colour: "#4e8c79",
    lineColour: "rgba(78, 140, 121, 0.2)",
    connectionDistance: 160,
    speed: 0.55,
    mouseRadius: 200,
    mouseStrength: 1.2,
    sizeRange: [1, 3.5],
    opacityRange: [0.25, 0.65],
  },
  science: {
    count: 160,
    colour: "#2d6a5a",
    lineColour: "rgba(45, 106, 90, 0.16)",
    connectionDistance: 170,
    speed: 0.45,
    mouseRadius: 210,
    mouseStrength: 1.0,
    sizeRange: [1, 3],
    opacityRange: [0.2, 0.6],
  },
  try: {
    count: 140,
    colour: "#2d6a5a",
    lineColour: "rgba(45, 106, 90, 0.2)",
    connectionDistance: 160,
    speed: 0.5,
    mouseRadius: 200,
    mouseStrength: 1.1,
    sizeRange: [1, 3],
    opacityRange: [0.22, 0.65],
  },
  builtFor: {
    count: 120,
    colour: "#2d6a5a",
    lineColour: "rgba(45, 106, 90, 0.18)",
    connectionDistance: 150,
    speed: 0.6,
    mouseRadius: 180,
    mouseStrength: 1.0,
    sizeRange: [1, 3],
    opacityRange: [0.2, 0.6],
  },
  compare: {
    count: 110,
    colour: "#2d6a5a",
    lineColour: "rgba(45, 106, 90, 0.14)",
    connectionDistance: 140,
    speed: 0.5,
    mouseRadius: 180,
    mouseStrength: 0.9,
    sizeRange: [1, 2.5],
    opacityRange: [0.15, 0.5],
  },
  contact: {
    count: 130,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.22)",
    connectionDistance: 160,
    speed: 0.55,
    mouseRadius: 200,
    mouseStrength: 1.2,
    sizeRange: [1, 3],
    opacityRange: [0.25, 0.75],
  },
};
