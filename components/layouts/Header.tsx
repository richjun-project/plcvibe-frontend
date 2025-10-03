"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Code2, Menu, User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCurrentUser, signOut } from "@/lib/auth/auth-helpers"
import type { User as SupabaseUser } from "@supabase/supabase-js"

export function Header() {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.error('Failed to load user:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      setUser(null)
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700">
            <Code2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            PLCVibe
          </span>
        </Link>

        {!loading && (
          <>
            {!user && (
              // Not logged in navigation
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  href="/projects"
                  className="text-sm text-gray-400 hover:text-gray-100 transition-colors"
                >
                  Projects
                </Link>
                <Link
                  href="/templates"
                  className="text-sm text-gray-400 hover:text-gray-100 transition-colors"
                >
                  Templates
                </Link>
                <Link
                  href="/docs"
                  className="text-sm text-gray-400 hover:text-gray-100 transition-colors"
                >
                  Docs
                </Link>
              </nav>
            )}

            <div className="flex items-center gap-3">
              {user ? (
                // Logged in actions
                <>
                  <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm">
                    <User className="h-4 w-4" />
                    <span>{user.email}</span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors text-sm font-medium"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden md:inline">Sign Out</span>
                  </button>
                </>
              ) : (
                // Not logged in actions
                <>
                  <Link href="/login">
                    <Button variant="outline" size="sm" className="hidden md:inline-flex">
                      <User className="w-4 h-4 mr-2" />
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button size="sm">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}