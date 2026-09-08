export type User = {
  nama: string
  email: string
  password: string
  isAdmin: boolean
}

export type PublicUser = Omit<User, 'password'>
