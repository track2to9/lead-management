"""
파이프라인 설정 관리
- .env에서 API 키 로드
- 클라이언트 프로필 (수출업체 정보)
- 타겟 설정 (국가, 제품 카테고리)
- LLM 프로바이더 선택
"""
import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()


@dataclass
class ClientProfile:
    """수출업체(우리 고객) 프로필"""
    company_name: str = ""
    website_url: str = ""
    product_description: str = ""
    strengths: str = ""
    target_buyer_types: str = ""  # 예: "건설장비 딜러, 부품 유통사, 렌탈 업체"


@dataclass
class TargetSettings:
    """타겟 시장 설정"""
    countries: list[str] = field(default_factory=list)
    product_category: str = ""
    language_hint: str = "en"  # 타겟 시장 주요 언어


@dataclass
class LLMConfig:
    """LLM 프로바이더 설정"""
    provider: str = "claude"  # claude / openai / gemini
    model: str = ""  # 비어있으면 프로바이더 기본값 사용
    max_tokens: int = 1024
    temperature: float = 0.3

    @property
    def api_key(self) -> str:
        key_map = {
            "claude": "ANTHROPIC_API_KEY",
            "openai": "OPENAI_API_KEY",
            "gemini": "GOOGLE_API_KEY",
        }
        env_var = key_map.get(self.provider, "ANTHROPIC_API_KEY")
        key = os.getenv(env_var, "")
        if not key:
            raise ValueError(
                f"API 키가 설정되지 않았습니다. .env 파일에 {env_var}를 설정해주세요."
            )
        return key

    @property
    def default_model(self) -> str:
        if self.model:
            return self.model
        defaults = {
            "claude": "claude-sonnet-4-20250514",
            "openai": "gpt-4o",
            "gemini": "gemini-1.5-pro",
        }
        return defaults.get(self.provider, "claude-sonnet-4-20250514")


@dataclass
class PipelineConfig:
    """전체 파이프라인 설정"""
    client: ClientProfile = field(default_factory=ClientProfile)
    target: TargetSettings = field(default_factory=TargetSettings)
    llm: LLMConfig = field(default_factory=LLMConfig)
    output_dir: str = "output"
    screenshot_dir: str = "screenshots"
    max_candidates_per_country: int = 50
    scrape_timeout: int = 20000  # ms
    polite_delay: float = 1.0  # 크롤링 간 대기 시간 (초)

    def __post_init__(self):
        # .env에서 LLM 프로바이더 로드
        env_provider = os.getenv("LLM_PROVIDER", "").lower()
        if env_provider and env_provider in ("claude", "openai", "gemini"):
            self.llm.provider = env_provider

    def validate(self):
        """필수 설정값 검증"""
        errors = []
        if not self.client.company_name:
            errors.append("클라이언트 회사명이 필요합니다 (--client-name 또는 config)")
        if not self.target.countries:
            errors.append("타겟 국가가 필요합니다 (--countries)")
        if not self.target.product_category:
            errors.append("제품 카테고리가 필요합니다 (--product)")
        try:
            _ = self.llm.api_key
        except ValueError as e:
            errors.append(str(e))
        if errors:
            raise ValueError("설정 오류:\n  - " + "\n  - ".join(errors))

    @classmethod
    def from_args(
        cls,
        client_name: str = "",
        client_url: str = "",
        product: str = "",
        countries: list[str] | None = None,
        product_description: str = "",
        strengths: str = "",
        target_buyers: str = "",
        output_dir: str = "output",
        llm_provider: str = "",
        llm_model: str = "",
    ) -> "PipelineConfig":
        """CLI 인자로부터 설정 생성"""
        config = cls()
        config.client.company_name = client_name
        config.client.website_url = client_url
        config.client.product_description = product_description or product
        config.client.strengths = strengths
        config.client.target_buyer_types = target_buyers
        config.target.countries = countries or []
        config.target.product_category = product
        config.output_dir = output_dir
        if llm_provider:
            config.llm.provider = llm_provider
        if llm_model:
            config.llm.model = llm_model
        return config

    def get_client_profile_text(self) -> str:
        """LLM 프롬프트에 삽입할 클라이언트 프로필 텍스트"""
        parts = [
            f"{self.client.company_name}",
        ]
        if self.client.website_url:
            parts[0] += f" ({self.client.website_url})"
        if self.client.product_description:
            parts.append(f"\n제품/서비스: {self.client.product_description}")
        if self.client.strengths:
            parts.append(f"\n강점: {self.client.strengths}")
        if self.client.target_buyer_types:
            parts.append(f"\n타겟 바이어: {self.client.target_buyer_types}")
        return "".join(parts)
