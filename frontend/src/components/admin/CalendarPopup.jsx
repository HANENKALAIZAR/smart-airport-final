import { useState } from 'react';
import { ChevronLeft, ChevronRight, BarChart3, TrendingUp, ArrowLeft, Plane, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Mock monthly stats per month index (0-11)
const MONTHLY_DATA = {
    0: { flights: 410, onTime: 298, delayed: 102, cancelled: 10, avgDelay: 62, topRoute: 'TUN → CDG', topCause: 'Winter fog' },
    1: { flights: 445, onTime: 312, delayed: 121, cancelled: 12, avgDelay: 68, topRoute: 'TUN → ORY', topCause: 'Mediterranean storms' },
    2: { flights: 480, onTime: 350, delayed: 118, cancelled: 12, avgDelay: 55, topRoute: 'TUN → IST', topCause: 'ATC restrictions' },
    3: { flights: 510, onTime: 385, delayed: 115, cancelled: 10, avgDelay: 48, topRoute: 'TUN → CDG', topCause: 'Crew scheduling' },
    4: { flights: 550, onTime: 425, delayed: 115, cancelled: 10, avgDelay: 42, topRoute: 'TUN → MRS', topCause: 'Airport congestion' },
    5: { flights: 620, onTime: 478, delayed: 130, cancelled: 12, avgDelay: 45, topRoute: 'TUN → ORY', topCause: 'Peak traffic' },
    6: { flights: 710, onTime: 540, delayed: 155, cancelled: 15, avgDelay: 52, topRoute: 'TUN → CDG', topCause: 'Summer peak load' },
    7: { flights: 730, onTime: 548, delayed: 168, cancelled: 14, avgDelay: 58, topRoute: 'TUN → LHR', topCause: 'Thunderstorms' },
    8: { flights: 580, onTime: 435, delayed: 132, cancelled: 13, avgDelay: 50, topRoute: 'TUN → FCO', topCause: 'Late rotations' },
    9: { flights: 490, onTime: 368, delayed: 112, cancelled: 10, avgDelay: 46, topRoute: 'TUN → IST', topCause: 'Crosswinds' },
    10: { flights: 440, onTime: 322, delayed: 108, cancelled: 10, avgDelay: 54, topRoute: 'TUN → CDG', topCause: 'Autumn fog' },
    11: { flights: 460, onTime: 330, delayed: 118, cancelled: 12, avgDelay: 60, topRoute: 'TUN → JED', topCause: 'Holiday congestion' },
};

const YEARLY_DATA = {
    2024: { flights: 5820, onTime: 4190, delayed: 1480, cancelled: 150, avgDelay: 58, delayRate: 25.4 },
    2025: { flights: 6240, onTime: 4560, delayed: 1520, cancelled: 160, avgDelay: 54, delayRate: 24.4 },
    2026: { flights: 1680, onTime: 1210, delayed: 428, cancelled: 42, avgDelay: 52, delayRate: 25.5 },
};

export default function CalendarPopup({ isOpen, onClose, selectedDate, onDateSelect }) {
    const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
    const [view, setView] = useState('calendar'); // 'calendar' | 'monthly' | 'yearly'

    if (!isOpen) return null;

    function getDays(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const start = (firstDay.getDay() + 6) % 7;
        const days = [];
        for (let i = 0; i < start; i++) days.push(null);
        for (let i = 1; i <= lastDay.getDate(); i++) days.push(i);
        return days;
    }

    function isToday(day) {
        const t = new Date();
        return day === t.getDate() && currentMonth.getMonth() === t.getMonth() && currentMonth.getFullYear() === t.getFullYear();
    }

    function isSelected(day) {
        return day === selectedDate.getDate() && currentMonth.getMonth() === selectedDate.getMonth() && currentMonth.getFullYear() === selectedDate.getFullYear();
    }

    function handleDayClick(day) {
        onDateSelect(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
    }

    const days = getDays(currentMonth);
    const mData = MONTHLY_DATA[currentMonth.getMonth()] || MONTHLY_DATA[0];
    const yData = YEARLY_DATA[currentMonth.getFullYear()] || YEARLY_DATA[2026];

    const statRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #E5E7EB' };
    const statLabelStyle = { fontSize: '0.8rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 };
    const statValueStyle = { fontSize: '0.9rem', fontWeight: 600, color: '#1E293B' };
    const barBg = { height: 6, borderRadius: 3, background: '#E5E7EB', flex: 1, marginLeft: 8, marginRight: 8 };

    return (
        <div className="admin-calendar-backdrop" onClick={onClose}>
            <div className="admin-calendar" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="admin-calendar__header">
                    {view !== 'calendar' ? (
                        <>
                            <button className="admin-calendar__nav" onClick={() => setView('calendar')}>
                                <ArrowLeft size={20} />
                            </button>
                            <h2>{view === 'monthly'
                                ? `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`
                                : `Year ${currentMonth.getFullYear()}`
                            }</h2>
                            <div style={{ width: 32 }} />
                        </>
                    ) : (
                        <>
                            <button className="admin-calendar__nav" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
                                <ChevronLeft size={20} />
                            </button>
                            <h2>{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h2>
                            <button className="admin-calendar__nav" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
                                <ChevronRight size={20} />
                            </button>
                        </>
                    )}
                </div>

                {/* Body */}
                {view === 'calendar' && (
                    <div className="admin-calendar__body">
                        <div className="admin-calendar__weekdays">
                            {weekDays.map(d => <div key={d} className="admin-calendar__weekday">{d}</div>)}
                        </div>
                        <div className="admin-calendar__days">
                            {days.map((day, i) => (
                                <div key={i}>
                                    {day ? (
                                        <button
                                            className={`admin-calendar__day${isSelected(day) ? ' admin-calendar__day--selected' : isToday(day) ? ' admin-calendar__day--today' : ''}`}
                                            onClick={() => handleDayClick(day)}
                                        >
                                            {day}
                                        </button>
                                    ) : (
                                        <div style={{ aspectRatio: '1' }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {view === 'monthly' && (
                    <div style={{ padding: '12px 16px' }}>
                        <div style={statRowStyle}>
                            <span style={statLabelStyle}><Plane size={14} /> Total Flights</span>
                            <span style={statValueStyle}>{mData.flights}</span>
                        </div>
                        <div style={statRowStyle}>
                            <span style={statLabelStyle}><CheckCircle size={14} /> On Time</span>
                            <span style={{ ...statValueStyle, color: '#16A34A' }}>{mData.onTime} ({Math.round(mData.onTime / mData.flights * 100)}%)</span>
                        </div>
                        <div style={statRowStyle}>
                            <span style={statLabelStyle}><AlertTriangle size={14} /> Delayed</span>
                            <span style={{ ...statValueStyle, color: '#F59E0B' }}>{mData.delayed} ({Math.round(mData.delayed / mData.flights * 100)}%)</span>
                        </div>
                        <div style={statRowStyle}>
                            <span style={statLabelStyle}><Clock size={14} /> Avg Delay</span>
                            <span style={statValueStyle}>{mData.avgDelay} min</span>
                        </div>
                        {/* Visual bar for delay rate */}
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
                            <span style={{ fontSize: '0.7rem', color: '#94A3B8', minWidth: 55 }}>Delay Rate</span>
                            <div style={barBg}>
                                <div style={{ height: 6, borderRadius: 3, width: `${Math.round(mData.delayed / mData.flights * 100)}%`, background: 'linear-gradient(90deg, #F59E0B, #EF4444)' }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#F59E0B' }}>{Math.round(mData.delayed / mData.flights * 100)}%</span>
                        </div>
                        <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px', marginTop: 8 }}>
                            <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginBottom: 4 }}>Top Route</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{mData.topRoute}</div>
                        </div>
                        <div style={{ background: '#FFF7ED', borderRadius: 8, padding: '10px 12px', marginTop: 8 }}>
                            <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginBottom: 4 }}>Top Delay Cause</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#B45309' }}>{mData.topCause}</div>
                        </div>
                    </div>
                )}

                {view === 'yearly' && (
                    <div style={{ padding: '12px 16px' }}>
                        <div style={statRowStyle}>
                            <span style={statLabelStyle}><Plane size={14} /> Total Flights</span>
                            <span style={statValueStyle}>{yData.flights.toLocaleString()}</span>
                        </div>
                        <div style={statRowStyle}>
                            <span style={statLabelStyle}><CheckCircle size={14} /> On Time</span>
                            <span style={{ ...statValueStyle, color: '#16A34A' }}>{yData.onTime.toLocaleString()} ({Math.round(yData.onTime / yData.flights * 100)}%)</span>
                        </div>
                        <div style={statRowStyle}>
                            <span style={statLabelStyle}><AlertTriangle size={14} /> Delayed</span>
                            <span style={{ ...statValueStyle, color: '#F59E0B' }}>{yData.delayed.toLocaleString()} ({yData.delayRate}%)</span>
                        </div>
                        <div style={statRowStyle}>
                            <span style={statLabelStyle}><Clock size={14} /> Avg Delay</span>
                            <span style={statValueStyle}>{yData.avgDelay} min</span>
                        </div>
                        {/* Year-over-year comparison */}
                        {Object.entries(YEARLY_DATA).map(([year, d]) => (
                            <div key={year} style={{ display: 'flex', alignItems: 'center', marginTop: year === Object.keys(YEARLY_DATA)[0] ? 12 : 6 }}>
                                <span style={{ fontSize: '0.75rem', color: '#64748B', minWidth: 38 }}>{year}</span>
                                <div style={barBg}>
                                    <div style={{
                                        height: 6, borderRadius: 3,
                                        width: `${d.delayRate * 3}%`,
                                        background: Number(year) === currentMonth.getFullYear()
                                            ? 'linear-gradient(90deg, #6366F1, #8B5CF6)'
                                            : '#CBD5E1',
                                    }} />
                                </div>
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: Number(year) === currentMonth.getFullYear() ? '#6366F1' : '#94A3B8', minWidth: 35 }}>
                                    {d.delayRate}%
                                </span>
                            </div>
                        ))}
                        <div style={{ fontSize: '0.65rem', color: '#94A3B8', textAlign: 'center', marginTop: 8 }}>
                            Delay rate comparison across years
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="admin-calendar__footer">
                    <button
                        className={`admin-btn ${view === 'monthly' ? 'admin-btn--primary' : 'admin-btn--outline'}`}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', border: view !== 'monthly' ? '1px solid #0A1F44' : undefined, color: view !== 'monthly' ? '#0A1F44' : undefined }}
                        onClick={() => setView(view === 'monthly' ? 'calendar' : 'monthly')}
                    >
                        <BarChart3 size={16} /> {view === 'monthly' ? 'Back to Calendar' : 'Monthly Summary'}
                    </button>
                    <button
                        className={`admin-btn ${view === 'yearly' ? 'admin-btn--primary' : 'admin-btn--outline'}`}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', border: view !== 'yearly' ? '1px solid #0A1F44' : undefined, color: view !== 'yearly' ? '#0A1F44' : undefined }}
                        onClick={() => setView(view === 'yearly' ? 'calendar' : 'yearly')}
                    >
                        <TrendingUp size={16} /> {view === 'yearly' ? 'Back to Calendar' : 'Yearly Summary'}
                    </button>
                </div>
            </div>
        </div>
    );
}
