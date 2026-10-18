"""
Cliente API para Eduteka.pe con soporte de autenticación y extracción completa.
Permite descargar:
1. Enunciados y opciones de preguntas matemáticas (con LaTeX / MathJax).
2. Claves correctas oficiales de cada pregunta.
3. Resoluciones matemáticas paso a paso oficiales.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
import os
import requests
import re
from pathlib import Path

BASE_URL = "https://eduteka.pe"


def load_cookie_from_env() -> Optional[str]:
    """Carga la cookie desde variable de entorno o archivo .env local."""
    cookie = os.environ.get("EDUTEKA_COOKIE")
    if cookie:
        return cookie

    env_path = Path(__file__).resolve().parents[2] / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("EDUTEKA_COOKIE="):
                val = line.split("=", 1)[1].strip()
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                return val
    return None


@dataclass
class QuestionOption:
    opt: str
    text_html: str
    block: bool = False
    is_answer: bool = False


@dataclass
class CompleteQuestion:
    id: str
    area: str
    slug: str
    type: str
    question_html: str
    question_text: str
    options: Dict[str, str]
    correct_key: Optional[str] = None
    resolution_html: Optional[str] = None
    resolution_text: Optional[str] = None
    web_url: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "area": self.area,
            "slug": self.slug,
            "type": self.type,
            "question_html": self.question_html,
            "question_text": self.question_text,
            "options": self.options,
            "correct_key": self.correct_key,
            "resolution_html": self.resolution_html,
            "resolution_text": self.resolution_text,
            "web_url": self.web_url,
        }


@dataclass
class AnswerResult:
    status: bool
    correct_key: Optional[str]
    is_user_correct: bool
    resolution_html: Optional[str]
    options_percent: Dict[str, Any] = field(default_factory=dict)
    message: str = ""


class EdutekaClient:
    """Cliente HTTP tipado para consumir el banco de preguntas y resoluciones de Eduteka.pe."""

    def __init__(self, cookie: Optional[str] = None, session: Optional[requests.Session] = None):
        self.session = session or requests.Session()
        self.cookie = cookie or load_cookie_from_env()

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "X-Requested-With": "fetch",
        }
        if self.cookie:
            headers["Cookie"] = self.cookie

        self.session.headers.update(headers)

    @property
    def is_authenticated(self) -> bool:
        return bool(self.cookie and "session=" in self.cookie)

    def get_question_uuids(self, area: str = "razonamiento-matematico", page: int = 1) -> List[str]:
        """Obtiene los UUIDs de las preguntas de una página de un área."""
        url = f"{BASE_URL}/preguntas/area/{area}?page={page}"
        res = self.session.get(url, headers={"Accept": "text/html"})
        if res.status_code != 200:
            return []
        
        pattern = r"showModalAnswerQuestion\s*\(\s*event\s*,\s*['\"]([a-f0-9-]+)['\"]\s*\)"
        return re.findall(pattern, res.text)

    def get_question_detail(self, question_uuid: str) -> Optional[Dict[str, Any]]:
        """Obtiene el detalle crudo de una pregunta desde el endpoint interno."""
        url = f"{BASE_URL}/preguntas/detail/{question_uuid}"
        res = self.session.get(url)
        if res.status_code != 200:
            return None
        data = res.json()
        return data.get("question") if data.get("status") else None

    def submit_answer(self, question_uuid: str, option_key: str = "A") -> AnswerResult:
        """Envía una respuesta (A, B, C, D, E) y desbloquea la clave oficial y la resolución."""
        url = f"{BASE_URL}/preguntas/{question_uuid}/enviar-respuesta"
        form_data = {"rpta": option_key.upper()}
        res = self.session.post(url, data=form_data)
        
        if res.status_code != 200:
            return AnswerResult(
                status=False,
                correct_key=None,
                is_user_correct=False,
                resolution_html=None,
                message=f"Error HTTP {res.status_code}",
            )

        data = res.json()
        return AnswerResult(
            status=data.get("status", False),
            correct_key=data.get("rpta"),
            is_user_correct=data.get("correctAnswer", False),
            resolution_html=data.get("resolution"),
            options_percent=data.get("optionsPorcent", {}),
            message=data.get("message", ""),
        )

    def get_complete_question(self, question_uuid: str, fetch_solution: bool = True) -> Optional[CompleteQuestion]:
        """Obtiene la pregunta completa: enunciado, opciones, clave correcta y resolución paso a paso."""
        q_raw = self.get_question_detail(question_uuid)
        if not q_raw:
            return None

        q_html = q_raw.get("question", "")
        q_text = re.sub(r"<[^>]+>", "", q_html).strip()
        slug = q_raw.get("slug", "")

        correct_key = None
        res_html = None
        res_text = None

        # 1. Si la pregunta ya fue respondida anteriormente por este usuario,
        # el endpoint detail ya incluye directamente la clave y la resolución:
        if q_raw.get("rpta"):
            correct_key = q_raw.get("rpta")
            res_html = q_raw.get("resolution")
            if res_html:
                res_text = re.sub(r"<[^>]+>", "", res_html).strip()
        # 2. Si no ha sido respondida, enviamos una opción para desbloquearla:
        elif fetch_solution and self.is_authenticated:
            ans = self.submit_answer(question_uuid, option_key="A")
            if ans.status and ans.correct_key:
                correct_key = ans.correct_key
                res_html = ans.resolution_html
                if res_html:
                    res_text = re.sub(r"<[^>]+>", "", res_html).strip()

        return CompleteQuestion(
            id=q_raw.get("_id", question_uuid),
            area=q_raw.get("area", ""),
            slug=slug,
            type=q_raw.get("type", "Ejercicio"),
            question_html=q_html,
            question_text=q_text,
            options=q_raw.get("options", {}),
            correct_key=correct_key,
            resolution_html=res_html,
            resolution_text=res_text,
            web_url=f"{BASE_URL}/preguntas/{slug}" if slug else "",
        )

    def extract_area_dataset(self, area: str, max_pages: int = 1, fetch_solutions: bool = True) -> List[CompleteQuestion]:
        """Extrae un lote completo de preguntas de un área académica con sus resoluciones."""
        all_questions: List[CompleteQuestion] = []
        for page in range(1, max_pages + 1):
            uuids = self.get_question_uuids(area=area, page=page)
            if not uuids:
                break
            for uid in uuids:
                cq = self.get_complete_question(uid, fetch_solution=fetch_solutions)
                if cq:
                    all_questions.append(cq)
        return all_questions
