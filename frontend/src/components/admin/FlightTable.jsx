import { useState, useEffect } from 'react';
import AviationBadge from './AviationBadge';
import Pagination from '../../components/Pagination';
import { useLanguage } from '../../context/LanguageContext';

const PAGE_SIZE = 10;

export default function FlightTable({ flights, onFlightClick }) {
    const { t } = useLanguage();
    const [currentPage, setCurrentPage] = useState(1);

    // Reset to page 1 whenever the flights array changes (e.g. new filters)
    useEffect(() => { setCurrentPage(1); }, [flights]);

    const totalItems = flights.length;
    const start = (currentPage - 1) * PAGE_SIZE;
    const paginatedFlights = flights.slice(start, start + PAGE_SIZE);

    const statusClass = (status) => {
        switch (status) {
            case 'On-Time': return 'admin-table__status--on-time';
            case 'Delayed': return 'admin-table__status--delayed';
            case 'Boarding': return 'admin-table__status--boarding';
            case 'Departed': return 'admin-table__status--departed';
            case 'Cancelled': return 'admin-table__status--cancelled';
            case 'Landed': return 'admin-table__status--departed';
            case 'Scheduled': return '';
            default: return '';
        }
    };

    return (
        <div className="admin-table-wrap">
            <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>{t('table_flight')}</th>
                            <th>{t('table_airline')}</th>
                            <th>{t('table_route')}</th>
                            <th>{t('table_time')}</th>
                            <th>{t('table_weather')}</th>
                            <th>{t('table_delay_min')}</th>
                            <th>{t('table_risk')}</th>
                            <th>{t('table_status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedFlights.map(flight => (
                            <tr key={flight.id} onClick={() => onFlightClick?.(flight)} style={{ cursor: onFlightClick ? 'pointer' : undefined }}>
                                <td style={{ fontWeight: 500 }}>{flight.flightNumber}</td>
                                <td className="admin-table__muted">{flight.airline}</td>
                                <td>{flight.origin} → {flight.destination}</td>
                                <td>{flight.scheduledTime}</td>
                                <td className="admin-table__muted">{flight.weather}</td>
                                <td>
                                    <span className={flight.predictedDelay > 30 ? 'admin-table__danger' : ''}>
                                        {flight.predictedDelay}
                                    </span>
                                </td>
                                <td><AviationBadge riskLevel={flight.riskLevel} /></td>
                                <td><span className={statusClass(flight.status)}>{flight.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                className="admin-pagination"
            />
        </div>
    );
}
