import React from 'react';
import { useQuery } from '@tanstack/react-query';

const fetchProxyData = async () => {
  const response = await fetch('/api/proxy');
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
};

const MetabaseProxyPage: React.FC = () => {
  const { data, error, isLoading } = useQuery(['metabaseProxy'], fetchProxyData);

  if (isLoading) return <div data-testid="loading">Loading...</div>;
  if (error) return <div data-testid="error">Error: {error.message}</div>;

  return (
    <div data-testid="metabase-proxy">
      <h1>Metabase Proxy Data</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default MetabaseProxyPage;