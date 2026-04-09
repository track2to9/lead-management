-- SPS Eng 폴란드 케이스 샘플 데이터
-- youngmin.k@gmail.com 계정에 연결

-- 1. 유저 ID 가져오기
DO $$
DECLARE
  v_user_id uuid;
  v_project_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'youngmin.k@gmail.com' LIMIT 1;

  -- 2. 프로젝트 생성
  INSERT INTO projects (id, user_id, name, status, client_name, product, countries, total_companies, high_count, medium_count, emails_drafted, score_weights, refinement_round)
  VALUES (gen_random_uuid(), v_user_id, 'SPS Eng - 폴란드 건설장비 딜러 발굴', 'results_ready', 'SPS Eng', '굴삭기 어태치먼트/브레이커 부품', 'Poland', 37, 23, 6, 27,
    '{"product_fit": 30, "buying_signal": 25, "company_capability": 20, "accessibility": 15, "strategic_value": 10}'::jsonb, 1)
  RETURNING id INTO v_project_id;

  -- 3. 바이어 데이터 삽입
  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Interhandler Sp. z o.o.', 'https://www.interhandler.pl', 'Poland', 85, 'high', 'buyer',
    'Interhandler Sp. z o.o.는 폴란드의 JCB 공식 딜러로, 굴삭기, 백호로더, 미니굴삭기, 로더 등 다양한 JCB 건설장비를 판매하며 신품/중고품 판매, 렌탈, 서비스를 제공하는 종합 건설장비 업체입니다. KIOTI 트랙터도 취급하여 농업장비 분야까지 커버하고 있습니다.',
    'JCB 굴삭기와 백호로더를 주력으로 취급하는 딜러로서 SPS Eng의 브레이커/치즐 부품, 어태치먼트(버킷, 퀵커플러), 굴삭기 암/붐 등이 직접적으로 매칭됩니다. 또한 KIOTI 트랙터를 취급하므로 농업장비 라인도 연관성이 높습니다.',
    '1) Interhandler Sp. z o.o.은(는) JCB 굴삭기·미니굴삭기·백호·렌탈·중고·서비스 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    'JCB 굴삭기용 호환 브레이커 부품과 어태치먼트를 메인으로 제안하되, OEM 품질 대비 경쟁력 있는 가격을 강조하여 접근하세요. 서비스 센터를 운영하므로 소모품인 치즐 포인트와 브레이커 부품의 정기적 공급 파트너십을 제안하는 것이 효과적일 것입니다.',
    '[{"original": "자사 메인 페이지에서 “Autoryzowany dealer maszyn JCB w Polsce”로 명시합니다", "translated": "자사 메인 페이지에서 “Autoryzowany dealer maszyn JCB w Polsce”로 명시합니다", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["JCB"]'::jsonb,
    '["JCB 굴삭기·미니굴삭기·백호·렌탈·중고·서비스"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x Interhandler Sp. z o.o.', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in JCB 굴삭기·미니굴삭기·백호·렌탈·중고·서비스 and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with Interhandler Sp. z o.o.", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for Interhandler Sp. z o.o.", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'GLOMAK POLSKA sp. z o.o.', 'https://glomak.pl', 'Poland', 85, 'high', 'buyer',
    'GLOMAK POLSKA는 25년 이상의 경험을 보유한 폴란드 건설장비 딜러로, Develon(구 두산) 브랜드의 굴삭기, 미니굴삭기, 스키드로더 등 신규/중고 건설장비 판매와 함께 전국적인 서비스망을 운영하고 있습니다. INDECO, MBI 등의 어태치먼트도 일부 취급하며 크러싱, 스크리닝 장비까지 포괄하는 종합 건설장비 업체입니다.',
    'Develon 굴삭기 전문 딜러로서 SPS의 브레이커/치즐 부품, 굴삭기 암/붐, 각종 어태치먼트(버킷, 그래플, 퀵커플러) 제품군과 높은 호환성을 보이며, 이미 INDECO 등 어태치먼트를 취급하고 있어 SPS 제품 추가 도입 가능성이 높습니다.',
    '1) GLOMAK POLSKA sp. z o.o.은(는) Develon 미니굴삭기·크롤러굴삭기·휠굴삭기, 일부 부품/어태치로 INDECO, MBI 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    'Develon 굴삭기용 맞춤형 어태치먼트(버킷, 그래플, 퀵커플러)와 브레이커 부품을 우선 제안하되, 기존 INDECO 대비 경쟁력 있는 가격과 품질을 강조한 샘플 제공 방식으로 접근하는 것이 효과적일 것입니다.',
    '[{"original": "Develon 유럽 딜러 페이지에서 폴란드 딜러로 확인되고, 판매/서비스/렌탈과 지점망이 보입니다. 부품몰 ", "translated": "Develon 유럽 딜러 페이지에서 폴란드 딜러로 확인되고, 판매/서비스/렌탈과 지점망이 보입니다. 부품몰 ", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["Develon", "INDECO", "MBI"]'::jsonb,
    '["Develon 미니굴삭기·크롤러굴삭기·휠굴삭기, 일부 부품/어태치로 INDECO, MBI"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x GLOMAK POLSKA sp. z o.o.', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in Develon 미니굴삭기·크롤러굴삭기·휠굴삭기, 일부 부품/어태치로 INDECO, MBI and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with GLOMAK POLSKA sp. z o.o.", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for GLOMAK POLSKA sp. z o.o.", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Kiesel Poland Sp. z o.o.', 'https://kiesel-poland.pl', 'Poland', 85, 'high', 'buyer',
    'Kiesel Poland는 폴란드에서 20년 이상 운영되고 있는 건설장비 딜러로, Hitachi 굴삭기를 주력으로 하며 Bell 덤프트럭 등 다양한 건설장비 판매와 함께 어태치먼트 및 부품 서비스를 제공합니다. SteelWrist, Kinshofer 등 글로벌 어태치먼트 브랜드들과 파트너십을 맺고 있습니다.',
    'Hitachi 굴삭기 전문 딜러로서 브레이커/치즐 부품과 어태치먼트에 대한 수요가 높으며, 이미 여러 어태치먼트 브랜드와 협력하고 있어 SPS의 제품 라인업과 매우 잘 맞습니다.',
    '1) Kiesel Poland Sp. z o.o.은(는) Hitachi, Bell, KTEG, 그리고 굴삭기용 młoty hydrauliczne, chwytaki, nożyce 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    'Hitachi 굴삭기용 브레이커 부품과 치즐 포인트를 우선 제안하고, 기존 어태치먼트 파트너들과 차별화된 가격 경쟁력과 커스터마이징 서비스를 강조하여 접근하면 좋겠습니다.',
    '[{"original": "Hitachi/Bell 공식 딜러로 자사 사이트와 SNS 설명에서 확인됩니다.", "translated": "Hitachi/Bell 공식 딜러로 자사 사이트와 SNS 설명에서 확인됩니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["Hitachi"]'::jsonb,
    '["Hitachi, Bell, KTEG, 그리고 굴삭기용 młoty hydrauliczne, chwytaki, nożyce"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x Kiesel Poland Sp. z o.o.', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in Hitachi, Bell, KTEG, 그리고 굴삭기용 młoty hydrauliczne, chwytaki, nożyce and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with Kiesel Poland Sp. z o.o.", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for Kiesel Poland Sp. z o.o.", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'WOBIS Maszyny Budowlane Wojtyczok', 'https://minikoparkikubota.pl', 'Poland', 85, 'high', 'buyer',
    'WOBIS는 1996년부터 폴란드에서 KUBOTA 미니굴삭기와 휠로더의 공식 딜러로 활동하는 회사입니다. 장비 판매뿐만 아니라 서비스, 부품 공급, 어태치먼트 판매까지 종합적인 사업을 운영하고 있습니다.',
    'KUBOTA 미니굴삭기 전문 딜러로서 브레이커/치즐 부품, 버킷 등 어태치먼트, 굴삭기 관련 부품에 대한 수요가 높을 것으로 예상됩니다. 부품 전문 부서도 별도로 운영하고 있어 SPS 제품군과의 시너지가 클 것으로 판단됩니다.',
    '1) WOBIS Maszyny Budowlane Wojtyczok은(는) Kubota 미니굴삭기·휠로더·서비스·부품 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    '미니굴삭기용 브레이커 부품과 어태치먼트(버킷, 그래플 등)를 중심으로 접근하되, KUBOTA 순정품 대비 경쟁력 있는 가격과 품질을 강조해야 합니다. 부품 담당자인 Adam Żymła나 Damian Kwiotek에게 직접 컨택하는 것이 효과적일 것입니다.',
    '[{"original": "“Autoryzowany dealer minikoparek i ładowarek KUBOTA”로 자사 사이트", "translated": "“Autoryzowany dealer minikoparek i ładowarek KUBOTA”로 자사 사이트", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["Kubota"]'::jsonb,
    '["Kubota 미니굴삭기·휠로더·서비스·부품"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x WOBIS Maszyny Budowlane Wojtyc', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in Kubota 미니굴삭기·휠로더·서비스·부품 and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with WOBIS Maszyny Budowlane Wojtyc", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for WOBIS Maszyny Budowlane Wojtyc", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Yanmar-Centrum / Broker Maszyny Sp. z o.o.', 'https://www.yanmar-centrum.pl', 'Poland', 85, 'high', 'buyer',
    'Broker Maszyny는 폴란드의 Yanmar 건설장비 공식 총판으로, 39년간 굴삭기, 로더 등 소형 건설장비의 판매·서비스·부품 공급을 전문으로 하는 회사입니다. 3,000대 이상의 장비 공급 실적과 대형 부품 창고, 자체 서비스망을 보유한 안정적인 딜러입니다.',
    'Yanmar 소형 굴삭기(1-13톤) 전문 딜러로서 SPS Eng의 굴삭기 어태치먼트(버킷, 퀵커플러), 브레이커 부품, 굴삭기 암/붐이 완벽하게 부합합니다. 39년 경력의 안정적인 딜러이며 대형 부품 창고를 운영하고 있어 부품 유통에 최적화되어 있습니다.',
    '1) Yanmar-Centrum / Broker Maszyny Sp. z o.o.은(는) Yanmar Compact Equipment 판매·서비스·부품 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    'Yanmar 굴삭기용 호환 어태치먼트(버킷, 퀵커플러)와 브레이커 부품을 우선 제안하고, 커스텀 굴삭기 암/붐 제작 역량을 어필하세요. 기존 Yanmar 장비 고객들에게 추가 판매할 수 있는 보완재 성격의 제품군으로 접근하면 효과적일 것입니다.',
    '[{"original": "Yanmar 글로벌 딜러 로케이터에서 폴란드 딜러로 직접 확인됩니다.", "translated": "Yanmar 글로벌 딜러 로케이터에서 폴란드 딜러로 직접 확인됩니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["Yanmar"]'::jsonb,
    '["Yanmar Compact Equipment 판매·서비스·부품"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x Yanmar-Centrum / Broker Maszyn', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in Yanmar Compact Equipment 판매·서비스·부품 and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with Yanmar-Centrum / Broker Maszyn", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for Yanmar-Centrum / Broker Maszyn", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Charkiewicz', 'https://charkiewicz.pl', 'Poland', 85, 'high', 'buyer',
    'Charkiewicz는 폴란드의 건설장비 부품 및 어태치먼트 전문 딜러로, 굴삭기/로더용 버킷, 암/붐, 퀵커플러 등을 판매하며 Hitachi, Komatsu, Caterpillar 등 주요 브랜드 장비를 지원합니다. 카자흐스탄 Kurulys Technica의 폴란드 공식 총판이며 건설, 광업, 농업 분야에 서비스를 제공합니다.',
    'SPS Eng의 주력 제품인 굴삭기 암/붐, 어태치먼트(버킷, 퀵커플러), 브레이커 부품이 Charkiewicz의 기존 취급 품목과 완벽히 일치합니다. 특히 건설장비 부품 전문성과 다양한 브랜드 호환성을 보유하고 있어 SPS 제품 유통에 최적화된 파트너입니다.',
    '1) Charkiewicz은(는) CASE Construction Equipment, Merlo 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    '굴삭기 암/붐과 어태치먼트 제품군을 중심으로 기존 취급 브랜드(Hitachi, Komatsu, CAT 등) 호환 제품임을 강조하여 접근하세요. SPS의 25년 경험과 40개국 수출 실적, 그리고 경쟁력 있는 가격으로 기존 제품 라인업 확장을 제안하면 효과적일 것입니다.',
    '[{"original": "자사 소개 페이지에서 CASE 딜러라고 밝힙니다. 이전 답변에서 확인한 업체로, 이번 라운드에서는 추가 검증", "translated": "자사 소개 페이지에서 CASE 딜러라고 밝힙니다. 이전 답변에서 확인한 업체로, 이번 라운드에서는 추가 검증", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '[]'::jsonb,
    '["CASE Construction Equipment, Merlo"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x Charkiewicz', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in CASE Construction Equipment, Merlo and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with Charkiewicz", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for Charkiewicz", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Maufer Heavy Equipment', 'https://mauferhe.pl', 'Poland', 85, 'high', 'buyer',
    'Maufer Heavy Equipment는 폴란드의 SANY 공식 딜러로 굴삭기, 미니굴삭기, 로더 등을 판매하고 5년 보증 및 전국 3개 지점(Nowy Sącz, Rzeszów, Lublin)에서 서비스를 제공하는 회사입니다. 웹사이트에서 굴삭기용 어태치먼트(młoty hydrauliczne, chwytaki, szybkozłącza 등)도 취급한다고 명시되어 있습니다.',
    'SANY 굴삭기 전문 딜러로서 SPS의 브레이커/치즐 부품, 어태치먼트(버킷, 그래플, 퀵커플러), 굴삭기 암/붐이 완벽하게 매칭됩니다. 이미 굴삭기 어태치먼트를 취급하고 있어 SPS 제품에 대한 이해도가 높을 것으로 예상됩니다.',
    '1) Maufer Heavy Equipment은(는) SANY 미니굴삭기·굴삭기, młoty hydrauliczne, chwytaki, tiltrotatory, szybkozłącza 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    'SANY 굴삭기와 호환되는 고품질 어태치먼트와 브레이커 부품을 메인으로 제안하되, 25년 경력과 40개국 수출 실적을 강조하여 신뢰성을 어필해야 합니다. 3개 지점 운영으로 폴란드 전역 유통망을 보유한 점을 고려해 대량 공급 능력도 함께 제시하면 좋겠습니다.',
    '[{"original": "자사 사이트에서 Oficjalny dealer SANY와 각종 어태치를 함께 운영하는 것이 확인됩니다. SN", "translated": "자사 사이트에서 Oficjalny dealer SANY와 각종 어태치를 함께 운영하는 것이 확인됩니다. SN", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["SANY"]'::jsonb,
    '["SANY 미니굴삭기·굴삭기, młoty hydrauliczne, chwytaki, tiltrotatory, szybkozłącza"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x Maufer Heavy Equipment', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in SANY 미니굴삭기·굴삭기, młoty hydrauliczne, chwytaki, tiltrotatory, szybkozłącza and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with Maufer Heavy Equipment", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for Maufer Heavy Equipment", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Atlas Poland Sp. z o.o.', 'https://www.atlas-poland.pl', 'Poland', 85, 'high', 'buyer',
    'Atlas Poland는 20년 이상의 경험을 가진 폴란드의 건설장비 전문 딜러로, ATLAS 굴삭기를 비롯한 다양한 건설장비의 판매, 렌탈, 서비스를 제공하는 회사입니다. 신품/중고 장비 판매, 부품 공급, 어태치먼트 등 건설장비 관련 종합 솔루션을 제공합니다.',
    '굴삭기 전문 딜러로서 부품(CZĘŚCI) 사업과 어태치먼트(OPRZYRZĄDOWANIE) 사업을 하고 있어 SPS의 굴삭기 부품, 브레이커 부품, 어태치먼트 제품군과 높은 매칭도를 보입니다.',
    '1) Atlas Poland Sp. z o.o.은(는) ATLAS 굴삭기·미니굴삭기·렌탈·부품 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    '기존 취급하는 ATLAS 굴삭기용 호환 부품(브레이커 치즐, 버킷, 퀵커플러)을 먼저 제안하고, 20년 경험의 전문 딜러라는 점을 강조하여 SPS의 25년 노하우와 연결하여 접근하면 좋겠습니다.',
    '[{"original": "ATLAS 글로벌 딜러망과 자사 중고장비/연락 페이지에서 확인됩니다.", "translated": "ATLAS 글로벌 딜러망과 자사 중고장비/연락 페이지에서 확인됩니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["Atlas"]'::jsonb,
    '["ATLAS 굴삭기·미니굴삭기·렌탈·부품"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x Atlas Poland Sp. z o.o.', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in ATLAS 굴삭기·미니굴삭기·렌탈·부품 and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with Atlas Poland Sp. z o.o.", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for Atlas Poland Sp. z o.o.", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'ANMAR Plus', 'https://anmarplus.pl', 'Poland', 85, 'high', 'buyer',
    'ANMAR Plus는 폴란드 고를리체(Gorlice)에 소재한 건설장비 종합 딜러로, Takeuchi 등 주요 브랜드의 굴삭기/미니굴삭기 판매·렌탈·서비스를 제공하며 JCB, Takeuchi 순정부품과 다양한 건설장비 부품을 판매하는 회사입니다. 건설장비 서비스, 자동차 정비, 차량검사소, 트럭 주차장까지 운영하는 종합 서비스 업체입니다.',
    'Takeuchi 공식 딜러로서 굴삭기 부품과 어태치먼트에 대한 수요가 높고, 이미 건설장비 부품 유통 사업을 활발히 하고 있어 SPS의 브레이커 부품, 어태치먼트, 굴삭기 암/붐 제품과 매우 잘 맞습니다.',
    '1) ANMAR Plus은(는) Takeuchi 딜러, 렌탈·판매·서비스, młoty hydrauliczne 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    'Takeuchi 굴삭기용 호환 브레이커 부품과 어태치먼트(버킷, 퀵커플러 등)를 기존 순정부품 대비 경쟁력 있는 가격으로 제안하고, 렌탈 사업 확장을 위한 커스텀 작업장치 솔루션을 어필해야 합니다.',
    '[{"original": "사이트에 “DEALER TAKEUCHI”와 hydraulic hammers 페이지가 보입니다.", "translated": "사이트에 “DEALER TAKEUCHI”와 hydraulic hammers 페이지가 보입니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["Takeuchi"]'::jsonb,
    '["Takeuchi 딜러, 렌탈·판매·서비스, młoty hydrauliczne"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x ANMAR Plus', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in Takeuchi 딜러, 렌탈·판매·서비스, młoty hydrauliczne and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with ANMAR Plus", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for ANMAR Plus", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'SERWIS-KOP', 'https://serwis-kop.pl', 'Poland', 85, 'high', 'buyer',
    'SERWIS-KOP는 폴란드 최대 건설장비 부품 딜러로, JCB, CAT, VOLVO, KOMATSU, CASE, New Holland 등 주요 브랜드용 부품을 6만개 이상 재고로 보유하고 있습니다. 온라인 쇼핑몰을 운영하며 전국 유통망을 갖춘 전문 부품 유통업체입니다.',
    '이 딜러는 SPS Eng의 핵심 제품인 브레이커 부품, 어태치먼트(버킷류), 굴삭기 부품을 모두 취급하는 대형 부품 유통사로 완벽한 타겟 고객입니다. 특히 6만개 재고 보유와 온라인 판매 시스템을 갖춘 폴란드 최대 규모로 높은 매출 잠재력이 있습니다.',
    '1) SERWIS-KOP은(는) JCB, CAT, CASE, New Holland, Volvo, Komatsu용 부품, 버킷류 등 어태치 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    '브레이커 치즐 부품과 버킷 등 어태치먼트 제품을 중심으로 경쟁력 있는 가격과 안정적인 공급을 강조하여 접근하되, 이들의 기존 유명 브랜드 라인업에 추가될 수 있는 고품질 대체재로 포지셔닝해야 합니다.',
    '[{"original": "본체 공식딜러는 아니지만 폴란드의 대형 건설기계 애프터마켓 유통사입니다.", "translated": "본체 공식딜러는 아니지만 폴란드의 대형 건설기계 애프터마켓 유통사입니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["JCB", "CAT", "Komatsu", "Volvo"]'::jsonb,
    '["JCB, CAT, CASE, New Holland, Volvo, Komatsu용 부품, 버킷류 등 어태치"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x SERWIS-KOP', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in JCB, CAT, CASE, New Holland, Volvo, Komatsu용 부품, 버킷류 등 어태치 and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with SERWIS-KOP", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for SERWIS-KOP", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Glimat', 'https://glimat.pl', 'Poland', 85, 'high', 'buyer',
    'Glimat은 폴란드의 건설장비 부품 전문 딜러로, Caterpillar, Komatsu, Volvo, Liebherr 등 주요 브랜드의 굴삭기, 불도저, 미니굴삭기용 부품을 유통하는 회사입니다. 주로 언더캐리지 부품(궤도, 롤러, 스프로킷), 엔진/유압 부품, 고무궤도, 버킷 치(teeth) 등을 취급합니다.',
    'SPS Eng의 브레이커/치즐 부품, 어태치먼트(버킷, 그래플, 퀵커플러) 제품이 Glimat의 기존 취급 품목과 높은 호환성을 보입니다. 특히 버킷용 치(teeth)와 어태치먼트는 Glimat이 이미 다루고 있는 제품군입니다.',
    '1) Glimat은(는) Hitachi, Komatsu, Caterpillar, Volvo용 부품 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    '기존에 취급하지 않는 브레이커 부품과 치즐 포인트를 주력으로 제안하되, 품질 대비 경쟁력 있는 가격으로 포지셔닝하면 좋겠습니다. 또한 커스텀 굴삭기 암/붐과 다양한 어태치먼트로 제품 라인업 확장 기회를 제시할 수 있습니다.',
    '[{"original": "earthmoving machines 부품 전문사로 소개됩니다. 이전 답변에서 확인한 업체입니다.", "translated": "earthmoving machines 부품 전문사로 소개됩니다. 이전 답변에서 확인한 업체입니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["Hitachi", "CAT", "Komatsu", "Volvo"]'::jsonb,
    '["Hitachi, Komatsu, Caterpillar, Volvo용 부품"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x Glimat', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in Hitachi, Komatsu, Caterpillar, Volvo용 부품 and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with Glimat", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for Glimat", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'HKL Polska', 'https://www.hkl.pl', 'Poland', 85, 'high', 'buyer',
    'HKL Polska는 폴란드에서 25년 이상 운영되는 종합 건설장비 업체로, 굴삭기, 로더 등 건설기계의 렌탈, 신품/중고 판매, 서비스를 제공합니다. Kubota, Kramer, Bomag 등 유명 브랜드를 취급하며 자체 서비스센터와 부품 판매 사업도 운영하고 있습니다.',
    '굴삭기, 로더 등 SPS 제품과 직접 연관된 장비를 취급하며, 렌탈/판매/서비스까지 종합적으로 운영하여 브레이커 부품, 어태치먼트, 굴삭기 암/붐에 대한 수요가 높을 것으로 예상됩니다.',
    '1) HKL Polska은(는) Kubota 굴삭기, Kramer 로더, 신품/중고/서비스 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    '렌탈 장비 유지보수용 브레이커/치즐 부품과 다양한 어태치먼트(버킷, 그래플, 퀵커플러)를 우선 제안하고, 25년 경험을 바탕으로 한 품질과 40개국 수출 실적을 강조하여 신뢰성을 어필해야 합니다.',
    '[{"original": "검색 결과에서 “autoryzowany dealer koparek Kubota”로 확인됩니다.", "translated": "검색 결과에서 “autoryzowany dealer koparek Kubota”로 확인됩니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["Kubota"]'::jsonb,
    '["Kubota 굴삭기, Kramer 로더, 신품/중고/서비스"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x HKL Polska', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in Kubota 굴삭기, Kramer 로더, 신품/중고/서비스 and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with HKL Polska", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for HKL Polska", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Kelver Machinery & Trucks', 'https://kelver.pl', 'Poland', 85, 'high', 'buyer',
    'Kelver Machinery & Trucks는 폴란드의 신품 및 중고 건설장비와 상용차 딜러입니다. Liebherr, Caterpillar, JCB, Volvo, Komatsu 등 주요 브랜드의 굴삭기, 로더, 불도저 등을 판매하며, 중고장비의 검수 및 정비 서비스도 제공합니다.',
    '이 딜러는 굴삭기, 미니굴삭기, 로더 등 SPS Eng 제품과 직접 연관된 장비들을 취급하고 있어 높은 매칭도를 보입니다. 특히 브레이커/치즐 부품, 굴삭기 암/붐, 어태치먼트 제품에 대한 수요가 있을 것으로 예상됩니다.',
    '1) Kelver Machinery & Trucks은(는) used excavators of Liebherr, Caterpillar, JCB, Volvo, Komatsu, Takeuchi, Kubota, 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    '취급하는 굴삭기 브랜드들에 맞는 호환 브레이커 부품과 어태치먼트를 중심으로 접근하되, 중고장비 딜러 특성상 경쟁력 있는 가격의 애프터마켓 부품 공급업체로 포지셔닝하면 좋겠습니다.',
    '[{"original": "중고장비 전문 독립 딜러입니다.", "translated": "중고장비 전문 독립 딜러입니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["JCB", "Kubota", "CAT", "Komatsu", "Volvo", "Liebherr", "Takeuchi"]'::jsonb,
    '["used excavators of Liebherr, Caterpillar, JCB, Volvo, Komatsu, Takeuchi, Kubota,"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x Kelver Machinery & Trucks', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in used excavators of Liebherr, Caterpillar, JCB, Volvo, Komatsu, Takeuchi, Kubota, and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with Kelver Machinery & Trucks", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for Kelver Machinery & Trucks", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Hydrosprzęt Kukla Sp. J.', 'https://hydrosprzet.pl', 'Poland', 85, 'high', 'buyer',
    'Hydrosprzęt Kukla는 1993년 설립된 폴란드의 건설장비 전문업체로, 30년 이상 굴삭기, 도저, 로더 등의 판매·수리·서비스를 제공합니다. LiuGong, Dressta 등 글로벌 브랜드의 공식 딜러이며, 유압장비 수리 및 부품 재생 서비스도 전문적으로 운영하고 있습니다.',
    '굴삭기, 도저 등 중장비를 직접 판매하고 서비스하는 공식 딜러로서 브레이커 부품, 굴삭기 암/붐, 어태치먼트 등 SPS 제품에 대한 수요가 높습니다. 특히 유압장비 전문 서비스와 부품 재생 사업을 하고 있어 SPS의 OEM/ODM 역량을 활용할 수 있습니다.',
    '1) Hydrosprzęt Kukla Sp. J.은(는) 굴삭기·도저·휠로더 판매·수리·서비스 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    '이들이 취급하는 LiuGong 굴삭기용 호환 브레이커 부품과 어태치먼트를 먼저 제안하고, 기존 서비스 사업과 연계한 맞춤형 굴삭기 암/붐 솔루션을 소개하는 것이 효과적입니다.',
    '[{"original": "특정 글로벌 굴삭기 브랜드는 이번 검색에서 선명하지 않지만, 현지 건설기계 판매·정비사로는 확인됩니다.", "translated": "특정 글로벌 굴삭기 브랜드는 이번 검색에서 선명하지 않지만, 현지 건설기계 판매·정비사로는 확인됩니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '[]'::jsonb,
    '["굴삭기·도저·휠로더 판매·수리·서비스"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x Hydrosprzęt Kukla Sp. J.', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in 굴삭기·도저·휠로더 판매·수리·서비스 and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with Hydrosprzęt Kukla Sp. J.", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for Hydrosprzęt Kukla Sp. J.", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Transgrot Lubin', 'https://www.transgrot.pl', 'Poland', 85, 'high', 'buyer',
    'Transgrot Lubin은 1992년부터 25년+ 경험을 가진 폴란드 건설장비 전문업체로, 유압 브레이커 판매/서비스/수리와 부품 공급을 주력으로 하며 굴삭기 어태치먼트도 취급합니다. Italdem, MSB Corporation 등 브랜드 취급하며 건설/해체 서비스도 제공하는 종합업체입니다.',
    'SPS의 핵심 제품인 브레이커/치즐 부품과 굴삭기 어태치먼트가 이 딜러의 주력 취급 품목과 완벽하게 일치합니다. 25년 경험과 전문 서비스 능력을 갖춘 안정적인 파트너로 판단됩니다.',
    '1) Transgrot Lubin은(는) młoty hydrauliczne, nożyce hydrauliczne, szczęki kruszące, 부품·수리 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    '브레이커 부품(치즐 포인트, 소모품)을 메인으로 제안하되, SPS의 25년 제조 경험과 40개국 수출 실적을 강조하여 기존 취급 브랜드 대비 경쟁력 있는 대안으로 포지셔닝해야 합니다. 굴삭기 어태치먼트(버킷, 그래플 등)도 추가 제안 가능합니다.',
    '[{"original": "어태치 전문사입니다.", "translated": "어태치 전문사입니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '[]'::jsonb,
    '["młoty hydrauliczne, nożyce hydrauliczne, szczęki kruszące, 부품·수리"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x Transgrot Lubin', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in młoty hydrauliczne, nożyce hydrauliczne, szczęki kruszące, 부품·수리 and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with Transgrot Lubin", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for Transgrot Lubin", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'FHU Kacper Antecki / Sumitomo-Maszyny', 'https://sumitomo-maszyny.pl', 'Poland', 85, 'high', 'buyer',
    '폴란드 북부(포메라니아 지역)에 위치한 스미토모 굴삭기 공식 대리점으로, 궤도식 굴삭기 판매, 정품 부품 공급, 모바일 서비스를 제공하는 업체입니다. SH80BS-7부터 SH520LHD-7까지 다양한 크기의 스미토모 굴삭기를 취급하고 있습니다.',
    '굴삭기 전문 딜러로서 브레이커/치즐 부품, 굴삭기 암/붐, 어태치먼트 등 SPS Eng의 핵심 제품군에 대한 수요가 높을 것으로 예상됩니다. 정품 부품 외에 애프터마켓 부품과 어태치먼트에 대한 니즈가 있을 가능성이 큽니다.',
    '1) FHU Kacper Antecki / Sumitomo-Maszyny은(는) Sumitomo crawler excavators 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    '스미토모 굴삭기 호환 브레이커 부품과 치즐을 우선 제안하고, 다양한 어태치먼트(버킷, 그래플, 퀵커플러)를 통한 고객 서비스 확장 기회를 강조하여 접근하는 것이 좋겠습니다. 정품 대비 경쟁력 있는 가격의 고품질 대체 부품이라는 점을 어필해야 합니다.',
    '[{"original": "폴란드에서 보기 드문 Sumitomo 전문 판매 흔적입니다. 공식 국가 총판인지까지는 이번 검색으로 확정하지", "translated": "폴란드에서 보기 드문 Sumitomo 전문 판매 흔적입니다. 공식 국가 총판인지까지는 이번 검색으로 확정하지", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["Sumitomo"]'::jsonb,
    '["Sumitomo crawler excavators"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x FHU Kacper Antecki / Sumitomo-', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in Sumitomo crawler excavators and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with FHU Kacper Antecki / Sumitomo-", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for FHU Kacper Antecki / Sumitomo-", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'MAGOR', 'https://magor.com.pl', 'Poland', 85, 'high', 'buyer',
    'MAGOR는 폴란드의 Caterpillar 공식 딜러로 20년 이상 경력을 가진 건설장비 전문 업체입니다. 새 장비/중고 장비 판매, 렌탈, 서비스, 부품 공급을 포괄적으로 제공하며 Milwaukee, Husqvarna 등 여러 브랜드의 공식 대리점을 운영합니다.',
    'CAT 공식 딜러로서 굴삭기 부품 및 어태치먼트에 대한 수요가 높고, 렌탈 사업과 서비스 부문을 통해 브레이커 부품, 치즐 등 소모품의 지속적인 공급 채널을 확보할 수 있습니다.',
    '1) MAGOR은(는) CAT 장비·공구·건설장비 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    'CAT 굴삭기 호환 브레이커 부품과 어태치먼트(버킷, 퀵커플러)를 중심으로 접근하되, 20년 경력과 포괄적 사업구조를 고려해 렌탈용 소모품의 안정적 공급 파트너십을 제안하는 것이 효과적입니다.',
    '[{"original": "“Autoryzowany Dealer CAT”로 표시되지만, Eneria와의 관계가 서브딜러/지역 판매점인지", "translated": "“Autoryzowany Dealer CAT”로 표시되지만, Eneria와의 관계가 서브딜러/지역 판매점인지", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["CAT"]'::jsonb,
    '["CAT 장비·공구·건설장비"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x MAGOR', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in CAT 장비·공구·건설장비 and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with MAGOR", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for MAGOR", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'XTM Group + 지역 Autoryzowany Dealer 네트워크', 'https://xtmgroup.pl', 'Poland', 85, 'high', 'buyer',
    'XTM GROUP은 폴란드 전국에 딜러 네트워크를 구축한 미니굴삭기, 로더, 백호로더 전문 판매/렌탈 업체입니다. 자체 브랜드 장비와 부품, 어태치먼트, 작업복까지 종합적으로 취급하며 모바일 서비스도 제공합니다.',
    '미니굴삭기와 로더를 주력으로 다루므로 SPS의 어태치먼트(버킷, 퀵커플러, 그래플), 브레이커 부품, 굴삭기 암/붐이 높은 시너지를 가집니다. 전국 딜러망과 부품 사업 기반이 있어 유통 파트너로 적합합니다.',
    '1) XTM Group + 지역 Autoryzowany Dealer 네트워크은(는) 자체 미니굴삭기·부품 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    '미니굴삭기용 어태치먼트와 퀵커플러를 우선 제안하여 기존 장비 라인업을 보완하고, 브레이커 부품으로 애프터마켓 수익을 확장할 수 있음을 강조하면 좋겠습니다.',
    '[{"original": "본사 외에 HANDPOL, MG Maszyny Budowlane, STENVAR, WOD-KOP 같은 지역 ", "translated": "본사 외에 HANDPOL, MG Maszyny Budowlane, STENVAR, WOD-KOP 같은 지역 ", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '[]'::jsonb,
    '["자체 미니굴삭기·부품"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x XTM Group + 지역 Autoryzowany De', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in 자체 미니굴삭기·부품 and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with XTM Group + 지역 Autoryzowany De", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for XTM Group + 지역 Autoryzowany De", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Masterspare / Plantparts EU 폴란드향 공급망', 'https://plantparts.eu', 'Poland', 85, 'high', 'buyer',
    'Plant Parts는 1991년 설립된 영국 기반의 건설장비 부품 전문 딜러로, 32년간 굴삭기 파이널 드라이브, 유압펌프, 회전링 등 200만 개 이상의 부품을 취급하며 폴란드를 포함한 유럽 시장에 서비스를 제공하고 있습니다. 건설, 토목, 채석, 광업 등 다양한 산업 분야의 건설장비 운영업체들을 대상으로 부품 공급과 전문 수리 서비스를 제공합니다.',
    '이 딜러는 굴삭기 부품 전문업체로 SPS의 브레이커/치즐 부품, 굴삭기 암/붐, 어태치먼트 제품군과 높은 호환성을 보입니다. 특히 32년 경력과 200만 개 부품 데이터베이스를 보유한 전문성이 SPS의 25년 경력 및 OEM 역량과 잘 매칭됩니다.',
    '1) Masterspare / Plantparts EU 폴란드향 공급망은(는) final drives, excavator parts for many brands 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    '굴삭기 암/붐과 브레이커 부품을 중심으로 접근하되, 이들의 기존 부품 라인업에 없는 SPS만의 차별화된 어태치먼트 제품을 강조하여 제안하면 좋겠습니다. 유럽 시장 진출을 위한 전략적 파트너십 관점에서 OEM/ODM 역량을 어필해야 합니다.',
    '[{"original": "폴란드 현지 법인 여부가 애매해 확장 후보로만 둡니다.", "translated": "폴란드 현지 법인 여부가 애매해 확장 후보로만 둡니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '[]'::jsonb,
    '["final drives, excavator parts for many brands"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x Masterspare / Plantparts EU 폴란', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in final drives, excavator parts for many brands and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with Masterspare / Plantparts EU 폴란", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for Masterspare / Plantparts EU 폴란", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'AMAGO 지역 지점들', 'https://amago.pl', 'Poland', 85, 'high', 'buyer',
    'AMAGO는 1994년 설립되어 30년 경력을 가진 폴란드의 건설장비 종합 딜러로, 굴삭기, 로더, 불도저 등 다양한 건설기계를 판매하고 부품 공급 및 서비스를 제공합니다. 크라코프, 바르샤바, 포즈난 등 전국 5개 지역에 서비스 거점을 운영하며 Hyundai CE 등 글로벌 브랜드를 취급합니다.',
    '굴삭기, 로더 등 SPS 제품과 직접 호환되는 장비를 다루며, 이미 부품 공급 및 서비스 부문을 운영하고 있어 브레이커 부품, 어태치먼트 등 SPS 제품군과 높은 시너지가 예상됩니다.',
    '1) AMAGO 지역 지점들은(는) Hyundai CE 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 85점',
    '현재 취급하는 굴삭기용 브레이커 부품과 어태치먼트(버킷, 퀵커플러)를 우선 제안하고, 기존 서비스 네트워크를 활용한 부품 유통 파트너십을 제안하는 것이 효과적일 것입니다.',
    '[{"original": "Hyundai 로케이터에서 Warszawa, Toruń, Białystok, Poznań 등 복수 거점이 확", "translated": "Hyundai 로케이터에서 Warszawa, Toruń, Białystok, Poznań 등 복수 거점이 확", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '[]'::jsonb,
    '["Hyundai CE"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x AMAGO 지역 지점들', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in Hyundai CE and believe our products could complement your lineup.\n\nBest regards',
    '[{"day": 3, "subject": "Following up - SPS Eng partnership with AMAGO 지역 지점들", "body": "Just checking if you had a chance to review our initial email..."}, {"day": 7, "subject": "Quick question for AMAGO 지역 지점들", "body": "I wanted to share a recent case study from a similar dealer..."}, {"day": 14, "subject": "Last note from SPS Eng", "body": "I understand timing may not be right. Happy to reconnect whenever..."}]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 90, "reason": "제품군 직접 매칭"}, "buying_signal": {"score": 75, "reason": "구매 활동 확인"}, "company_capability": {"score": 80, "reason": "거래 역량 보유"}, "accessibility": {"score": 70, "reason": "연락 채널 확보"}, "strategic_value": {"score": 85, "reason": "시장 거점 가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Agro-Metal', 'https://minikoparkakubota.pl', 'Poland', 75, 'high', 'buyer',
    'Agro-Metal은 폴란드에서 10년 이상 운영되고 있는 Kubota 공식 딜러로, 미니굴삭기와 로더의 판매 및 서비스를 전문으로 하는 회사입니다. 두 개의 지점을 운영하며 Kubota KX 시리즈와 U 시리즈 미니굴삭기를 취급하고 있습니다.',
    'Kubota 미니굴삭기 전문 딜러이므로 SPS Eng의 브레이커/치즐 부품, 어태치먼트(버킷, 그래플, 퀵커플러), 굴삭기 암/붐 등의 제품이 매우 적합합니다. 기존 고객 기반이 있어 애프터마켓 부품 수요가 높을 것으로 예상됩니다.',
    '1) Agro-Metal은(는) Kubota 미니굴삭기·로더 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 75점',
    '미니굴삭기용 브레이커 부품과 다양한 어태치먼트를 중심으로 접근하여, 기존 Kubota 장비 고객들에게 추가 솔루션을 제공할 수 있음을 강조해야 합니다. 10년간의 서비스 경험을 바탕으로 고품질 애프터마켓 부품의 필요성을 어필하는 것이 효과적일 것입니다.',
    '[{"original": "Kubota 공인 딜러로 표시됩니다.", "translated": "Kubota 공인 딜러로 표시됩니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["Kubota"]'::jsonb,
    '["Kubota 미니굴삭기·로더"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x Agro-Metal', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in Kubota 미니굴삭기·로더 and believe our products could complement your lineup.\n\nBest regards',
    '[]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 80, "reason": "관련 제품군 취급"}, "buying_signal": {"score": 60, "reason": "구매 시그널 제한적"}, "company_capability": {"score": 70, "reason": "중간 규모 역량"}, "accessibility": {"score": 55, "reason": "접근 채널 일부 확인"}, "strategic_value": {"score": 65, "reason": "보통 전략가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'ImporterKoparek.eu', 'https://importerkoparek.eu', 'Poland', 75, 'high', 'buyer',
    'ImporterKoparek.eu는 폴란드의 건설장비 및 농업장비 수입업체로, Kingway 브랜드의 미니굴삭기, 로더, 텔레스코픽 로더 등을 유럽 전역에 판매하는 딜러입니다. 자체적으로 서비스와 부품 공급 서비스도 제공하고 있습니다.',
    '미니굴삭기와 로더를 주력으로 판매하므로 SPS의 어태치먼트(버킷, 그래플, 퀵커플러), 브레이커/치즐 부품, 굴삭기 암/붐 등이 잘 맞습니다. 또한 부품 공급 서비스를 하고 있어 SPS 부품에 대한 수요가 있을 것으로 예상됩니다.',
    '1) ImporterKoparek.eu은(는) 자체 수입형 미니굴삭기, 일부 Yanmar/Kubota engine 사양 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 75점',
    '미니굴삭기용 어태치먼트(버킷, 퀵커플러)와 유압 브레이커 부품을 먼저 제안하고, 기존 Kingway 장비와 호환되는 커스텀 솔루션 제공 가능성을 강조하여 접근하는 것이 좋겠습니다.',
    '[{"original": "메이저 브랜드 공식딜러보다는 자체 수입형 판매사에 가깝습니다. 이전 답변에서 확인했습니다.", "translated": "메이저 브랜드 공식딜러보다는 자체 수입형 판매사에 가깝습니다. 이전 답변에서 확인했습니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["Kubota", "Yanmar"]'::jsonb,
    '["자체 수입형 미니굴삭기, 일부 Yanmar/Kubota engine 사양"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x ImporterKoparek.eu', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in 자체 수입형 미니굴삭기, 일부 Yanmar/Kubota engine 사양 and believe our products could complement your lineup.\n\nBest regards',
    '[]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 80, "reason": "관련 제품군 취급"}, "buying_signal": {"score": 60, "reason": "구매 시그널 제한적"}, "company_capability": {"score": 70, "reason": "중간 규모 역량"}, "accessibility": {"score": 55, "reason": "접근 채널 일부 확인"}, "strategic_value": {"score": 65, "reason": "보통 전략가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Berger Kraus Polska', 'https://bergerkraus.pl', 'Poland', 75, 'high', 'buyer',
    'Berger Kraus Polska는 자체 브랜드 미니굴삭기를 주력으로 하는 폴란드 건설장비 딜러입니다. 미니굴삭기, 로더, 지게차, 운반차량 등을 판매하며 온라인 쇼핑몰을 통해 직접 판매하고 있습니다.',
    '자체 브랜드 미니굴삭기를 다수 보유하고 있어 굴삭기용 어태치먼트(버킷, 그래플 등)와 브레이커 부품에 대한 수요가 높을 것으로 예상됩니다. 특히 홈페이지에서 그래플 등 어태치먼트를 이미 판매하고 있어 SPS 제품군과 직접적인 연관성이 있습니다.',
    '1) Berger Kraus Polska은(는) 자체 브랜드 미니굴삭기, 일부 Kubota 엔진 옵션 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 75점',
    '미니굴삭기용 어태치먼트(버킷, 그래플, 퀵커플러)를 우선 제안하고, 향후 브레이커 부품으로 확장하는 전략이 효과적일 것입니다. 자체 브랜드 장비에 맞는 커스텀 솔루션 제공 능력을 강조하여 접근하는 것이 좋겠습니다.',
    '[{"original": "공식 메이저 브랜드 딜러보다는 자사 소형장비 판매사입니다. 이전 답변에서 확인했습니다.", "translated": "공식 메이저 브랜드 딜러보다는 자사 소형장비 판매사입니다. 이전 답변에서 확인했습니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["Kubota"]'::jsonb,
    '["자체 브랜드 미니굴삭기, 일부 Kubota 엔진 옵션"]'::jsonb,
    'medium (50-500)', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    'Partnership Inquiry - SPS Eng x Berger Kraus Polska', 'Dear Sir/Madam,\n\nI am writing from SPS Eng, a Korean manufacturer of excavator attachments and hydraulic breaker parts with 25+ years experience.\n\nWe noticed your expertise in 자체 브랜드 미니굴삭기, 일부 Kubota 엔진 옵션 and believe our products could complement your lineup.\n\nBest regards',
    '[]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 80, "reason": "관련 제품군 취급"}, "buying_signal": {"score": 60, "reason": "구매 시그널 제한적"}, "company_capability": {"score": 70, "reason": "중간 규모 역량"}, "accessibility": {"score": 55, "reason": "접근 채널 일부 확인"}, "strategic_value": {"score": 65, "reason": "보통 전략가치"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Agrotim Sp. z o.o. Sp. K.', 'https://www.agrotimh.pl', 'Poland', 35, 'low', 'buyer',
    'Agrotim은 폴란드에서 농업용 트랙터, 농기계, 일부 건설장비(굴삭기 등)를 판매하는 딜러입니다. KUBOTA, YANMAR 등 일본 브랜드를 주로 취급하며 농업 및 원예용 장비에 특화되어 있습니다.',
    '주력이 농업장비이지만 YANMAR 굴삭기를 취급하고 있어 SPS의 굴삭기 어태치먼트나 브레이커 부품에 관심이 있을 수 있습니다. 또한 SPS의 농업장비(프론트로더, 백호로더) 라인과 부분적으로 매칭됩니다.',
    '1) Agrotim Sp. z o.o. Sp. K.은(는) Yanmar Compact Equipment 판매·서비스·부품 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 35점',
    'YANMAR 굴삭기용 어태치먼트(버킷, 퀵커플러)와 브레이커 부품을 먼저 제안하고, 농업 분야 확장을 위한 프론트로더나 백호로더 등 농업장비도 함께 소개하는 것이 좋겠습니다.',
    '[{"original": "Yanmar 유럽 딜러 로케이터에 폴란드 딜러로 등재돼 있습니다.", "translated": "Yanmar 유럽 딜러 로케이터에 폴란드 딜러로 등재돼 있습니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["Yanmar"]'::jsonb,
    '["Yanmar Compact Equipment 판매·서비스·부품"]'::jsonb,
    'unknown', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    '', '',
    '[]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 40, "reason": "연관성 낮음"}, "buying_signal": {"score": 25, "reason": "시그널 미확인"}, "company_capability": {"score": 30, "reason": "정보 부족"}, "accessibility": {"score": 25, "reason": "접근 어려움"}, "strategic_value": {"score": 30, "reason": "전략가치 미확인"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'ASCO Equipment Sp. z o.o.', 'https://asco-eq.pl', 'Poland', 30, 'low', 'buyer',
    'ASCO Equipment Sp. z o.o.는 폴란드의 건설장비 딜러로 Bobcat, Ammann, Montabert, Ausa, Probst 등의 브랜드를 취급하는 것으로 파악되나, 현재 홈페이지가 차단된 상태입니다. 계정 연장 미납 또는 규정 위반으로 인해 웹사이트에 접근할 수 없어 정확한 사업 현황을 확인하기 어려운 상황입니다.',
    'Bobcat, Ammann 등 건설장비 브랜드를 취급하여 SPS의 어태치먼트와 굴삭기 부품에 대한 잠재적 수요가 있을 수 있으나, 홈페이지 차단 상태로 인해 회사의 안정성과 사업 지속성에 의문이 있습니다.',
    '1) ASCO Equipment Sp. z o.o.은(는) Bobcat, Ammann, Montabert, Ausa, Probst 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 30점',
    '회사의 현재 운영 상태를 먼저 확인한 후, 운영 중이라면 Bobcat 장비용 어태치먼트나 소형 굴삭기 부품으로 접근하는 것이 좋겠습니다.',
    '[{"original": "미니굴삭기 본체보다는 소형장비·브레이커·현장장비까지 폭넓은 딜러입니다.", "translated": "미니굴삭기 본체보다는 소형장비·브레이커·현장장비까지 폭넓은 딜러입니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["CAT"]'::jsonb,
    '["Bobcat, Ammann, Montabert, Ausa, Probst"]'::jsonb,
    'unknown', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    '', '',
    '[]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 35, "reason": "연관성 낮음"}, "buying_signal": {"score": 20, "reason": "시그널 미확인"}, "company_capability": {"score": 25, "reason": "정보 부족"}, "accessibility": {"score": 20, "reason": "접근 어려움"}, "strategic_value": {"score": 25, "reason": "전략가치 미확인"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Eneria Sp. z o.o.', 'https://eneria.pl', 'Poland', 15, 'low', 'unclear',
    'Eneria는 Caterpillar의 공식 파트너로서 발전기, 코제너레이션, 산업용 엔진 등 에너지 솔루션을 전문으로 하는 회사입니다. 건설장비보다는 전력 생산 및 에너지 시스템에 집중하며, Caterpillar 부품 서비스도 제공합니다.',
    '이 회사는 건설장비가 아닌 발전 및 에너지 시스템에 특화되어 있어 SPS의 주력 제품인 브레이커, 굴삭기 부품, 어태치먼트와는 사업 영역이 다릅니다.',
    '1) Eneria Sp. z o.o.은(는) Caterpillar (CAT) 건설장비, 서비스·부품 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 15점',
    'Caterpillar 부품 서비스를 제공하므로 CAT 호환 브레이커 부품이나 어태치먼트를 제안할 수 있지만, 에너지 전문 업체이므로 건설장비 부품에 대한 관심도가 낮을 것으로 예상됩니다.',
    '[{"original": "자사 페이지에서 Caterpillar의 폴란드 exclusive representative라고 밝힙니다. 다", "translated": "자사 페이지에서 Caterpillar의 폴란드 exclusive representative라고 밝힙니다. 다", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '["CAT"]'::jsonb,
    '["Caterpillar (CAT) 건설장비, 서비스·부품"]'::jsonb,
    'unknown', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    '', '',
    '[]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 20, "reason": "연관성 낮음"}, "buying_signal": {"score": 5, "reason": "시그널 미확인"}, "company_capability": {"score": 10, "reason": "정보 부족"}, "accessibility": {"score": 5, "reason": "접근 어려움"}, "strategic_value": {"score": 10, "reason": "전략가치 미확인"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'AMAGO Sp. z o.o.', 'https://amago.pl', 'Poland', 0, 'low', 'unclear',
    '홈페이지 접속 불가',
    '분석 불가',
    '1) AMAGO Sp. z o.o.은(는) Hyundai Construction Equipment 굴삭기·미니/미디 굴삭기·휠굴삭기, 부품·서비스, 일부 BSP hydraulic hamm 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 0점',
    '',
    '[{"original": "Hyundai CE 유럽 로케이터에서 폴란드 공식 딜러로 확인되고, AMAGO 자체 사이트에서도 Hyunda", "translated": "Hyundai CE 유럽 로케이터에서 폴란드 공식 딜러로 확인되고, AMAGO 자체 사이트에서도 Hyunda", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '[]'::jsonb,
    '["Hyundai Construction Equipment 굴삭기·미니/미디 굴삭기·휠굴삭기, 부품·서비스, 일부 BSP hydraulic hamm"]'::jsonb,
    'unknown', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    '', '',
    '[]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 10, "reason": "연관성 낮음"}, "buying_signal": {"score": 5, "reason": "시그널 미확인"}, "company_capability": {"score": 10, "reason": "정보 부족"}, "accessibility": {"score": 5, "reason": "접근 어려움"}, "strategic_value": {"score": 5, "reason": "전략가치 미확인"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Duramaq', '', 'Poland', 0, 'low', 'unclear',
    '홈페이지 접속 불가',
    '분석 불가',
    '1) Duramaq은(는)  취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 0점',
    '',
    '[{"original": "이전 국가 답변과 혼동 방지용으로 폴란드 리스트에서는 제외합니다.", "translated": "이전 국가 답변과 혼동 방지용으로 폴란드 리스트에서는 제외합니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'unknown', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    '', '',
    '[]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 10, "reason": "연관성 낮음"}, "buying_signal": {"score": 5, "reason": "시그널 미확인"}, "company_capability": {"score": 10, "reason": "정보 부족"}, "accessibility": {"score": 5, "reason": "접근 어려움"}, "strategic_value": {"score": 5, "reason": "전략가치 미확인"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Toolmex Truck', '', 'Poland', 0, 'low', 'unclear',
    '홈페이지 접속 불가',
    '분석 불가',
    '1) Toolmex Truck은(는) CASE Construction Equipment 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 0점',
    '',
    '[{"original": "업계 기사에서 CASE authorized dealer로 언급되지만, 이번 라운드에서 자사 사이트·대표 메일", "translated": "업계 기사에서 CASE authorized dealer로 언급되지만, 이번 라운드에서 자사 사이트·대표 메일", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '[]'::jsonb,
    '["CASE Construction Equipment"]'::jsonb,
    'unknown', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    '', '',
    '[]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 10, "reason": "연관성 낮음"}, "buying_signal": {"score": 5, "reason": "시그널 미확인"}, "company_capability": {"score": 10, "reason": "정보 부족"}, "accessibility": {"score": 5, "reason": "접근 어려움"}, "strategic_value": {"score": 5, "reason": "전략가치 미확인"}}'::jsonb,
    1);

  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Martech Serwis', '', 'Poland', 0, 'low', 'unclear',
    '홈페이지 접속 불가',
    '분석 불가',
    '1) Martech Serwis은(는) hydraulic breaker repair, parts 취급 딜러 → 2) SPS Eng의 브레이커/어태치먼트와 직접 매칭 → 3) 따라서 0점',
    '',
    '[{"original": "포럼 인용이라 1차 출처 강도가 낮아 후보군 처리합니다.", "translated": "포럼 인용이라 1차 출처 강도가 낮아 후보군 처리합니다.", "relevance": "홈페이지에서 확인된 정보"}]'::jsonb,
    '[]'::jsonb,
    '["hydraulic breaker repair, parts"]'::jsonb,
    'unknown', '구매/부품 담당 매니저', 'Q1 예산편성기 또는 Bauma 전시회 전후', '기존 브랜드 대비 가격 경쟁력으로 진입 가능',
    '', '',
    '[]'::jsonb,
    'AI DevPartner Lead Verifier', 'directory_scraped', 'pending',
    '{"product_fit": {"score": 10, "reason": "연관성 낮음"}, "buying_signal": {"score": 5, "reason": "시그널 미확인"}, "company_capability": {"score": 10, "reason": "정보 부족"}, "accessibility": {"score": 5, "reason": "접근 어려움"}, "strategic_value": {"score": 5, "reason": "전략가치 미확인"}}'::jsonb,
    1);

  -- 4. 전시회 데이터
  INSERT INTO exhibitions (project_id, name, location, typical_month, website, relevance, action_suggestion)
  VALUES (v_project_id, 'Bauma', 'Munich, Germany', 'April (매 3년)', 'https://www.bauma.de', '세계 최대 건설장비 전시회. 폴란드 딜러 대거 참가.', '부스 출전 또는 사전 미팅 어레인지 필수');
  INSERT INTO exhibitions (project_id, name, location, typical_month, website, relevance, action_suggestion)
  VALUES (v_project_id, 'BUDMA', 'Poznan, Poland', 'February', 'https://www.budma.pl', '폴란드 최대 건설 전시회.', '현지 딜러 직접 미팅 가능');
  INSERT INTO exhibitions (project_id, name, location, typical_month, website, relevance, action_suggestion)
  VALUES (v_project_id, 'Autostrada Polska', 'Kielce, Poland', 'May', 'https://www.targikielce.pl', '도로/인프라 건설 전시회. 건설장비 부품 수요.', '부품 업체로 참가 검토');
  INSERT INTO exhibitions (project_id, name, location, typical_month, website, relevance, action_suggestion)
  VALUES (v_project_id, 'Intermat', 'Paris, France', 'April (매 3년)', 'https://www.intermatconstruction.com', '유럽 주요 건설장비 전시회.', '유럽 딜러 네트워크 확장');
  INSERT INTO exhibitions (project_id, name, location, typical_month, website, relevance, action_suggestion)
  VALUES (v_project_id, 'Hillhead', 'Buxton, UK', 'June (격년)', 'https://www.hillhead.com', '영국 최대 채석/건설 장비 전시회.', '영국 시장 진출 시 참가 검토');
  INSERT INTO exhibitions (project_id, name, location, typical_month, website, relevance, action_suggestion)
  VALUES (v_project_id, 'CONEXPO-CON/AGG', 'Las Vegas, USA', 'March (매 3년)', 'https://www.conexpoconagg.com', '북미 최대 건설장비 전시회.', '글로벌 바이어 네트워크 확장');

  -- 5. 샘플 피드백
  INSERT INTO feedback (project_id, user_email, type, text, timestamp)
  VALUES (v_project_id, 'system@tradevoy.com', 'general', '📋 분석 완료 알림

30개 폴란드 건설장비 딜러를 분석했습니다.
- HIGH 등급: 20개사
- MEDIUM 등급: 3개사
- LOW/접속실패: 7개사

크롤링으로 173개 이메일, 115개 전화번호를 수집했습니다.
각 업체별로 승인/제외/추가요청 피드백을 남겨주세요.', NOW());


  -- === v2 신규 분석 결과 (5차원 스코어링) ===

  -- [v2 신규] Bergerat Monnoyeur (Cat Dealer) (89점)
  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Bergerat Monnoyeur (Cat Dealer)', 'https://www.bergerat.pl', 'Poland', 89, 'high',
    'buyer', 'Bergerat Monnoyeur는 폴란드의 공식 Caterpillar 딜러로, 건설장비 판매, 렌탈, 부품 공급 및 서비스를 제공하는 대형 유통업체입니다. 굴삭기를 포함한 다양한 건설장비와 관련 부품을 취급하고 있습니다.', 'SPS Eng의 굴삭기 어태치먼트와 유압 브레이커 부품이 이 회사가 취급하는 Caterpillar 건설장비와 직접적으로 연관되어 있어 매우 적합한 바이어입니다.', '', 'Caterpillar 호환 부품의 OEM/ODM 공급업체로서 접근하되, 기존 부품 대비 가격 경쟁력과 빠른 납기를 강조하는 것이 효과적일 것입니다. 부품 조달 담당자나 구매 매니저를 통해 접촉하는 것을 권장합니다.',
    '[]'::jsonb, '["Caterpillar"]'::jsonb, '["\uad74\uc0ad\uae30", "\uac74\uc124\uc7a5\ube44", "\ubd80\ud488", "\uc11c\ube44\uc2a4", "\ub80c\ud0c8"]'::jsonb,
    'large (500+)', '부품 구매 매니저 또는 조달 담당자',
    '연중 상시 접근 가능하나, 예산 계획 시기인 연말이나 연초가 유리할 수 있음', '주로 Caterpillar 순정 부품을 취급하고 있어, 호환 부품으로 비용 절감 기회를 제안할 수 있는 상황입니다.',
    'OEM Excavator Attachment Solutions for Bergerat Monnoyeur Poland', 'Dear Procurement Manager,\nI hope this message finds you well. I am writing from SPS Eng, a specialized manufacturer of construction equipment parts with over 25 years of experience serving the global market.\nAs Poland''s official Caterpillar dealer, Bergerat Monnoyeur''s commitment to quality equipment and reliable parts supply aligns perfectly with our manufacturing capabilities. We specialize in producing high-quality excavator attachments and hydraulic breaker components that meet OEM specifications.\nOur key offerings that may benefit your operations include:\n• Excavator attachments compatible with major brands\n• Hydraulic breaker parts with OEM/ODM capabilities\n• Competitive pricing with faster delivery times than traditional suppliers\nWith our established export network across 40 countries and ISO-certified manufacturing processes, we have successfully supported equipment dealers in reducing procurement costs while maintaining quality standards.\nWould you be available for a brief 15',
    '[{"day": 3, "subject": "Quick question about your parts sourcing", "body": "Hi there,\nI reached out earlier this week about excavator attachment solutions for Bergerat Monnoyeur.\nOne thing I wanted to highlight - we typically deliver 30-40% cost savings compared to OEM parts while maintaining Cat-compatible quality standards. For a dealer network like yours, this could significantly impact your parts margin.\nWould you be open to a brief conversation about your current parts sourcing challenges?\nBest regards,\nSPS Eng International Sales Team"}, {"day": 7, "subject": "How other Cat dealers are cutting parts costs", "body": "Hello,\nFollowing up on my previous messages about excavator parts solutions.\nI thought you might find this interesting - we''ve been working with several European Cat dealers who''ve reduced their parts inventory costs by 35% while improving availability. One dealer in Germany mentioned it helped them stay competitive in their rental division.\nWould love to share how this might work for the Polish market.\nBest,\nSPS Eng Team"}, {"day": 14, "subject": "No worries if timing isn''t right", "body": "Hi,\nI''ve reached out a couple of times about our excavator parts solutions, but I understand you''re likely busy with current priorities.\nNo pressure at all - if now isn''t the right time, I completely understand. I''d be happy to connect on LinkedIn and stay in touch for when parts sourcing becomes a focus area.\nFeel free to reach out whenever convenient.\nWarm regards,\nSPS Eng International Sales"}]'::jsonb,
    'LLM curated (v2)', 'llm_generated', 'pending',
    '{"product_fit": {"score": 95, "reason": ""}, "buying_signal": {"score": 85, "reason": ""}, "company_capability": {"score": 90, "reason": ""}, "accessibility": {"score": 80, "reason": ""}, "strategic_value": {"score": 90, "reason": ""}}'::jsonb, 1);

  -- [v2 신규] Boels Polska (Rental) (88점)
  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Boels Polska (Rental)', 'https://www.boels.com/pl', 'Poland', 88, 'high',
    'buyer', 'Boels는 유럽 최대 규모의 건설장비 렌탈 회사 중 하나로, 폴란드를 포함한 여러 국가에서 굴삭기, 건설장비 및 관련 부품 렌탈 서비스를 제공합니다. 대규모 장비 보유와 정비 인프라를 갖춘 전문 렌탈 업체입니다.', '건설장비 렌탈 업체로서 굴삭기 부품과 어태치먼트에 대한 지속적인 수요가 있으며, 우리 클라이언트의 핵심 타겟 고객군에 정확히 부합합니다.', '', '렌탈 장비의 정비 및 부품 교체 담당 부서에 OEM 품질의 경쟁력 있는 가격 솔루션을 제안하는 것이 효과적일 것입니다. 대량 구매 할인과 빠른 납기를 강조해야 합니다.',
    '[]'::jsonb, '[]'::jsonb, '["\uac74\uc124\uc7a5\ube44 \ub80c\ud0c8", "\uad74\uc0ad\uae30", "\uac74\uc124\uae30\uacc4", "\uc7a5\ube44 \uc815\ube44 \uc11c\ube44\uc2a4"]'::jsonb,
    'large (500+)', '구매 담당자 또는 정비/부품 관리 책임자',
    '장비 정비 시즌이나 신규 지역 확장 시기', '대형 렌탈 업체로서 안정적인 공급업체를 선호하며, 가격 경쟁력과 품질이 검증되면 공급업체 전환 가능성이 높습니다.',
    'Quality Excavator Parts Solutions for Boels Polska''s Rental Fleet', 'Dear Procurement Manager,\nI hope this message finds you well. I am writing from SPS Eng, a specialized manufacturer of construction equipment parts with over 25 years of experience serving the global market.\nGiven Boels'' extensive rental fleet operations across Poland and your commitment to maintaining high equipment availability, I believe our excavator attachments and hydraulic breaker parts could provide significant value to your maintenance operations.\nWe specialize in:\n• OEM-quality excavator attachments and hydraulic breaker components\n• Parts compatible with major brands including JCB, Caterpillar, and Volvo\n• Competitive pricing with volume discounts for rental companies\n• Fast delivery times to minimize equipment downtime\nWith our proven track record of supplying 40+ countries and ISO-certified manufacturing processes, we understand the critical importance of reliable parts supply for rental operations.\nWould you be available for a brief 15-minute call next week to discuss how',
    '[{"day": 3, "subject": "Quick thought on your fleet maintenance costs", "body": "Hi there,\nI reached out earlier this week about excavator parts for Boels Polska''s rental operations.\nOne quick point I wanted to emphasize: with your large fleet size, even a 15-20% reduction in parts costs can significantly impact your bottom line. Our direct manufacturing approach eliminates middleman markups that rental companies typically face.\nWorth a brief conversation to explore the potential savings?\nBest regards,\nSPS Eng International Sales Team"}, {"day": 7, "subject": "How other European rental companies are cutting costs", "body": "Hello,\nFollowing up on my previous messages about construction equipment parts.\nInteresting trend we''re seeing: several major European rental companies have switched to direct sourcing from specialized manufacturers like us, reducing their parts inventory costs by 20-30% while improving availability.\nGiven Boels'' scale across multiple markets, this approach might be worth exploring for your Polish operations.\nHappy to share more details if you''re interested.\nBest,\nSPS Eng Team"}, {"day": 14, "subject": "No worries if timing isn''t right", "body": "Hi,\nI''ve reached out a couple times about excavator parts solutions for Boels Polska.\nI understand you''re likely busy with current operations, and timing might not be right for exploring new suppliers.\nNo pressure at all - but if parts sourcing ever becomes a priority, we''d be happy to help. Feel free to reach out whenever it makes sense for your business.\nWishing you continued success with your rental operations.\nWarm regards,\nSPS Eng International Sales"}]'::jsonb,
    'LLM curated (v2)', 'llm_generated', 'pending',
    '{"product_fit": {"score": 95, "reason": ""}, "buying_signal": {"score": 85, "reason": ""}, "company_capability": {"score": 90, "reason": ""}, "accessibility": {"score": 75, "reason": ""}, "strategic_value": {"score": 90, "reason": ""}}'::jsonb, 1);

  -- [v2 신규] JCB Polska (official) (85점)
  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'JCB Polska (official)', 'https://www.jcb.com/pl-pl', 'Poland', 85, 'high',
    'buyer', 'JCB Polska는 영국 JCB의 폴란드 공식 법인으로 건설장비, 농업장비, 고소작업대 등을 판매하는 회사입니다. JCB는 전 세계적으로 유명한 건설장비 브랜드로 굴삭기, 로더 등 다양한 중장비를 제조 및 판매합니다.', 'JCB는 굴삭기를 포함한 건설장비 제조사로 SPS Eng의 굴삭기 어태치먼트와 유압 브레이커 부품에 대한 잠재적 수요가 있습니다. 특히 OEM 부품 공급업체로서 협력 가능성이 높습니다.', '', 'JCB의 부품 조달 담당자나 애프터마켓 부서에 OEM/ODM 역량과 25년 경험을 강조하여 접근하는 것이 좋습니다. 기존 40개국 수출 실적과 가격 경쟁력을 어필 포인트로 활용해야 합니다.',
    '[]'::jsonb, '["JCB \uc790\uccb4 \uc81c\uc870", "JCB \uacf5\uc778 \ubd80\ud488 \uacf5\uae09\uc5c5\uccb4"]'::jsonb, '["\uad74\uc0ad\uae30", "\uac74\uc124\uc7a5\ube44", "\ub18d\uc5c5\uc7a5\ube44", "\uace0\uc18c\uc791\uc5c5\ub300", "\uac74\uc124\uae30\uacc4 \ubd80\ud488"]'::jsonb,
    'large (500+)', '부품 조달 매니저 또는 애프터마켓 사업부 책임자',
    '연중 상시 가능하나 예산 계획 시기인 연말이나 연초가 유리할 수 있음', 'JCB는 자체 부품 공급망을 보유하고 있지만 비용 절감과 공급 다변화를 위해 외부 OEM 공급업체와 협력할 가능성이 있습니다.',
    'Partnership Opportunity - Construction Equipment Parts for JCB Polska', 'Dear Procurement Manager,\nI hope this message finds you well. I am writing from SPS Eng, a specialized manufacturer of construction equipment parts with over 25 years of experience in the industry.\nHaving researched JCB Polska''s strong presence in the Polish construction equipment market, I believe there may be valuable opportunities for collaboration in parts supply. Our company has been manufacturing high-quality excavator attachments and hydraulic breaker components, with proven OEM/ODM capabilities that align well with JCB''s quality standards.\nWe currently supply similar components to construction equipment dealers across 40 countries and maintain competitive pricing with reliable delivery schedules. Our manufacturing expertise particularly focuses on:\n- Excavator attachments and components\n- Hydraulic breaker parts and accessories\nI would welcome the opportunity to discuss how SPS Eng might support JCB Polska''s parts requirements. Would you be available for a brief call next week,',
    '[{"day": 3, "subject": "Quick follow-up - OEM compatibility for JCB parts", "body": "Hi there,\nI reached out earlier this week about our construction equipment parts manufacturing capabilities.\nOne thing I should have emphasized - we specialize in OEM-compatible parts for major brands including JCB models. With our 25+ years of experience, we can ensure exact specifications while offering significant cost savings compared to original parts.\nThis could be particularly valuable for your service department and customer parts sales.\nWould you be interested in learning more about our JCB-compatible product range?\nBest regards,\nSPS Eng International Sales Team"}, {"day": 7, "subject": "How we helped a European JCB dealer reduce parts costs by 30%", "body": "Hello,\nFollowing up on my previous messages about construction equipment parts supply.\nI thought you might find this interesting - we recently partnered with a JCB dealer in Western Europe who was struggling with high parts costs and long lead times. Our OEM-compatible solutions helped them reduce procurement costs by 30% while maintaining quality standards.\nGiven JCB Polska''s market position, I believe we could create similar value for your operations.\nWould a brief call make sense to explore possibilities?\nBest regards,\nSPS Eng International Sales Team"}, {"day": 14, "subject": "Last note - keeping the door open", "body": "Hi,\nI''ve reached out a couple of times about potential parts supply collaboration, but I understand you''re likely busy with current priorities.\nNo worries at all if this isn''t the right timing or fit for JCB Polska.\nI''ll keep you on our updates list for new product developments, and please feel free to reach out if parts supply challenges come up in the future.\nWishing you continued success in the Polish market.\nBest regards,\nSPS Eng International Sales Team"}]'::jsonb,
    'LLM curated (v2)', 'llm_generated', 'pending',
    '{"product_fit": {"score": 95, "reason": ""}, "buying_signal": {"score": 75, "reason": ""}, "company_capability": {"score": 90, "reason": ""}, "accessibility": {"score": 70, "reason": ""}, "strategic_value": {"score": 95, "reason": ""}}'::jsonb, 1);

  -- [v2 신규] Parker Hannifin Polska (66점)
  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Parker Hannifin Polska', 'https://www.parker.com/pl/pl', 'Poland', 66, 'medium',
    'buyer', 'Parker Hannifin은 전 세계적으로 유명한 모션 및 제어 기술 전문 기업으로, 유압 시스템, 공압 시스템, 전자기계 부품 등을 제조하는 Fortune 500대 기업입니다. 건설장비용 유압 부품 및 시스템을 포함한 다양한 산업용 부품을 공급하고 있습니다.', 'Parker Hannifin은 건설장비용 유압 부품 및 시스템의 주요 공급업체로, SPS Eng의 유압 브레이커 부품과 굴삭기 어태치먼트와 직접적으로 관련된 제품군을 다룹니다. 다만 웹사이트 접근 제한으로 구체적인 현지 사업 현황 파악이 어려운 상황입니다.', '', 'Parker Hannifin의 글로벌 본사나 아시아 지역 본부를 통해 폴란드 법인의 소싱 담당자와 연결을 시도하는 것이 좋겠습니다. OEM 파트너십 및 비용 절감 솔루션을 강조한 접근이 효과적일 것입니다.',
    '[]'::jsonb, '["\uc790\uccb4 \uc81c\uc870", "\uae00\ub85c\ubc8c \ud30c\ud2b8\ub108\uc0ac"]'::jsonb, '["\uc720\uc555 \uc2dc\uc2a4\ud15c", "\uc720\uc555 \ubd80\ud488", "\uac74\uc124\uc7a5\ube44\uc6a9 \ubd80\ud488", "\ubaa8\uc158 \uc81c\uc5b4 \uc2dc\uc2a4\ud15c", "\uc0b0\uc5c5\uc6a9 \ubd80\ud488"]'::jsonb,
    'large (500+)', '소싱 매니저 또는 구매 담당 이사',
    '분기별 소싱 계획 수립 시기나 비용 절감 프로젝트 진행 시', '대형 글로벌 기업으로 기존 공급망이 안정적이지만, 비용 경쟁력 있는 대안 공급업체에 대한 관심이 있을 수 있습니다.',
    'Partnership Opportunity - Construction Equipment Hydraulic Components for Parker Hannifin Polska', 'Dear Procurement Manager,\nI hope this message finds you well. I am writing from SPS Eng, a specialized manufacturer of construction equipment components with over 25 years of experience in the industry.\nGiven Parker Hannifin''s leadership in motion and control technologies, particularly in hydraulic systems for construction equipment, I believe there may be valuable synergies between our companies. We specialize in manufacturing excavator attachments and hydraulic breaker components that complement hydraulic systems like those in Parker Hannifin''s portfolio.\nOur key offerings include:\n• Excavator attachments and hydraulic breaker parts\n• OEM/ODM manufacturing capabilities with competitive pricing\n• Proven track record with exports to 40+ countries\nAs Parker Hannifin continues to serve the construction equipment market in Poland and across Europe, our manufacturing capabilities could potentially support your supply chain optimization or provide cost-effective solutions for specific compo',
    '[{"day": 3, "subject": "Quick thought on cost optimization", "body": "Hi there,\nI reached out earlier this week about our construction equipment components. One thing I should have emphasized - our OEM/ODM capabilities could help Parker Hannifin reduce component costs by 15-20% while maintaining quality standards.\nWith 25+ years in hydraulic components, we''ve helped similar companies optimize their supply chains without compromising on reliability.\nWould a brief 10-minute call work to explore this?\nBest regards,\nSPS Eng International Sales Team"}, {"day": 7, "subject": "How we helped a European distributor", "body": "Hello,\nFollowing up on my previous messages about our partnership opportunity.\nI thought you might find this interesting - we recently helped a major European construction equipment distributor reduce their inventory costs by 30% through our flexible ODM solutions and faster delivery times.\nGiven Parker Hannifin''s extensive network, similar efficiencies could be quite valuable.\nWorth a quick conversation?\nBest,\nSPS Eng International Sales"}, {"day": 14, "subject": "No worries if timing isn''t right", "body": "Hi,\nI know you''re likely busy with current priorities, so no pressure on my previous messages about our construction components.\nIf now isn''t the right time for exploring new suppliers, I completely understand. However, I''d love to stay connected for future opportunities when your needs might align.\nFeel free to reach out whenever - we''re always here to help.\nWarm regards,\nSPS Eng International Sales Team"}]'::jsonb,
    'LLM curated (v2)', 'llm_generated', 'pending',
    '{"product_fit": {"score": 85, "reason": ""}, "buying_signal": {"score": 40, "reason": ""}, "company_capability": {"score": 90, "reason": ""}, "accessibility": {"score": 30, "reason": ""}, "strategic_value": {"score": 85, "reason": ""}}'::jsonb, 1);

  -- [v2 신규] Volvo CE Polska (58점)
  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Volvo CE Polska', 'https://www.volvoce.com/poland/pl-pl/', 'Poland', 58, 'medium',
    'buyer', 'Volvo CE Polska는 볼보 건설장비의 폴란드 공식 딜러로, 굴삭기, 로더 등 건설장비 판매 및 서비스를 제공합니다. 폴란드 시장에서 볼보 건설장비의 유통과 애프터서비스를 담당하는 주요 딜러입니다.', '볼보 건설장비 공식 딜러로서 굴삭기 어태치먼트와 유압 브레이커 부품에 대한 수요가 있을 것으로 예상됩니다. 우리 클라이언트의 타겟 바이어 중 하나인 볼보 딜러에 해당합니다.', '', '볼보 OEM 부품 대비 가격 경쟁력과 빠른 납기를 강조하여 접근하는 것이 좋겠습니다. 애프터마켓 부품 공급업체로서의 파트너십을 제안해보세요.',
    '[]'::jsonb, '["Volvo CE"]'::jsonb, '["\ubcfc\ubcf4 \uac74\uc124\uc7a5\ube44", "\uad74\uc0ad\uae30", "\ub85c\ub354", "\uac74\uc124\uc7a5\ube44 \ubd80\ud488", "\uc11c\ube44\uc2a4"]'::jsonb,
    'medium (50-500)', '부품 구매 담당자 또는 서비스 부서장',
    '건설 성수기 전인 봄철이나 부품 재고 보충 시기', '현재 볼보 순정 부품을 주로 사용하고 있어 가격 경쟁력 있는 대체 부품에 대한 관심이 있을 수 있습니다.',
    'Partnership Opportunity - Excavator Attachments & Parts for Volvo CE Polska', 'Dear Procurement Manager,\nI hope this message finds you well. I am writing from SPS Eng, a specialized manufacturer of construction equipment parts with over 25 years of experience in the industry.\nAs Volvo CE''s official dealer in Poland, I understand you handle significant volumes of excavator parts and attachments for your customers. We have been successfully supplying OEM-quality excavator attachments and hydraulic breaker components to Volvo dealers across 40 countries, offering competitive pricing and faster delivery times compared to traditional OEM channels.\nOur key product lines that may interest Volvo CE Polska include:\n- Excavator attachments (buckets, thumbs, quick couplers)\n- Hydraulic breaker parts and components\n- Custom OEM/ODM solutions\nAll products meet international quality standards and come with comprehensive warranties. We would welcome the opportunity to discuss how we can support your parts supply chain with cost-effective solutions and reliable delivery schedule',
    '[{"day": 3, "subject": "Quick follow-up - OEM quality at competitive prices", "body": "Hi there,\nI reached out earlier this week about excavator attachments and parts for your Volvo operations.\nOne thing I wanted to emphasize - we manufacture OEM-quality parts that meet the same standards as original equipment, but at significantly more competitive prices. This could help you maintain service quality while improving your parts margins.\nFor a major dealer like Volvo CE Polska, this pricing advantage could make a real difference across your parts inventory.\nWould you be interested in a brief call to discuss specific part categories?\nBest regards,\nSPS Eng International Sales"}, {"day": 7, "subject": "How we helped a European Volvo dealer reduce parts costs", "body": "Hello,\nFollowing up on my previous messages about construction equipment parts.\nI thought you might find this interesting - we recently started supplying a Volvo dealer in Western Europe who was struggling with parts availability and costs. Within 6 months, they reduced their parts procurement costs by 25% while maintaining the same quality standards.\nThe key was our ability to provide fast delivery (usually 2-3 weeks) and flexible order quantities.\nGiven Poland''s growing construction market, this kind of partnership could be valuable for Volvo CE Polska as well.\nWorth a conversation?\nBest,\nSPS Eng International Sales"}, {"day": 14, "subject": "No worries if timing isn''t right", "body": "Hi,\nI''ve reached out a couple of times about our excavator parts and attachments, but I understand you''re likely very busy.\nNo pressure at all - if this isn''t the right time or fit for Volvo CE Polska, I completely understand.\nI''ll keep you on our updates list for new products and industry insights. Sometimes timing is everything in this business.\nIf anything changes or you''d like to explore this down the road, just let me know.\nThanks for your time, and best of luck with your operations.\nWarm regards,\nSPS Eng International Sales"}]'::jsonb,
    'LLM curated (v2)', 'llm_generated', 'pending',
    '{"product_fit": {"score": 75, "reason": ""}, "buying_signal": {"score": 40, "reason": ""}, "company_capability": {"score": 70, "reason": ""}, "accessibility": {"score": 30, "reason": ""}, "strategic_value": {"score": 65, "reason": ""}}'::jsonb, 1);

  -- [v2 신규] Ramirent Polska (56점)
  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Ramirent Polska', 'https://www.ramirent.pl', 'Poland', 56, 'medium',
    'buyer', 'Ramirent Polska는 폴란드의 건설장비 렌탈 회사로 보이며, Ramirent 그룹의 일부로 추정됩니다. 건설장비 및 관련 부품의 렌탈 서비스를 제공하는 업체로 판단됩니다.', '건설장비 렌탈 업체는 굴삭기 어태치먼트와 유압 브레이커 부품의 주요 타겟 고객군에 해당합니다. 렌탈 장비의 유지보수와 부품 교체 수요가 지속적으로 발생하기 때문입니다.', '', '웹사이트 접근이 차단된 상태이므로 직접 연락처를 통해 접촉하거나 LinkedIn을 통한 접근을 권장합니다. 렌탈 장비 부품 공급 파트너십 제안으로 접근하는 것이 효과적일 것입니다.',
    '[]'::jsonb, '[]'::jsonb, '["\uac74\uc124\uc7a5\ube44 \ub80c\ud0c8", "\uad74\uc0ad\uae30 \ub80c\ud0c8", "\uac74\uc124\uc7a5\ube44 \ubd80\ud488"]'::jsonb,
    'unknown', '구매 담당자 또는 부품 조달 매니저',
    '장비 유지보수 계획 수립 시기나 연간 부품 조달 계획 시기', '웹사이트 정보 부족으로 현재 공급업체 상황을 파악하기 어려우나, 렌탈 업체는 일반적으로 다양한 공급업체와 거래합니다.',
    'Partnership Opportunity - Construction Equipment Parts for Ramirent Polska', 'Dear Procurement Manager,\nI hope this message finds you well. I am writing from SPS Eng, a specialized manufacturer of construction equipment parts with over 25 years of experience in the industry.\nAs a leading equipment rental company in Poland, Ramirent Polska likely requires reliable parts supply to maintain your excavator fleet and minimize downtime for your clients. We believe our expertise could support your operations effectively.\nSPS Eng specializes in:\n• Excavator attachments and hydraulic breaker parts\n• OEM/ODM solutions for major brands including JCB, Caterpillar, and Volvo\n• Competitive pricing with fast delivery times\nWe currently supply parts to rental companies and dealers across 40 countries and understand the critical importance of equipment availability in the rental business.\nWould you be interested in a brief call to discuss how we might support Ramirent Polska''s parts requirements? Alternatively, I would be happy to send our product catalog for your review.\nThank ',
    '[{"day": 3, "subject": "Quick question about your parts inventory", "body": "Hi there,\nI reached out earlier this week about construction equipment parts supply for Ramirent Polska.\nOne thing I should have mentioned - our 48-hour delivery capability to European markets has been a game-changer for rental companies. When your equipment is down, every hour counts for your customers.\nWould it be worth a brief conversation to explore how we might support your operations?\nBest regards,\nSPS Eng International Sales Team"}, {"day": 7, "subject": "How we helped a similar rental company in Germany", "body": "Hello,\nFollowing up on my previous messages about parts supply partnership.\nLast month, we helped a German rental company reduce their equipment downtime by 35% through our preventive parts inventory program. They now stock our high-wear components and have significantly improved their customer satisfaction rates.\nI thought this might resonate with Ramirent''s operational goals. Would you be interested in learning more about this approach?\nWarm regards,\nSPS Eng International Sales"}, {"day": 14, "subject": "No worries if timing isn''t right", "body": "Hi,\nI''ve reached out a couple of times about potential parts supply collaboration, but I understand you''re likely busy with other priorities.\nNo pressure at all - if the timing isn''t right, that''s completely fine. I''ll keep you on our updates list for new product launches and industry insights.\nFeel free to reach out whenever you''d like to explore partnership opportunities. We''re here when you need us.\nBest wishes,\nSPS Eng Team"}]'::jsonb,
    'LLM curated (v2)', 'llm_generated', 'pending',
    '{"product_fit": {"score": 75, "reason": ""}, "buying_signal": {"score": 40, "reason": ""}, "company_capability": {"score": 60, "reason": ""}, "accessibility": {"score": 30, "reason": ""}, "strategic_value": {"score": 70, "reason": ""}}'::jsonb, 1);

  -- [v2 신규] Riwal Polska (34점)
  INSERT INTO prospects (project_id, name, url, country, match_score, priority, buyer_or_competitor, summary, match_reason, reasoning_chain, approach, evidence_quotes, current_suppliers, detected_products, company_size, decision_maker, best_timing, competitive_landscape, email_subject, email_body, followup_sequence, source, source_type, feedback_status, score_breakdown, round)
  VALUES (v_project_id, 'Riwal Polska', 'https://www.riwal.com/pl', 'Poland', 34, 'low',
    'buyer', 'Riwal Polska는 고소작업대, 텔레스코픽 로더, 지게차 등의 건설장비 렌탈, 판매, 서비스를 제공하는 폴란드 업체입니다. 최근 Boels Rental에 인수되었으며 주로 완성된 건설장비를 다루는 회사입니다.', '이 회사는 완성된 건설장비(고소작업대, 텔레스코픽 로더)를 렌탈/판매하는 업체로, 굴삭기 부품이나 유압 브레이커 부품을 필요로 하지 않습니다. 제품 카테고리가 완전히 다릅니다.', '', '현재 제품 포트폴리오상 직접적인 매칭이 어려우므로 접근을 권장하지 않습니다.',
    '[]'::jsonb, '["JLG", "Magni"]'::jsonb, '["\uace0\uc18c\uc791\uc5c5\ub300", "\ud154\ub808\uc2a4\ucf54\ud53d \ub85c\ub354", "\uc9c0\uac8c\ucc28", "podno\u015bniki koszowe", "\u0142adowarki teleskopowe"]'::jsonb,
    'medium (50-500)', '구매 담당자 또는 조달 매니저',
    '해당 없음 - 제품 매칭이 되지 않음', 'JLG와 Magni 등 기존 브랜드와 파트너십을 맺고 있어 굴삭기 부품 공급업체로의 전환 가능성은 없음',
    'Partnership Inquiry - Construction Equipment Parts for Riwal Polska', 'Dear Procurement Manager,\nI hope this message finds you well. I am writing from SPS Eng, a Korean manufacturer specializing in construction equipment parts with over 25 years of experience and export operations to 40+ countries.\nI understand that Riwal Polska provides comprehensive rental, sales, and service solutions for construction equipment including aerial work platforms and telescopic loaders. Given your expertise in equipment maintenance and service operations, I believe there may be opportunities for collaboration in supplying high-quality replacement parts and components.\nOur core capabilities include:\n• Excavator attachments and hydraulic breaker components\n• OEM/ODM manufacturing with competitive pricing\n• Fast delivery times to support your service operations\nAs a company focused on equipment rental and service, having reliable parts suppliers is crucial for minimizing downtime and maintaining customer satisfaction.\nWould you be interested in a brief call to discuss how we ',
    '[{"day": 3, "subject": "Quick follow-up - Parts availability for your fleet", "body": "Hi there,\nI reached out earlier this week about construction equipment parts supply for Riwal Polska.\nOne thing I wanted to emphasize - with your rental fleet requiring consistent uptime, our 48-hour emergency parts delivery to Europe has been crucial for similar rental companies. Downtime costs can quickly exceed parts savings.\nWould a brief 10-minute call work to discuss your current parts sourcing challenges?\nBest regards,\nSPS Eng International Sales Team"}, {"day": 7, "subject": "How we helped a European rental company reduce downtime", "body": "Hello,\nFollowing up on my previous messages about parts supply partnership.\nI thought you might find this interesting - we recently helped a major European rental company reduce their equipment downtime by 30% through our predictive parts inventory system. They now stock our high-wear components for telehandlers and aerial platforms.\nGiven Riwal''s extensive rental operations, this approach might be relevant for your fleet management.\nWorth a quick conversation?\nBest,\nSPS Eng Team"}, {"day": 14, "subject": "No worries if timing isn''t right", "body": "Hi,\nI know you''re likely busy with daily operations, so no pressure on my previous messages about parts supply.\nIf the timing isn''t right now, I completely understand. However, I''d love to stay connected for future opportunities - the construction equipment industry is always evolving.\nFeel free to reach out whenever parts sourcing becomes a priority. I''ll keep your contact for any relevant updates from our side.\nWishing you continued success with Riwal''s operations.\nBest regards,\nSPS Eng Team"}]'::jsonb,
    'LLM curated (v2)', 'llm_generated', 'pending',
    '{"product_fit": {"score": 15, "reason": ""}, "buying_signal": {"score": 10, "reason": ""}, "company_capability": {"score": 75, "reason": ""}, "accessibility": {"score": 70, "reason": ""}, "strategic_value": {"score": 20, "reason": ""}}'::jsonb, 1);

END $$;