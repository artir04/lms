from fastapi import APIRouter, Depends
from app.db.session import get_db
from app.services.auth_service import AuthService
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=dict)
async def login(data: LoginRequest, db=Depends(get_db)):
    service = AuthService(db)
    return await service.login(data)


@router.post("/refresh", response_model=dict)
async def refresh(data: RefreshRequest, db=Depends(get_db)):
    service = AuthService(db)
    return await service.refresh(data.refresh_token)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(data: ForgotPasswordRequest, db=Depends(get_db)):
    service = AuthService(db)
    await service.forgot_password(data.email, data.tenant_slug)
    return MessageResponse(
        message="If an account exists for that email, a reset link has been sent."
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(data: ResetPasswordRequest, db=Depends(get_db)):
    service = AuthService(db)
    await service.reset_password(data.token, data.new_password)
    return MessageResponse(message="Password has been reset successfully.")


@router.get("/sso/{provider}")
async def sso_redirect(provider: str):
    # TODO: Implement OAuth2 redirect for 'google' and 'microsoft'
    from fastapi.responses import JSONResponse
    return JSONResponse({"redirect_url": f"https://accounts.google.com/o/oauth2/auth?provider={provider}"})
