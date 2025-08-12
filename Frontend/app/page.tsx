import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, Users } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">AI-Powered Employee Onboarding</h1>
          <p className="text-xl text-gray-600">Streamline your training process with intelligent content management</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* HR/Admin Portal */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">HR/Admin Portal</CardTitle>
              <CardDescription>Manage employees, upload training content, and track progress</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/admin/login">
                <Button size="lg" className="w-full">
                  Access Admin Portal
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Employee Portal */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Employee Portal</CardTitle>
              <CardDescription>Access your personalized training modules and assessments</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/employee/login">
                <Button size="lg" variant="outline" className="w-full bg-transparent">
                  Employee Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
