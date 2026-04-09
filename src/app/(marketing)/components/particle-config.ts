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

export const SECTION_CONFIGS: Record<string, ParticleConfig> = {
  hero: {
    count: 180,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.16)",
    connectionDistance: 170,
    speed: 0.7,
    mouseRadius: 200,
    mouseStrength: 1.4,
    sizeRange: [1, 4],
    opacityRange: [0.2, 0.8],
  },
  problem: {
    count: 130,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.12)",
    connectionDistance: 140,
    speed: 0.8,
    mouseRadius: 180,
    mouseStrength: 1.1,
    sizeRange: [1, 3],
    opacityRange: [0.15, 0.6],
  },
  journey: {
    count: 160,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.14)",
    connectionDistance: 160,
    speed: 0.6,
    mouseRadius: 200,
    mouseStrength: 1.2,
    sizeRange: [1, 4],
    opacityRange: [0.2, 0.7],
  },
  builtFor: {
    count: 100,
    colour: "#2d6a5a",
    lineColour: "rgba(45, 106, 90, 0.14)",
    connectionDistance: 150,
    speed: 0.65,
    mouseRadius: 180,
    mouseStrength: 0.9,
    sizeRange: [1, 3],
    opacityRange: [0.15, 0.55],
  },
  contact: {
    count: 100,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.12)",
    connectionDistance: 140,
    speed: 0.65,
    mouseRadius: 160,
    mouseStrength: 1.0,
    sizeRange: [1, 3],
    opacityRange: [0.15, 0.55],
  },
};
