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


/*
// Dataset configuration - add new datasets here
export const DATASETS = {
  "Yoda 12 Node": {
    dataFile: "/new_12_data.json",
    positionsFile: "/query_new_12node.json"
  },
  "Yoda 28 Node": {
    dataFile: "/new_28_data.json",
    positionsFile: "/query_new_28node.json"
  },
  "EST4 150 Node": {
    dataFile: "/new_150_data.json",
    positionsFile: "/query_new_150node.json"
  }
} as const;

export type DatasetName = keyof typeof DATASETS;
*/