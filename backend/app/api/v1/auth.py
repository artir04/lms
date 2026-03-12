from fastapi import APIRouter, Depends
from app.db.session import get_db
from app.services.auth_service import AuthService
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest
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


@router.get("/sso/{provider}")
async def sso_redirect(provider: str):
    # TODO: Implement OAuth2 redirect for 'google' and 'microsoft'
    from fastapi.responses import JSONResponse
    return JSONResponse({"redirect_url": f"https://accounts.google.com/o/oauth2/auth?provider={provider}"})
