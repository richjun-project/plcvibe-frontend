'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/auth-helpers'
import { Plus, FolderOpen, MessageSquare } from 'lucide-react'
import { Header } from '@/components/layouts/Header'
import type { User } from '@supabase/supabase-js'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!user) {
    return null // Middleware should redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {user.email?.split('@')[0]}!
          </h1>
          <p className="text-gray-400">
            Continue working on your PLC projects or start a new one
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link
            href="/projects?action=new"
            className="group p-6 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-600 transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-600 text-white group-hover:bg-blue-500 transition-colors">
                <Plus className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">New Project</h3>
            </div>
            <p className="text-sm text-gray-400">
              Create a new PLC programming project
            </p>
          </Link>

          <Link
            href="/projects"
            className="group p-6 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-600 transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-green-600 text-white group-hover:bg-green-500 transition-colors">
                <FolderOpen className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">My Projects</h3>
            </div>
            <p className="text-sm text-gray-400">
              View and manage your existing projects
            </p>
          </Link>

          <Link
            href="/chat"
            className="group p-6 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-600 transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-600 text-white group-hover:bg-purple-500 transition-colors">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">AI Assistant</h3>
            </div>
            <p className="text-sm text-gray-400">
              Get help with PLC code generation and analysis
            </p>
          </Link>
        </div>

        {/* Recent Projects */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Recent Projects</h2>
            <Link
              href="/projects"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              View all →
            </Link>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center">
            <FolderOpen className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">No projects yet</p>
            <Link
              href="/projects?action=new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Your First Project
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-lg border border-gray-700 bg-gray-800/50">
            <div className="text-3xl font-bold text-white mb-1">0</div>
            <div className="text-sm text-gray-400">Total Projects</div>
          </div>

          <div className="p-6 rounded-lg border border-gray-700 bg-gray-800/50">
            <div className="text-3xl font-bold text-white mb-1">0</div>
            <div className="text-sm text-gray-400">Code Files</div>
          </div>

          <div className="p-6 rounded-lg border border-gray-700 bg-gray-800/50">
            <div className="text-3xl font-bold text-white mb-1">0</div>
            <div className="text-sm text-gray-400">AI Analyses</div>
          </div>
        </div>
      </main>
    </div>
  )
}
