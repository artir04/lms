export interface LoginRequest {
  email: string
  password: string
  tenant_slug: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface TokenPayload {
  sub: string
  tenant_id: string
  roles: string[]
  exp: number
}
