// Dataset configuration - add new datasets here
export const DATASETS = {
  "Yoda 12 Node": {
    dataFile: "/data-12Node.json",
    positionsFile: "/query-12Node.json"
  },
  "Yoda 28 Node": {
    dataFile: "/data-28Node.json",
    positionsFile: "/query-28Node.json"
  },
  "EST4 150 Node": {
    dataFile: "/data-150Node.json",
    positionsFile: "/query-150Node.json"
  }
} as const;

export type DatasetName = keyof typeof DATASETS;
