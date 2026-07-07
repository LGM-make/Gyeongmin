import { InventoryItem, AnomalousItem, ColumnMapping, AnalysisSummary, ThresholdDetails } from "./types";

// Helper to clean numeric values (remove commas, spaces, etc.)
export function parseNumber(val: string | undefined | null): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? NaN : num;
}

// Auto-map user headers to standard fields
export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    sku: "",
    name: "",
    currentStock: "",
    targetStock: "",
  };

  const clean = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");

  headers.forEach((header) => {
    const h = clean(header);
    
    // SKU mapping
    if (["sku", "sku코드", "sku_code", "상품코드", "부품코드", "코드", "id"].includes(h) || h.includes("sku")) {
      if (!mapping.sku) mapping.sku = header;
    }
    // Name mapping
    else if (["상품명", "품명", "부품명", "원자재명", "이름", "name", "productname", "품목명"].includes(h) || h.includes("상품명") || h.includes("품명")) {
      if (!mapping.name) mapping.name = header;
    }
    // Current stock mapping
    else if (["현재고", "현재고수량", "실재고", "수량", "재고량", "재고", "stock", "quantity", "qty", "currentstock"].includes(h) || h.includes("현재고") || h.includes("실재고")) {
      if (!mapping.currentStock) mapping.currentStock = header;
    }
    // Target stock / safety stock / reorder point
    else if (["적정재고", "안전재고", "평균판매량", "재주문점", "목표재고", "연간출고량", "평균일판매량", "target", "targetstock", "safetystock", "reorderpoint"].includes(h) || h.includes("적정") || h.includes("안전") || h.includes("목표") || h.includes("재주문") || h.includes("판매량")) {
      if (!mapping.targetStock) mapping.targetStock = header;
    }
    // Unit cost
    else if (["단가", "가격", "금액", "price", "unitcost", "cost"].includes(h) || h.includes("단가") || h.includes("가격")) {
      mapping.unitCost = header;
    }
    // Expiry date
    else if (["유통기한", "만료일", "expiry", "expirydate", "expiration"].includes(h) || h.includes("유통")) {
      mapping.expiryDate = header;
    }
    // ETA / Incoming date
    else if (["입고예정일", "입고일", "예정일", "eta", "incomingdate"].includes(h) || h.includes("예정일") || h.includes("입고")) {
      mapping.eta = header;
    }
    // Location
    else if (["창고위치", "위치", "창고", "location", "warehouse"].includes(h) || h.includes("위치") || h.includes("창고")) {
      mapping.location = header;
    }
  });

  // Fallback defaults if not found
  if (!mapping.sku && headers.length > 0) mapping.sku = headers[0];
  if (!mapping.name && headers.length > 1) mapping.name = headers[1];
  if (!mapping.currentStock && headers.length > 2) mapping.currentStock = headers[2];
  if (!mapping.targetStock && headers.length > 3) mapping.targetStock = headers[3];

  return mapping;
}

