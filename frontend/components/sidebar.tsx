"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"



export function Sidebar() {
  const [isManagementOpen, setIsManagementOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = () => {
    router.push("/login")
  }

const userData = localStorage.getItem('userData')
const user = userData ? JSON.parse(userData) : null
const role=user.data.role
console.log("user", user.data.role)


  const isActive = (path: string) => pathname === path


const navigation = [
  { name: "企業一覧", href: "/admin/companies" },
  { name: "企業管理", href: "/admin/company-management", children: [
    { name: "新規登録", href: "/admin/company-management/register" },
    { name: "テキスト", href: "/admin/company-management/text1" },
    { name: "テキスト", href: "/admin/company-management/text2" },
    { name: "テキスト", href: "/admin/company-management/text3" },
  ]},
]

  return (
    <div className={`w-64 ${role==="admin"?"bg-[#00C9D8]":"bg-blue-600"} text-white min-h-screen`}>
      <div className="p-4">
        <div className={`${role==="admin"?"text-black":"text-blue-600"} bg-white  p-3 rounded text-center font-bold`}>LOGO</div>
      </div>
 {/* Navigation */}
      

      {role==="user"&&<nav className="mt-8">
        <div className="px-4 py-2 text-sm font-medium text-blue-200">顧客管理</div>

        <Link href="/dashboard">
          <div className={`px-6 py-3 hover:bg-blue-700 cursor-pointer ${isActive("/dashboard") ? "bg-blue-700" : ""}`}>
            顧客リスト
          </div>
        </Link>

        <Link href="/call-history">
          <div
            className={`px-6 py-3 hover:bg-blue-700 cursor-pointer ${isActive("/call-history") ? "bg-blue-700" : ""}`}
          >
            コール履歴
          </div>
        </Link>

        <div>
          <div
            className="px-6 py-3 hover:bg-blue-700 cursor-pointer flex items-center justify-between"
            onClick={() => setIsManagementOpen(!isManagementOpen)}
          >
            <span>管理</span>
            {isManagementOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>

          {isManagementOpen && (
            <div className="bg-blue-700">
              <Link href="/management">
                <div
                  className={`px-8 py-2 hover:bg-blue-800 cursor-pointer text-sm ${
                    isActive("/management") ? "bg-blue-800" : ""
                  }`}
                >
                  システム管理
                </div>
              </Link>
              <Link href="/import">
                <div
                  className={`px-8 py-2 hover:bg-blue-800 cursor-pointer text-sm ${
                    isActive("/import") ? "bg-blue-800" : ""
                  }`}
                >
                  データインポート
                </div>
              </Link>
            </div>
          )}
        </div>
      </nav>}
      {role==="admin"&&
      
      <nav className="space-y-1">
          {navigation.map((item) => (
            <div key={item.name}>
              <Link
                href={item.href}
                className={cn(
                  "block px-3 py-2 text-white hover:bg-cyan-500 rounded",
                  pathname === item.href && "bg-cyan-500"
                )}
              >
                {item.name}
              </Link>
              {item.children && (
                <div className="ml-4 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.name}
                      href={child.href}
                      className={cn(
                        "flex items-center px-3 py-2 text-white hover:bg-cyan-500 rounded text-sm",
                        pathname === child.href && "bg-cyan-500"
                      )}
                    >
                      <input type="checkbox" className="mr-2" />
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      }

      <div className="absolute bottom-0 w-64 p-4">
        <Button variant="ghost" className="w-full text-white hover:bg-blue-700" onClick={handleLogout}>
          ログアウト
        </Button>
      </div>
    </div>
  )
}
