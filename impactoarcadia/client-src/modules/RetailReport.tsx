import React from 'react';
import { Card } from 'shadcn/ui';

interface ServiceOrderReportProps {
  reportData: Array<{ status: string; count: number; }>; 
}

const ServiceOrderReport: React.FC<ServiceOrderReportProps> = ({ reportData }) => {
  return (
    <div className="flex flex-wrap gap-4">
      {reportData.map(({ status, count }) => (
        <Card key={status} className="p-4">
          <h3 className="font-bold text-lg">{status}</h3>
          <p className="text-xl">{count}</p>
        </Card>
      ))}
    </div>
  );
};

export default ServiceOrderReport;
