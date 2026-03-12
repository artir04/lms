import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class QuestionOptionCreate(BaseModel):
    text: str
    is_correct: bool = False


class QuestionOptionRead(BaseModel):
    id: uuid.UUID
    text: str
    is_correct: bool | None = None  # hidden from students

    model_config = {"from_attributes": True}


class QuestionCreate(BaseModel):
    text: str
    question_type: str  # mcq | true_false | short_answer | essay
    points: Decimal = Decimal("1.0")
    position: int = 0
    explanation: str | None = None
    options: list[QuestionOptionCreate] = []


class QuestionRead(BaseModel):
    id: uuid.UUID
    text: str
    question_type: str
    points: Decimal
    position: int
    explanation: str | None
    options: list[QuestionOptionRead]

    model_config = {"from_attributes": True}


class QuizCreate(BaseModel):
    title: str
    instructions: str | None = None
    time_limit_min: int | None = None
    max_attempts: int = 1
    shuffle_questions: bool = False
    due_at: datetime | None = None
    lesson_id: uuid.UUID | None = None


class QuizUpdate(BaseModel):
    title: str | None = None
    instructions: str | None = None
    time_limit_min: int | None = None
    max_attempts: int | None = None
    shuffle_questions: bool | None = None
    due_at: datetime | None = None
    is_published: bool | None = None


class QuizRead(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    instructions: str | None
    time_limit_min: int | None
    max_attempts: int
    due_at: datetime | None
    is_published: bool
    question_count: int = 0
    total_points: Decimal = Decimal("0")
    created_at: datetime

    model_config = {"from_attributes": True}


class QuizDetailRead(QuizRead):
    questions: list[QuestionRead]


class AnswerSubmit(BaseModel):
    question_id: uuid.UUID
    selected_option_id: uuid.UUID | None = None
    text_response: str | None = None


class SubmissionCreate(BaseModel):
    answers: list[AnswerSubmit]


class AnswerRead(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    selected_option_id: uuid.UUID | None
    text_response: str | None
    is_correct: bool | None
    points_earned: Decimal | None
    feedback: str | None

    model_config = {"from_attributes": True}


class SubmissionRead(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    student_id: uuid.UUID
    attempt_num: int
    started_at: datetime
    submitted_at: datetime | None
    score: Decimal | None
    status: str
    answers: list[AnswerRead] = []

    model_config = {"from_attributes": True}


class ManualGradeRequest(BaseModel):
    answer_id: uuid.UUID
    points_earned: Decimal
    feedback: str | None = None
