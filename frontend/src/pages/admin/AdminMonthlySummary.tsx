import React from 'react';
import { Calendar, TrendingUp, AlertTriangle, Clock, Plane } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface MonthlySummaryPageProps {
  month: number;
  year: number;
}

export function MonthlySummaryPage({ month, year }: MonthlySummaryPageProps) {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Mock data for the month
  const monthlyKPIs = {
    totalFlights: 3847,
    onTimePercentage: 76.4,
    averageDelay: 22,
    highestDelayDay: 18
  };

  const dailyDelayTrend = Array.from({ length: 28 }, (_, i) => ({
    day: i + 1,
    avgDelay: Math.floor(Math.random() * 30 + 10),
    flights: Math.floor(Math.random() * 50 + 100)
  }));

  const delayDistribution = [
    { range: '0-10 min', count: 1450 },
    { range: '11-20 min', count: 980 },
    { range: '21-30 min', count: 720 },
    { range: '31-45 min', count: 450 },
    { range: '46-60 min', count: 180 },
    { range: '60+ min', count: 67 }
  ];

  const airlinePerformance = [
    { airline: 'Tunisair', avgDelay: 18, flights: 1200 },
    { airline: 'Nouvelair', avgDelay: 24, flights: 890 },
    { airline: 'Air France', avgDelay: 20, flights: 650 },
    { airline: 'Lufthansa', avgDelay: 16, flights: 540 },
    { airline: 'Turkish Air', avgDelay: 28, flights: 420 },
    { airline: 'Emirates', avgDelay: 12, flights: 147 }
  ];

  const riskBreakdown = [
    { name: 'Low Risk', value: 2308, color: '#2E7D32' },
    { name: 'Medium Risk', value: 1089, color: '#FFB020' },
    { name: 'High Risk', value: 450, color: '#E53935' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0A1F44] to-[#163A70] text-white rounded-md p-6">
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="w-8 h-8 text-[#00C2FF]" />
          <h1 className="text-3xl font-bold">
            {monthNames[month]} {year} – Operational Summary
          </h1>
        </div>
        <p className="text-white/80">
          Comprehensive monthly analysis for Tunis International Airport
        </p>
      </div>

      {/* KPI Section */}
      <div>
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Monthly Key Performance Indicators</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <Plane className="w-8 h-8 text-[#00C2FF] opacity-80" />
            </div>
            <p className="text-sm text-[#6B7280] mb-1">Total Flights</p>
            <p className="text-4xl font-bold text-[#1A1A1A]">{monthlyKPIs.totalFlights.toLocaleString()}</p>
            <p className="text-xs text-[#6B7280] mt-2">processed this month</p>
          </div>

          <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <TrendingUp className="w-8 h-8 text-[#2E7D32] opacity-80" />
            </div>
            <p className="text-sm text-[#6B7280] mb-1">On-Time Performance</p>
            <p className="text-4xl font-bold text-[#2E7D32]">{monthlyKPIs.onTimePercentage}%</p>
            <p className="text-xs text-[#6B7280] mt-2">flights departed on time</p>
          </div>

          <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <Clock className="w-8 h-8 text-[#FFB020] opacity-80" />
            </div>
            <p className="text-sm text-[#6B7280] mb-1">Average Delay</p>
            <p className="text-4xl font-bold text-[#1A1A1A]">{monthlyKPIs.averageDelay}</p>
            <p className="text-xs text-[#6B7280] mt-2">minutes per delayed flight</p>
          </div>

          <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <AlertTriangle className="w-8 h-8 text-[#E53935] opacity-80" />
            </div>
            <p className="text-sm text-[#6B7280] mb-1">Highest Delay Day</p>
            <p className="text-4xl font-bold text-[#E53935]">{monthNames[month]} {monthlyKPIs.highestDelayDay}</p>
            <p className="text-xs text-[#6B7280] mt-2">peak delay recorded</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Delay Trend */}
        <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6">
          <h3 className="font-semibold text-lg mb-4 text-[#1A1A1A]">Daily Delay Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyDelayTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#6B7280" />
              <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="avgDelay"
                stroke="#E53935"
                strokeWidth={2}
                name="Avg Delay (min)"
                dot={{ fill: '#E53935', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Delay Distribution */}
        <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6">
          <h3 className="font-semibold text-lg mb-4 text-[#1A1A1A]">Delay Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={delayDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="range" tick={{ fontSize: 12 }} stroke="#6B7280" />
              <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="count" fill="#0A1F44" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Airline Performance */}
        <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6">
          <h3 className="font-semibold text-lg mb-4 text-[#1A1A1A]">Airline Performance Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={airlinePerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#6B7280" />
              <YAxis dataKey="airline" type="category" tick={{ fontSize: 12 }} stroke="#6B7280" width={90} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="avgDelay" fill="#00C2FF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Level Breakdown */}
        <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6">
          <h3 className="font-semibold text-lg mb-4 text-[#1A1A1A]">Risk Level Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={riskBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {riskBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Insights Panel */}
      <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6">
        <h3 className="font-semibold text-lg mb-4 text-[#1A1A1A] flex items-center gap-2">
          <span className="text-[#00C2FF]">🤖</span> AI-Generated Insights
        </h3>
        <div className="space-y-4">
          <div className="bg-[#00C2FF]/5 border-l-4 border-[#00C2FF] p-4 rounded-r-md">
            <p className="text-sm text-[#1A1A1A] leading-relaxed">
              <span className="font-semibold">Weather Impact:</span> This month showed increased delays due to 
              seasonal weather conditions. Heavy rain events on days 7, 14, and 18 contributed to 34% of all 
              significant delays (≥30 minutes).
            </p>
          </div>
          <div className="bg-[#FFB020]/5 border-l-4 border-[#FFB020] p-4 rounded-r-md">
            <p className="text-sm text-[#1A1A1A] leading-relaxed">
              <span className="font-semibold">Traffic Patterns:</span> Peak traffic congestion occurred during 
              afternoon hours (14:00-18:00), accounting for 42% of medium-risk flights. Consider operational 
              adjustments during these windows.
            </p>
          </div>
          <div className="bg-[#2E7D32]/5 border-l-4 border-[#2E7D32] p-4 rounded-r-md">
            <p className="text-sm text-[#1A1A1A] leading-relaxed">
              <span className="font-semibold">Performance Improvement:</span> On-time performance improved by 3.2% 
              compared to the previous month, primarily due to enhanced ground operations efficiency and better 
              weather forecasting integration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
