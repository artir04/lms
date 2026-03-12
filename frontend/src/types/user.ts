export interface User {
  id: string
  tenant_id: string
  school_id: string | null
  email: string
  first_name: string
  last_name: string
  full_name: string
  avatar_url: string | null
  is_active: boolean
  roles: string[]
  last_login_at: string | null
  created_at: string
}

export interface UserSummary {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  roles: string[]
}

export interface UserCreate {
  email: string
  password?: string
  first_name: string
  last_name: string
  school_id?: string
  roles: string[]
}
