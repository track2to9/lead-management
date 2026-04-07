# TODOS

## P2: CRM 범용 연동
- **무엇:** CSV 외에 Zoho, Salesforce, HubSpot 등 주요 CRM API 직접 연동 옵션
- **왜:** 고객별 CRM이 다름. 범용 CSV는 기본, API 연동은 부가가치
- **노력:** M (human) → CC: S (CRM별)
- **의존성:** CSV 결과물 품질 검증 완료 후
- **컨텍스트:** 지인은 Zoho 사용 중이지만, 다른 고객은 Salesforce나 HubSpot일 수 있음. CRM 연동은 선택적 기능으로 설계.

## P3: robots.txt 준수
- **무엇:** 타겟 웹사이트 스크래핑 시 robots.txt 확인 로직
- **왜:** 법적 위험 감소, 윤리적 스크래핑
- **노력:** S (human) → CC: S

## P3: IP 프록시/로테이션
- **무엇:** 대량 스크래핑 시 IP 차단 방지를 위한 프록시 로테이션
- **왜:** 동일 IP로 수십 개 산업용 사이트 접속 시 차단 위험
- **노력:** M (human) → CC: S
