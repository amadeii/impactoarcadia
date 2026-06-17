import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from 'shadcn/ui';

const fetchDocumentation = async () => {
  const { data } = await axios.get('/api/docs/system-overview');
  return data;
};

const SystemOverview: React.FC = () => {
  const { data, error, isLoading } = useQuery('systemDocumentation', fetchDocumentation);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading documentation.</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Documentação do Sistema Arcadia Suite</h1>
      <div data-testid="documentation-list">
        {data.map((doc: any) => (
          <div key={doc.id} className="my-4 p-2 border rounded">
            <h2 className="font-semibold">{doc.moduleName}</h2>
            <p>{doc.description}</p>
          </div>
        ))}
      </div>
      <Button onClick={() => window.print()} data-testid="print-button">Imprimir Documentação</Button>
    </div>
  );
};

export default SystemOverview;
