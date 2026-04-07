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
    lineColour: "rgba(201, 169, 98, 0.12)",
    connectionDistance: 150,
    speed: 0.3,
    mouseRadius: 200,
    mouseStrength: 0.8,
    sizeRange: [1, 4],
    opacityRange: [0.1, 0.6],
  },
  problem: {
    count: 80,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.08)",
    connectionDistance: 120,
    speed: 0.4,
    mouseRadius: 180,
    mouseStrength: 0.6,
    sizeRange: [1, 3],
    opacityRange: [0.1, 0.4],
  },
  journey: {
    count: 100,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.1)",
    connectionDistance: 140,
    speed: 0.2,
    mouseRadius: 200,
    mouseStrength: 0.7,
    sizeRange: [1, 4],
    opacityRange: [0.1, 0.5],
  },
  builtFor: {
    count: 60,
    colour: "#2d6a5a",
    lineColour: "rgba(45, 106, 90, 0.1)",
    connectionDistance: 130,
    speed: 0.25,
    mouseRadius: 180,
    mouseStrength: 0.5,
    sizeRange: [1, 3],
    opacityRange: [0.1, 0.4],
  },
  contact: {
    count: 50,
    colour: "#c9a962",
    lineColour: "rgba(201, 169, 98, 0.06)",
    connectionDistance: 100,
    speed: 0.15,
    mouseRadius: 160,
    mouseStrength: 0.3,
    sizeRange: [1, 3],
    opacityRange: [0.05, 0.3],
  },
};
