"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Filter, Plus, ChevronLeft, ChevronRight, Trash2, Edit } from 'lucide-react'
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

interface Company {
  _id: string;
  companyId: string;
  name: string;
  address: string;
  url: string;
  phone: string;
  email?: string;
  lastCall?: string;
  status: string;
  createdAt: string;
}

export default function CompanyList() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    const userData = localStorage.getItem('userData');
    if (!userData) {
      router.push('/admin/login');
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== 'admin') {
      router.push('/admin/login');
      return;
    }
    fetchCompanies();
  }, [router])

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/companies', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        setCompanies(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('企業データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この企業を削除してもよろしいですか？')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/companies/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        toast.success('企業を削除しました');
        fetchCompanies();
      } else {
        toast.error(data.error || '削除に失敗しました');
      }
    } catch (error) {
      console.error('Error deleting company:', error);
      toast.error('削除に失敗しました');
    }
  };

  const handleNewRegistration = () => {
    router.push("/admin/company-management/register")
  }

  const handleEdit = (id: string) => {
    router.push(`/admin/company-management/edit/${id}`)
  }

  const handleToggleCompany = (companyId: string) => {
    setSelectedCompanies(prev => 
      prev.includes(companyId) 
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    )
  }

  const handleSelectAll = () => {
    if (selectedCompanies.length === companies.length) {
      setSelectedCompanies([])
    } else {
      setSelectedCompanies(companies.map(c => c._id))
    }
  }

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.companyId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage)
  const paginatedCompanies = filteredCompanies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-semibold">企業一覧</h1>
        <Button 
          onClick={handleNewRegistration} 
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          新規登録
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="検索..."
                className="pl-10 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              フィルター
            </Button>
          </div>
          <div className="text-sm text-gray-500">
            全{filteredCompanies.length}件
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 text-left">
                  <Checkbox 
                    checked={selectedCompanies.length === companies.length && companies.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="p-3 text-left text-sm font-medium text-gray-700">企業ID</th>
                <th className="p-3 text-left text-sm font-medium text-gray-700">企業名</th>
                <th className="p-3 text-left text-sm font-medium text-gray-700">住所</th>
                <th className="p-3 text-left text-sm font-medium text-gray-700">URL</th>
                <th className="p-3 text-left text-sm font-medium text-gray-700">電話番号</th>
                <th className="p-3 text-left text-sm font-medium text-gray-700">ステータス</th>
                <th className="p-3 text-left text-sm font-medium text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCompanies.map((company) => (
                <tr key={company._id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <Checkbox 
                      checked={selectedCompanies.includes(company._id)}
                      onCheckedChange={() => handleToggleCompany(company._id)}
                    />
                  </td>
                  <td className="p-3 text-sm font-mono">{company.companyId}</td>
                  <td className="p-3 text-sm font-medium">
                    <Link 
                      href={`/admin/companies/${company._id}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {company.name}
                    </Link>
                  </td>
                  <td className="p-3 text-sm text-gray-600">{company.address}</td>
                  <td className="p-3 text-sm">
                    {company.url && (
                      <a href={company.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {company.url}
                      </a>
                    )}
                  </td>
                  <td className="p-3 text-sm">{company.phone}</td>
                  <td className="p-3">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      company.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {company.status === 'active' ? 'アクティブ' : '非アクティブ'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(company._id)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(company._id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCompanies.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            企業データがありません
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredCompanies.length)} / {filteredCompanies.length}件
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}