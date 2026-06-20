import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import type { ConnectionStatus } from '../types';

interface StatusBarProps {
  status: ConnectionStatus;
  lastSyncTime: number;
  collaboratorCount: number;
}

export function StatusBar({ status, lastSyncTime, collaboratorCount }: StatusBarProps) {

  const statusConfig = {
    connected: {
      icon: Wifi,
      text: '已连接',
      color: 'text-success',
      bg: 'bg-success',
    },
    connecting: {
      icon: RefreshCw,
      text: '连接中...',
      color: 'text-amber-400',
      bg: 'bg-amber-400',
    },
    disconnected: {
      icon: WifiOff,
      text: '已断开',
      color: 'text-red-400',
      bg: 'bg-red-400',
    },
    offline: {
      icon: WifiOff,
      text: '离线模式',
      color: 'text-orange-400',
      bg: 'bg-orange-400',
    },
  };

  const cfg = statusConfig[status];
  const StatusIcon = cfg.icon;

  const formatSyncTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return '刚刚';
    if (diff < 60) return `${diff} 秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <div className="h-7 bg-slate-900 text-white text-xs flex items-center px-4 justify-between select-none">
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-1.5 ${cfg.color}`}>
          <span className={`w-2 h-2 rounded-full ${cfg.bg} ${status === 'connecting' ? 'animate-pulse' : ''}`} />
          <StatusIcon size={12} className={status === 'connecting' ? 'animate-spin' : ''} />
          <span>{cfg.text}</span>
        </div>

        <div className="h-3 w-px bg-slate-600" />

        <div className="flex items-center gap-1.5 text-slate-400">
          <span>最后同步: {formatSyncTime(lastSyncTime)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-slate-400">
          在线协作者: <span className="text-white font-medium">{collaboratorCount}</span>
        </div>
        <div className="text-slate-500 font-mono">
          CRDT · Yjs
        </div>
      </div>
    </div>
  );
}

export default StatusBar;
