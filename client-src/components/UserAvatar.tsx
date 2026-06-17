import React from 'react';

interface UserAvatarProps {
  name: string;
  size?: number;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ name, size = 40 }) => {
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase();

  const generateColor = (name: string) => {
    const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FFBD33'];
    return colors[hash % colors.length];
  };

  const backgroundColor = generateColor(name);

  return (
    <div
data-testid="user-avatar"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: size / 2,
      }}
    >
      {initials}
    </div>
  );
};

export default UserAvatar;
