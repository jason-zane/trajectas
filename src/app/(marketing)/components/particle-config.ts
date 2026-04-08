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
    count: 120,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.14)",
    connectionDistance: 160,
    speed: 0.3,
    mouseRadius: 280,
    mouseStrength: 1.4,
    sizeRange: [1, 4],
    opacityRange: [0.15, 0.7],
  },
  problem: {
    count: 80,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.1)",
    connectionDistance: 130,
    speed: 0.4,
    mouseRadius: 260,
    mouseStrength: 1.1,
    sizeRange: [1, 3],
    opacityRange: [0.1, 0.5],
  },
  journey: {
    count: 100,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.12)",
    connectionDistance: 150,
    speed: 0.2,
    mouseRadius: 280,
    mouseStrength: 1.2,
    sizeRange: [1, 4],
    opacityRange: [0.15, 0.6],
  },
  builtFor: {
    count: 60,
    colour: "#2d6a5a",
    lineColour: "rgba(45, 106, 90, 0.12)",
    connectionDistance: 140,
    speed: 0.25,
    mouseRadius: 260,
    mouseStrength: 0.9,
    sizeRange: [1, 3],
    opacityRange: [0.1, 0.45],
  },
  contact: {
    count: 60,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.1)",
    connectionDistance: 120,
    speed: 0.2,
    mouseRadius: 260,
    mouseStrength: 1.0,
    sizeRange: [1, 3],
    opacityRange: [0.1, 0.45],
  },
};
