import type { CollabUser } from '../types';

interface UserAvatarListProps {
  users: CollabUser[];
  max?: number;
}

export function UserAvatarList({ users, max = 5 }: UserAvatarListProps) {
  const visible = users.slice(0, max);
  const remaining = users.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((user, idx) => (
        <div
          key={user.id}
          className="relative w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold border-2 border-brand-700 transition-transform hover:scale-110 hover:z-10 cursor-pointer"
          style={{ backgroundColor: user.color, zIndex: visible.length - idx }}
          title={`${user.name} - 在线`}
        >
          {user.name.charAt(0).toUpperCase()}
          <span
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-brand-700 bg-success"
            title="在线"
          />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className="w-8 h-8 rounded-full bg-slate-500 flex items-center justify-center text-white text-xs font-semibold border-2 border-brand-700"
          title={`还有 ${remaining} 位协作者`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

export default UserAvatarList;
