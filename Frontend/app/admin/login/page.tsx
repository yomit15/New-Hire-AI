import { Suspense } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import AdminLoginForm from "./login-form"

export default function AdminLogin() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>

        <Suspense fallback={<div>Loading...</div>}>
          <AdminLoginForm />
        </Suspense>
      </div>
    </div>
  )
}
