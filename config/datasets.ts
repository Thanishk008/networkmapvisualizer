// Dataset configuration - add new datasets here
export const DATASETS = {
  "Yoda 12 Node": {
    dataFile: "/12_data.json",
    positionsFile: "/query_12node.json"
  },
  "Yoda 28 Node": {
    dataFile: "/28_data.json",
    positionsFile: "/query_28node.json"
  },
  "EST4 150 Node": {
    dataFile: "/150_data.json",
    positionsFile: "/query_150node.json"
  },
  "EST4 3 Node": {
    dataFile: "/3_data.json",
    positionsFile: "/query_3node.json"
  }
} as const;

export type DatasetName = keyof typeof DATASETS;
