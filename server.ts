import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize GoogleGenAI client lazily or safely
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
} catch (error) {
  console.error("Failed to initialize GoogleGenAI:", error);
}

// API endpoint for verifying a custom Gemini API Key
app.post("/api/verify-key", async (req, res) => {
  const customApiKey = (req.headers["x-gemini-api-key"] as string) || req.body.apiKey;
  if (!customApiKey) {
    return res.status(400).json({ valid: false, error: "API Key가 제공되지 않았습니다." });
  }

  try {
    const tempAi = new GoogleGenAI({
      apiKey: customApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    // Make a minimal token call to verify
    await tempAi.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Verification check. Reply with 'ok'.",
      config: {
        maxOutputTokens: 5,
      },
    });

    res.json({ valid: true });
  } catch (error: any) {
    console.error("API Key Verification Error:", error);
    res.status(400).json({ valid: false, error: error.message || "유효하지 않은 API Key입니다." });
  }
});

// API endpoint for generating professional inventory analysis comments
app.post("/api/generate-comment", async (req, res) => {
  const { industry, thresholdCriteria, thresholdDetails, kpis, topRiskItems, abnormalItems } = req.body;
  const customApiKey = req.headers["x-gemini-api-key"] as string | undefined;

  if (!industry) {
    return res.status(400).json({ error: "업종 정보가 필요합니다." });
  }

  let activeAi = ai;
  if (customApiKey && customApiKey.trim() !== "") {
    try {
      activeAi = new GoogleGenAI({
        apiKey: customApiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    } catch (e: any) {
      console.error("Failed to initialize custom dynamic GoogleGenAI client:", e);
    }
  }

  const prompt = `당신은 물류 및 SCM(공급망 관리) 부서를 지원하는 최고의 **재고 데이터 분석 및 리포트 자동화 전문가**입니다.
제공된 재고 상태 및 분석 요약을 바탕으로, 다음의 조건과 출력 양식을 정확히 준수하여 리포트의 **4. 종합 분석 코멘트** 섹션을 한국어로 정교하게 작성해 주세요.

### 분석 환경 조건
- **업종/목적**: ${industry}
- **판정 기준**: ${thresholdCriteria} (상세: ${JSON.stringify(thresholdDetails)})
- **주요 지표 (KPI)**:
  - 총 관리 SKU 수: ${kpis.totalCount} 개
  - 🚨 품절 위험 SKU: ${kpis.stockoutCount} 개 (${kpis.stockoutRate}%)
  - ⚠️ 과재고 SKU: ${kpis.overstockCount} 개 (${kpis.overstockRate}%)
  - ❌ 데이터 이상 SKU: ${kpis.abnormalCount} 개

- **상위 리스크 SKU 목록 (최대 5개)**:
${JSON.stringify(topRiskItems || [])}

- **데이터 이상 SKU 목록 (최대 3개)**:
${JSON.stringify(abnormalItems || [])}

### 작성 지침 (필수 준수)
- 반드시 아래의 3가지 대분류(* 현황 요약, * 리스크 요인, * 운영 제안)의 형식으로 마크다운 리스트 형태로 출력해 주세요.
- 전문적이고 구체적인 SCM 용어(예: 안전재고, 리드타임, 적재 비용, 품절 리스크, 재고 일수 등)를 적절히 활용하되, 가독성 높은 비즈니스 서체(존댓말)로 설명해 주세요.
- 업종 특성(예: 신선식품의 유통기한 민감성, 전자제품의 단종 및 진부화 리스크, 이커머스의 트렌드 및 수요 급변동성 등)을 강하게 반영해 주세요.
- 조치 제안은 우선순위에 맞춰 실행 가능한 실질적인 행동 지침(Action Plan)으로 구체적인 방안(수치, 프로세스 등)을 적어도 2~3개 이상 디테일하게 제시해 주세요.

### 출력 양식
* **현황 요약**: [설정한 업종 및 목적에 맞춘 전체 재고 흐름 상태 요약 및 전반적인 재고 건전성 평가]
* **리스크 요인**: [발견된 리스크 항목들의 구체적인 원인 분석 및 재고 보유 비용과 기회 손실 리스크에 관한 심도 깊은 분석]
* **운영 제안**: [품절 방지 및 창고 적재 비용 절감을 위한 향후 액션 플랜 제시 (우선순위 순, 번호 매겨진 구체적 행동 방안 포함)]
`;

  try {
    if (!activeAi) {
      throw new Error("GEMINI_API_KEY environment variable is not configured or client initialization failed.");
    }

    const response = await activeAi.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    const text = response.text || "코멘트 생성 도중 텍스트가 반환되지 않았습니다.";
    res.json({ comment: text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Fallback professional comment in case Gemini fails or is unconfigured
    const fallbackComment = `* **현황 요약**: 현재 ${industry} 기준 총 ${kpis.totalCount}개의 SKU를 대상으로 재고 분석을 수행하였습니다. 품절 위험 품목이 ${kpis.stockoutCount}개(${kpis.stockoutRate}%), 과재고 품목이 ${kpis.overstockCount}개(${kpis.overstockRate}%)로 식별되어 전반적으로 안전 재고 재조정 및 긴급 수급 조절이 필요한 상황입니다.
* **리스크 요인**: 품절 위험 상태인 SKU들은 잠재적인 매출 기회 손실과 고객 신뢰 저하를 유발할 수 있으며, 과재고 SKU들은 창고 적재 비용 상승 및 현금 흐름의 악화를 초래할 우려가 큽니다. 특히 상위 리스크 품목들의 이탈률이 두드러지므로 조속한 조치가 필수적입니다.
* **운영 제안**: 
  1. **🚨 품절 위험 긴급 대응**: 품절 위험 품목에 대하여 발주 리드타임(Lead Time)을 재검토하고 공급사와의 협의를 통해 긴급 긴급 수급 조치를 실행하십시오.
  2. **⚠️ 과재고 소진 프로세스**: 과재고 비중이 높은 품목은 할인 프로모션, 사은품 패키징 또는 물류 센터 간 전환배치를 통해 적체 상태를 빠르게 해소하는 것이 현명합니다.
  3. **📊 재고 관리 모니터링 정기화**: 정기적인 재고 분석 주기(주/월 단위)를 설정하여 표준편차 및 수요 변동에 기반한 재주문점(Reorder Point)을 유연하게 업데이트해 나가십시오.`;

    res.json({ comment: fallbackComment, isFallback: true, error: error.message });
  }
});

// Serve frontend build static files and setup Vite in dev mode
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
