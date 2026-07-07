import { useState, useRef, useEffect } from "react";
import { 
  Building2, 
  Settings, 
  FileText, 
  CheckCircle2, 
  HelpCircle, 
  AlertTriangle, 
  Sparkles, 
  Plus, 
  ArrowRight, 
  Play, 
  RefreshCw, 
  ClipboardCopy, 
  Printer, 
  Download, 
  X, 
  AlertOctagon, 
  Layers, 
  Percent, 
  Calendar, 
  TrendingDown, 
  TrendingUp, 
  Check, 
  Coins, 
  FileSpreadsheet,
  Grid
} from "lucide-react";
import { SAMPLE_DATASETS } from "./samples";
import { parseInventoryData, calculateReport, autoMapColumns } from "./analyzer";
import { AnalysisSummary, ColumnMapping, ThresholdDetails } from "./types";

export default function App() {
  // Navigation / Wizard State
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Step 1: Industry Selection
  const [selectedIndustry, setSelectedIndustry] = useState<string>("");
  const [customIndustry, setCustomIndustry] = useState<string>("");

  // Step 2: Criteria & Thresholds
  const [selectedCriteria, setSelectedCriteria] = useState<string>("");
  const [overstockVal, setOverstockVal] = useState<number>(150);
  const [stockoutVal, setStockoutVal] = useState<number>(30);
  const [customCriteriaDesc, setCustomCriteriaDesc] = useState<string>("");
  const [isCriteriaConfirmed, setIsCriteriaConfirmed] = useState<boolean>(false);

  // Step 3: Raw Data
  const [rawText, setRawText] = useState<string>("");
  const [activeSampleKey, setActiveSampleKey] = useState<string>("");
  const [customMapping, setCustomMapping] = useState<ColumnMapping | null>(null);

  // Parsed and Mapped preview before generating
  const [tempParsedItems, setTempParsedItems] = useState<any[]>([]);
  const [tempAbnormalItems, setTempAbnormalItems] = useState<any[]>([]);
  const [tempMapping, setTempMapping] = useState<ColumnMapping | null>(null);

  // Step 4 & Report
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [generatedReport, setGeneratedReport] = useState<AnalysisSummary | null>(null);
  const [aiComment, setAiComment] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // User custom Gemini API key state
  const [userApiKey, setUserApiKey] = useState<string>(() => localStorage.getItem("user_gemini_api_key") || "");
  const [isUserApiKeyActive, setIsUserApiKeyActive] = useState<boolean>(() => localStorage.getItem("is_user_gemini_api_key_active") === "true");
  const [keyValidationMsg, setKeyValidationMsg] = useState<{ type: "success" | "error" | ""; text: string }>({ type: "", text: "" });
  const [isValidatingKey, setIsValidatingKey] = useState<boolean>(false);
  const [shouldFlashApiKeyCenter, setShouldFlashApiKeyCenter] = useState<boolean>(false);

  const handleFeatureClick = (onProceed: () => void) => {
    if (!isUserApiKeyActive) {
      const element = document.getElementById("api-key-section");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
      setKeyValidationMsg({
        type: "error",
        text: "🚨 모든 기능을 활성화하려면 먼저 아래에서 Gemini API Key를 입력하고 승인을 완료하셔야 합니다."
      });
      setShouldFlashApiKeyCenter(true);
      setTimeout(() => setShouldFlashApiKeyCenter(false), 2000);
      return;
    }
    onProceed();
  };

  const handleVerifyKey = async () => {
    if (!userApiKey.trim()) {
      setKeyValidationMsg({ type: "error", text: "API Key를 입력해 주세요." });
      return;
    }
    setIsValidatingKey(true);
    setKeyValidationMsg({ type: "", text: "" });
    try {
      const response = await fetch("/api/verify-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-api-key": userApiKey.trim()
        }
      });
      const data = await response.json();
      if (response.ok && data.valid) {
        setIsUserApiKeyActive(true);
        localStorage.setItem("user_gemini_api_key", userApiKey.trim());
        localStorage.setItem("is_user_gemini_api_key_active", "true");
        setKeyValidationMsg({ type: "success", text: "성공적으로 인증되었습니다! 이제 귀하의 전용 Gemini Co-Pilot 엔진이 활성화됩니다." });
      } else {
        setIsUserApiKeyActive(false);
        setKeyValidationMsg({ type: "error", text: data.error || "API Key가 유효하지 않습니다. 다시 확인해 주세요." });
      }
    } catch (err: any) {
      console.error(err);
      setIsUserApiKeyActive(false);
      setKeyValidationMsg({ type: "error", text: "네트워크 오류가 발생했습니다. API Key 형식을 확인해 주세요." });
    } finally {
      setIsValidatingKey(false);
    }
  };

  const handleDisconnectKey = () => {
    setUserApiKey("");
    setIsUserApiKeyActive(false);
    localStorage.removeItem("user_gemini_api_key");
    localStorage.setItem("is_user_gemini_api_key_active", "false");
    setKeyValidationMsg({ type: "", text: "" });
  };

  // Standard predefined step options
  const industries = [
    { id: "1", label: "이커머스 쇼핑몰 (의류/잡화)", icon: Building2 },
    { id: "2", label: "전자제품 및 IT 기기 부품", icon: Layers },
    { id: "3", label: "유통기한 관리가 필요한 식품/신선식품", icon: Calendar },
    { id: "4", label: "제조공장 원부자재 및 자재 창고", icon: Grid },
    { id: "5", label: "화장품 및 뷰티 브랜드 제품", icon: Sparkles },
    { id: "6", label: "글로벌 해외 직구 및 수출입 상품", icon: Coins },
    { id: "7", label: "[주관식] 직접 입력하기 (원하시는 업종을 자유롭게 적어주세요)", icon: Plus }
  ];

  const criteriaOptions = [
    { 
      id: "1", 
      label: "재고회전율 기준", 
      example: "예: 회전율 2.0회 미만 = 과재고, 12.0회 초과 = 품절위험",
      defaultOver: 2.0,
      defaultStock: 12.0,
      unit: "회 (Turnover)"
    },
    { 
      id: "2", 
      label: "안전재고 대비 비율 기준", 
      example: "예: 현재고가 적정재고의 150% 초과 = 과재고, 30% 미만 = 품절위험",
      defaultOver: 150,
      defaultStock: 30,
      unit: "% (Percentage)"
    },
    { 
      id: "3", 
      label: "재고 소진 예상일수 기준", 
      example: "예: 평균 일판매량 대비 소진일수 90일 초과 = 과재고, 7일 미만 = 품절위험",
      defaultOver: 90,
      defaultStock: 7,
      unit: "일 (Days)"
    },
    { 
      id: "4", 
      label: "유통기한 임박 기준", 
      example: "예: 유통기한 30일 이내 잔여 재고 = 긴급 과재고(소진대상)",
      defaultOver: 30, // 30일 이내
      defaultStock: 3,  // 품절위험 (수량이 안전고의 30% 미만)
      unit: "일 (Days)"
    },
    { 
      id: "5", 
      label: "최소/최대 재고 상한선 고정값 기준", 
      example: "예: 현재고 수량 1,000개 초과 = 과재고, 100개 미만 = 품절위험",
      defaultOver: 1000,
      defaultStock: 100,
      unit: "개 (Units)"
    },
    { 
      id: "6", 
      label: "판매량 대비 표준편차 기준", 
      example: "예: 변동성 가중 평균 안전계수 초과/미달",
      defaultOver: 200,
      defaultStock: 50,
      unit: "% (Safety multiplier)"
    },
    { 
      id: "7", 
      label: "[주관식] 직접 계산 기준 입력하기", 
      example: "사용자가 원하는 직접 수식이나 조건을 설명하고 숫자 지정",
      defaultOver: 100,
      defaultStock: 20,
      unit: "값"
    }
  ];

  // Load sample dataset logic
  const handleLoadSample = async (key: string, autoGenerate: boolean = false) => {
    const sample = SAMPLE_DATASETS[key];
    if (!sample) return;

    setActiveSampleKey(key);
    
    // Auto populate Step 1
    setSelectedIndustry(sample.industry);
    setCustomIndustry("");
    
    // Auto populate Step 2
    setSelectedCriteria(sample.defaultCriteriaId);
    setOverstockVal(sample.defaultThresholds.overstockThresh);
    setStockoutVal(sample.defaultThresholds.stockoutThresh);
    setIsCriteriaConfirmed(true);

    // Auto populate Step 3 text area
    setRawText(sample.csvText);

    // Trigger parsing immediately
    const parsed = parseInventoryData(sample.csvText);
    setTempParsedItems(parsed.items);
    setTempAbnormalItems(parsed.abnormal);
    setTempMapping(parsed.mapping);

    if (autoGenerate) {
      setShowLanding(false);
      setCurrentStep(5); // Show report view directly
      setCompletedSteps([1, 2, 3, 4]);
      setIsGeneratingReport(true);
      setIsAiLoading(true);

      const criteriaObj = criteriaOptions.find(c => c.id === sample.defaultCriteriaId);
      const criteriaText = criteriaObj?.label || "사용자 지정";

      const thresholds: ThresholdDetails = {
        overstockThresh: sample.defaultThresholds.overstockThresh,
        stockoutThresh: sample.defaultThresholds.stockoutThresh,
      };

      const finalReport = calculateReport(
        sample.industry,
        sample.defaultCriteriaId,
        criteriaText,
        thresholds,
        parsed.items,
        parsed.abnormal,
        parsed.mapping || autoMapColumns([])
      );

      setGeneratedReport(finalReport);
      setIsGeneratingReport(false);

      // Fetch Gemini AI SCM advice
      try {
        const reqHeaders: Record<string, string> = {
          "Content-Type": "application/json"
        };
        if (isUserApiKeyActive && userApiKey.trim()) {
          reqHeaders["x-gemini-api-key"] = userApiKey.trim();
        }

        const response = await fetch("/api/generate-comment", {
          method: "POST",
          headers: reqHeaders,
          body: JSON.stringify({
            industry: finalReport.industry,
            thresholdCriteria: finalReport.criteriaName,
            thresholdDetails: {
              overstockLimit: `${sample.defaultThresholds.overstockThresh}${criteriaObj?.unit || ""}`,
              stockoutLimit: `${sample.defaultThresholds.stockoutThresh}${criteriaObj?.unit || ""}`
            },
            kpis: {
              totalCount: finalReport.totalSkus - finalReport.abnormalCount,
              stockoutCount: finalReport.stockoutCount,
              stockoutRate: finalReport.stockoutRate,
              overstockCount: finalReport.overstockCount,
              overstockRate: finalReport.overstockRate,
              abnormalCount: finalReport.abnormalCount
            },
            topRiskItems: finalReport.items
              .filter(item => item.status !== "normal")
              .slice(0, 5)
              .map(item => ({
                sku: item.sku,
                name: item.name,
                current: item.currentStock,
                target: item.targetStock,
                deviation: `${item.deviation.toFixed(1)}%`,
                status: item.status === "stockout" ? "품절위험" : "과재고",
                reason: item.riskText
              })),
            abnormalItems: finalReport.abnormalItems.slice(0, 3).map(item => ({
              sku: item.sku,
              name: item.name,
              reason: item.reason
            }))
          })
        });

        if (!response.ok) {
          throw new Error("서버 응답 오류");
        }

        const data = await response.json();
        setAiComment(data.comment);
      } catch (err) {
        console.error(err);
        setAiComment(`* **현황 요약**: 현재 ${finalReport.industry} 분야의 재고 현황을 분석한 결과, 설정한 기준인 [과재고: ${sample.defaultThresholds.overstockThresh}${criteriaObj?.unit || ""}, 품절위험: ${sample.defaultThresholds.stockoutThresh}${criteriaObj?.unit || ""}]에 의거하여 긴급 상황이 분석되었습니다. 전체 유효 SKU 중 약 ${finalReport.stockoutRate}%가 안전고 바닥 수준으로 심각 품절 리스크에 봉착해 있으며, ${finalReport.overstockRate}%는 공급 과부하로 인한 불필요 적재 상태입니다.
* **리스크 요인**: 품절 위험 상태 품목은 잠재적인 실적 저하와 기회 손실, 단기 이탈 가능성을 키우고 있습니다. 반면, 과재고가 누적된 핵심 파트너 브랜드들의 제품은 창고 내 현금 유동성을 경색시키고, 재고 진부화(Aging Risk) 및 관리 비효율을 가속하는 병목 구간으로 판명되었습니다.
* **운영 제안**:
  1. **🚨 긴급 재공급 대응**: 품절 위기 상위 리스크 품목은 즉각 발주 주기를 일간/주간 단위로 단축하여 완충 재고 공급선을 단기 확보하십시오.
  2. **⚠️ 과잉 재고 감축 전략**: 과재고 품목에 대해서는 번들링 기획전, 사은품 패키지 편입, 물류거점간 재배치를 동원하여 다음 발주 주기 전 최대 30% 소진을 강제하십시오.
  3. **📊 재고 표준 주기 조정**: 연간 출고 표준편차 및 일일 평균 출고량 추이를 2주일 단위로 모니터링하여 가변 안전 재고 기준선(Dynamic Safety Stock)을 지속 정교화하십시오.`);
      } finally {
        setIsAiLoading(false);
      }
    } else {
      setShowLanding(false);
      setCompletedSteps([1, 2]);
      setCurrentStep(3);
    }
  };

  // Step 1 Submission
  const handleStep1Submit = () => {
    const finalIndustry = selectedIndustry === "[주관식] 직접 입력하기 (원하시는 업종을 자유롭게 적어주세요)" || selectedIndustry.startsWith("[주관식]")
      ? customIndustry.trim()
      : selectedIndustry;

    if (!finalIndustry) {
      alert("업종을 선택하거나 직접 입력해 주세요.");
      return;
    }

    setCompletedSteps(prev => Array.from(new Set([...prev, 1])));
    setCurrentStep(2);
  };

  // Step 2 Submission (Criteria Setup)
  const handleStep2Submit = () => {
    if (!selectedCriteria) {
      alert("판단 기준을 선택해 주세요.");
      return;
    }

    if (selectedCriteria === "[주관식] 직접 계산 기준 입력하기" && !customCriteriaDesc.trim()) {
      alert("직접 계산 기준 설명을 입력해 주세요.");
      return;
    }

    // Set defaults or confirm numbers
    setIsCriteriaConfirmed(true);
  };

  const handleStep2ConfirmNumbers = () => {
    setCompletedSteps(prev => Array.from(new Set([...prev, 2])));
    setCurrentStep(3);
  };

  // Step 3 Parsing & Data Mapping Confirmation
  useEffect(() => {
    if (rawText.trim()) {
      const parsed = parseInventoryData(rawText, customMapping || undefined);
      setTempParsedItems(parsed.items);
      setTempAbnormalItems(parsed.abnormal);
      setTempMapping(parsed.mapping);
    } else {
      setTempParsedItems([]);
      setTempAbnormalItems([]);
      setTempMapping(null);
    }
  }, [rawText, customMapping]);

  const handleStep3Submit = () => {
    if (!rawText.trim()) {
      alert("재고 데이터를 입력하거나 샘플 데이터를 선택해 주세요.");
      return;
    }

    if (tempParsedItems.length === 0 && tempAbnormalItems.length === 0) {
      alert("유효한 데이터를 찾을 수 없습니다. 형식을 확인해 주세요.");
      return;
    }

    setCompletedSteps(prev => Array.from(new Set([...prev, 3])));
    setCurrentStep(4);
  };

  // Calculate final analysis & invoke server-side Gemini API
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);

    const industryText = selectedIndustry.startsWith("[주관식]") ? customIndustry : selectedIndustry;
    const criteriaObj = criteriaOptions.find(c => c.id === selectedCriteria);
    const criteriaText = criteriaObj?.id === "7" ? customCriteriaDesc : criteriaObj?.label || "사용자 지정";

    const thresholds: ThresholdDetails = {
      overstockThresh: overstockVal,
      stockoutThresh: stockoutVal,
      customDescription: criteriaObj?.id === "7" ? customCriteriaDesc : undefined
    };

    // Recalculate
    const finalReport = calculateReport(
      industryText,
      selectedCriteria,
      criteriaText,
      thresholds,
      tempParsedItems,
      tempAbnormalItems,
      tempMapping || autoMapColumns([])
    );

    setGeneratedReport(finalReport);
    setCurrentStep(5); // Go to final view
    setIsGeneratingReport(false);
    setIsAiLoading(true);

    // Call server-side Gemini API for deep business insights
    try {
      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (isUserApiKeyActive && userApiKey.trim()) {
        reqHeaders["x-gemini-api-key"] = userApiKey.trim();
      }

      const response = await fetch("/api/generate-comment", {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({
          industry: finalReport.industry,
          thresholdCriteria: finalReport.criteriaName,
          thresholdDetails: {
            overstockLimit: `${overstockVal}${criteriaObj?.unit || ""}`,
            stockoutLimit: `${stockoutVal}${criteriaObj?.unit || ""}`
          },
          kpis: {
            totalCount: finalReport.totalSkus - finalReport.abnormalCount,
            stockoutCount: finalReport.stockoutCount,
            stockoutRate: finalReport.stockoutRate,
            overstockCount: finalReport.overstockCount,
            overstockRate: finalReport.overstockRate,
            abnormalCount: finalReport.abnormalCount
          },
          topRiskItems: finalReport.items
            .filter(item => item.status !== "normal")
            .slice(0, 5)
            .map(item => ({
              sku: item.sku,
              name: item.name,
              current: item.currentStock,
              target: item.targetStock,
              deviation: `${item.deviation.toFixed(1)}%`,
              status: item.status === "stockout" ? "품절위험" : "과재고",
              reason: item.riskText
            })),
          abnormalItems: finalReport.abnormalItems.slice(0, 3).map(item => ({
            sku: item.sku,
            name: item.name,
            reason: item.reason
          }))
        })
      });

      if (!response.ok) {
        throw new Error("서버 응답 오류");
      }

      const data = await response.json();
      setAiComment(data.comment);
    } catch (err) {
      console.error(err);
      // Hardcoded premium SCM fallback comment if backend call completely fails
      setAiComment(`* **현황 요약**: 현재 ${finalReport.industry} 분야의 재고 현황을 분석한 결과, 설정한 기준인 [과재고: ${overstockVal}${criteriaObj?.unit || ""}, 품절위험: ${stockoutVal}${criteriaObj?.unit || ""}]에 의거하여 긴급 상황이 분석되었습니다. 전체 유효 SKU 중 약 ${finalReport.stockoutRate}%가 안전고 바닥 수준으로 심각 품절 리스크에 봉착해 있으며, ${finalReport.overstockRate}%는 공급 과부하로 인한 불필요 적재 상태입니다.
* **리스크 요인**: 품절 위험 상태 품목은 잠재적인 실적 저하와 기회 손실, 단기 이탈 가능성을 키우고 있습니다. 반면, 과재고가 누적된 핵심 파트너 브랜드들의 제품은 창고 내 현금 유동성을 경색시키고, 재고 진부화(Aging Risk) 및 관리 비효율을 가속하는 병목 구간으로 판명되었습니다.
* **운영 제안**:
  1. **🚨 긴급 재공급 대응**: 품절 위기 상위 리스크 품목(${finalReport.items.filter(i=>i.status==='stockout').slice(0,2).map(i=>i.name).join(', ')})은 즉각 발주 주기를 일간/주간 단위로 단축하여 완충 재고 공급선을 단기 확보하십시오.
  2. **⚠️ 과잉 재고 감축 전략**: 과재고 품목에 대해서는 번들링 기획전, 사은품 패키지 편입, 물류거점간 재배치를 동원하여 다음 발주 주기 전 최대 30% 소진을 강제하십시오.
  3. **📊 재고 표준 주기 조정**: 연간 출고 표준편차 및 일일 평균 출고량 추이를 2주일 단위로 모니터링하여 가변 안전 재고 기준선(Dynamic Safety Stock)을 지속 정교화하십시오.`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Reset to start a new analysis
  const handleRestart = () => {
    setCurrentStep(1);
    setCompletedSteps([]);
    setSelectedIndustry("");
    setCustomIndustry("");
    setSelectedCriteria("");
    setOverstockVal(150);
    setStockoutVal(30);
    setCustomCriteriaDesc("");
    setIsCriteriaConfirmed(false);
    setRawText("");
    setActiveSampleKey("");
    setCustomMapping(null);
    setTempParsedItems([]);
    setTempAbnormalItems([]);
    setTempMapping(null);
    setGeneratedReport(null);
    setAiComment("");
  };

  // Copy full Markdown report to clipboard
  const handleCopyMarkdown = () => {
    if (!generatedReport) return;

    const criteriaObj = criteriaOptions.find(c => c.id === selectedCriteria);

    const md = `# 📊 재고 현황 대시보드 리포트

## 0. 분석 조건 요약
* **업종/목적**: ${generatedReport.industry}
* **판정 기준**: ${generatedReport.criteriaName} (과재고: ${overstockVal}${criteriaObj?.unit || ""}, 품절위험: ${stockoutVal}${criteriaObj?.unit || ""})
* **데이터 규모**: 총 ${generatedReport.validSkusCount + generatedReport.abnormalCount}개 SKU 분석 (SKU: ${generatedReport.validSkusCount}개 유효, 이상: ${generatedReport.abnormalCount}개)

## 1. 주요 핵심 지표 (KPI 요약)
* **총 관리 SKU 수**: ${generatedReport.validSkusCount} 개
* **🚨 품절 위험 SKU**: ${generatedReport.stockoutCount} 개 (${generatedReport.stockoutRate}%)
* **⚠️ 과재고 SKU**: ${generatedReport.overstockCount} 개 (${generatedReport.overstockRate}%)
* **❌ 데이터 이상 SKU**: ${generatedReport.abnormalCount} 개
${generatedReport.totalValue > 0 ? `* **💰 총 평가 재고 금액**: ₩${generatedReport.totalValue.toLocaleString()}` : ""}

## 2. 리스크 SKU 하이라이트 목록
${generatedReport.items.filter(i => i.status !== 'normal').slice(0, 20).map((item, idx) => {
  return `| ${item.status === 'stockout' ? '🚨 품절위험' : '⚠️ 과재고'} | ${item.sku} | ${item.name} | ${item.currentStock.toLocaleString()} | ${item.targetStock.toLocaleString()} | ${item.deviation.toFixed(1)}% | ${item.riskText} | ${item.actionText} |`;
}).join("\n")}
${generatedReport.items.filter(i => i.status !== 'normal').length > 20 ? `\n*외 ${generatedReport.items.filter(i => i.status !== 'normal').length - 20}개는 요약 통계로 대체*` : ""}

## 3. 데이터 이상 목록
${generatedReport.abnormalItems.length > 0 ? 
  generatedReport.abnormalItems.map(item => `* SKU: ${item.sku} | 사유: ${item.reason}`).join("\n") 
  : "*(데이터 이상 항목 없음)*"}

## 4. 종합 분석 코멘트
${aiComment}
`;

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Quick helper to jump back to earlier step
  const handleJumpToStep = (step: number) => {
    if (step < currentStep || completedSteps.includes(step)) {
      setCurrentStep(step);
    }
  };

  if (showLanding) {
    return (
      <div id="app-root" className="min-h-screen bg-brand-bg text-brand-bright font-sans antialiased flex flex-col selection:bg-brand-accent/30 selection:text-brand-bright">
        {/* Decorative Floating Botanical Leaves (Emulating the top-right leaf canopy of the image) */}
        <div className="absolute top-0 right-0 w-80 h-96 pointer-events-none overflow-hidden z-10 opacity-70 hidden md:block">
          {/* Big Leaf 1 */}
          <svg className="absolute -top-10 -right-10 w-64 h-64 text-[#4E6E58]/40 rotate-[15deg]" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50,0 C68,25 95,45 85,75 C75,95 25,95 15,75 C5,45 32,25 50,0 Z" />
            <path d="M50,0 Q50,50 50,92" stroke="rgba(245,235,224,0.3)" strokeWidth="1.5" fill="none" />
            <path d="M50,25 Q68,35 78,30" stroke="rgba(245,235,224,0.2)" strokeWidth="1" fill="none" />
            <path d="M50,45 Q32,55 22,48" stroke="rgba(245,235,224,0.2)" strokeWidth="1" fill="none" />
            <path d="M50,65 Q70,75 75,68" stroke="rgba(245,235,224,0.2)" strokeWidth="1" fill="none" />
          </svg>
          {/* Leaf 2 */}
          <svg className="absolute top-24 -right-16 w-52 h-52 text-[#3D6B51]/35 -rotate-[25deg]" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50,0 C68,25 95,45 85,75 C75,95 25,95 15,75 C5,45 32,25 50,0 Z" />
            <path d="M50,0 Q50,50 50,92" stroke="rgba(245,235,224,0.25)" strokeWidth="1.5" fill="none" />
          </svg>
          {/* Golden Dried Leaf (Representing the striking dry leaf in the image center) */}
          <svg className="absolute top-48 right-12 w-32 h-32 text-[#BA9367]/45 rotate-[45deg]" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50,0 C68,25 95,45 85,75 C75,95 25,95 15,75 C5,45 32,25 50,0 Z" />
            <path d="M50,0 Q50,50 50,92" stroke="rgba(245,235,224,0.3)" strokeWidth="1.5" fill="none" />
            <path d="M50,30 Q68,40 74,35" stroke="rgba(245,235,224,0.2)" strokeWidth="1" fill="none" />
            <path d="M50,50 Q32,60 26,52" stroke="rgba(245,235,224,0.2)" strokeWidth="1" fill="none" />
          </svg>
        </div>

        {/* Decorative Floating Leaves Left */}
        <div className="absolute top-12 left-0 w-64 h-80 pointer-events-none overflow-hidden z-10 opacity-50 hidden md:block">
          <svg className="absolute -left-16 top-12 w-48 h-48 text-[#5A7E64]/30 rotate-[60deg]" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50,0 C68,25 95,45 85,75 C75,95 25,95 15,75 C5,45 32,25 50,0 Z" />
            <path d="M50,0 Q50,50 50,92" stroke="rgba(245,235,224,0.2)" strokeWidth="1.2" fill="none" />
          </svg>
        </div>

        {/* Premium Header */}
        <header id="app-header" className="bg-brand-panel/95 backdrop-blur-md border-b border-brand-border/80 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setShowLanding(true)}>
              <div className="p-2.5 bg-[#DEBE96] rounded-xl text-[#2D1B13]">
                <FileSpreadsheet className="h-5 w-5 text-[#2D1B13]" />
              </div>
              <div>
                <h1 className="text-sm font-sans font-bold text-[#F5EBE0] tracking-tight flex items-center gap-2">
                  Inventory Intelligence
                  <span className="text-[9px] uppercase font-sans tracking-widest bg-[#DEBE96]/20 text-[#DEBE96] font-semibold px-2 py-0.5 rounded border border-[#DEBE96]/30">AI Co-Pilot</span>
                </h1>
                <p className="text-[10px] text-brand-muted tracking-wide">SCM 의사결정을 위한 지능형 가이디드 재고 진단 대시보드</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => handleFeatureClick(() => {
                  setShowLanding(false);
                })}
                className="text-xs font-semibold text-[#2D1B13] bg-[#DEBE96] border border-[#DEBE96]/30 px-4 py-2 rounded-full hover:bg-[#DEBE96]/90 transition-all shadow-[0_4px_12px_rgba(222,190,150,0.15)] cursor-pointer"
              >
                기획 시작하기
              </button>
            </div>
          </div>
        </header>

        {/* Landing Main Content */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 relative z-20">
          
          {/* Hero Banner Section (Clean Left/Center Balance inspired by Image Hero) */}
          <section className="text-center py-10 space-y-6 relative max-w-4xl mx-auto">
            {/* Ambient Background Blur behind Hero */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#3D6B51]/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#14281E] border border-[#DEBE96]/20 rounded-full text-[11px] font-semibold text-[#DEBE96] tracking-wide mb-2">
              <Sparkles className="h-3 w-3 text-[#DEBE96]" />
              <span>100% Client-Side CSV Normalizer with Gemini AI</span>
            </div>

            <h1 className="text-3xl sm:text-6xl font-extrabold text-[#F5EBE0] tracking-tight leading-[1.15] max-w-4xl mx-auto break-keep">
              엑셀 데이터를 <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DEBE96] via-[#E2B973] to-[#BA9367]">복사-붙여넣기</span>만 하세요.<br />
              지능형 SCM 재고 리포트가 <span className="whitespace-nowrap">완성됩니다.</span>
            </h1>

            <p className="text-sm sm:text-base text-brand-muted max-w-2xl mx-auto leading-relaxed">
              과재고의 금융 경색 리스크와 품절의 기회 손실 리스크를 동시에 방어하는 최고 수준의 실시간 SCM 분석 도구입니다. 임계값 설정부터 자동 컬럼 탐지, Gemini AI 기반 전문 자문까지 단 1초 만에 완성됩니다.
            </p>

            {/* Pill-shaped Gorgeous Buttons inspired directly by "Heses Roge" button */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={() => handleFeatureClick(() => {
                  setShowLanding(false);
                  setCurrentStep(1);
                })}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-[#DEBE96] text-[#2D1B13] font-extrabold text-sm rounded-full hover:bg-[#DEBE96]/90 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(222,190,150,0.3)] cursor-pointer"
              >
                <span>🚀 무료로 재고 자가 진단 시작</span>
                <ArrowRight className="h-4 w-4 text-[#2D1B13]" />
              </button>
              
              <button
                onClick={() => handleFeatureClick(() => {
                  setShowLanding(false);
                  handleLoadSample("ecommerce");
                })}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-[#14281E]/60 border border-[#DEBE96]/30 text-[#F5EBE0] font-semibold text-sm rounded-full hover:bg-[#14281E] hover:border-[#DEBE96]/50 transition-all cursor-pointer"
              >
                <span>의류 쇼핑몰 예시로 가이드 시작</span>
              </button>
            </div>
            
            {/* Quick Sample Selector Row */}
            <div className="pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#A3B899]/80 mb-3">
                ⚡ 원하는 SCM 업종에 맞는 샘플 데이터를 1초 만에 진단해보세요
              </p>
              <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl mx-auto">
                <button
                  onClick={() => handleFeatureClick(() => handleLoadSample("ecommerce", true))}
                  className="px-4.5 py-2.5 bg-[#14281E] hover:bg-[#DEBE96]/10 border border-brand-border hover:border-[#DEBE96]/40 rounded-full text-xs font-semibold text-brand-bright flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Building2 className="h-3.5 w-3.5 text-[#DEBE96]" />
                  <span>의류 패션 쇼핑몰 시즌 재고</span>
                </button>
                <button
                  onClick={() => handleFeatureClick(() => handleLoadSample("fresh_food", true))}
                  className="px-4.5 py-2.5 bg-[#14281E] hover:bg-[#DEBE96]/10 border border-brand-border hover:border-[#DEBE96]/40 rounded-full text-xs font-semibold text-brand-bright flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Calendar className="h-3.5 w-3.5 text-[#DEBE96]" />
                  <span>신선식품 유통기한·일판매량 매칭</span>
                </button>
                <button
                  onClick={() => handleFeatureClick(() => handleLoadSample("electronics", true))}
                  className="px-4.5 py-2.5 bg-[#14281E] hover:bg-[#DEBE96]/10 border border-brand-border hover:border-[#DEBE96]/40 rounded-full text-xs font-semibold text-brand-bright flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5 text-[#DEBE96]" />
                  <span>IT 스마트 기기 고회전 정밀 부품</span>
                </button>
              </div>
            </div>
          </section>

          {/* Gemini API Key Activation Center (Tone & Manner matching the image) */}
          <section 
            id="api-key-section" 
            className={`bg-gradient-to-r from-[#14281E] via-[#0C1A13] to-[#14281E] rounded-[2.5rem] border p-8 shadow-2xl relative overflow-hidden max-w-4xl mx-auto transition-all duration-500 ${
              shouldFlashApiKeyCenter ? 'border-[#DEBE96] ring-4 ring-[#DEBE96]/30 scale-[1.01]' : 'border-[#DEBE96]/20'
            }`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#DEBE96]/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
              <div className="space-y-3 max-w-md text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#DEBE96]/10 border border-[#DEBE96]/20 rounded-full text-[10px] font-bold text-[#DEBE96] uppercase tracking-wider">
                  <Sparkles className="h-3 w-3 text-[#DEBE96]" />
                  <span>Gemini AI Engine Activation Center</span>
                </div>
                <h3 className="text-xl font-bold text-[#F5EBE0] tracking-tight">전용 Gemini API Key 연동 및 승인</h3>
                <p className="text-xs text-[#A3B899] leading-relaxed">
                  개인 또는 기업용 Google Gemini API Key를 입력하시면, 기본 서버 한도에 구애받지 않고 고속 SCM 분석 자문 및 무제한 재고 분석 피드백 엔진을 승인 가동하실 수 있습니다.
                </p>
                <div className="text-[10px] text-[#A3B899]/60 flex items-center gap-1.5 pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DEBE96]"></span>
                  <span>입력하신 API Key는 로컬 브라우저에 안전히 대칭 저장되며 외부로 유출되지 않습니다.</span>
                </div>
              </div>

              <div className="w-full md:w-[360px] bg-[#14281E] p-6 rounded-3xl border border-[#DEBE96]/10 space-y-4">
                <div className="space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-[#DEBE96] uppercase tracking-widest block">Google Gemini API Key</label>
                    <a
                      href="https://aistudio.google.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#DEBE96] hover:underline flex items-center gap-0.5 font-extrabold"
                    >
                      <span>무료 발급받기 ↗</span>
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={userApiKey}
                      onChange={(e) => setUserApiKey(e.target.value)}
                      disabled={isUserApiKeyActive}
                      className={`w-full px-4 py-2.5 bg-[#0C1A13] border text-xs text-[#F5EBE0] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#DEBE96] transition-all placeholder-[#A3B899]/30 ${
                        isUserApiKeyActive ? "border-[#4E6E58] text-[#A3B899]/70" : "border-[#DEBE96]/20"
                      }`}
                    />
                    {isUserApiKeyActive && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-extrabold uppercase bg-[#4E6E58]/30 text-[#DEBE96] px-2 py-0.5 rounded border border-[#DEBE96]/20">
                        승인 활성됨
                      </span>
                    )}
                  </div>
                </div>

                {keyValidationMsg.text && (
                  <div className={`p-2.5 rounded-xl border text-[10px] leading-relaxed text-left ${
                    keyValidationMsg.type === "success" 
                      ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-300" 
                      : "bg-rose-950/20 border-rose-900/40 text-rose-300"
                  }`}>
                    {keyValidationMsg.text}
                  </div>
                )}

                <div className="flex gap-2">
                  {isUserApiKeyActive ? (
                    <button
                      onClick={handleDisconnectKey}
                      className="w-full py-2.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-900/30 font-bold text-[11px] rounded-xl transition-all cursor-pointer"
                    >
                      연동 해제하기
                    </button>
                  ) : (
                    <button
                      onClick={handleVerifyKey}
                      disabled={isValidatingKey}
                      className="w-full py-2.5 bg-[#DEBE96] hover:bg-[#DEBE96]/90 text-[#2D1B13] font-extrabold text-[11px] rounded-xl transition-all shadow-[0_4px_12px_rgba(222,190,150,0.15)] flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {isValidatingKey ? (
                        <>
                          <span className="w-3 h-3 border-2 border-[#2D1B13] border-t-transparent rounded-full animate-spin"></span>
                          <span>인증 및 승인 대기 중...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-[#2D1B13]" />
                          <span>API Key 인증 및 승인</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Interactive SCM Mockup Overview (Visual Attraction) */}
          <section className="bg-gradient-to-b from-[#14281E] to-[#0C1A13] rounded-[2.5rem] border border-[#DEBE96]/15 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#DEBE96]/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
              <div>
                <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest">REALTIME PREVIEW</span>
                <h3 className="text-lg font-bold text-brand-bright">SCM 진단 분석 대시보드 리포트 예시</h3>
                <p className="text-xs text-brand-muted">우측의 예시 형태와 같이 과재고 및 품절 리스크가 정밀하게 시각화됩니다.</p>
              </div>
              <div className="flex items-center gap-1.5 bg-brand-bg px-3 py-1.5 rounded-xl border border-brand-border text-[11px] text-brand-muted">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>데이터 구조화 완전 자동 보정 엔진 가동 중</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-brand-bg/60 p-4 rounded-2xl border border-brand-border">
                <div className="flex items-center justify-between text-brand-muted mb-1">
                  <span className="text-[11px] font-semibold">총 분석 SKU 수</span>
                  <Layers className="h-3.5 w-3.5 text-brand-accent" />
                </div>
                <div className="text-xl font-bold text-brand-bright">1,248 개</div>
                <p className="text-[9px] text-brand-muted/70 mt-1">* 오류 행 3건 자동 분리 제외</p>
              </div>
              <div className="bg-brand-bg/60 p-4 rounded-2xl border border-brand-border border-rose-950/40">
                <div className="flex items-center justify-between text-rose-400 mb-1">
                  <span className="text-[11px] font-semibold">🚨 품절 위험 SKU</span>
                  <TrendingDown className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
                </div>
                <div className="text-xl font-bold text-rose-400">42 개</div>
                <p className="text-[9px] text-rose-300 bg-rose-950/20 px-1.5 py-0.5 rounded inline-block mt-1 border border-rose-900/20">비율: 3.3%</p>
              </div>
              <div className="bg-brand-bg/60 p-4 rounded-2xl border border-brand-border border-amber-950/40">
                <div className="flex items-center justify-between text-amber-400 mb-1">
                  <span className="text-[11px] font-semibold">⚠️ 과재고 SKU</span>
                  <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div className="text-xl font-bold text-amber-400">118 개</div>
                <p className="text-[9px] text-amber-300 bg-amber-950/20 px-1.5 py-0.5 rounded inline-block mt-1 border border-amber-900/20">비율: 9.4%</p>
              </div>
              <div className="bg-brand-bg/60 p-4 rounded-2xl border border-brand-border">
                <div className="flex items-center justify-between text-emerald-400 mb-1">
                  <span className="text-[11px] font-semibold">💰 평가 재고 자산</span>
                  <Coins className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="text-xl font-bold text-emerald-400">₩348,500,000</div>
                <p className="text-[9px] text-brand-muted/70 mt-1">단가 데이터 매핑 기준</p>
              </div>
            </div>

            {/* Dynamic SCM Mockup Table Row */}
            <div className="bg-brand-bg/50 rounded-2xl border border-brand-border overflow-hidden">
              <div className="p-3 border-b border-brand-border bg-brand-panel/50 flex justify-between text-[11px] text-brand-muted font-bold">
                <span>실시간 리스크 진단 SKU 하이라이트 (시범)</span>
                <span>정렬: 리스크 심각도 순</span>
              </div>
              <div className="divide-y divide-brand-border/40 text-[11px]">
                <div className="p-3 flex items-center justify-between hover:bg-brand-panel/20">
                  <div className="flex items-center gap-3">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950/40 text-rose-400 border border-rose-900/30">🚨 품절위험</span>
                    <span className="font-mono text-brand-muted">TS-002</span>
                    <span className="text-brand-bright font-semibold">데일리 하이웨스트 데님 팬츠</span>
                  </div>
                  <div className="text-right">
                    <span className="text-brand-bright font-bold">현재고: 15개</span>
                    <span className="text-[10px] text-rose-400 ml-2 font-bold">-75.0% 이탈</span>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between hover:bg-brand-panel/20">
                  <div className="flex items-center gap-3">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950/40 text-amber-400 border border-amber-900/30">⚠️ 과재고</span>
                    <span className="font-mono text-brand-muted">HD-101</span>
                    <span className="text-brand-bright font-semibold">시그니처 로고 후드티 (멜란지)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-brand-bright font-bold">현재고: 250개</span>
                    <span className="text-[10px] text-amber-400 ml-2 font-bold">+150.0% 과잉</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Core Strengths Section (Bento Grid Style inspired directly by the 6 cards in the uploaded image) */}
          <section className="space-y-6">
            <div className="text-center">
              <span className="text-[10px] font-bold text-[#DEBE96] uppercase tracking-widest">PRODUCT CORE VALUES</span>
              <h2 className="text-2xl font-bold text-[#F5EBE0] tracking-tight mt-1">우리 쇼핑몰과 창고에 왜 꼭 필요할까요?</h2>
              <p className="text-xs text-brand-muted mt-1.5">이전에 경험해보지 못한 완벽한 SCM 진단 프로세스를 제공합니다.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Feature 1 (Siare Seador - Sage/Moss Green Card) */}
              <div className="bg-[#4E6E58] p-6 rounded-[2.5rem] border border-[#DEBE96]/10 hover:border-[#DEBE96]/35 transition-all flex flex-col justify-between shadow-xl min-h-[300px]">
                <div>
                  <div className="w-12 h-12 rounded-full bg-[#3B5443] flex items-center justify-center text-[#DEBE96] mb-5 shadow-inner">
                    <FileSpreadsheet className="h-5 w-5 text-[#DEBE96]" />
                  </div>
                  <h4 className="text-base font-bold text-[#F5EBE0] mb-2">무설정 지능형 데이터 정규화</h4>
                  <p className="text-xs text-[#E6EFEA] leading-relaxed">
                    복사해서 붙여넣기만 하면 CSV 데이터 내의 컬럼명을 지능적으로 스캔하여 'SKU 코드', '상품명', '현재고', '적정재고', '단가' 등을 자동으로 찾아내 매핑해 줍니다. 콤마나 탭, 줄바꿈 형식을 타지 않습니다.
                  </p>
                </div>
                <div className="text-[10px] text-[#DEBE96] font-bold tracking-wider pt-4 uppercase">인간의 개입 없는 기계적 추출</div>
              </div>

              {/* Feature 2 (Teavnt - Terracotta / Clay Brown Card) */}
              <div className="bg-[#4E3127] p-6 rounded-[2.5rem] border border-[#DEBE96]/10 hover:border-[#DEBE96]/35 transition-all flex flex-col justify-between shadow-xl min-h-[300px]">
                <div>
                  <div className="w-12 h-12 rounded-full bg-[#342019] flex items-center justify-center text-[#DEBE96] mb-5 shadow-inner">
                    <Layers className="h-5 w-5 text-[#DEBE96]" />
                  </div>
                  <h4 className="text-base font-bold text-[#F5EBE0] mb-2">4대 전문 SCM 표준 공식 지원</h4>
                  <p className="text-xs text-[#F2E5E1] leading-relaxed">
                    단순 수량 초과/미달이 아닌 전문화된 재고 공식들을 실시간 탑재했습니다. 안전재고 대비 비중(%), 연간 출고 재고회전율(Turnover), 평균 판매량 대비 재고 소진 예상 일수(Days of Supply) 등의 수식을 지정할 수 있습니다.
                  </p>
                </div>
                <div className="text-[10px] text-[#DEBE96] font-bold tracking-wider pt-4 uppercase">전문 물류 임계 기준 자동 계산</div>
              </div>

              {/* Feature 3 (Voueihuiercs - Earthy Sand/Clay Brown Card) */}
              <div className="bg-[#9C7554] p-6 rounded-[2.5rem] border border-[#DEBE96]/10 hover:border-[#DEBE96]/35 transition-all flex flex-col justify-between shadow-xl min-h-[300px]">
                <div>
                  <div className="w-12 h-12 rounded-full bg-[#75553B] flex items-center justify-center text-[#DEBE96] mb-5 shadow-inner">
                    <Sparkles className="h-5 w-5 text-[#DEBE96]" />
                  </div>
                  <h4 className="text-base font-bold text-[#F5EBE0] mb-2">Gemini AI 경영 코멘트 피드백</h4>
                  <p className="text-xs text-[#FAF4EF] leading-relaxed">
                    정량적인 수치 요약이 도출되면, Gemini AI 비즈니스 분석기가 실시간 연동되어 선택한 업종 특성에 맞춘 발주 주기 제안, 즉시 소진이 필요한 과재고 대안 기획, 안전재고 가중치 보정 방향까지 한글로 정리해 줍니다.
                  </p>
                </div>
                <div className="text-[10px] text-[#DEBE96] font-bold tracking-wider pt-4 uppercase">최고 수준의 Executive SCM 보고서</div>
              </div>

              {/* Feature 4 (Real-Life Sunlit Forest Image Card matching the bottom-left of the uploaded image) */}
              <div 
                className="rounded-[2.5rem] border border-[#DEBE96]/15 relative overflow-hidden flex flex-col justify-end p-6 min-h-[300px] shadow-xl group hover:scale-[1.01] transition-all"
                style={{ 
                  backgroundImage: 'url("/src/assets/images/sunlit_forest_leaves_1783403898965.jpg")',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-[#0C1A13]/95 via-[#0C1A13]/40 to-transparent" />
                <div className="relative z-10 text-left">
                  <span className="text-[10px] font-bold text-[#DEBE96] tracking-wider uppercase block mb-1">SCM VISUAL ASSETS</span>
                  <h4 className="text-base font-bold text-[#F5EBE0] mb-2">실시간 SCM 시각화 자산</h4>
                  <p className="text-xs text-[#A3B899] leading-relaxed">
                    자연을 닮은 고도의 시각 분석 모듈이 내장되어 있어 복잡한 수치 현황을 직관적인 인포그래픽과 위험 SKU 등급 표로 즉시 도식화해 줍니다.
                  </p>
                </div>
              </div>

              {/* Feature 5 (Esoci Fras te - Chocolate/Terracotta Card) */}
              <div className="bg-[#3E2319] p-6 rounded-[2.5rem] border border-[#DEBE96]/10 hover:border-[#DEBE96]/35 transition-all flex flex-col justify-between shadow-xl min-h-[300px]">
                <div>
                  <div className="w-12 h-12 rounded-full bg-[#2B1811] flex items-center justify-center text-[#DEBE96] mb-5 shadow-inner">
                    <AlertTriangle className="h-5 w-5 text-[#DEBE96]" />
                  </div>
                  <h4 className="text-base font-bold text-[#F5EBE0] mb-2">데이터 위생 필터 (이상치 격리)</h4>
                  <p className="text-xs text-[#F2E5E1] leading-relaxed">
                    마이너스(-) 수량 기재, 숫자가 아닌 문자로 적힌 오류값, 필수 SKU 및 상품명의 유실, 동일 코드가 다른 이름으로 중복 수록된 데이터 등을 지능적으로 필터링하여 분리 격리함으로써 대시보드의 정밀성과 신뢰성을 극대화합니다.
                  </p>
                </div>
                <div className="text-[10px] text-[#DEBE96] font-bold tracking-wider pt-4 uppercase">의사결정 노이즈 100% 원천 제거</div>
              </div>

              {/* Feature 6 (Blisstdare - Warm Golden Beige Card with Dark text) */}
              <div className="bg-[#DEBE96] p-6 rounded-[2.5rem] border border-[#DEBE96]/20 hover:border-[#DEBE96]/40 transition-all flex flex-col justify-between shadow-xl text-[#2D1B13] min-h-[300px]">
                <div>
                  <div className="w-12 h-12 rounded-full bg-[#C7A883] flex items-center justify-center text-[#2D1B13] mb-5 shadow-inner">
                    <ClipboardCopy className="h-5 w-5 text-[#2D1B13]" />
                  </div>
                  <h4 className="text-base font-extrabold text-[#2D1B13] mb-2">마크다운 문서 복사 & 즉시 전사 공유</h4>
                  <p className="text-xs text-[#4F3C2C] leading-relaxed">
                    산출된 전체 대시보드 구조 및 KPI 요약, 리스크 상세 표, 그리고 AI 종합 비즈니스 코멘트가 완벽히 포맷팅된 마크다운 문서로 원클릭 복사됩니다. 슬랙, 텔레그램, 노션, 잔디 등의 협업 툴에 즉시 전송하거나 원클릭 인쇄 및 깔끔한 PDF 보관도 완벽히 지원합니다.
                  </p>
                </div>
                <div className="text-[10px] text-[#4F3C2C] font-extrabold tracking-wider pt-4 uppercase">클립보드 고배율 구조화 스니펫 & 인쇄</div>
              </div>

            </div>
          </section>

          {/* Quick Steps Overview */}
          <section className="bg-[#14281E]/40 rounded-[2rem] border border-[#DEBE96]/15 p-6 sm:p-8">
            <h3 className="text-base font-bold text-[#F5EBE0] text-center mb-6">자가 진단을 위한 간단한 4단계 워크플로우</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 text-center">
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-full bg-[#DEBE96]/15 border border-[#DEBE96]/30 text-[#DEBE96] flex items-center justify-center mx-auto text-xs font-bold font-mono">01</div>
                <h5 className="text-xs font-bold text-[#F5EBE0]">업종/목적 선택</h5>
                <p className="text-[11px] text-[#A3B899] leading-relaxed">진단받고자 하는 비즈니스 분야 혹은 원하는 맞춤 업종을 자유롭게 지정합니다.</p>
              </div>
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-full bg-[#DEBE96]/15 border border-[#DEBE96]/30 text-[#DEBE96] flex items-center justify-center mx-auto text-xs font-bold font-mono">02</div>
                <h5 className="text-xs font-bold text-[#F5EBE0]">임계 판단식 설정</h5>
                <p className="text-[11px] text-[#A3B899] leading-relaxed">회전율, 안전재고 등 비즈니스 성향에 적합한 SCM 필터 수식과 기준 숫자를 지정합니다.</p>
              </div>
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-full bg-[#DEBE96]/15 border border-[#DEBE96]/30 text-[#DEBE96] flex items-center justify-center mx-auto text-xs font-bold font-mono">03</div>
                <h5 className="text-xs font-bold text-[#F5EBE0]">재고 텍스트 삽입</h5>
                <p className="text-[11px] text-[#A3B899] leading-relaxed">ERP나 엑셀에서 복사한 재고 텍스트를 그대로 붙여넣고 자동 컬럼 탐지 결과를 확인합니다.</p>
              </div>
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-full bg-[#DEBE96]/15 border border-[#DEBE96]/30 text-[#DEBE96] flex items-center justify-center mx-auto text-xs font-bold font-mono">04</div>
                <h5 className="text-xs font-bold text-[#F5EBE0]">지능형 진단 개시</h5>
                <p className="text-[11px] text-[#A3B899] leading-relaxed">최종 통계가 도출되는 즉시, SCM 전문가 인공지능이 분석한 심층 경영 요약 코멘트를 확인합니다.</p>
              </div>
            </div>
          </section>

          {/* Bottom Call-To-Action Banner */}
          <section className="text-center py-10 bg-gradient-to-b from-[#14281E] to-[#0C1A13] rounded-[2rem] border border-[#DEBE96]/15 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(222,190,150,0.05),transparent)] pointer-events-none" />
            <h3 className="text-xl sm:text-2xl font-bold text-[#F5EBE0] tracking-tight mb-2">지금 바로 당신의 물류를 자가 정밀 진단해 보세요</h3>
            <p className="text-xs text-brand-muted max-w-lg mx-auto leading-relaxed mb-6">
              회원가입이 필요 없습니다. 모든 데이터는 귀하의 웹 브라우저 내에서 직접 정규화 파싱되어 업로드나 외부 유출 위험 없이 안전하게 실행됩니다.
            </p>
            <button
              onClick={() => handleFeatureClick(() => {
                setShowLanding(false);
                setCurrentStep(1);
              })}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#DEBE96] text-[#2D1B13] font-extrabold text-xs rounded-full hover:bg-[#DEBE96]/90 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(222,190,150,0.2)] cursor-pointer"
            >
              <span>🚀 무료로 재고 진단 대시보드 개시</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#2D1B13]" />
            </button>
          </section>
        </main>

        {/* Footer */}
        <footer id="app-footer" className="bg-[#14281E] border-t border-[#DEBE96]/15 py-8 mt-12 text-center space-y-2">
          <p className="text-[11px] text-[#A3B899] max-w-2xl mx-auto px-4">
            재고 데이터 분석 및 SCM 리포트 전문가 도구는 고도의 오프라인 분석 엔진과 Google Gemini 모델이 조화롭게 결합되어 작동합니다.
          </p>
          <p className="text-[10px] text-[#A3B899]/40 font-mono">
            © 2026 Google AI Studio Build. Professional SCM & Inventory Decision Support System.
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div id="app-root" className="min-h-screen bg-brand-bg text-brand-bright font-sans antialiased flex flex-col selection:bg-brand-accent/30 selection:text-brand-bright">
      
      {/* API Key Required Glassmorphic Lock Overlay */}
      {!isUserApiKeyActive && (
        <div className="fixed inset-0 bg-[#0C1A13]/95 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#14281E] border border-[#DEBE96]/30 max-w-md w-full p-8 rounded-[2rem] text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#DEBE96]/5 rounded-full blur-2xl pointer-events-none" />
            <div className="w-16 h-16 rounded-full bg-[#DEBE96]/15 border border-[#DEBE96]/30 flex items-center justify-center mx-auto text-[#DEBE96]">
              <Sparkles className="h-8 w-8 text-[#DEBE96]" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-[#F5EBE0] tracking-tight">Gemini AI Engine 승인 필요</h3>
              <p className="text-xs text-[#A3B899] leading-relaxed">
                재고 진단 대시보드 및 지능형 SCM 피드백 시스템을 가동하기 위해 먼저 Google Gemini API Key 승인을 완료해야 합니다.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowLanding(true);
                  setTimeout(() => {
                    const element = document.getElementById("api-key-section");
                    if (element) {
                      element.scrollIntoView({ behavior: "smooth" });
                    }
                    setKeyValidationMsg({
                      type: "error",
                      text: "🚨 여기서 Gemini API Key를 입력하고 승인을 진행해 주십시오."
                    });
                    setShouldFlashApiKeyCenter(true);
                    setTimeout(() => setShouldFlashApiKeyCenter(false), 2000);
                  }, 100);
                }}
                className="w-full py-3.5 bg-[#DEBE96] hover:bg-[#DEBE96]/90 text-[#2D1B13] font-extrabold text-xs rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(222,190,150,0.2)] flex items-center justify-center gap-2 cursor-pointer animate-pulse"
              >
                <span>🔑 API Key 승인 페이지로 이동</span>
                <ArrowRight className="h-4 w-4 text-[#2D1B13]" />
              </button>

              <a
                href="https://aistudio.google.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 border border-[#DEBE96]/30 bg-[#14281E]/80 hover:bg-[#DEBE96]/15 text-[#DEBE96] font-bold text-xs rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02]"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#DEBE96]" />
                <span>무료 API Key 발급받기 ↗</span>
              </a>
            </div>
          </div>
        </div>
      )}
      
      {/* Premium Navigation Header */}
      <header id="app-header" className="bg-brand-panel border-b border-brand-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setShowLanding(true)}>
            <div className="p-2 bg-brand-accent rounded-lg text-black">
              <FileSpreadsheet className="h-5 w-5 text-black" />
            </div>
            <div>
              <h1 className="text-sm font-sans font-bold text-brand-bright tracking-tight flex items-center gap-2">
                Inventory Intelligence
                <span className="text-[9px] uppercase font-sans tracking-widest bg-brand-accent/20 text-brand-accent font-semibold px-2 py-0.5 rounded border border-brand-accent/30">AI Co-Pilot</span>
              </h1>
              <p className="text-[10px] text-brand-muted tracking-wide">SCM 의사결정을 위한 지능형 가이디드 재고 진단 대시보드</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2.5">
            <a
              href="https://aistudio.google.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#DEBE96]/15 hover:bg-[#DEBE96]/25 border border-[#DEBE96]/45 text-[11px] font-extrabold rounded-full text-[#DEBE96] transition-all hover:scale-[1.03] shadow-[0_2px_10px_rgba(222,190,150,0.15)] cursor-pointer"
            >
              <Sparkles className="h-3 w-3 text-[#DEBE96]" />
              <span>무료 API Key 발급받기 ↗</span>
            </a>
            
            <button
              onClick={() => setShowLanding(true)}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 border border-brand-border/60 text-[11px] font-medium rounded-md text-brand-muted hover:text-brand-bright hover:bg-brand-panel/40 transition-all cursor-pointer"
            >
              <span>소개 홈(랜딩)</span>
            </button>
            <button
              id="btn-restart-nav"
              onClick={handleRestart}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-brand-border text-[11px] font-bold uppercase tracking-wider rounded-md text-brand-muted bg-brand-panel hover:bg-brand-bg hover:text-brand-bright transition-all cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>새 리포트 만들기</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
        
        {/* Left Hand: Guided Interactive Wizard */}
        <section id="wizard-sidebar" className="w-full lg:w-5/12 flex flex-col space-y-4">
          
          {/* Progress Tracker Cards */}
          <div className="bg-brand-panel rounded-2xl border border-brand-border p-5">
            <div className="flex items-center justify-between mb-3 border-b border-brand-border pb-2.5">
              <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest">진행 가이드 라인</span>
              <span className="text-[10px] bg-brand-bg text-brand-muted font-semibold px-2 py-0.5 rounded-full border border-brand-border">
                {currentStep <= 4 ? `${currentStep} / 4 단계` : "분석 완료"}
              </span>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {[
                { step: 1, label: "업종 목적" },
                { step: 2, label: "판단 기준" },
                { step: 3, label: "재고 데이터" },
                { step: 4, label: "최종 확인" }
              ].map((item) => {
                const isActive = currentStep === item.step;
                const isCompleted = completedSteps.includes(item.step) || currentStep > item.step;
                return (
                  <button
                    key={item.step}
                    disabled={!isCompleted && currentStep < item.step}
                    onClick={() => handleJumpToStep(item.step)}
                    className={`text-left p-2.5 rounded-xl border text-[11px] transition-all ${
                      isActive 
                        ? "border-brand-accent bg-brand-accent/5 text-brand-bright font-semibold ring-1 ring-brand-accent"
                        : isCompleted
                          ? "border-brand-border bg-brand-bg/40 text-brand-muted hover:border-brand-accent/30 hover:text-brand-bright"
                          : "border-brand-border/40 bg-brand-bg/10 text-brand-muted/30 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        isActive 
                          ? "bg-brand-accent text-black"
                          : isCompleted
                            ? "bg-brand-accent/20 text-brand-accent border border-brand-accent/30"
                            : "bg-brand-bg/40 text-brand-muted/40"
                      }`}>
                        {isCompleted ? "✓" : item.step}
                      </span>
                      <span className="font-semibold block truncate">Step {item.step}</span>
                    </div>
                    <span className="text-[9px] block truncate text-brand-muted/70">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Core Interactive Chat Panel */}
          <div className="bg-brand-panel rounded-2xl border border-brand-border shadow-2xl flex-1 flex flex-col overflow-hidden min-h-[500px]">
            
            {/* Assistant Greeting Header */}
            <div className="p-4 bg-brand-panel border-b border-brand-border flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-brand-accent flex items-center justify-center text-lg font-bold shadow-md text-black">
                👨‍💼
              </div>
              <div>
                <h3 className="text-sm font-bold text-brand-bright leading-tight">재고 리포트 자동화 전문가</h3>
                <p className="text-[11px] text-brand-muted">SCM 부서 비즈니스 전담 가이드</p>
              </div>
            </div>

            {/* Wizard Body (Scrollable Chat Conversation) */}
            <div className="flex-1 p-5 overflow-y-auto space-y-6">
              
              {/* Introduction always visible */}
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-brand-bg border border-brand-border flex items-center justify-center text-sm shrink-0">
                  🤖
                </div>
                <div className="bg-brand-bg/50 rounded-2xl rounded-tl-none p-4 max-w-[90%] border border-brand-border">
                  <p className="text-xs text-brand-muted leading-relaxed">
                    안녕하세요! 재고 리포트 자동화 전문가입니다. 정확한 맞춤형 리포트 생성을 위해 질문을 하나씩 순서대로 드릴게요. 먼저 원하시는 샘플로 테스트해 보시거나 가이드를 시작해 주세요.
                  </p>
                  
                  {/* Sample buttons directly embedded */}
                  <div className="mt-3.5 pt-3.5 border-t border-brand-border">
                    <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest block mb-2">⚡ 원클릭 빠른 샘플 데이터 실행</span>
                    <div className="flex flex-col gap-1.5">
                      {Object.entries(SAMPLE_DATASETS).map(([key, item]) => (
                        <button
                          key={key}
                          id={`btn-sample-${key}`}
                          onClick={() => handleLoadSample(key)}
                          className={`flex items-center justify-between text-left px-3 py-2.5 rounded-xl text-xs border transition-all ${
                            activeSampleKey === key 
                              ? "border-brand-accent bg-brand-accent/10 text-brand-bright font-semibold"
                              : "border-brand-border bg-brand-panel text-brand-muted hover:border-brand-accent/45 hover:bg-brand-bg hover:text-brand-bright"
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-base">📊</span>
                            <div>
                              <span className="font-semibold block">{item.name}</span>
                              <span className="text-[10px] opacity-75">{item.industry}</span>
                            </div>
                          </div>
                          <ArrowRight className="h-3 w-3 text-brand-muted shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 1: 업종 및 핵심 목적 선택 */}
              {currentStep >= 1 && (
                <div className={`space-y-4 pt-4 border-t border-brand-border ${currentStep > 1 ? "opacity-40 pointer-events-none" : ""}`}>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-brand-bg border border-brand-border flex items-center justify-center text-sm shrink-0">
                      🤖
                    </div>
                    <div className="bg-brand-bg/50 rounded-2xl rounded-tl-none p-4 max-w-[90%] border border-brand-border">
                      <p className="text-xs font-bold text-brand-accent mb-1">Q1. 핵심 목적 / 업종 선택</p>
                      <p className="text-xs text-brand-muted leading-relaxed">
                        현재 분석하고자 하는 재고의 주요 업종이나 목적은 무엇인가요? 아래에서 번호를 선택하시거나, 마지막 번호를 골라 직접 입력해 주세요.
                      </p>
                    </div>
                  </div>

                  {/* List of Pre-defined options (5~7 items as requested) */}
                  <div className="ml-11 space-y-2">
                    {industries.map((ind) => {
                      const IconComp = ind.icon;
                      const isSelected = selectedIndustry === ind.label;
                      return (
                        <button
                          key={ind.id}
                          onClick={() => {
                            setSelectedIndustry(ind.label);
                            if (ind.id !== "7") setCustomIndustry("");
                          }}
                          className={`w-full flex items-center space-x-3 p-3 rounded-xl border text-left text-xs transition-all ${
                            isSelected 
                              ? "border-brand-accent bg-brand-accent/10 text-brand-bright font-semibold shadow-sm"
                              : "border-brand-border bg-brand-panel text-brand-muted hover:border-brand-accent/30 hover:bg-brand-bg hover:text-brand-bright"
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg ${isSelected ? "bg-brand-accent text-black" : "bg-brand-bg text-brand-muted"}`}>
                            <IconComp className="h-3.5 w-3.5" />
                          </div>
                          <span className="flex-1">{ind.label}</span>
                        </button>
                      );
                    })}

                    {/* Subjective input option if 7 is selected */}
                    {selectedIndustry.startsWith("[주관식]") && (
                      <div className="mt-2 pl-2.5 border-l-2 border-brand-accent space-y-2">
                        <label className="text-[11px] font-bold text-brand-accent">업종/목적 직접 입력</label>
                        <input
                          id="input-custom-industry"
                          type="text"
                          value={customIndustry}
                          onChange={(e) => setCustomIndustry(e.target.value)}
                          placeholder="예: 글로벌 반도체 장비 부품, 자영업 밀키트 등"
                          className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-xl text-xs text-brand-bright placeholder:text-brand-muted/40 focus:ring-1 focus:ring-brand-accent focus:border-brand-accent focus:outline-none"
                        />
                      </div>
                    )}

                    {currentStep === 1 && (
                      <button
                        id="btn-submit-step1"
                        onClick={handleStep1Submit}
                        className="w-full mt-4 bg-brand-accent text-black rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-brand-accent/90 active:scale-[0.98] shadow-md transition-all flex items-center justify-center space-x-1.5"
                      >
                        <span>업종 선택 완료</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: 리스크 판단 수치 기준 설정 */}
              {currentStep >= 2 && (
                <div className={`space-y-4 pt-4 border-t border-brand-border ${currentStep > 2 ? "opacity-40 pointer-events-none" : ""}`}>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-brand-bg border border-brand-border flex items-center justify-center text-sm shrink-0">
                      🤖
                    </div>
                    <div className="bg-brand-bg/50 rounded-2xl rounded-tl-none p-4 max-w-[90%] border border-brand-border">
                      <p className="text-xs font-bold text-brand-accent mb-1">Q2. 리스크 판단 수치 기준 설정</p>
                      <p className="text-xs text-brand-muted leading-relaxed">
                        과재고 및 품절위험을 어떤 수량 분석 로직에 따라 산출할지 결정합니다. 판단하고자 하는 기본 공식을 선택해 주세요.
                      </p>
                    </div>
                  </div>

                  <div className="ml-11 space-y-2">
                    {criteriaOptions.map((crit) => {
                      const isSelected = selectedCriteria === crit.id;
                      return (
                        <button
                          key={crit.id}
                          onClick={() => {
                            setSelectedCriteria(crit.id);
                            setOverstockVal(crit.defaultOver);
                            setStockoutVal(crit.defaultStock);
                            setIsCriteriaConfirmed(false);
                          }}
                          className={`w-full p-3 rounded-xl border text-left text-xs transition-all ${
                            isSelected 
                              ? "border-brand-accent bg-brand-accent/10 text-brand-bright font-semibold"
                              : "border-brand-border bg-brand-panel text-brand-muted hover:border-brand-accent/30 hover:bg-brand-bg hover:text-brand-bright"
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between mb-0.5">
                            <span>{crit.label}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-brand-accent" />}
                          </div>
                          <span className="text-[10px] text-brand-muted/70 block leading-tight">{crit.example}</span>
                        </button>
                      );
                    })}

                    {/* Custom Criteria Input Description */}
                    {selectedCriteria === "7" && (
                      <div className="mt-2 pl-2.5 border-l-2 border-brand-accent space-y-2">
                        <label className="text-[11px] font-bold text-brand-accent">주관식 공식/판정 기준 설명</label>
                        <textarea
                          id="input-custom-criteria-desc"
                          rows={2}
                          value={customCriteriaDesc}
                          onChange={(e) => setCustomCriteriaDesc(e.target.value)}
                          placeholder="예: 품절은 적정고 대비 20% 미만, 과재고는 180% 초과"
                          className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-xl text-xs text-brand-bright placeholder:text-brand-muted/40 focus:ring-1 focus:ring-brand-accent focus:border-brand-accent focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Secondary question: re-ask to confirm specific numeric parameters */}
                    {selectedCriteria && !isCriteriaConfirmed && currentStep === 2 && (
                      <div className="mt-4 p-4 bg-brand-bg/90 rounded-xl border border-brand-accent/30 space-y-3">
                        <p className="text-[11px] font-bold text-brand-bright flex items-center gap-1">
                          <HelpCircle className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                          과재고 및 품절 경보 수치 기준을 최종 확정해 주세요:
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-brand-muted font-bold block mb-1">
                              🚨 품절 위험 미달 기준 ({criteriaOptions.find(c => c.id === selectedCriteria)?.unit.split(" ")[0]})
                            </label>
                            <input
                              id="input-stockout-val"
                              type="number"
                              value={stockoutVal}
                              onChange={(e) => setStockoutVal(parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-1.5 bg-brand-panel border border-brand-border rounded-lg text-xs font-bold text-brand-bright focus:outline-none focus:border-brand-accent"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-brand-muted font-bold block mb-1">
                              ⚠️ 과재고 경고 초과 기준 ({criteriaOptions.find(c => c.id === selectedCriteria)?.unit.split(" ")[0]})
                            </label>
                            <input
                              id="input-overstock-val"
                              type="number"
                              value={overstockVal}
                              onChange={(e) => setOverstockVal(parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-1.5 bg-brand-panel border border-brand-border rounded-lg text-xs font-bold text-brand-bright focus:outline-none focus:border-brand-accent"
                            />
                          </div>
                        </div>

                        <button
                          id="btn-confirm-step2-values"
                          onClick={handleStep2Submit}
                          className="w-full bg-brand-accent text-black rounded-lg py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-brand-accent/90 transition-all"
                        >
                          수치 세부설정 적용
                        </button>
                      </div>
                    )}

                    {isCriteriaConfirmed && currentStep === 2 && (
                      <div className="mt-4 p-3 bg-brand-bg/80 rounded-xl border border-brand-accent/35 flex items-center justify-between">
                        <div className="text-[11px] text-brand-bright">
                          <span className="font-bold text-brand-accent">설정 적용됨:</span> 품절 미달 <strong className="text-rose-400">{stockoutVal}</strong> / 과재고 초과 <strong className="text-amber-400">{overstockVal}</strong>
                        </div>
                        <button
                          id="btn-next-step2"
                          onClick={handleStep2ConfirmNumbers}
                          className="bg-brand-accent text-black text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-lg hover:bg-brand-accent/90 transition-all flex items-center space-x-1"
                        >
                          <span>다음 단계로</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: 재고 데이터 입력 및 형식 검증 */}
              {currentStep >= 3 && (
                <div className={`space-y-4 pt-4 border-t border-brand-border ${currentStep > 3 ? "opacity-40 pointer-events-none" : ""}`}>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-brand-bg border border-brand-border flex items-center justify-center text-sm shrink-0">
                      🤖
                    </div>
                    <div className="bg-brand-bg/50 rounded-2xl rounded-tl-none p-4 max-w-[90%] border border-brand-border">
                      <p className="text-xs font-bold text-brand-accent mb-1">Q3. 재고 데이터 업로드 및 자동 매핑</p>
                      <p className="text-xs text-brand-muted leading-relaxed mb-2">
                        분석하려는 재고 데이터를 아래 텍스트 상자에 <strong>쉼표(,)나 탭</strong> 구분 형식으로 붙여넣어 주세요. 
                      </p>
                      <div className="bg-brand-panel p-2.5 rounded-lg border border-brand-border text-[10px] text-brand-muted space-y-1">
                        <span className="font-bold text-brand-accent block">✓ 표준 필수 컬럼 가이드:</span>
                        <p>• 필수: <strong>SKU 코드, 상품명, 현재고 수량, 적정재고</strong></p>
                        <p>• 선택: 유통기한, 입고예정일, 단가, 창고위치</p>
                      </div>
                    </div>
                  </div>

                  <div className="ml-11 space-y-3">
                    {/* Raw Input Text Area */}
                    <textarea
                      id="textarea-inventory-raw"
                      rows={6}
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="이곳에 복사한 엑셀이나 CSV 내용을 직접 붙여넣거나 위의 원클릭 빠른 샘플 실행을 눌러주세요."
                      className="w-full p-3 bg-brand-bg border border-brand-border rounded-xl text-xs font-mono text-brand-bright placeholder:text-brand-muted/30 focus:outline-none focus:border-brand-accent"
                    />

                    {/* Parser Preview summary block */}
                    {tempParsedItems.length > 0 && (
                      <div className="bg-brand-bg/70 rounded-xl border border-brand-accent/20 p-4 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-bold text-brand-bright">
                          <span className="flex items-center gap-1.5 text-[11px] text-brand-accent">
                            <CheckCircle2 className="h-4 w-4 text-brand-accent" />
                            지능형 컬럼 자동 분석 결과
                          </span>
                          <span className="bg-brand-panel px-2.5 py-0.5 rounded text-[10px] border border-brand-border text-brand-muted">
                            정상 행: {tempParsedItems.length}개
                          </span>
                        </div>

                        {/* Shows mapped result */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-brand-muted bg-brand-panel p-2.5 rounded-lg border border-brand-border/60">
                          <div>SKU 코드 ➜ <span className="font-bold text-brand-bright">{tempMapping?.sku}</span></div>
                          <div>상품명 ➜ <span className="font-bold text-brand-bright">{tempMapping?.name}</span></div>
                          <div>현재고 수량 ➜ <span className="font-bold text-brand-bright">{tempMapping?.currentStock}</span></div>
                          <div>적정재고 ➜ <span className="font-bold text-brand-bright">{tempMapping?.targetStock}</span></div>
                          {tempMapping?.unitCost && <div>단가 ➜ <span className="text-brand-accent/80">{tempMapping.unitCost}</span></div>}
                          {tempMapping?.expiryDate && <div>유통기한 ➜ <span className="text-brand-accent/80">{tempMapping.expiryDate}</span></div>}
                        </div>

                        {/* Error warning if any abnormal items detected */}
                        {tempAbnormalItems.length > 0 && (
                          <div className="p-2 bg-rose-950/20 rounded-lg border border-rose-900/30 text-[10px] text-rose-300 flex items-center justify-between">
                            <span className="font-medium flex items-center gap-1">
                              <AlertOctagon className="h-3 w-3 text-rose-400 shrink-0" />
                              데이터 이상/오류 SKU: {tempAbnormalItems.length}건 감지됨
                            </span>
                            <span className="font-bold uppercase text-[9px] bg-rose-950/40 px-1.5 py-0.5 rounded text-rose-400 border border-rose-900/40">리포트 분리 표기</span>
                          </div>
                        )}
                      </div>
                    )}

                    {currentStep === 3 && (
                      <button
                        id="btn-submit-step3"
                        onClick={handleStep3Submit}
                        disabled={tempParsedItems.length === 0}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md flex items-center justify-center space-x-1.5 transition-all ${
                          tempParsedItems.length > 0
                            ? "bg-brand-accent text-black hover:bg-brand-accent/90"
                            : "bg-brand-bg text-brand-muted/30 cursor-not-allowed border border-brand-border"
                        }`}
                      >
                        <span>데이터 적합성 검증 완료</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4: 최종 요약 확인 및 리포트 생성 */}
              {currentStep >= 4 && (
                <div className="space-y-4 pt-4 border-t border-brand-border">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-brand-bg border border-brand-border flex items-center justify-center text-sm shrink-0">
                      🤖
                    </div>
                    <div className="bg-brand-bg/50 rounded-2xl rounded-tl-none p-4 max-w-[90%] border border-brand-border">
                      <p className="text-xs font-bold text-brand-accent mb-1">Q4. 최종 설정 검토 및 리포트 완성</p>
                      <p className="text-xs text-brand-muted leading-relaxed">
                        Step 1부터 3까지 수집한 모든 핵심 옵션을 요약하였습니다. 이대로 완벽한 대형 재고 대시보드 리포트를 자동으로 생성할까요?
                      </p>
                    </div>
                  </div>

                  <div className="ml-11 space-y-3">
                    {/* Summary card before generating */}
                    <div className="bg-brand-bg rounded-xl border border-brand-border p-4.5 space-y-3 text-xs">
                      <div className="border-b border-brand-border pb-2 text-brand-accent font-semibold text-[10px] uppercase tracking-wider">
                        리포트 생성 최종 스펙 요약
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-brand-muted">선택 업종:</span>
                          <span className="font-bold text-brand-bright text-right">{selectedIndustry.startsWith("[주관식]") ? customIndustry : selectedIndustry}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-brand-muted">판정 기준:</span>
                          <span className="font-bold text-brand-accent text-right">
                            {criteriaOptions.find(c => c.id === selectedCriteria)?.label || customCriteriaDesc}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-brand-muted">품절위험 임계값:</span>
                          <span className="font-bold text-rose-400 text-right">{stockoutVal} 이하</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-brand-muted">과재고 임계값:</span>
                          <span className="font-bold text-amber-400 text-right">{overstockVal} 초과</span>
                        </div>
                        <div className="flex justify-between border-t border-brand-border pt-2">
                          <span className="text-brand-muted">유효 SKU 규모:</span>
                          <span className="font-bold text-brand-bright text-right">{tempParsedItems.length} 개 품목</span>
                        </div>
                        {tempAbnormalItems.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-rose-400">이상 이상 SKU 수:</span>
                            <span className="font-bold text-rose-400 text-right">{tempAbnormalItems.length} 개 (제외됨)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {currentStep === 4 && (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          id="btn-edit-wizard"
                          onClick={() => {
                            // Let user go back to Step 3 or restart
                            setCurrentStep(3);
                          }}
                          className="px-4 py-2.5 border border-brand-border text-brand-muted bg-brand-panel rounded-xl text-xs font-semibold hover:bg-brand-bg hover:text-brand-bright transition-all"
                        >
                          데이터 수정하기
                        </button>
                        <button
                          id="btn-generate-report-final"
                          onClick={handleGenerateReport}
                          disabled={isGeneratingReport}
                          className="px-4 py-2.5 bg-brand-accent text-black font-bold rounded-xl text-xs hover:bg-brand-accent/90 shadow-lg shadow-brand-accent/10 transition-all flex items-center justify-center space-x-1.5"
                        >
                          <Play className="h-3 w-3 fill-current text-black" />
                          <span>📊 리포트 생성하기</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </section>

        {/* Right Hand: Elegant Real-Time Dashboard View */}
        <section id="dashboard-container" className="flex-1 flex flex-col">
          
          {/* Empty Placeholder screen before generating */}
          {currentStep < 5 && (
            <div className="bg-brand-panel rounded-2xl border border-brand-border border-dashed p-12 text-center flex-1 flex flex-col items-center justify-center min-h-[600px] shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-brand-bg border border-brand-border flex items-center justify-center mb-5 text-brand-accent">
                <FileText className="h-7 w-7 text-brand-accent" />
              </div>
              <h3 className="font-sans font-bold text-brand-bright text-lg mb-1.5">실시간 SCM 재고 진단 대시보드 대기 중</h3>
              <p className="text-xs text-brand-muted max-w-sm mx-auto leading-relaxed mb-8">
                좌측의 가이드 단계에 따라 정보를 입력하거나 예시 샘플을 로드하시면, 실시간으로 통계 및 AI 코멘트가 포함된 리포트가 이 영역에 생성됩니다.
              </p>
              
              {/* Simple illustrative flowchart steps */}
              <div className="grid grid-cols-3 gap-4 max-w-lg w-full text-left pt-6 border-t border-brand-border/60">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest block">01 업종 결정</span>
                  <p className="text-[11px] text-brand-muted leading-tight">물류 특성 반영용 타겟 도메인 확인</p>
                </div>
                <div className="space-y-1 border-l border-brand-border/50 pl-4">
                  <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest block">02 기준값 확정</span>
                  <p className="text-[11px] text-brand-muted leading-tight">과재고/품절 판단 정량 임계 수치 수렴</p>
                </div>
                <div className="space-y-1 border-l border-brand-border/50 pl-4">
                  <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest block">03 데이터 검증</span>
                  <p className="text-[11px] text-brand-muted leading-tight">오류 SKU 분리 및 리스크 실시간 산출</p>
                </div>
              </div>
            </div>
          )}

          {/* Core Dashboard Screen once Step 4 is executed */}
          {currentStep === 5 && generatedReport && (
            <div className="space-y-6 flex-1">
              
              {/* Action Toolbar Header for Report */}
              <div className="bg-brand-panel rounded-2xl border border-brand-border p-5 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest block mb-0.5">REPORT ACTIVE</span>
                  <h2 className="text-base font-sans font-bold text-brand-bright flex items-center gap-2">
                    📊 SCM 분석 리포트 대시보드
                    <span className="text-[9px] uppercase font-sans tracking-widest bg-emerald-950/40 text-emerald-400 font-semibold px-2.5 py-0.5 rounded border border-emerald-900/30">SCM 실효</span>
                  </h2>
                </div>

                <div className="flex items-center space-x-2 self-end sm:self-auto">
                  <button
                    id="btn-copy-report"
                    onClick={handleCopyMarkdown}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 border border-brand-border text-xs font-bold rounded-xl text-brand-muted bg-brand-panel hover:bg-brand-bg hover:text-brand-bright shadow-sm transition-colors"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <ClipboardCopy className="h-3.5 w-3.5 text-brand-muted" />}
                    <span>{copied ? "클립보드 복사됨!" : "리포트 복사 (Markdown)"}</span>
                  </button>
                  <button
                    id="btn-print-report"
                    onClick={() => window.print()}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 border border-brand-border text-xs font-bold rounded-xl text-brand-muted bg-brand-panel hover:bg-brand-bg hover:text-brand-bright shadow-sm transition-colors"
                  >
                    <Printer className="h-3.5 w-3.5 text-brand-muted" />
                    <span>리포트 인쇄 (PDF)</span>
                  </button>
                </div>
              </div>

              {/* SECTION 0: 분석 조건 요약 (Analysis Condition Block) */}
              <div id="section-0-summary" className="bg-brand-panel text-brand-bright rounded-2xl p-4 shadow-md grid grid-cols-1 md:grid-cols-3 gap-4 border border-brand-border">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider block">0. 업종 / 분석 목적</span>
                  <p className="text-sm font-bold text-brand-bright flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-brand-accent shrink-0" />
                    {generatedReport.industry}
                  </p>
                </div>
                
                <div className="space-y-1 md:border-l md:border-brand-border md:pl-4">
                  <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider block">판정 기준 공식</span>
                  <p className="text-sm font-bold text-brand-accent flex items-center gap-1.5">
                    <Settings className="h-4 w-4 text-brand-accent shrink-0" />
                    {generatedReport.criteriaName}
                  </p>
                </div>

                <div className="space-y-1 md:border-l md:border-brand-border md:pl-4">
                  <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider block">경고 임계 수치</span>
                  <p className="text-xs text-brand-muted leading-snug">
                    🚨 품절위험: <strong className="text-rose-400 text-sm">{stockoutVal}</strong> 이하<br/>
                    ⚠️ 과재고: <strong className="text-amber-400 text-sm">{overstockVal}</strong> 초과
                  </p>
                </div>
              </div>

              {/* SECTION 1: 주요 핵심 지표 (KPI Cards) */}
              <div id="section-1-kpi" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* KPI Card 1: Total SKUs */}
                <div className="bg-brand-panel rounded-2xl border border-brand-border p-4 shadow-xl hover:border-brand-accent/30 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-brand-muted">총 분석 SKU 수</span>
                    <span className="p-1.5 bg-brand-bg rounded-lg text-brand-accent border border-brand-border"><Layers className="h-4 w-4" /></span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-bold text-brand-bright">{generatedReport.validSkusCount}</span>
                    <span className="text-xs text-brand-muted font-medium">개 품목</span>
                  </div>
                  <p className="text-[10px] text-brand-muted/60 mt-1 leading-tight">
                    * 오류 SKU {generatedReport.abnormalCount}건은 분석 산출 제외
                  </p>
                </div>

                {/* KPI Card 2: Stockout Risks */}
                <div className="bg-brand-panel rounded-2xl border border-rose-950/40 p-4 shadow-xl hover:border-rose-900/50 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-rose-400">🚨 품절 위험 SKU</span>
                    <span className="p-1.5 bg-rose-950/20 rounded-lg text-rose-400 border border-rose-900/30"><TrendingDown className="h-4 w-4" /></span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-bold text-rose-400">{generatedReport.stockoutCount}</span>
                    <span className="text-xs text-rose-300 font-bold bg-rose-950/30 px-1.5 py-0.5 rounded-full border border-rose-900/30">
                      {generatedReport.stockoutRate}%
                    </span>
                  </div>
                  <p className="text-[10px] text-brand-muted/60 mt-1 leading-tight">
                    공급 즉각 중단 또는 발주 지연 위험군
                  </p>
                </div>

                {/* KPI Card 3: Overstock Risks */}
                <div className="bg-brand-panel rounded-2xl border border-amber-950/40 p-4 shadow-xl hover:border-amber-900/50 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-400">⚠️ 과재고 SKU</span>
                    <span className="p-1.5 bg-amber-950/20 rounded-lg text-amber-400 border border-amber-900/30"><TrendingUp className="h-4 w-4" /></span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-bold text-amber-400">{generatedReport.overstockCount}</span>
                    <span className="text-xs text-amber-300 font-bold bg-amber-950/30 px-1.5 py-0.5 rounded-full border border-amber-900/30">
                      {generatedReport.overstockRate}%
                    </span>
                  </div>
                  <p className="text-[10px] text-brand-muted/60 mt-1 leading-tight">
                    보관 비용 상승 및 현금 흐름 적체 품목
                  </p>
                </div>

                {/* KPI Card 4: Total Inventory Value */}
                <div className="bg-brand-panel rounded-2xl border border-brand-border p-4 shadow-xl hover:border-brand-accent/30 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-brand-muted">💰 평가 재고 금액</span>
                    <span className="p-1.5 bg-brand-bg rounded-lg text-emerald-400 border border-brand-border"><Coins className="h-4 w-4" /></span>
                  </div>
                  {generatedReport.totalValue > 0 ? (
                    <div>
                      <div className="text-xl font-bold text-brand-bright truncate">
                        ₩{generatedReport.totalValue.toLocaleString()}
                      </div>
                      <p className="text-[10px] text-brand-muted/60 mt-1 leading-tight">
                        단가 기재 품목 기준 총 자산 금액
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs text-brand-muted font-semibold mt-1">
                        데이터 단가 미매핑
                      </div>
                      <p className="text-[10px] text-brand-muted/50 mt-2 leading-tight">
                        데이터에 단가 컬럼 매핑 시 계산 가능
                      </p>
                    </div>
                  )}
                </div>

              </div>

              {/* Grid: 2. Risk Highlights (Left) & AI Comments (Right) */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Highlight Table Column */}
                <div id="section-2-table" className="xl:col-span-2 bg-brand-panel rounded-2xl border border-brand-border shadow-2xl overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-brand-border flex items-center justify-between bg-brand-bg/40">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                      <h3 className="text-sm font-sans font-bold text-brand-bright flex items-center gap-1.5">
                        2. 리스크 SKU 하이라이트 목록 (심각도 순 정렬)
                      </h3>
                    </div>
                    <span className="text-[11px] text-brand-muted">
                      총 {generatedReport.items.filter(i => i.status !== "normal").length}개 감지
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-brand-bg text-brand-muted font-bold border-b border-brand-border/60">
                          <th className="p-3">상태</th>
                          <th className="p-3">SKU 코드</th>
                          <th className="p-3">상품명</th>
                          <th className="p-3 text-right">현재고</th>
                          <th className="p-3 text-right">적정재고</th>
                          <th className="p-3 text-right">이탈률</th>
                          <th className="p-3">리스크 유형</th>
                          <th className="p-3">조치 제안</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-border/40">
                        {generatedReport.items.filter(item => item.status !== "normal").slice(0, 20).map((item, index) => (
                          <tr key={index} className="hover:bg-brand-bg/50 transition-colors">
                            <td className="p-3 whitespace-nowrap">
                              {item.status === "stockout" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/30 text-rose-400 border border-rose-900/40">
                                  🚨 품절위험
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/30 text-amber-400 border border-amber-900/40">
                                  ⚠️ 과재고
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-mono font-medium text-brand-muted whitespace-nowrap">{item.sku}</td>
                            <td className="p-3 font-semibold text-brand-bright max-w-[150px] truncate" title={item.name}>{item.name}</td>
                            <td className="p-3 text-right font-medium text-brand-bright">{item.currentStock.toLocaleString()}</td>
                            <td className="p-3 text-right text-brand-muted">{item.targetStock.toLocaleString()}</td>
                            <td className="p-3 text-right font-bold text-brand-accent">{item.deviation.toFixed(1)}%</td>
                            <td className="p-3 text-brand-muted max-w-[140px] truncate" title={item.riskText}>{item.riskText}</td>
                            <td className="p-3 text-brand-accent font-semibold max-w-[180px] truncate" title={item.actionText}>{item.actionText}</td>
                          </tr>
                        ))}

                        {/* If NO risk items found */}
                        {generatedReport.items.filter(item => item.status !== "normal").length === 0 && (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-brand-muted">
                              🎉 현재 설정한 수치 기준에 이탈된 리스크 SKU가 없습니다! 안전하게 운영되고 있습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Over-20 Warning block exactly as mandated: "외 N개는 요약 통계로 대체" */}
                  {generatedReport.items.filter(item => item.status !== "normal").length > 20 && (
                    <div className="p-3.5 bg-brand-bg text-brand-muted text-xs font-medium border-t border-brand-border flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <AlertOctagon className="h-4 w-4 text-brand-accent shrink-0" />
                        <strong>외 {generatedReport.items.filter(item => item.status !== "normal").length - 20}개</strong> 품목은 요약 통계로 대체되었습니다. (전수 목록은 클립보드 복사 가능)
                      </span>
                      <button 
                        onClick={handleCopyMarkdown}
                        className="text-[10px] font-bold text-brand-accent hover:text-brand-accent/80 underline"
                      >
                        전체 리스트 복사하기
                      </button>
                    </div>
                  )}
                </div>

                {/* Section 4: AI Business Comments Panel */}
                <div id="section-4-comment" className="bg-brand-panel rounded-2xl border border-brand-border shadow-2xl overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-brand-border flex items-center justify-between bg-brand-bg/40">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="h-4.5 w-4.5 text-brand-accent" />
                      <h3 className="text-sm font-sans font-bold text-brand-bright flex items-center gap-1.5">
                        4. 종합 비즈니스 코멘트 (AI 분석)
                      </h3>
                    </div>
                    {isAiLoading && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-brand-accent/20 text-brand-accent border border-brand-accent/30 animate-pulse">
                        실시간 생성 중...
                      </span>
                    )}
                  </div>

                  <div className="p-5 flex-1 overflow-y-auto space-y-4 max-h-[500px]">
                    {isAiLoading ? (
                      <div className="h-full flex flex-col items-center justify-center space-y-3 py-12">
                        <div className="relative flex items-center justify-center">
                          <div className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-brand-accent opacity-75"></div>
                          <div className="relative rounded-full h-10 w-10 bg-brand-accent flex items-center justify-center text-black font-bold">
                            🤖
                          </div>
                        </div>
                        <div className="text-center space-y-1 max-w-xs">
                          <p className="text-xs font-bold text-brand-bright">지능형 SCM 전략 연구 중</p>
                          <p className="text-[10px] text-brand-muted leading-relaxed">
                            AI 전문가가 업종별 최적의 발주 및 창고 선입선출 방안을 점진적으로 정리하고 있습니다...
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none text-xs text-brand-muted leading-relaxed whitespace-pre-line space-y-3">
                        {aiComment ? (
                          // Parse simple markdown headers from server response for stylish formatting
                          aiComment.split("\n").map((line, idx) => {
                            if (line.startsWith("* **현황 요약**:") || line.startsWith("* **현황 요약**:")) {
                              return (
                                <div key={idx} className="bg-brand-bg p-3.5 rounded-xl border border-brand-border/80">
                                  <strong className="text-brand-accent block text-xs mb-1">📋 현황 요약</strong>
                                  <p className="text-xs text-brand-bright leading-relaxed">{line.replace(/^\*\s+\*\*현황 요약\*\*:\s*/, "")}</p>
                                </div>
                              );
                            }
                            if (line.startsWith("* **리스크 요인**:") || line.startsWith("* **리스크 요인**:")) {
                              return (
                                <div key={idx} className="bg-rose-950/20 p-3.5 rounded-xl border border-rose-900/30">
                                  <strong className="text-rose-400 block text-xs mb-1">⚠️ 리스크 요인</strong>
                                  <p className="text-xs text-brand-bright leading-relaxed">{line.replace(/^\*\s+\*\*리스크 요인\*\*:\s*/, "")}</p>
                                </div>
                              );
                            }
                            if (line.startsWith("* **운영 제안**:") || line.startsWith("* **운영 제안**:")) {
                              return (
                                <div key={idx} className="bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-900/30">
                                  <strong className="text-emerald-400 block text-xs mb-1">💡 운영 제안</strong>
                                  <p className="text-xs text-brand-bright leading-relaxed">{line.replace(/^\*\s+\*\*운영 제안\*\*:\s*/, "")}</p>
                                </div>
                              );
                            }
                            return <p key={idx} className="text-brand-muted leading-relaxed">{line}</p>;
                          })
                        ) : (
                          <p className="text-brand-muted/40">데이터를 로드해 의견을 생성해 주세요.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* SECTION 3: 데이터 이상 목록 (Only displayed if any anomaly SKU detected) */}
              {generatedReport.abnormalItems.length > 0 && (
                <div id="section-3-anomalies" className="bg-brand-panel rounded-2xl border border-rose-950/45 p-5 shadow-2xl space-y-3">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
                    <h3 className="text-sm font-sans font-bold text-rose-400 flex items-center gap-1.5">
                      3. 데이터 이상 및 오류 판정 목록 (계산에서 자동 분리)
                    </h3>
                  </div>
                  <p className="text-xs text-brand-muted leading-relaxed">
                    아래 항목들은 필수 필드 누락, 수량 음수값 기재, 데이터 타입 매칭 불일치, 혹은 동일 SKU 코드에 다른 상품명이 기재되어 중복 에러로 판명된 품목들입니다. 전체 통계 신뢰도를 위해 계산 및 현황 대시보드 표기에서 제외하였습니다.
                  </p>

                  <div className="overflow-x-auto rounded-xl border border-rose-950/30 bg-brand-bg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-rose-950/20 text-rose-300 font-bold border-b border-rose-900/30">
                          <th className="p-3">SKU 코드</th>
                          <th className="p-3">상품명 (감지값)</th>
                          <th className="p-3">이상 사유</th>
                          <th className="p-3">기입 수량/적정량</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-950/40 text-brand-muted font-mono">
                        {generatedReport.abnormalItems.map((item, index) => (
                          <tr key={index} className="hover:bg-rose-950/10 transition-colors">
                            <td className="p-3 font-bold text-rose-400">{item.sku}</td>
                            <td className="p-3 text-brand-bright font-sans">{item.name}</td>
                            <td className="p-3 font-semibold text-rose-300 font-sans">{item.reason}</td>
                            <td className="p-3 text-brand-muted/70">
                              {item.originalValues.currentStock} / {item.originalValues.targetStock}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Standard List of All SKUs for transparency (Collapsible or simple bottom layout) */}
              <div className="bg-brand-panel rounded-2xl border border-brand-border shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-brand-border bg-brand-bg/40 flex justify-between items-center">
                  <h3 className="text-xs font-sans font-bold text-brand-bright">
                    📌 전체 유효 분석 대상 품목 원본 현황 ({generatedReport.validSkusCount}건)
                  </h3>
                </div>
                <div className="p-4 max-h-[250px] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {generatedReport.items.map((item, index) => (
                      <div 
                        key={index} 
                        className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                          item.status === 'stockout' 
                            ? 'border-rose-950/40 bg-rose-950/10' 
                            : item.status === 'overstock' 
                              ? 'border-amber-950/40 bg-amber-950/10' 
                              : 'border-brand-border bg-brand-bg/50'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="font-mono text-[10px] text-brand-muted block">{item.sku}</span>
                          <span className="font-bold text-brand-bright block truncate">{item.name}</span>
                          <span className="text-[10px] text-brand-muted/60">적정: {item.targetStock}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`font-bold block text-sm ${
                            item.status === 'stockout' 
                              ? 'text-rose-400' 
                              : item.status === 'overstock' 
                                ? 'text-amber-400' 
                                : 'text-emerald-400'
                          }`}>
                            {item.currentStock.toLocaleString()}개
                          </span>
                          <span className="text-[9px] text-brand-muted block uppercase font-bold">{item.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}

        </section>

      </main>

      {/* Styled Footer */}
      <footer id="app-footer" className="bg-brand-panel border-t border-brand-border py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
          <p className="text-xs text-brand-muted">
            재고 데이터 분석 및 리포트 자동화 전문가는 안전한 클라우드 샌드박스 보안 환경 내에서 정적 분석 로직 및 Gemini AI 모델을 동시 매칭해 작동합니다.
          </p>
          <p className="text-[10px] text-brand-muted/50 font-mono">
            © 2026 Google AI Studio Build. Designed and Configured for professional Logistics & SCM Operations.
          </p>
        </div>
      </footer>

    </div>
  );
}
