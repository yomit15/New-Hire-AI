"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { Building2, Users, Plus, Trash2, LogOut } from "lucide-react"
import { ContentUpload } from "./content-upload"
import { UploadedFilesList } from "./uploaded-files-list"
import { Toaster } from "react-hot-toast" // Import Toaster

interface Employee {
  id: string
  email: string
  name: string | null
  joined_at: string
}

interface Admin {
  id: string
  email: string
  name: string | null
  company_id: string
}

interface TrainingModule {
  id: string
  title: string
  description: string | null
  content_type: string
  content_url: string
  created_at: string
  gpt_summary: string | null
  transcription: string | null
  ai_modules: string | null
  ai_topics: string | null
  ai_objectives: string | null
  processing_status: string
}

export default function AdminDashboard() {
  const { user, loading: authLoading, logout } = useAuth()
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [trainingModules, setTrainingModules] = useState<TrainingModule[]>([])
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [addingEmployee, setAddingEmployee] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/admin/login")
      } else {
        checkAdminAccess()
      }
    }
  }, [user, authLoading, router])

  const checkAdminAccess = async () => {
    if (!user?.email) return

    try {
      // Get admin data from Supabase
      const { data: adminData, error: adminError } = await supabase
        .from("admins")
        .select("*")
        .eq("email", user.email)
        .single()

      if (adminError || !adminData) {
        router.push("/admin/login")
        return
      }

      setAdmin(adminData)
      await loadEmployees(adminData.company_id)
      await loadTrainingModules(adminData.company_id)
    } catch (error) {
      console.error("Admin access check failed:", error)
      router.push("/admin/login")
    } finally {
      setLoading(false)
    }
  }

  const loadEmployees = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("company_id", companyId)
        .order("joined_at", { ascending: false })

      if (error) throw error
      setEmployees(data || [])
    } catch (error: any) {
      setError("Failed to load employees: " + error.message)
    }
  }

  const loadTrainingModules = useCallback(async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from("training_modules")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setTrainingModules(data || [])
    } catch (error: any) {
      setError("Failed to load training modules: " + error.message)
    }
  }, [])

  const addEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!admin) return

    setAddingEmployee(true)
    setError("")
    setSuccess("")

    try {
      const { data, error } = await supabase
        .from("employees")
        .insert({
          email: newEmployeeEmail,
          company_id: admin.company_id,
        })
        .select()
        .single()

      if (error) throw error

      setEmployees([data, ...employees])
      setNewEmployeeEmail("")
      setSuccess("Employee added successfully!")
    } catch (error: any) {
      setError("Failed to add employee: " + error.message)
    } finally {
      setAddingEmployee(false)
    }
  }

  const removeEmployee = async (employeeId: string) => {
    if (!confirm("Are you sure you want to remove this employee?")) return

    try {
      const { error } = await supabase.from("employees").delete().eq("id", employeeId)

      if (error) throw error

      setEmployees(employees.filter((emp) => emp.id !== employeeId))
      setSuccess("Employee removed successfully!")
    } catch (error: any) {
      setError("Failed to remove employee: " + error.message)
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster /> {/* Add Toaster component here */}
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Building2 className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-600">Welcome back, {admin?.name || user?.email}</p>
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
          {/* Add Employee Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Plus className="w-5 h-5 mr-2" />
                Add New Employee
              </CardTitle>
              <CardDescription>Add employee emails to allow them to access the training portal</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={addEmployee} className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="employeeEmail" className="sr-only">
                    Employee Email
                  </Label>
                  <Input
                    id="employeeEmail"
                    type="email"
                    placeholder="employee@company.com"
                    value={newEmployeeEmail}
                    onChange={(e) => setNewEmployeeEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={addingEmployee}>
                  {addingEmployee ? "Adding..." : "Add Employee"}
                </Button>
              </form>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="mt-4">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Employees List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Allowed Employees ({employees.length})
              </CardTitle>
              <CardDescription>Employees who can access the training portal</CardDescription>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No employees added yet</p>
                  <p className="text-sm">Add employee emails above to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {employees.map((employee) => (
                    <div key={employee.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{employee.email}</p>
                        <p className="text-sm text-gray-500">
                          Added {new Date(employee.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        onClick={() => removeEmployee(employee.id)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Content Upload Section */}
          {admin?.company_id && (
            <ContentUpload companyId={admin.company_id} onUploadSuccess={() => loadTrainingModules(admin.company_id)} />
          )}

          {/* Uploaded Files List */}
          <UploadedFilesList modules={trainingModules} onModuleDeleted={() => loadTrainingModules(admin!.company_id)} />
        </div>
      </div>
    </div>
  )
}
