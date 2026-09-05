import { NextResponse } from 'next/server'

export default function middleware() {
	return NextResponse.next()
}

export const config = { matcher: ['/((?!api/auth|login|track|_next/static|_next/image|favicon.ico).*)'] }
