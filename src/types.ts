export interface InventoryItem {
  sku: string;
  name: string;
  currentStock: number;
  targetStock: number; // or average sales / safety stock
  expiryDate?: string;
  eta?: string;
  unitCost?: number;
  location?: string;
}

export interface AnomalousItem {
  sku: string;
  name: string;
  reason: string;
  originalValues: {
    sku: string;
    name: string;
    currentStock: string;
    targetStock: string;
  };
}

export interface ThresholdDetails {
  overstockThresh: number; // e.g. 150 (for %) or 90 (for days)
  stockoutThresh: number;  // e.g. 30 (for %) or 7 (for days)
  customDescription?: string;
}

export interface ColumnMapping {
  sku: string;
  name: string;
  currentStock: string;
  targetStock: string;
  unitCost?: string;
  expiryDate?: string;
  eta?: string;
  location?: string;
}

export interface AnalysisSummary {
  industry: string;
  criteriaId: string;
  criteriaName: string;
  thresholds: ThresholdDetails;
  totalSkus: number;
  validSkusCount: number;
  stockoutCount: number;
  overstockCount: number;
  normalCount: number;
  abnormalCount: number;
  stockoutRate: number;
  overstockRate: number;
  totalValue: number;
  items: Array<InventoryItem & { status: "normal" | "stockout" | "overstock"; deviation: number; riskText: string; actionText: string }>;
  abnormalItems: AnomalousItem[];
}
