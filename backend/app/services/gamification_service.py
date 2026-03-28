import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.gamification import Badge, UserBadge, PointEntry
from app.models.user import User
from app.schemas.gamification import StudentPoints, LeaderboardEntry, UserBadgeRead, PointEntryRead, BadgeRead


# Points awarded for different actions
POINT_VALUES = {
    "quiz_completed": 10,
    "perfect_score": 25,
    "lesson_viewed": 2,
    "streak_7_days": 15,
    "first_submission": 5,
}


class GamificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def award_points(self, user_id: uuid.UUID, reason: str, resource_id: uuid.UUID | None = None) -> PointEntry:
        points = POINT_VALUES.get(reason, 5)
        entry = PointEntry(
            user_id=user_id,
            points=points,
            reason=reason,
            resource_id=resource_id,
        )
        self.db.add(entry)
        await self.db.flush()
        await self._check_badges(user_id)
        return entry

    async def get_student_points(self, user_id: uuid.UUID) -> StudentPoints:
        # Total points
        total_r = await self.db.execute(
            select(func.coalesce(func.sum(PointEntry.points), 0))
            .where(PointEntry.user_id == user_id)
        )
        total = total_r.scalar_one()

        # Badges
        badges_r = await self.db.execute(
            select(UserBadge)
            .options(selectinload(UserBadge.badge))
            .where(UserBadge.user_id == user_id)
            .order_by(UserBadge.earned_at.desc())
        )
        badges = badges_r.scalars().all()

        # Recent points
        recent_r = await self.db.execute(
            select(PointEntry)
            .where(PointEntry.user_id == user_id)
            .order_by(PointEntry.created_at.desc())
            .limit(20)
        )
        recent = recent_r.scalars().all()

        return StudentPoints(
            total_points=total,
            badges=[UserBadgeRead.model_validate(b) for b in badges],
            recent_points=[PointEntryRead.model_validate(p) for p in recent],
        )

    async def get_leaderboard(self, tenant_id: uuid.UUID, limit: int = 20) -> list[LeaderboardEntry]:
        # Single query: join user info and badge count with points
        badge_sub = (
            select(UserBadge.user_id, func.count().label("badge_count"))
            .group_by(UserBadge.user_id)
            .subquery()
        )

        result = await self.db.execute(
            select(
                User.id,
                User.first_name,
                User.last_name,
                User.avatar_url,
                func.sum(PointEntry.points).label("total"),
                func.coalesce(badge_sub.c.badge_count, 0).label("badge_count"),
            )
            .join(PointEntry, PointEntry.user_id == User.id)
            .outerjoin(badge_sub, badge_sub.c.user_id == User.id)
            .where(User.tenant_id == tenant_id, User.is_active == True)
            .group_by(User.id, User.first_name, User.last_name, User.avatar_url, badge_sub.c.badge_count)
            .order_by(func.sum(PointEntry.points).desc())
            .limit(limit)
        )
        rows = result.all()

        return [
            LeaderboardEntry(
                student_id=row.id,
                student_name=f"{row.first_name} {row.last_name}",
                avatar_url=row.avatar_url,
                total_points=row.total,
                badge_count=row.badge_count,
                rank=rank,
            )
            for rank, row in enumerate(rows, 1)
        ]

    async def _check_badges(self, user_id: uuid.UUID) -> None:
        """Check and award any earned badges."""
        total_r = await self.db.execute(
            select(func.coalesce(func.sum(PointEntry.points), 0))
            .where(PointEntry.user_id == user_id)
        )
        total_points = total_r.scalar_one()

        # Get all badges
        all_badges_r = await self.db.execute(select(Badge))
        all_badges = all_badges_r.scalars().all()

        # Get already earned badge IDs
        earned_r = await self.db.execute(
            select(UserBadge.badge_id).where(UserBadge.user_id == user_id)
        )
        earned_ids = {r[0] for r in earned_r.all()}

        for badge in all_badges:
            if badge.id in earned_ids:
                continue
            earned = False
            if badge.criteria_type == "total_points" and total_points >= badge.criteria_value:
                earned = True
            elif badge.criteria_type == "quiz_count":
                quiz_count = (await self.db.execute(
                    select(func.count()).select_from(PointEntry)
                    .where(PointEntry.user_id == user_id, PointEntry.reason == "quiz_completed")
                )).scalar_one()
                if quiz_count >= badge.criteria_value:
                    earned = True
            elif badge.criteria_type == "perfect_score":
                perfect_count = (await self.db.execute(
                    select(func.count()).select_from(PointEntry)
                    .where(PointEntry.user_id == user_id, PointEntry.reason == "perfect_score")
                )).scalar_one()
                if perfect_count >= badge.criteria_value:
                    earned = True

            if earned:
                self.db.add(UserBadge(
                    user_id=user_id,
                    badge_id=badge.id,
                    earned_at=datetime.now(timezone.utc),
                ))
        await self.db.flush()
