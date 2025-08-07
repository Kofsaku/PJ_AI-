import "../globals.css"
import { Sidebar } from "@/components/sidebar"




export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
   
        <div className="flex">
          <Sidebar />
          <main className="flex-1 bg-gray-50">
            {children}
          </main>
        </div>
    
  )
}
