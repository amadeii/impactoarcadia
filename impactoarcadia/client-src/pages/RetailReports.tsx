import React, { useState } from "react";
import { TradeInFiltersWidget } from "../components/retail-reports/TradeInFiltersWidget";
import { TradeInDetailsModal } from "../components/retail-reports/TradeInDetailsModal";
import { TradeInPrintButton } from "../components/retail-reports/TradeInPrintButton";
import { useQuery } from "@tanstack/react-query";

const fetchTradeIns = async (filters) => {
  const query = new URLSearchParams(filters).toString();
  const response = await fetch(`/api/modules/retail-reports/trade-ins?${query}`);
  if (!response.ok) throw new Error("Failed to fetch trade-ins.");
  return response.json();
};

export const RetailReportsPage: React.FC = () => {
  const [filters, setFilters] = useState({});
  const [selectedTradeIn, setSelectedTradeIn] = useState(null);

  const { data: tradeIns, isLoading, error } = useQuery(["tradeIns", filters], () => fetchTradeIns(filters));

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Retail Trade-In Reports</h1>
      <TradeInFiltersWidget onApplyFilters={setFilters} data-testid="filters-widget" />

      {isLoading && <p>Loading trade-ins...</p>}
      {error && <p className="text-red-500">Failed to load trade-ins.</p>}

      <table className="table-auto w-full border-collapse border border-gray-300 mt-4">
        <thead>
          <tr>
            <th className="border border-gray-300 px-4 py-2">ID</th>
            <th className="border border-gray-300 px-4 py-2">Seller</th>
            <th className="border border-gray-300 px-4 py-2">Company</th>
            <th className="border border-gray-300 px-4 py-2">Client</th>
            <th className="border border-gray-300 px-4 py-2">Date</th>
            <th className="border border-gray-300 px-4 py-2">Value</th>
            <th className="border border-gray-300 px-4 py-2">Status</th>
            <th className="border border-gray-300 px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tradeIns?.map((tradeIn) => (
            <tr key={tradeIn.id}>
              <td className="border border-gray-300 px-4 py-2">{tradeIn.id}</td>
              <td className="border border-gray-300 px-4 py-2">{tradeIn.sellerId}</td>
              <td className="border border-gray-300 px-4 py-2">{tradeIn.companyId}</td>
              <td className="border border-gray-300 px-4 py-2">{tradeIn.clientId}</td>
              <td className="border border-gray-300 px-4 py-2">{new Date(tradeIn.tradeInDate).toLocaleDateString()}</td>
              <td className="border border-gray-300 px-4 py-2">{tradeIn.tradeInValue}</td>
              <td className="border border-gray-300 px-4 py-2">{tradeIn.status}</td>
              <td className="border border-gray-300 px-4 py-2">
                <button
                  className="text-blue-500 hover:underline"
                  onClick={() => setSelectedTradeIn(tradeIn)}
                  data-testid="view-details-button"
                >
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <TradeInPrintButton tradeIns={tradeIns} data-testid="print-button" />

      {selectedTradeIn && (
        <TradeInDetailsModal
          tradeIn={selectedTradeIn}
          onClose={() => setSelectedTradeIn(null)}
          data-testid="details-modal"
        />
      )}
    </div>
  );
};

export default RetailReportsPage;