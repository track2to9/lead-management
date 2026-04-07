"""
파이프라인 실행 로깅
- 각 실행의 타임스탬프, 입력 파라미터, 단계별 결과 기록
- 후보 수, 검증 수, 매칭률, API 비용 추적
- 할루시네이션 비율 계산
- JSON 파일로 output/logs/ 에 저장
"""
import json
import os
from datetime import datetime


class RunLogger:
    """파이프라인 실행 로거"""

    def __init__(self, output_dir: str = "output"):
        self.log_dir = os.path.join(output_dir, "logs")
        os.makedirs(self.log_dir, exist_ok=True)

        self.run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_data = {
            "run_id": self.run_id,
            "started_at": None,
            "finished_at": None,
            "input_params": {},
            "steps": [],
            "summary": {},
        }

    def start_run(self, params: dict):
        """실행 시작 기록"""
        self.log_data["started_at"] = datetime.now().isoformat()
        self.log_data["input_params"] = params
        print(f"\n  📝 실행 로그 ID: {self.run_id}")

    def log_step(self, country: str, step_name: str, status: str, details: dict | None = None):
        """
        단계별 결과 기록.

        Args:
            country: 국가명
            step_name: 단계명 (source_finder, candidate_collector, web_scraper, analyzer, email_drafter)
            status: started / completed / failed
            details: 추가 정보 dict
        """
        entry = {
            "timestamp": datetime.now().isoformat(),
            "country": country,
            "step": step_name,
            "status": status,
        }
        if details:
            entry["details"] = details

        self.log_data["steps"].append(entry)

    def finish_run(self, summary: dict):
        """실행 완료 기록 + 파일 저장"""
        self.log_data["finished_at"] = datetime.now().isoformat()
        self.log_data["summary"] = summary

        # 실행 시간 계산
        if self.log_data["started_at"]:
            started = datetime.fromisoformat(self.log_data["started_at"])
            finished = datetime.fromisoformat(self.log_data["finished_at"])
            duration = (finished - started).total_seconds()
            self.log_data["duration_seconds"] = round(duration, 1)

        # JSON 파일 저장
        log_path = os.path.join(self.log_dir, f"run_{self.run_id}.json")
        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(self.log_data, f, ensure_ascii=False, indent=2)

        print(f"  📝 실행 로그 저장: {log_path}")

    def get_log_path(self) -> str:
        """현재 실행 로그 파일 경로 반환"""
        return os.path.join(self.log_dir, f"run_{self.run_id}.json")
