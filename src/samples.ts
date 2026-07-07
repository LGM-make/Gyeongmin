export interface SampleDataset {
  name: string;
  industry: string;
  csvText: string;
  defaultCriteriaId: string;
  defaultThresholds: {
    overstockThresh: number;
    stockoutThresh: number;
  };
}

export const SAMPLE_DATASETS: Record<string, SampleDataset> = {
  ecommerce: {
    name: "의류 패션 쇼핑몰 시즌 재고",
    industry: "이커머스 쇼핑몰 (의류/잡화)",
    defaultCriteriaId: "2", // 안전재고 대비 비율
    defaultThresholds: {
      overstockThresh: 150, // 150% 초과시 과재고
      stockoutThresh: 30,   // 30% 미만시 품절위험
    },
    csvText: `SKU 코드,상품명,현재고 수량,적정재고,단가,창고위치
TS-001,오버핏 피그먼트 반팔티 (블랙),120,80,18000,A-12
TS-002,데일리 하이웨스트 데님 팬츠,15,60,32000,B-03
HD-101,시그니처 로고 후드티 (멜란지),250,100,45000,A-08
OP-302,스퀘어넥 플라워 롱 원피스,8,40,49000,C-01
KT-054,스탠다드 캐시미어 가디건,85,50,58000,B-11
JK-701,미니멀 싱글 수트 재킷,140,40,89000,A-02
SK-401,에센셜 코튼 플리츠 스커트,-5,30,24000,C-05
SH-092,클래식 레더 로퍼 (브라운),40,40,65000,B-22
TS-001,오버핏 피그먼트 반팔티 (화이트),90,80,18000,A-13
BG-881,캠퍼스 캔버스 숄더백,110,30,22000,C-08
ACC-01,써지컬스틸 볼드 체인 팔찌,200,20,12000,D-01
KT-054,스탠다드 캐시미어 가디건,텍스트에러,50,58000,B-11
TR-042,에센셜 밴딩 조거팬츠,12,50,28000,B-05
`,
  },
  fresh_food: {
    name: "신선식품 밀키트 유통기한 관리",
    industry: "유통기한 관리가 필요한 식품/신선식품",
    defaultCriteriaId: "3", // 소진 예상일수 기준
    defaultThresholds: {
      overstockThresh: 30,  // 30일 초과시 과재고
      stockoutThresh: 5,    // 5일 미만시 품절위험
    },
    csvText: `SKU,품목명,현재고수량,평균일판매량,유통기한,단가
MK-STK,소고기 찹스테이크 밀키트,450,80,2026-07-15,14900
MK-PASTA,트러플 크림 파스타 세트,25,35,2026-07-09,9900
MK-SALAD,리코타치즈 아보카도 샐러드,12,30,2026-07-07,7500
MK-HOTPOT,얼큰 소고기 버섯전골,180,40,2026-07-18,16900
SF-SHRIMP,급냉 감바스용 생새우 (500g),300,20,2026-09-30,12500
MK-SALAD,중복코드오류상품명다름,50,20,2026-07-12,8000
SF-SALMON,노르웨이 생연어 필렛 (300g),5,25,2026-07-08,19800
DP-MILK,매일 신선한 유기농 우유 (1L),120,40,2026-07-12,2850
DP-CHEESE,체다 슬라이스 치즈 대용량,500,10,2026-10-25,11000
VG-ONION,국산 햇양파 (3kg 망),45,50,2026-07-14,4500
MK-PADTHAI,쉬림프 팟타이 누들 키트,-10,20,2026-07-11,11900
`,
  },
  electronics: {
    name: "IT 스마트 기기 정밀 부품",
    industry: "전자제품 및 IT 기기 부품",
    defaultCriteriaId: "1", // 재고회전율 기준
    defaultThresholds: {
      overstockThresh: 3,   // 회전율 3회 미만 = 과재고
      stockoutThresh: 12,  // 회전율 12회 이상 = 품절위험 (회전율이 너무 높다는건 공급 대비 급소진)
    },
    csvText: `부품코드,부품명,현재고,연간출고량,입고예정일,단가
COMP-MCU32,ARM Cortex-M4 32비트 MCU,15000,60000,2026-08-15,2400
COMP-RES01,칩저항 10kOhm 0603,280000,1200000,2026-07-20,5
COMP-CAP10,적층 세라믹 콘덴서 10uF,450000,1800000,2026-07-22,8
COMP-BLE05,Bluetooth 5.2 통신 모듈,800,12000,2026-08-01,4500
COMP-BATT,리튬이온 배터리 셀 3000mAh,120,4800,2026-07-10,3200
COMP-OLED,0.96인치 I2C OLED 디스플레이,3500,6000,2026-09-10,1800
COMP-USB,USB-C 타입 입출력 단자 커넥터,55000,120000,2026-08-20,150
COMP-MCU32,Cortex-M4 (에러용 중복코드),100,5000,2026-08-15,2400
COMP-PMIC,전원 관리 IC 고성능 칩,50,2400,2026-07-25,3800
COMP-CASE,스마트 허브 ABS 사출 외장 케이스,8500,10000,2026-10-05,2900
COMP-WIFI,Dual-Band Wi-Fi 6 SoC 칩셋,-400,15000,2026-08-05,5200
`,
  },
};
