from datetime import datetime

from sqlalchemy import Boolean, Integer, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Competition(Base):
    __tablename__ = "competitions"
    __table_args__ = {"schema": "football"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sportmonks_competition_id: Mapped[int] = mapped_column(
        Integer, nullable=False, unique=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    short_code: Mapped[str | None] = mapped_column(String(20))
    country_id: Mapped[int | None] = mapped_column(Integer)
    type: Mapped[str | None] = mapped_column(String(30))
    sub_type: Mapped[str | None] = mapped_column(String(30))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    image_path: Mapped[str | None] = mapped_column(Text)
    category: Mapped[int | None] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(nullable=False)
    updated_at: Mapped[datetime] = mapped_column(nullable=False)
