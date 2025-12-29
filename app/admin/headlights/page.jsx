"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/libs/supabase";
import { Loader2 } from "lucide-react";

export default function HeadlightsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalAccounts: 0,
    totalLogins: 0,
    totalListings: 0,
    paidListings: 0,
    totalRevenue: 0,
    totalCost: 0
  });
  const [users, setUsers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const adminEmails = ['admin@lm-intel.ai', 'jmcdrmtt00@gmail.com'];
    if (!adminEmails.includes(user.email)) {
      router.push('/dashboard/generate');
      return;
    }

    loadDashboardData();
  };

  const loadDashboardData = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('headlights_overview')
        .select('*')
        .lte('date_account_opened', `${selectedDate}T23:59:59`);

      if (error) throw error;

      setUsers(data || []);

      const totals = (data || []).reduce((acc, user) => ({
        totalAccounts: acc.totalAccounts + 1,
        totalLogins: acc.totalLogins + (user.num_logins || 0),
        totalListings: acc.totalListings + (user.num_listings || 0),
        paidListings: acc.paidListings + (user.new_listing_credits || 0),
        totalRevenue: acc.totalRevenue + (parseFloat(user.revenue_to_date) || 0),
        totalCost: acc.totalCost + (parseFloat(user.cost_to_date) || 0)
      }), {
        totalAccounts: 0,
        totalLogins: 0,
        totalListings: 0,
        paidListings: 0,
        totalRevenue: 0,
        totalCost: 0
      });

      setMetrics(totals);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Headlights Dashboard
          </h1>
          <p className="text-slate-600">
            Internal analytics for Davey and John
          </p>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <label className="text-sm font-medium text-slate-700">
            Data as of:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg"
          />
          <button
            onClick={loadDashboardData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Update
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Overview of QuickList Performance as of {selectedDate}
          </h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-slate-600 mb-1">Accounts</p>
              <p className="text-3xl font-bold text-slate-900">{metrics.totalAccounts}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Logins</p>
              <p className="text-3xl font-bold text-slate-900">{metrics.totalLogins}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Listings created</p>
              <p className="text-3xl font-bold text-slate-900">{metrics.totalListings}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Listings paid for</p>
              <p className="text-3xl font-bold text-slate-900">{metrics.paidListings}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Revenue</p>
              <p className="text-3xl font-bold text-green-600">${metrics.totalRevenue.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Cost</p>
              <p className="text-3xl font-bold text-red-600">${metrics.totalCost.toFixed(4)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Brokerage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Joined</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Listings</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Logins</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Revenue</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((user) => (
                  <tr key={user.user_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">{user.listor_email}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{user.brokerage_domain || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(user.date_account_opened).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{user.source || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{user.num_listings || 0}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{user.num_logins || 0}</td>
                    <td className="px-4 py-3 text-sm text-green-600">
                      ${parseFloat(user.revenue_to_date || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600">
                      ${parseFloat(user.cost_to_date || 0).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

