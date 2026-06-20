import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table2, Sparkles, Users, Zap, Shield, ArrowRight } from 'lucide-react';

export function Home() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const createNewDoc = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Spreadsheet' }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        navigate(`/doc/${data.data.id}`);
      }
    } catch (err) {
      console.error('Failed to create doc:', err);
      const fallbackId = `demo-${Date.now()}`;
      navigate(`/doc/${fallbackId}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <nav className="flex items-center justify-between mb-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-success to-brand-400 flex items-center justify-center">
              <Table2 size={22} />
            </div>
            <span className="text-xl font-display font-semibold tracking-wide">
              CollabSheet
            </span>
          </div>
          <button
            onClick={createNewDoc}
            disabled={isLoading}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? '创建中...' : '开始使用'}
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </nav>

        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
            <Sparkles size={14} className="text-amber-400" />
            <span className="text-sm text-slate-300">
              基于 CRDT 的实时协同电子表格
            </span>
          </div>

          <h1 className="font-display text-6xl font-bold mb-6 leading-tight">
            多人实时协同
            <br />
            <span className="bg-gradient-to-r from-success via-cyan-400 to-brand-300 bg-clip-text text-transparent">
              无冲突电子表格
            </span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            去中心化冲突解决，离线编辑自动合并。告别版本混乱，让团队协作像本地编辑一样流畅。
          </p>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={createNewDoc}
              disabled={isLoading}
              className="px-8 py-4 bg-success hover:bg-emerald-600 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-success/25 hover:shadow-success/40 hover:-translate-y-0.5 flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? '创建中...' : '创建新表格'}
              {!isLoading && <ArrowRight size={20} />}
            </button>
            <button
              onClick={() => navigate('/doc/demo')}
              className="px-8 py-4 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl font-semibold text-lg transition-all"
            >
              打开演示文档
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur hover:bg-white/10 transition-all">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-4">
              <Users size={22} />
            </div>
            <h3 className="text-lg font-semibold mb-2">实时光标同步</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              看到每个协作者的光标位置和选区，知道谁在编辑哪里。
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur hover:bg-white/10 transition-all">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center mb-4">
              <Zap size={22} />
            </div>
            <h3 className="text-lg font-semibold mb-2">CRDT 并发编辑</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              基于 Yjs 的无冲突复制数据类型，自动解决并发冲突。
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur hover:bg-white/10 transition-all">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-4">
              <Shield size={22} />
            </div>
            <h3 className="text-lg font-semibold mb-2">离线编辑支持</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              断网后继续编辑，重连自动合并所有变更，不丢失任何数据。
            </p>
          </div>
        </div>

        <div className="mt-20 pt-8 border-t border-white/10 flex items-center justify-between text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span>Powered by</span>
            <span className="font-mono text-brand-300">Yjs · CRDT</span>
          </div>
          <div>
            支持文本、数字、日期、布尔值
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
