import { useState } from "react";
import { 
  UserPlus, 
  FileCheck, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Search,
  Filter,
  MoreVertical
} from "lucide-react";

type OnboardingStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";

type OnboardingRecord = {
  id: string;
  lawyer_name: string;
  email: string;
  case_type: string;
  state: string;
  status: OnboardingStatus;
  start_date: string;
  end_date: string | null;
  assigned_to: string;
};

const mockData: OnboardingRecord[] = [
  {
    id: "1",
    lawyer_name: "John Smith",
    email: "john.smith@lawfirm.com",
    case_type: "Personal Injury",
    state: "California",
    status: "IN_PROGRESS",
    start_date: "2024-01-15",
    end_date: null,
    assigned_to: "Agent A"
  },
  {
    id: "2",
    lawyer_name: "Sarah Johnson",
    email: "sarah.j@lawfirm.com",
    case_type: "Family Law",
    state: "Texas",
    status: "PENDING",
    start_date: "2024-01-20",
    end_date: null,
    assigned_to: "Agent B"
  },
  {
    id: "3",
    lawyer_name: "Michael Brown",
    email: "mbrown@lawfirm.com",
    case_type: "Criminal Defense",
    state: "Florida",
    status: "COMPLETED",
    start_date: "2024-01-01",
    end_date: "2024-01-14",
    assigned_to: "Agent A"
  },
  {
    id: "4",
    lawyer_name: "Emily Davis",
    email: "emily.d@lawfirm.com",
    case_type: "Corporate Law",
    state: "New York",
    status: "REJECTED",
    start_date: "2024-01-10",
    end_date: null,
    assigned_to: "Agent C"
  }
];

const statusConfig: Record<OnboardingStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
};

export default function OnboardingManagementPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredRecords = mockData.filter(record => {
    const matchesSearch = 
      record.lawyer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.case_type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = [
    { label: "Total Onboardings", value: mockData.length, icon: UserPlus },
    { label: "Pending", value: mockData.filter(r => r.status === "PENDING").length, icon: Clock },
    { label: "In Progress", value: mockData.filter(r => r.status === "IN_PROGRESS").length, icon: AlertCircle },
    { label: "Completed", value: mockData.filter(r => r.status === "COMPLETED").length, icon: CheckCircle2 },
  ];

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Onboarding Management</h1>
        <p className="text-gray-500 mt-1">Track and manage attorney onboarding progress</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <stat.icon className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or case type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Lawyer Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Case Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">State</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Start Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Assigned To</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRecords.map((record) => {
                const status = statusConfig[record.status];
                const StatusIcon = status.icon;
                return (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{record.lawyer_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{record.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{record.case_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{record.state}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{record.start_date}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{record.assigned_to}</td>
                    <td className="px-4 py-3">
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredRecords.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No onboarding records found.
          </div>
        )}
      </div>
    </div>
  );
}