// Parser for raw text (CSV or Tab-Separated values)
export function parseInventoryData(
  rawText: string,
  userMapping?: ColumnMapping
): { items: InventoryItem[]; abnormal: AnomalousItem[]; mapping: ColumnMapping } {
  const items: InventoryItem[] = [];
  const abnormal: AnomalousItem[] = [];

  if (!rawText || !rawText.trim()) {
    return { items, abnormal, mapping: userMapping || autoMapColumns([]) };
  }

  // Split lines
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { items, abnormal, mapping: userMapping || autoMapColumns([]) };
  }

  // Detect delimiter (comma or tab)
  const firstLine = lines[0];
  let delimiter = ",";
  if (firstLine.includes("\t")) {
    delimiter = "\t";
  } else if (!firstLine.includes(",") && firstLine.includes(";")) {
    delimiter = ";";
  }

  // Helper to split line respecting quotes (basic CSV split)
  const splitLine = (line: string) => {
    let result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitLine(firstLine);
  const mapping = userMapping || autoMapColumns(headers);

  // Map header index
  const idxSku = headers.indexOf(mapping.sku);
  const idxName = headers.indexOf(mapping.name);
  const idxCurrentStock = headers.indexOf(mapping.currentStock);
  const idxTargetStock = headers.indexOf(mapping.targetStock);
  const idxUnitCost = mapping.unitCost ? headers.indexOf(mapping.unitCost) : -1;
  const idxExpiry = mapping.expiryDate ? headers.indexOf(mapping.expiryDate) : -1;
  const idxEta = mapping.eta ? headers.indexOf(mapping.eta) : -1;
  const idxLoc = mapping.location ? headers.indexOf(mapping.location) : -1;

  // Track unique SKU codes to find duplicates with different names
  const skuToNameMap: Record<string, string> = {};

  for (let i = 1; i < lines.length; i++) {
    const rawCols = splitLine(lines[i]);
    // Skip empty lines or lines with mismatching column lengths
    if (rawCols.length === 0 || (rawCols.length === 1 && rawCols[0] === "")) continue;

    const skuVal = idxSku !== -1 ? rawCols[idxSku] || "" : "";
    const nameVal = idxName !== -1 ? rawCols[idxName] || "" : "";
    const currentStockStr = idxCurrentStock !== -1 ? rawCols[idxCurrentStock] || "" : "";
    const targetStockStr = idxTargetStock !== -1 ? rawCols[idxTargetStock] || "" : "";
    const unitCostStr = idxUnitCost !== -1 ? rawCols[idxUnitCost] || "" : "";
    const expiryStr = idxExpiry !== -1 ? rawCols[idxExpiry] || "" : "";
    const etaStr = idxEta !== -1 ? rawCols[idxEta] || "" : "";
    const locStr = idxLoc !== -1 ? rawCols[idxLoc] || "" : "";

    const originalValues = {
      sku: skuVal,
      name: nameVal,
      currentStock: currentStockStr,
      targetStock: targetStockStr,
    };

    // 1. Check for empty required fields
    if (!skuVal || !nameVal || !currentStockStr || !targetStockStr) {
      abnormal.push({
        sku: skuVal || `LINE-${i}`,
        name: nameVal || "이름 없음",
        reason: "❌ 필수 필드 누락 (SKU, 상품명, 현재고, 적정재고 필수)",
        originalValues,
      });
      continue;
    }

    const currentStockNum = parseNumber(currentStockStr);
    const targetStockNum = parseNumber(targetStockStr);
    const unitCostNum = idxUnitCost !== -1 ? parseNumber(unitCostStr) : undefined;

    // 2. Check for numeric parsing error
    if (isNaN(currentStockNum) || isNaN(targetStockNum)) {
      abnormal.push({
        sku: skuVal,
        name: nameVal,
        reason: "❌ 수량 필드에 숫자가 아닌 텍스트 포함",
        originalValues,
      });
      continue;
    }

    // 3. Check for negative numbers
    if (currentStockNum < 0 || targetStockNum < 0) {
      abnormal.push({
        sku: skuVal,
        name: nameVal,
        reason: "❌ 현재고 또는 적정재고 수량이 음수값임",
        originalValues,
      });
      continue;
    }

    // 4. SKU Code duplicates with different names
    if (skuToNameMap[skuVal] && skuToNameMap[skuVal] !== nameVal) {
      abnormal.push({
        sku: skuVal,
        name: nameVal,
        reason: `❌ SKU 중복 오류 (동일 코드에 서로 다른 상품명 '${skuToNameMap[skuVal]}'과 '${nameVal}'이 매칭됨)`,
        originalValues,
      });
      continue;
    }

    // Record correct SKU-name mapping
    if (!skuToNameMap[skuVal]) {
      skuToNameMap[skuVal] = nameVal;
    }

    // Valid item
    items.push({
      sku: skuVal,
      name: nameVal,
      currentStock: currentStockNum,
      targetStock: targetStockNum,
      expiryDate: expiryStr || undefined,
      eta: etaStr || undefined,
      unitCost: isNaN(unitCostNum as number) ? undefined : unitCostNum,
      location: locStr || undefined,
    });
  }

  return { items, abnormal, mapping };
}

