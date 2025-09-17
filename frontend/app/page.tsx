import Link from "next/link"

export default function HomePage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">AI Call System</h1>
        <p className="mb-4">AI-powered call system with Twilio integration</p>
        <Link 
          href="/login" 
          className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
        >
          ログイン
        </Link>
      </div>
    </div>
  )
}
