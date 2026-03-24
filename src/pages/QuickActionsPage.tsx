import { useState } from "react";
import { 
  FileText, 
  Users, 
  Briefcase, 
  Calendar, 
  CheckCircle, 
  Clock,
  Search,
  Settings
} from "lucide-react";

const quickActions = [
  {
    id: 1,
    title: "New Order",
    description: "Create a new case order for attorney onboarding",
    icon: FileText,
    color: "bg-blue-500",
    path: "/account-management/orders/new"
  },
  {
    id: 2,
    title: "View Lawyers",
    description: "Browse and manage attorney profiles",
    icon: Users,
    color: "bg-green-500",
    path: "/account-management/lawyers"
  },
  {
    id: 3,
    title: "Active Cases",
    description: "View all active onboarding cases",
    icon: Briefcase,
    color: "bg-purple-500",
    path: "/account-management/orders"
  },
  {
    id: 4,
    title: "Schedule Tasks",
    description: "Manage onboarding task schedules",
    icon: Calendar,
    color: "bg-orange-500",
    path: "/account-management/schedule"
  },
  {
    id: 5,
    title: "Pending Approvals",
    description: "Review pending attorney applications",
    icon: CheckCircle,
    color: "bg-yellow-500",
    path: "/account-management/approvals"
  },
  {
    id: 6,
    title: "Recent Activity",
    description: "View recent onboarding activities",
    icon: Clock,
    color: "bg-gray-500",
    path: "/account-management/activity"
  },
  {
    id: 7,
    title: "Search Cases",
    description: "Search and filter case records",
    icon: Search,
    color: "bg-indigo-500",
    path: "/account-management/search"
  },
  {
    id: 8,
    title: "Settings",
    description: "Configure account settings",
    icon: Settings,
    color: "bg-red-500",
    path: "/account-management/settings"
  }
];

export default function QuickActionsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredActions = quickActions.filter(action =>
    action.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    action.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quick Actions</h1>
        <p className="text-gray-500 mt-1">Access common tasks and features quickly</p>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search actions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredActions.map((action) => (
          <div
            key={action.id}
            className="p-4 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center mb-3`}>
              <action.icon className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900">{action.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{action.description}</p>
          </div>
        ))}
      </div>

      {filteredActions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No actions found matching your search.
        </div>
      )}
    </div>
  );
}
