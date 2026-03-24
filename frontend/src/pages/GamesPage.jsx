import React, { useEffect, useState } from 'react';
import { Gamepad2, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '../api';
import { formatBytes, formatRelativeDate } from '../utils';

const PLATFORM_COLORS = {
  Steam: 'text-blue-400',
  Epic: 'text-purple-400',
  GOG: 'text-violet-400',
  EA: 'text-orange-400',
  Ubisoft: 'text-blue-300',
  Xbox: 'text-green-400',
  Local: 'text-slate-400',
};

export default function GamesPage() {
  const [games, setGames] = useState([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showStaleOnly, setShowStaleOnly] = useState(false);

  const loadGames = async (rescan = false) => {
    setLoading(true);
    try {
      const res = await api.get(`/games?rescan=${rescan}`);
      setGames(res.data.games || []);
      setTotalBytes(res.data.total_bytes || 0);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadGames();
  }, []);

  const filteredGames = showStaleOnly ? games.filter((g) => g.is_stale) : games;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Game Library</h1>
          <p className="text-slate-400 text-sm">
            {games.length} games detected · {formatBytes(totalBytes)} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              className="accent-brand-600"
              checked={showStaleOnly}
              onChange={(e) => setShowStaleOnly(e.target.checked)}
            />
            Stale only (>90 days)
          </label>
          <button
            onClick={() => loadGames(true)}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Rescan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="card text-center py-10">
          <Gamepad2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">
            {showStaleOnly ? 'No stale games found.' : 'No games detected. Try rescanning.'}
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="divide-y divide-slate-700/50">
            {filteredGames.map((game) => (
              <div key={`${game.name}-${game.platform}`} className="flex items-center gap-4 py-3">
                <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Gamepad2 className="w-5 h-5 text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white text-sm truncate">{game.name}</p>
                    {game.is_stale && (
                      <span className="badge badge-yellow flex-shrink-0">
                        <AlertTriangle className="w-2.5 h-2.5 mr-1" /> Stale
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{game.install_path}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xs font-semibold ${PLATFORM_COLORS[game.platform] || 'text-slate-400'}`}>
                    {game.platform}
                  </p>
                  <p className="text-sm font-medium text-slate-300">{formatBytes(game.size_bytes)}</p>
                  <p className="text-xs text-slate-500">{formatRelativeDate(game.last_played)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
