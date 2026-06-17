import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchUsers } from '../hooks/useUsers';

const UserList: React.FC = () => {
  const { data: users, isLoading, error } = useQuery(['users'], fetchUsers);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading users</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">User Management</h1>
      <Link to="/users/new" className="btn btn-primary">Create User</Link>
      <table className="min-w-full mt-4">
        <thead>
          <tr>
            <th className="px-4 py-2">ID</th>
            <th className="px-4 py-2">Username</th>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id} data-testid={`user-${user.id}`}>  
              <td className="border px-4 py-2">{user.id}</td>
              <td className="border px-4 py-2">{user.username}</td>
              <td className="border px-4 py-2">{user.name}</td>
              <td className="border px-4 py-2">{user.email}</td>
              <td className="border px-4 py-2">
                <Link to={`/users/${user.id}/edit`} className="btn btn-secondary">Edit</Link>
                <button onClick={() => handleDelete(user.id)} className="btn btn-danger">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserList;

const handleDelete = async (id: number) => {
  await fetch(`/api/users/${id}`, { method: 'DELETE' });
  // Refresh user list after deletion
};