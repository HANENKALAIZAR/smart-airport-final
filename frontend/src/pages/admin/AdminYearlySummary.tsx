import React from 'react';
import { Calendar, TrendingUp, AlertCircle, Award } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface YearlySummaryPageProps {
  year: number;
}

export function YearlySummaryPage({ year }: YearlySummaryPageProps) {
  // Mock yearly data
  const yearlyKPIs = {
    totalFlights: 42567,
    averageDelay: 19.8,
    onTimePercentage: 78.2,
    worstMonth: 'February',
    bestMonth: 'September'
  };

  const monthlyDelayData = [
    { month: 'Jan', avgDelay: 16, flights: 3245, onTimeRate: 82 },
    { month: 'Feb', avgDelay: 28, flights: 3140, onTimeRate: 68 },
    { month: 'Mar', avgDelay: 22, flights: 3567, onTimeRate: 74 },
    { month: 'Apr', avgDelay: 18, flights: 3689, onTimeRate: 79 },
    { month: 'May', avgDelay: 15, flights: 3821, onTimeRate: 84 },
    { month: 'Jun', avgDelay: 17, flights: 4012, onTimeRate: 81 },
    { month: 'Jul', avgDelay: 20, flights: 4234, onTimeRate: 77 },
    { month: 'Aug', avgDelay: 19, flights: 4156, onTimeRate: 78 },
    { month: 'Sep', avgDelay: 12, flights: 3678, onTimeRate: 88 },
    { month: 'Oct', avgDelay: 16, flights: 3489, onTimeRate: 83 },
    { month: 'Nov', avgDelay: 21, flights: 3298, onTimeRate: 75 },
    { month: 'Dec', avgDelay: 24, flights: 3238, onTimeRate: 71 }
  ];

  const yearlyRiskDistribution = [
    { month: 'Jan', low: 2100, medium: 890, high: 255 },
    { month: 'Feb', low: 1850, medium: 950, high: 340 },
    { month: 'Mar', low: 2200, medium: 1120, high: 247 },
    { month: 'Apr', low: 2450, medium: 980, high: 259 },
    { month: 'May', low: 2680, medium: 890, high: 251 },
    { month: 'Jun', low: 2780, medium: 1020, high: 212 },
    { month: 'Jul', low: 2890, medium: 1130, high: 214 },
    { month: 'Aug', low: 2850, medium: 1090, high: 216 },
    { month: 'Sep', low: 2920, medium: 620, high: 138 },
    { month: 'Oct', low: 2450, medium: 850, high: 189 },
    { month: 'Nov', low: 2120, medium: 980, high: 198 },
    { month: 'Dec', low: 1980, medium: 1050, high: 208 }
  ];

  const seasonalAnalysis = [
    { season: 'Winter', avgDelay: 23, impact: 'High', color: '#E53935' },
    { season: 'Spring', avgDelay: 18, impact: 'Medium', color: '#FFB020' },
    { season: 'Summer', avgDelay: 19, impact: 'Medium', color: '#FFB020' },
    { season: 'Fall', avgDelay: 19, impact: 'Medium', color: '#FFB020' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0A1F44] to-[#163A70] text-white rounded-md p-6">
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="w-8 h-8 text-[#00C2FF]" />
          <h1 className="text-3xl font-bold">{year} – Annual Operations Report</h1>
        </div>
        <p className="text-white/80">
          Complete yearly performance analysis for Tunis International Airport
        </p>
      </div>

      {/* Yearly KPIs */}
      <div>
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Annual Performance Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6 shadow-sm">
            <p className="text-sm text-[#6B7280] mb-2">Total Flights</p>
            <p className="text-4xl font-bold text-[#1A1A1A]">{yearlyKPIs.totalFlights.toLocaleString()}</p>
            <p className="text-xs text-[#6B7280] mt-2">yearly operations</p>
          </div>

          <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6 shadow-sm">
            <p className="text-sm text-[#6B7280] mb-2">Avg On-Time Rate</p>
            <p className="text-4xl font-bold text-[#2E7D32]">{yearlyKPIs.onTimePercentage}%</p>
            <p className="text-xs text-[#6B7280] mt-2">annual average</p>
          </div>

          <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6 shadow-sm">
            <p className="text-sm text-[#6B7280] mb-2">Avg Delay</p>
            <p className="text-4xl font-bold text-[#FFB020]">{yearlyKPIs.averageDelay}</p>
            <p className="text-xs text-[#6B7280] mt-2">minutes per delay</p>
          </div>

          <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6 shadow-sm">
            <p className="text-sm text-[#6B7280] mb-2">Best Month</p>
            <p className="text-4xl font-bold text-[#2E7D32]">{yearlyKPIs.bestMonth}</p>
            <p className="text-xs text-[#6B7280] mt-2">88% on-time</p>
          </div>

          <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6 shadow-sm">
            <p className="text-sm text-[#6B7280] mb-2">Worst Month</p>
            <p className="text-4xl font-bold text-[#E53935]">{yearlyKPIs.worstMonth}</p>
            <p className="text-xs text-[#6B7280] mt-2">68% on-time</p>
          </div>
        </div>
      </div>

      {/* Monthly Delay Trend */}
      <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6">
        <h3 className="font-semibold text-lg mb-4 text-[#1A1A1A]">Monthly Delay Performance</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyDelayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6B7280" />
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
            <Bar dataKey="avgDelay" fill="#E53935" name="Avg Delay (min)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* On-Time Performance Trend */}
      <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6">
        <h3 className="font-semibold text-lg mb-4 text-[#1A1A1A]">On-Time Performance Trend</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={monthlyDelayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6B7280" />
            <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" domain={[60, 90]} />
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
              dataKey="onTimeRate"
              stroke="#2E7D32"
              strokeWidth={3}
              name="On-Time Rate (%)"
              dot={{ fill: '#2E7D32', r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Risk Distribution Over Year */}
      <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6">
        <h3 className="font-semibold text-lg mb-4 text-[#1A1A1A]">Risk Distribution Across Months</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={yearlyRiskDistribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6B7280" />
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
            <Bar dataKey="low" stackId="a" fill="#2E7D32" name="Low Risk" />
            <Bar dataKey="medium" stackId="a" fill="#FFB020" name="Medium Risk" />
            <Bar dataKey="high" stackId="a" fill="#E53935" name="High Risk" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Seasonal Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6">
          <h3 className="font-semibold text-lg mb-4 text-[#1A1A1A]">Seasonal Impact Analysis</h3>
          <div className="space-y-4">
            {seasonalAnalysis.map((season) => (
              <div key={season.season} className="flex items-center justify-between p-4 bg-[#F4F6F9] rounded-md">
                <div className="flex-1">
                  <p className="font-semibold text-[#1A1A1A] mb-1">{season.season}</p>
                  <p className="text-sm text-[#6B7280]">Weather Impact: {season.impact}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: season.color }}>
                    {season.avgDelay} min
                  </p>
                  <p className="text-xs text-[#6B7280]">avg delay</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Achievements */}
        <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6">
          <h3 className="font-semibold text-lg mb-4 text-[#1A1A1A] flex items-center gap-2">
            <Award className="w-5 h-5 text-[#00C2FF]" />
            Key Achievements {year}
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-[#2E7D32]/5 border-l-4 border-[#2E7D32] rounded-r-md">
              <div className="w-8 h-8 rounded-full bg-[#2E7D32] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-semibold text-[#1A1A1A] text-sm">Best September Performance</p>
                <p className="text-xs text-[#6B7280]">88% on-time rate achieved in September</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[#00C2FF]/5 border-l-4 border-[#00C2FF] rounded-r-md">
              <div className="w-8 h-8 rounded-full bg-[#00C2FF] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-semibold text-[#1A1A1A] text-sm">AI Prediction Accuracy</p>
                <p className="text-xs text-[#6B7280]">94.2% average prediction accuracy maintained</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[#FFB020]/5 border-l-4 border-[#FFB020] rounded-r-md">
              <div className="w-8 h-8 rounded-full bg-[#FFB020] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-semibold text-[#1A1A1A] text-sm">Operational Efficiency</p>
                <p className="text-xs text-[#6B7280]">15% reduction in ground delays compared to 2025</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[#163A70]/5 border-l-4 border-[#163A70] rounded-r-md">
              <div className="w-8 h-8 rounded-full bg-[#163A70] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                4
              </div>
              <div>
                <p className="font-semibold text-[#1A1A1A] text-sm">Traffic Growth</p>
                <p className="text-xs text-[#6B7280]">12.4% increase in total flights handled</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="bg-white rounded-md border border-[rgba(0,0,0,0.08)] p-6">
        <h3 className="font-semibold text-lg mb-4 text-[#1A1A1A] flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-[#00C2FF]" />
          Executive Summary
        </h3>
        <div className="prose prose-sm max-w-none text-[#1A1A1A]">
          <p className="mb-3 leading-relaxed">
            Tunis International Airport demonstrated strong operational performance in {year}, handling{' '}
            <span className="font-semibold">{yearlyKPIs.totalFlights.toLocaleString()} flights</span> with an 
            overall on-time rate of <span className="font-semibold">{yearlyKPIs.onTimePercentage}%</span>.
          </p>
          <p className="mb-3 leading-relaxed">
            The AI delay prediction system maintained exceptional accuracy throughout the year, enabling 
            proactive operational adjustments and improving passenger experience. Winter months (January-February) 
            presented the greatest challenges due to adverse weather conditions, while September emerged as the 
            peak performance month with 88% on-time departures.
          </p>
          <p className="leading-relaxed">
            Looking ahead, continued investment in predictive analytics and ground operations optimization 
            will be critical to maintaining service quality amid projected 15% traffic growth in {year + 1}.
          </p>
        </div>
      </div>
    </div>
  );
}
