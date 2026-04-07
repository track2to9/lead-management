"""
LLM 추상화 레이어
- Claude, OpenAI, Gemini 통합 인터페이스
- 재시도, 타임아웃, 레이트 리밋 처리
- 현재 Claude 구현 완료. OpenAI/Gemini는 인터페이스만 정의.
"""
import json
import time
from abc import ABC, abstractmethod

from .config import LLMConfig


class LLMClient(ABC):
    """LLM 프로바이더 통합 인터페이스"""

    def __init__(self, config: LLMConfig):
        self.config = config
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.call_count = 0

    @abstractmethod
    def generate(self, prompt: str, *, json_mode: bool = False, max_tokens: int | None = None) -> str:
        """
        프롬프트를 보내고 응답 텍스트를 반환.
        json_mode=True이면 JSON 형식 응답을 유도.
        """
        ...

    def generate_json(self, prompt: str, *, max_tokens: int | None = None) -> dict:
        """JSON 응답을 파싱하여 dict로 반환"""
        raw = self.generate(prompt, json_mode=True, max_tokens=max_tokens)
        # JSON 블록 추출 (```json ... ``` 형태 처리)
        raw = raw.strip()
        if raw.startswith("```"):
            lines = raw.split("\n")
            # 첫 줄(```json)과 마지막 줄(```) 제거
            lines = [l for l in lines if not l.strip().startswith("```")]
            raw = "\n".join(lines)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # JSON 배열이나 객체 부분만 추출 시도
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(raw[start:end])
            # 배열 시도
            start = raw.find("[")
            end = raw.rfind("]") + 1
            if start >= 0 and end > start:
                return json.loads(raw[start:end])
            raise ValueError(f"LLM 응답을 JSON으로 파싱할 수 없습니다:\n{raw[:500]}")

    @property
    def estimated_cost_usd(self) -> float:
        """예상 API 비용 (USD) - 프로바이더별 요금 기준 추정"""
        # Claude Sonnet 기준: input $3/MTok, output $15/MTok
        if self.config.provider == "claude":
            return (self.total_input_tokens * 3 + self.total_output_tokens * 15) / 1_000_000
        # GPT-4o 기준: input $2.5/MTok, output $10/MTok
        elif self.config.provider == "openai":
            return (self.total_input_tokens * 2.5 + self.total_output_tokens * 10) / 1_000_000
        return 0.0

    def _retry_with_backoff(self, func, max_retries: int = 3):
        """지수 백오프로 재시도"""
        last_error = None
        for attempt in range(max_retries):
            try:
                return func()
            except Exception as e:
                last_error = e
                error_str = str(e).lower()
                # 레이트 리밋이나 서버 오류만 재시도
                if "rate" in error_str or "429" in error_str or "500" in error_str or "overloaded" in error_str:
                    wait = (2 ** attempt) + 1
                    print(f"     ⏳ API 재시도 대기 ({wait}초)... (시도 {attempt + 1}/{max_retries})")
                    time.sleep(wait)
                else:
                    raise
        raise last_error


class ClaudeClient(LLMClient):
    """Anthropic Claude 클라이언트"""

    def __init__(self, config: LLMConfig):
        super().__init__(config)
        import anthropic
        self._client = anthropic.Anthropic(api_key=config.api_key)

    def generate(self, prompt: str, *, json_mode: bool = False, max_tokens: int | None = None) -> str:
        tokens = max_tokens or self.config.max_tokens

        if json_mode:
            prompt += "\n\n반드시 유효한 JSON 형식으로만 응답해주세요. 다른 텍스트 없이 JSON만 출력하세요."

        def _call():
            response = self._client.messages.create(
                model=self.config.default_model,
                max_tokens=tokens,
                temperature=self.config.temperature,
                messages=[{"role": "user", "content": prompt}],
            )
            # 토큰 사용량 추적
            self.total_input_tokens += response.usage.input_tokens
            self.total_output_tokens += response.usage.output_tokens
            self.call_count += 1
            return response.content[0].text

        return self._retry_with_backoff(_call)


class OpenAIClient(LLMClient):
    """OpenAI GPT 클라이언트 (인터페이스 구현 - 추후 완성)"""

    def __init__(self, config: LLMConfig):
        super().__init__(config)
        try:
            import openai
            self._client = openai.OpenAI(api_key=config.api_key)
        except ImportError:
            raise ImportError("openai 패키지가 필요합니다: pip install openai")

    def generate(self, prompt: str, *, json_mode: bool = False, max_tokens: int | None = None) -> str:
        tokens = max_tokens or self.config.max_tokens

        kwargs = {
            "model": self.config.default_model,
            "max_tokens": tokens,
            "temperature": self.config.temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        def _call():
            response = self._client.chat.completions.create(**kwargs)
            usage = response.usage
            if usage:
                self.total_input_tokens += usage.prompt_tokens
                self.total_output_tokens += usage.completion_tokens
            self.call_count += 1
            return response.choices[0].message.content

        return self._retry_with_backoff(_call)


class GeminiClient(LLMClient):
    """Google Gemini 클라이언트 (인터페이스 구현 - 추후 완성)"""

    def __init__(self, config: LLMConfig):
        super().__init__(config)
        raise NotImplementedError(
            "Gemini 클라이언트는 아직 구현되지 않았습니다. "
            "claude 또는 openai를 사용해주세요."
        )

    def generate(self, prompt: str, *, json_mode: bool = False, max_tokens: int | None = None) -> str:
        raise NotImplementedError


def create_llm_client(config: LLMConfig) -> LLMClient:
    """설정에 따라 적절한 LLM 클라이언트 생성"""
    providers = {
        "claude": ClaudeClient,
        "openai": OpenAIClient,
        "gemini": GeminiClient,
    }
    provider_class = providers.get(config.provider)
    if not provider_class:
        raise ValueError(
            f"지원하지 않는 LLM 프로바이더: {config.provider}. "
            f"사용 가능: {', '.join(providers.keys())}"
        )
    return provider_class(config)
