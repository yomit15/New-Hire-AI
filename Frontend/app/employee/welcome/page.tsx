"use client"

import { useState, useEffect } from "react"
import ScoreFeedbackCard from "../assessment/score-feedback"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { Users, LogOut, BookOpen, Clock } from "lucide-react"

interface Employee {
  id: string
  email: string
  name: string | null
  joined_at: string
}

export default function EmployeeWelcome() {
  const { user, loading: authLoading, logout } = useAuth()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [scoreHistory, setScoreHistory] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/employee/login")
      } else {
        checkEmployeeAccess()
      }
    }
  }, [user, authLoading, router])

  const checkEmployeeAccess = async () => {
    if (!user?.email) return

    try {
      // Get employee data from Supabase
      const { data: employeeData, error: employeeError } = await supabase
        .from("employees")
        .select("*")
        .eq("email", user.email)
        .single()

      if (employeeError || !employeeData) {
        router.push("/employee/login")
        return
      }

      setEmployee(employeeData)
      // Fetch all assessment results for this employee (history)
      const { data: assessments, error: assessmentError } = await supabase
        .from("employee_assessments")
        .select("score, feedback, question_feedback, assessment_id, created_at, assessments(type, questions)")
        .eq("employee_id", employeeData.id)
        .order("created_at", { ascending: false })
      setScoreHistory(assessments || [])
    } catch (error) {
      console.error("Employee access check failed:", error)
      router.push("/employee/login")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Employee Portal</h1>
                <p className="text-sm text-gray-600">Welcome to your training dashboard</p>
              </div>
            </div>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8">
          {/* Welcome Card */}
          <Card className="bg-gradient-to-r from-green-500 to-blue-600 text-white">
            <CardHeader>
              <CardTitle className="text-3xl">Welcome, {user?.displayName || employee?.name || user?.email}!</CardTitle>
              <CardDescription className="text-green-100">
                You've successfully logged into your personalized training portal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-green-100">
                <Clock className="w-5 h-5 mr-2" />
                <span>Member since {new Date(employee?.joined_at || "").toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle>Score & Feedback History</CardTitle>
                <CardDescription>View all your assessment results and AI feedback</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  See your full history of scores and feedback for all assessments.
                </p>
                <Button className="w-full" onClick={() => router.push("/employee/score-history") }>
                  View Score & Feedback History
                </Button>
              </CardContent>
            </Card>

            <Card className="">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle>Assessments</CardTitle>
                <CardDescription>Take baseline and module assessments</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">AI-generated assessments will help track your progress.</p>
                <a href="/employee/assessment">
                  <Button className="w-full">
                    Start Baseline Assessment
                  </Button>
                </a>
              </CardContent>
            </Card>

            <Card className="">
              <CardHeader>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <CardTitle>Learning Plan</CardTitle>
                <CardDescription>View your personalized learning path</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  AI will create a custom learning plan based on your assessment.
                </p>
                <Button className="w-full" onClick={() => router.push("/employee/training-plan") }>
                  View Learning Plan
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Current module implementation status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="font-medium text-green-800">Module 1: Employee Onboarding</span>
                  <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-medium">
                    ✓ Complete
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-600">Module 2: Content Ingestion</span>
                  <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded-full text-xs font-medium">
                    Coming Soon
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="font-medium text-green-800">Module 3: AI Processing</span>
                  <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-medium">
                    ✓ Complete
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
