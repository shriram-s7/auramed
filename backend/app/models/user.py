from sqlalchemy import Boolean, Column, Enum, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import UserRole
from app.models.mixins import TimestampMixin, UUIDPKMixin


class User(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "users"

    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, name="user_role"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)

    doctor_profile = relationship(
        "DoctorProfile", back_populates="user", uselist=False, foreign_keys="DoctorProfile.user_id"
    )
    patient_profile = relationship(
        "PatientProfile", back_populates="user", uselist=False, foreign_keys="PatientProfile.user_id"
    )
