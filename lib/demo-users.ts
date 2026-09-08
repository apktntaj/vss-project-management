import 'server-only'

export type DemoUser = {
  id: string
  name: string
  email: string
  password: string
}

export const DEMO_USER: DemoUser = {
  id: 'demo-admin',
  name: 'Admin Demo VSS',
  email: 'admin@vss.demo',
  password: 'demo-vss-2026',
}

export function findDemoUser(email: string, password: string) {
  if (email.toLowerCase() !== DEMO_USER.email || password !== DEMO_USER.password) {
    return null
  }

  const { password: _password, ...user } = DEMO_USER
  return user
}