// Perform calculations based on the selected formula
export function calculateReport(
  industry: string,
  criteriaId: string,
  criteriaName: string,
  thresholds: ThresholdDetails,
  validItems: InventoryItem[],
  abnormalItems: AnomalousItem[],
  mapping: ColumnMapping
): AnalysisSummary {
  const analyzedItems: any[] = [];
  let stockoutCount = 0;
  let overstockCount = 0;
  let normalCount = 0;
  let totalValue = 0;

  const { overstockThresh, stockoutThresh } = thresholds;

  validItems.forEach((item) => {
    let status: "normal" | "stockout" | "overstock" = "normal";
    let deviation = 0; // % deviation from standard threshold
    let riskText = "정상";
    let actionText = "유지 관리";

    const current = item.currentStock;
    const target = item.targetStock; // can be safety stock, daily sales, annual volume, etc.

    if (item.unitCost) {
      totalValue += current * item.unitCost;
    }

    // Apply specific calculation formulas
    switch (criteriaId) {
      case "1": {
        // 1) 재고회전율 기준 (Target Stock / Current Stock or Annual Sales / Current Stock)
        // Let's approximate Turnover = targetStock / Math.max(1, currentStock)
        // overstockThresh is like 'Turnover less than 2.0 = Overstock'
        // stockoutThresh is like 'Turnover more than 12.0 = Stockout risk'
        const turnover = current === 0 ? 999 : target / current;
        if (turnover < overstockThresh) {
          status = "overstock";
          // Deviation is how far below the overstock threshold we are
          deviation = ((overstockThresh - turnover) / overstockThresh) * 100;
          riskText = `재고회전율 낮음 (${turnover.toFixed(1)}회)`;
          actionText = "할인 기획전 진행 및 발주 일시 중단";
        } else if (turnover > stockoutThresh) {
          status = "stockout";
          // Deviation is how far above the stockout threshold we are
          deviation = ((turnover - stockoutThresh) / stockoutThresh) * 100;
          riskText = `재고회전율 과다 (${turnover.toFixed(1)}회)`;
          actionText = "긴급 수급 계약 및 적정 발주량 검토";
        } else {
          riskText = `적정 회전율 유지 (${turnover.toFixed(1)}회)`;
        }
        break;
      }
      case "2": {
        // 2) 안전재고 대비 비율 기준: Ratio (%) = (Current / Target) * 100
        const ratio = target === 0 ? 999 : (current / target) * 100;
        if (ratio > overstockThresh) {
          status = "overstock";
          deviation = ratio - overstockThresh;
          riskText = `보유 재고율 과다 (${ratio.toFixed(0)}%)`;
          actionText = "수요 유치 이벤트 실시 및 입고 일정 조정";
        } else if (ratio < stockoutThresh) {
          status = "stockout";
          deviation = stockoutThresh - ratio;
          riskText = `보유 재고율 부족 (${ratio.toFixed(0)}%)`;
          actionText = "긴급 재발주 발송 및 공급사 납기 단축 유도";
        } else {
          riskText = `적정 보유율 유지 (${ratio.toFixed(0)}%)`;
        }
        break;
      }
      case "3": {
        // 3) 재고 소진 예상일수 기준: Days = Current Stock / Daily Demand (Target Stock here represents Daily Demand)
        const days = target === 0 ? 999 : current / target;
        if (days < stockoutThresh) {
          status = "stockout";
          deviation = ((stockoutThresh - days) / stockoutThresh) * 100;
          riskText = `소진 위험 (${days.toFixed(1)}일 분 잔존)`;
          actionText = "항공 송출 검토 및 현고 확보 긴급 조치";
        } else if (days > overstockThresh) {
          status = "overstock";
          deviation = ((days - overstockThresh) / overstockThresh) * 100;
          riskText = `창고 정체 (${days.toFixed(1)}일 분 과다)`;
          actionText = "반품/폐기 검토 및 프로모션 활용 밀어내기";
        } else {
          riskText = `안정적 소진율 (${days.toFixed(1)}일 분)`;
        }
        break;
      }
      case "4": {
        // 4) 유통기한 임박 기준: (e.g. within 30 days of standard or checking expiration dates if present)
        // Let's parse item.expiryDate if available, or approximate based on Stockout/Overstock of current vs target.
        let daysToExpiry = 999;
        if (item.expiryDate) {
          try {
            const exp = new Date(item.expiryDate);
            const today = new Date("2026-07-06"); // Set to current system date mock
            const diffTime = exp.getTime() - today.getTime();
            daysToExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          } catch (e) {
            daysToExpiry = 999;
          }
        }
        
        // Expiry warning takes priority for overstock status (meaning we must clear it quickly)
        if (daysToExpiry > 0 && daysToExpiry <= overstockThresh) {
          status = "overstock"; // Mark as Overstock risk so it triggers urgent action
          deviation = ((overstockThresh - daysToExpiry) / overstockThresh) * 100;
          riskText = `유통기한 임박 (${daysToExpiry}일 잔여)`;
          actionText = "임박 상품 선입선출 강화 및 긴급 특가 처리";
        } else if (current < target * 0.3) {
          status = "stockout";
          deviation = ((target * 0.3 - current) / (target * 0.3)) * 100;
          riskText = `수량 절대 부족 (안전선의 30% 미만)`;
          actionText = "신선 밀키트 원재료 즉시 수급 및 생산량 증대";
        } else {
          riskText = daysToExpiry !== 999 ? `유통기한 안정 (${daysToExpiry}일 잔여)` : "유통기한 양호";
        }
        break;
      }
      case "5": {
        // 5) 최소/최대 재고 상한선 고정값 기준
        // stockoutThresh = Min, overstockThresh = Max (Direct Units)
        if (current > overstockThresh) {
          status = "overstock";
          deviation = ((current - overstockThresh) / overstockThresh) * 100;
          riskText = `지정 최대치 초과 (+${(current - overstockThresh).toFixed(0)}개)`;
          actionText = "추가 생산 중단 및 창고 보관료 초과 점검";
        } else if (current < stockoutThresh) {
          status = "stockout";
          deviation = ((stockoutThresh - current) / stockoutThresh) * 100;
          riskText = `지정 최소치 미달 (-${(stockoutThresh - current).toFixed(0)}개)`;
          actionText = "즉시 신규 오더 발행 및 자재 쇼티지 방어";
        } else {
          riskText = "설정 범위 내 정상 보유";
        }
        break;
      }
      default: {
        // Fallback or 6) 판매량 대비 표준편차 기준 / Custom
        // Default to Safety Stock Ratio mapping logic
        const ratio = target === 0 ? 999 : (current / target) * 100;
        if (ratio > overstockThresh) {
          status = "overstock";
          deviation = ratio - overstockThresh;
          riskText = `보유량 상한 초과 (${ratio.toFixed(0)}%)`;
          actionText = "조속한 마케팅 협업 및 입고 쿼터 제한";
        } else if (ratio < stockoutThresh) {
          status = "stockout";
          deviation = stockoutThresh - ratio;
          riskText = `보유량 하한 미달 (${ratio.toFixed(0)}%)`;
          actionText = "신속 발주 체계 전환 및 수급 불균형 모니터링";
        } else {
          riskText = "적정 재고 수준 유지";
        }
        break;
      }
    }

    if (status === "stockout") stockoutCount++;
    else if (status === "overstock") overstockCount++;
    else normalCount++;

    analyzedItems.push({
      ...item,
      status,
      deviation,
      riskText,
      actionText,
    });
  });

  const totalCount = validItems.length;
  const stockoutRate = totalCount > 0 ? parseFloat(((stockoutCount / totalCount) * 100).toFixed(1)) : 0;
  const overstockRate = totalCount > 0 ? parseFloat(((overstockCount / totalCount) * 100).toFixed(1)) : 0;

  // Sort items: Risk items first (severity descending), then normal items
  const sortedItems = [...analyzedItems].sort((a, b) => {
    // If one is normal and one is risk, risk wins
    const aRisk = a.status !== "normal";
    const bRisk = b.status !== "normal";
    if (aRisk && !bRisk) return -1;
    if (!aRisk && bRisk) return 1;
    
    // If both are risk, sort by deviation percentage descending
    if (aRisk && bRisk) {
      return b.deviation - a.deviation;
    }
    
    // Otherwise alphabetical
    return a.sku.localeCompare(b.sku);
  });

  return {
    industry,
    criteriaId,
    criteriaName,
    thresholds,
    totalSkus: totalCount + abnormalItems.length,
    validSkusCount: totalCount,
    stockoutCount,
    overstockCount,
    normalCount,
    abnormalCount: abnormalItems.length,
    stockoutRate,
    overstockRate,
    totalValue,
    items: sortedItems,
    abnormalItems,
  };
}
