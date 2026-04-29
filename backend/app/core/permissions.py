from enum import StrEnum


class Role(StrEnum):
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    TEACHER = "teacher"
    PARENT = "parent"
    STUDENT = "student"


# Role hierarchy: higher index = more privilege
# Parent is at the same level as student but has different access patterns (read-only child data)
ROLE_HIERARCHY = [Role.STUDENT, Role.PARENT, Role.TEACHER, Role.ADMIN, Role.SUPERADMIN]


def has_role(user_roles: list[str], required: Role) -> bool:
    return required in user_roles


def has_any_role(user_roles: list[str], *required: Role) -> bool:
    return any(r in user_roles for r in required)


def has_min_role(user_roles: list[str], min_role: Role) -> bool:
    min_idx = ROLE_HIERARCHY.index(min_role)
    return any(
        ROLE_HIERARCHY.index(r) >= min_idx
        for r in user_roles
        if r in ROLE_HIERARCHY
    )
