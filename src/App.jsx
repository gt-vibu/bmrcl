/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  MapPin, 
  ArrowRightLeft, 
  Search, 
  TrainFront, 
  Info, 
  Users, 
  Ticket, 
  ChevronRight,
  Menu,
  X,
  CreditCard,
  Clock,
  Calendar,
  LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getMetroData, getFare } from './data.js';

export default function App() {
  const [metroLines, setMetroLines] = useState({});
  const [interchanges, setInterchanges] = useState([]);
  const [fareRules, setFareRules] = useState(null);
  const [loadingMetroData, setLoadingMetroData] = useState(true);
  const [metroDataError, setMetroDataError] = useState('');
  const [activeTab, setActiveTab] = useState('finder');
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [showRoute, setShowRoute] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Advanced Fare States
  const [userType, setUserType] = useState('token');
  const [dayType, setDayType] = useState('weekday');
  const [timeType, setTimeType] = useState('peak');

  // Stations Tab States
  const [selectedLine, setSelectedLine] = useState(null);

  // Timings State
  const [timings, setTimings] = useState([]);
  const [loadingTimings, setLoadingTimings] = useState(false);

  // Map Modal State
  const [showMap, setShowMap] = useState(false);

  const METRO_LINES = metroLines;
  const INTERCHANGES = interchanges;

  useEffect(() => {
    const loadMetroData = async () => {
      try {
        const data = await getMetroData();
        setMetroLines(data.metroLines ?? {});
        setInterchanges(data.interchanges ?? []);
        setFareRules(data.fareRules ?? null);
      } catch (error) {
        console.error('Failed to fetch metro data:', error);
        setMetroDataError('Metro data could not be loaded from MongoDB.');
      } finally {
        setLoadingMetroData(false);
      }
    };

    loadMetroData();
  }, []);

  useEffect(() => {
    if (activeTab === 'timings' && timings.length === 0) {
      fetchTimings();
    }
  }, [activeTab]);

  const fetchTimings = async () => {
    setLoadingTimings(true);
    try {
      const response = await fetch('/api/timings');
      const data = await response.json();
      setTimings(data);
    } catch (error) {
      console.error("Failed to fetch timings:", error);
    } finally {
      setLoadingTimings(false);
    }
  };

  // Flattened station list for search
  const allStations = useMemo(() => {
    const set = new Set();
    Object.values(METRO_LINES).forEach(line => {
      line.stations.forEach(s => set.add(s));
    });
    return Array.from(set).sort();
  }, [METRO_LINES]);

  const getLineOfStation = (station) => {
    return Object.keys(METRO_LINES).filter(key => METRO_LINES[key].stations.includes(station));
  };

  const getNeighbors = (station) => {
    const neighbors = [];
    Object.entries(METRO_LINES).forEach(([lineKey, line]) => {
      const idx = line.stations.indexOf(station);
      if (idx !== -1) {
        if (idx > 0) neighbors.push({ station: line.stations[idx - 1], line: lineKey });
        if (idx < line.stations.length - 1) neighbors.push({ station: line.stations[idx + 1], line: lineKey });
      }
    });
    return neighbors;
  };

  const getRouteStats = (path) => {
    if (!path) return { stops: 0, transfers: 0 };

    return path.reduce((stats, step, idx) => {
      if (idx === 0) return stats;

      return {
        stops: stats.stops + 1,
        transfers: stats.transfers + (step.line !== path[idx - 1].line ? 1 : 0),
      };
    }, { stops: 0, transfers: 0 });
  };

  const normalizeRouteLines = (path) => {
    if (path.length <= 1) return path;

    return path.map((step, idx) => ({
      ...step,
      line: idx === 0 ? path[1].line : step.line,
    }));
  };

  // DFS finds every simple route. Sorting then chooses the shortest route,
  // with fewer transfers used as the tie-breaker for the best route.
  const calculateAllRoutes = (start, end) => {
    if (!start || !end || start === end) return [];

    const routes = [];
    const routeKeys = new Set();

    const dfs = (station, path, visited) => {
      if (station === end) {
        const route = normalizeRouteLines(path);
        const routeKey = route.map(step => `${step.station}:${step.line}`).join('>');

        if (!routeKeys.has(routeKey)) {
          routeKeys.add(routeKey);
          routes.push(route);
        }
        return;
      }

      getNeighbors(station).forEach((neighbor) => {
        if (visited.has(neighbor.station)) return;

        visited.add(neighbor.station);
        dfs(
          neighbor.station,
          [
            ...path,
            {
              station: neighbor.station,
              line: neighbor.line,
              isInterchange: INTERCHANGES.includes(neighbor.station),
            },
          ],
          visited
        );
        visited.delete(neighbor.station);
      });
    };

    dfs(
      start,
      [{ station: start, line: getLineOfStation(start)[0], isInterchange: INTERCHANGES.includes(start) }],
      new Set([start])
    );

    return routes.sort((a, b) => {
      const aStats = getRouteStats(a);
      const bStats = getRouteStats(b);
      return aStats.stops - bStats.stops || aStats.transfers - bStats.transfers;
    });
  };

  const allRoutes = useMemo(() => calculateAllRoutes(source, destination), [source, destination, METRO_LINES, INTERCHANGES]);
  const route = allRoutes[0] || null;
  const numStations = route ? route.length - 1 : 0;
  const individualFare = getFare(numStations, { userType, dayType, timeType }, fareRules);
  const totalFare = individualFare * passengers;
  const fareRows = useMemo(() => {
    let minStations = 1;

    return (fareRules?.slabs ?? []).map((slab, index) => {
      const stations = slab.maxStations === null
        ? `${minStations}+`
        : `${minStations} - ${slab.maxStations}`;

      if (slab.maxStations !== null) {
        minStations = slab.maxStations + 1;
      }

      return {
        slab: index + 1,
        stations,
        fare: slab.fare,
      };
    });
  }, [fareRules]);

  const renderRoutePath = (path) => (
    <div className="space-y-1">
      {path.map((step, idx) => {
        const lineColor = METRO_LINES[step.line]?.color || '#ddd';
        const isFirst = idx === 0;
        const isLast = idx === path.length - 1;
        const nextStep = path[idx + 1];
        const lineChanged = nextStep && nextStep.line !== step.line;

        return (
          <div key={`${step.station}-${idx}`} className="relative pl-12 pb-8 last:pb-0">
            {!isLast && (
              <div
                className="absolute left-[19px] top-[40px] w-1 h-[calc(100%-18px)] rounded-full"
                style={{ backgroundColor: lineColor }}
              />
            )}

            <div
              className={`absolute left-[10px] top-[14px] w-5 h-5 rounded-full border-4 bg-white z-10 ${isFirst || isLast ? 'ring-4 ring-white shadow-md' : ''}`}
              style={{ borderColor: lineColor }}
            />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className={`text-lg font-bold ${isFirst || isLast ? 'text-slate-900' : 'text-slate-700'}`}>
                  {step.station}
                  {isFirst && <span className="ml-2 text-[10px] py-0.5 px-2 bg-emerald-100 text-emerald-700 rounded-full font-bold uppercase tracking-wider">Start</span>}
                  {isLast && <span className="ml-2 text-[10px] py-0.5 px-2 bg-purple-100 text-purple-700 rounded-full font-bold uppercase tracking-wider">End</span>}
                </h4>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span
                    className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm text-white"
                    style={{ backgroundColor: lineColor }}
                  >
                    {METRO_LINES[step.line]?.name}
                  </span>
                  {step.isInterchange && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-sm flex items-center gap-1">
                      <ArrowRightLeft size={10} /> Interchange
                    </span>
                  )}
                </div>
              </div>

              {lineChanged && (
                <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-2xl flex items-center gap-3 border border-amber-100">
                  <div className="p-1.5 bg-amber-100 rounded-lg">
                    <ArrowRightLeft size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">Transfer To</p>
                    <p className="text-sm font-bold">{METRO_LINES[nextStep.line]?.name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const handleSwap = () => {
    const temp = source;
    setSource(destination);
    setDestination(temp);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 border-t-4 border-purple-theme">
      {/* Navigation */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-purple-theme rounded-lg flex items-center justify-center text-white">
              <TrainFront size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-purple-theme leading-none">BMRCL</h1>
              <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase">Metro Planner</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {['finder', 'stations', 'timings', 'fares'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  activeTab === tab 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab === 'finder' ? 'Route Finder' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <button 
            className="md:hidden p-2 text-slate-500"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-slate-100 overflow-hidden"
            >
              <div className="px-4 py-4 space-y-2">
                {['finder', 'stations', 'timings', 'fares'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setMobileMenuOpen(false); }}
                    className={`w-full text-left px-4 py-3 rounded-xl text-md font-semibold ${
                      activeTab === tab ? 'bg-purple-50 text-purple-theme' : 'text-slate-600'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <div className="bg-purple-theme py-12 px-4 shadow-inner">
        <div className="max-w-4xl mx-auto text-center text-white">
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold mb-3"
          >
            Smooth Travels, Every Time
          </motion.h2>
          <p className="text-purple-100 text-lg opacity-90 max-w-xl mx-auto">
            Plan your journey across Bengaluru with the most accurate route and fare information.
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 -mt-8 pb-16">
        {loadingMetroData && (
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 text-center border border-slate-100">
            <p className="text-slate-500 font-bold">Loading metro data from MongoDB...</p>
          </div>
        )}

        {metroDataError && (
          <div className="bg-red-50 rounded-3xl shadow-sm p-8 mb-6 text-center border border-red-100">
            <p className="text-red-700 font-bold">{metroDataError}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'finder' && (
            <motion.div
              key="finder"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Search Card */}
              <div className="bg-white rounded-3xl shadow-xl p-6 md:p-10">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
                  <div className="md:col-span-5 space-y-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Departing From</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-theme transition-colors">
                        <MapPin size={20} />
                      </div>
                      <select 
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-purple-theme focus:bg-white outline-none transition-all appearance-none text-slate-800 font-medium"
                      >
                        <option value="">Select source station</option>
                        {allStations.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex justify-center pb-2">
                    <button 
                      onClick={handleSwap}
                      className="w-12 h-12 rounded-full bg-slate-100 hover:bg-purple-100 text-slate-500 hover:text-purple-theme transition-all transform hover:rotate-180 flex items-center justify-center cursor-pointer shadow-sm border border-slate-200"
                      title="Swap Source and Destination"
                    >
                      <ArrowRightLeft size={20} />
                    </button>
                  </div>

                  <div className="md:col-span-5 space-y-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Destination</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-theme transition-colors">
                        <MapPin size={20} />
                      </div>
                      <select 
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-purple-theme focus:bg-white outline-none transition-all appearance-none text-slate-800 font-medium"
                      >
                        <option value="">Select destination station</option>
                        {allStations.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-12 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">User Type</label>
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button 
                          onClick={() => setUserType('token')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${userType === 'token' ? 'bg-white text-purple-theme shadow-sm' : 'text-slate-500'}`}
                        >
                          <Ticket size={14} /> Token
                        </button>
                        <button 
                          onClick={() => setUserType('card')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${userType === 'card' ? 'bg-white text-purple-theme shadow-sm' : 'text-slate-500'}`}
                        >
                          <CreditCard size={14} /> Smart Card
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Day Selection</label>
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button 
                          onClick={() => setDayType('weekday')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${dayType === 'weekday' ? 'bg-white text-purple-theme shadow-sm' : 'text-slate-500'}`}
                        >
                          <Calendar size={14} /> Mon - Sat
                        </button>
                        <button 
                          onClick={() => setDayType('holiday')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${dayType === 'holiday' ? 'bg-white text-purple-theme shadow-sm' : 'text-slate-500'}`}
                        >
                          <Calendar size={14} /> Sun / Holiday
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Time Window</label>
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button 
                          onClick={() => setTimeType('peak')}
                          disabled={dayType === 'holiday'}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${timeType === 'peak' ? 'bg-white text-purple-theme shadow-sm' : 'text-slate-500'} disabled:opacity-50`}
                        >
                          <Clock size={14} /> Peak
                        </button>
                        <button 
                          onClick={() => setTimeType('non-peak')}
                          disabled={dayType === 'holiday'}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${timeType === 'non-peak' ? 'bg-white text-purple-theme shadow-sm' : 'text-slate-500'} disabled:opacity-50`}
                        >
                          <Clock size={14} /> Non-Peak
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-12 pt-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-2xl w-full md:w-auto">
                        <div className="flex items-center gap-2 pl-3">
                          <Users size={18} className="text-slate-400" />
                          <span className="text-sm font-semibold text-slate-600">Passengers:</span>
                        </div>
                        <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                          <button onClick={() => setPassengers(Math.max(1, passengers - 1))} className="w-10 h-10 hover:bg-slate-50 disabled:opacity-30" disabled={passengers <= 1}>-</button>
                          <span className="w-12 text-center font-bold text-sm">{passengers}</span>
                          <button onClick={() => setPassengers(passengers + 1)} className="w-10 h-10 hover:bg-slate-50">+</button>
                        </div>
                      </div>

                      <button 
                        onClick={() => setShowRoute(true)}
                        disabled={!source || !destination || source === destination}
                        className="w-full md:w-auto px-10 h-14 bg-purple-theme hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-2xl font-bold shadow-lg shadow-purple-200 transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-95 group uppercase tracking-widest text-xs"
                      >
                        <Search size={18} />
                        Plan My Journey
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Results */}
              <AnimatePresence>
                {showRoute && route && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                  >
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                        <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                          <span className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <MapPin size={20} />
                          </span>
                          Best Route
                        </h3>
                        <div className="mb-8 grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Stops</p>
                            <p className="text-2xl font-black text-emerald-700">{numStations}</p>
                          </div>
                          <div className="rounded-2xl bg-purple-50 border border-purple-100 p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-purple-600">Transfers</p>
                            <p className="text-2xl font-black text-purple-700">{getRouteStats(route).transfers}</p>
                          </div>
                        </div>

                        {renderRoutePath(route)}
                      </div>

                      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                          <span className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
                            <LayoutGrid size={20} />
                          </span>
                          All Possible Routes
                          <span className="ml-auto text-xs font-black text-slate-400 uppercase tracking-widest">{allRoutes.length} found</span>
                        </h3>

                        <div className="space-y-4 max-h-[560px] overflow-y-auto pr-2 custom-scrollbar">
                          {allRoutes.map((possibleRoute, routeIdx) => {
                            const stats = getRouteStats(possibleRoute);
                            const routeLines = [...new Set(possibleRoute.map(step => step.line))]
                              .map(line => METRO_LINES[line]?.name)
                              .filter(Boolean)
                              .join(' + ');

                            return (
                              <details
                                key={possibleRoute.map(step => `${step.station}-${step.line}`).join('|')}
                                open={routeIdx === 0}
                                className={`rounded-2xl border p-5 ${routeIdx === 0 ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-100 bg-slate-50/60'}`}
                              >
                                <summary className="cursor-pointer list-none">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-black text-slate-900">Route {routeIdx + 1}</span>
                                        {routeIdx === 0 && (
                                          <span className="text-[10px] py-0.5 px-2 bg-emerald-100 text-emerald-700 rounded-full font-black uppercase tracking-wider">Best</span>
                                        )}
                                      </div>
                                      <p className="text-xs font-semibold text-slate-500 mt-1">{routeLines}</p>
                                    </div>

                                    <div className="flex gap-2 text-xs font-bold">
                                      <span className="px-3 py-1 rounded-lg bg-white text-slate-700 border border-slate-100">{stats.stops} stops</span>
                                      <span className="px-3 py-1 rounded-lg bg-white text-slate-700 border border-slate-100">{stats.transfers} transfers</span>
                                    </div>
                                  </div>
                                </summary>

                                <div className="mt-6 border-t border-slate-200/70 pt-6">
                                  {renderRoutePath(possibleRoute)}
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Cost Summary */}
                      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-3 opacity-5">
                          <Ticket size={120} strokeWidth={1} />
                        </div>
                        
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                          <span className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                            <Ticket size={20} />
                          </span>
                          Fare Detail
                        </h3>

                        <div className="space-y-4">
                          <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                            <span>Stations Traveled</span>
                            <span className="text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">{numStations} stops</span>
                          </div>
                          <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                            <span>Fare per Passenger</span>
                            <span className="text-slate-900 font-bold">₹{individualFare}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                            <span>Total Passengers</span>
                            <span className="text-slate-900 font-bold">{passengers}</span>
                          </div>

                          <div className="pt-4 mt-4 border-t border-dashed border-slate-200">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Estimated Total</p>
                            <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-extrabold text-purple-theme">₹{totalFare}</span>
                              <span className="text-xs text-slate-400 font-bold uppercase">Incl. Taxes</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3 text-sm text-blue-700">
                          <Info size={18} className="flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold mb-1 text-xs">Fare applied:</p>
                            <p className="opacity-80 text-xs">
                              {userType === 'card' 
                                ? `Smart Card Discount Applied (${dayType === 'holiday' ? '10% Holiday' : (timeType === 'peak' ? '5% Peak' : '10% Non-Peak')})` 
                                : 'Standard Token Fare Applied'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-lg overflow-hidden relative group">
                         <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-purple-500 rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                         <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                           <LayoutGrid size={18} className="text-purple-400" /> Professional Map
                         </h4>
                         <p className="text-slate-400 text-sm leading-relaxed mb-6">
                            Visualize the entire BMRCL network. View all lines, interchanges, and upcoming expansions in a clean layout.
                         </p>
                         <button 
                          onClick={() => setShowMap(true)}
                          className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all backdrop-blur-sm border border-white/5"
                         >
                            View Station Map <ChevronRight size={16} />
                         </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'stations' && (
            <motion.div
              key="stations"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 transition-all duration-500">
                <div className="flex flex-col mb-10 gap-6">
                  <div>
                    <h2 className="text-3xl font-extrabold mb-1">Network Explorer</h2>
                    <p className="text-slate-500 font-medium text-sm">Switch between lines directly to view stations.</p>
                  </div>
                  
                  {/* Line Switcher on Top */}
                  <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-100 mb-2">
                    <button 
                      onClick={() => setSelectedLine(null)}
                      className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!selectedLine ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                    >
                      All Lines
                    </button>
                    {Object.entries(METRO_LINES).map(([key, line]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedLine(key)}
                        className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border-2 ${
                          selectedLine === key 
                            ? 'bg-white shadow-md' 
                            : 'bg-transparent text-slate-400 hover:text-slate-600 border-transparent hover:border-slate-200'
                        }`}
                        style={{ 
                          borderColor: selectedLine === key ? line.color : 'transparent',
                          color: selectedLine === key ? line.color : '' 
                        }}
                      >
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: line.color }} />
                        {line.name}
                      </button>
                    ))}
                  </div>
                </div>
                
                {!selectedLine ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-500">
                    {Object.entries(METRO_LINES).map(([key, line]) => (
                      <motion.button
                        key={key}
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedLine(key)}
                        className="group bg-slate-50 hover:bg-white p-6 rounded-3xl border-2 border-transparent hover:border-slate-100 hover:shadow-xl transition-all text-left overflow-hidden relative"
                      >
                        <div 
                          className="absolute top-0 right-0 w-32 h-32 opacity-10 group-hover:opacity-20 transition-opacity"
                          style={{ backgroundColor: line.color, borderRadius: '0 0 0 100%' }}
                        />
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-black/10" style={{ backgroundColor: line.color }}>
                          <LayoutGrid size={24} />
                        </div>
                        <h3 className="text-xl font-extrabold mb-2">{line.name}</h3>
                        <p className="text-slate-500 text-sm font-medium">{line.stations.length} Active Stations</p>
                        <div className="mt-6 flex items-center gap-2 text-xs font-bold text-slate-400 group-hover:text-slate-900 transition-colors">
                          Explore Route <ChevronRight size={14} />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <motion.div 
                    key={selectedLine}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="duration-500"
                  >
                    <div className="flex items-center gap-4 mb-8">
                      <div 
                        className="p-3 rounded-2xl text-white shadow-lg shadow-black/5"
                        style={{ backgroundColor: METRO_LINES[selectedLine].color }}
                      >
                        <TrainFront size={24} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-900">{METRO_LINES[selectedLine].name}</h3>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{METRO_LINES[selectedLine].stations.length} Stations Found</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {METRO_LINES[selectedLine].stations.map((station, idx) => (
                        <motion.div 
                          key={station}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.02 }}
                          className={`group p-5 rounded-2xl border-2 transition-all ${
                            INTERCHANGES.includes(station) 
                              ? 'bg-purple-50/50 border-purple-100 hover:bg-purple-50' 
                              : 'bg-white border-slate-50 hover:border-slate-200 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-[10px] font-bold text-slate-300 group-hover:text-slate-400">#{idx + 1}</span>
                            {INTERCHANGES.includes(station) && (
                              <ArrowRightLeft size={14} className="text-purple-400" />
                            )}
                          </div>
                          <h4 className="font-bold text-slate-800 mt-2">{station}</h4>
                          {INTERCHANGES.includes(station) && (
                            <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mt-1">Interchange Station</p>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'timings' && (
            <motion.div
              key="timings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold mb-1 text-slate-900">Metro Train Timings</h2>
                    <p className="text-slate-500 font-medium text-sm">First &amp; last trains, frequency, and peak hours for all lines.</p>
                  </div>
                  <button 
                    onClick={fetchTimings}
                    disabled={loadingTimings}
                    className="p-3 bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-theme rounded-xl transition-all disabled:opacity-50"
                    title="Refresh Timings"
                  >
                    <Clock size={20} className={loadingTimings ? 'animate-spin' : ''} />
                  </button>
                </div>

                {loadingTimings ? (
                  <div className="py-24 flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold text-sm animate-pulse">Loading timings...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {timings.map((t, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="rounded-3xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all"
                      >
                        {/* Line header */}
                        <div className="px-6 py-4 flex items-center gap-3" style={{ backgroundColor: t.color + '18' }}>
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 text-base leading-tight">{t.line}</h4>
                            <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">{t.terminal}</p>
                          </div>
                        </div>

                        {/* Timing grid */}
                        <div className="px-6 py-5 bg-slate-50 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">First Train (Mon–Sat)</p>
                            <p className="text-lg font-extrabold text-slate-900">{t.firstTrain}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Last Train (Mon–Sat)</p>
                            <p className="text-lg font-extrabold text-slate-900">{t.lastTrain}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">First Train (Sun/Holiday)</p>
                            <p className="text-lg font-extrabold text-slate-900">{t.sundayFirst}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Last Train (Sun/Holiday)</p>
                            <p className="text-lg font-extrabold text-slate-900">{t.sundayLast}</p>
                          </div>
                        </div>

                        {/* Frequency + peak */}
                        <div className="px-6 py-4 grid grid-cols-2 gap-4 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-slate-400 flex-shrink-0" />
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peak Freq.</p>
                              <p className="text-sm font-bold text-slate-800">{t.peakFrequency}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-slate-400 flex-shrink-0" />
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Off-Peak Freq.</p>
                              <p className="text-sm font-bold text-slate-800">{t.offPeakFrequency}</p>
                            </div>
                          </div>
                        </div>

                        {/* Peak hours */}
                        {t.peakHours !== '—' && (
                          <div className="px-6 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
                            <Info size={13} className="text-amber-500 flex-shrink-0" />
                            <p className="text-xs text-amber-700 font-semibold">Peak: {t.peakHours}</p>
                          </div>
                        )}

                        {/* Notes */}
                        {t.notes && (
                          <div className="px-6 py-3 border-t border-slate-100">
                            <p className="text-xs text-slate-500 leading-relaxed">{t.notes}</p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                    {timings.length === 0 && (
                      <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-400 font-bold italic">Timing data temporarily unavailable.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-10 p-8 bg-purple-50 rounded-[32px] border border-purple-100 flex gap-6">
                  <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Info size={28} />
                  </div>
                  <div>
                    <h4 className="font-bold text-purple-900 text-lg mb-2">Service Standard</h4>
                    <p className="text-sm text-purple-800/70 leading-relaxed font-medium">
                      Metro services start from <b>5:00 AM</b> (Mon–Sat) and <b>7:00 AM</b> (Sun/Holidays). 
                      Last trains depart terminal stations around <b>11:00–11:35 PM</b> nightly. 
                      Timings may extend during major festivals — check the official <b>Namma Metro app</b> for live updates.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'fares' && (
            <motion.div
              key="fares"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 max-w-2xl mx-auto overflow-hidden"
            >
              <div className="mb-10 text-center">
                <h2 className="text-2xl font-bold mb-2">BMRCL Fare Chart 2025</h2>
                <p className="text-slate-500 font-medium">Standard ticket slabs based on travel distance.</p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Slab</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Stations</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-right">Fare (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {fareRows.map((row) => (
                      <tr key={row.slab} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-400">#0{row.slab}</td>
                        <td className="px-6 py-4 font-bold text-slate-700">{row.stations}</td>
                        <td className="px-6 py-4 font-black text-purple-theme text-right">₹{row.fare}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 p-8 bg-slate-50 rounded-[32px] border border-slate-100">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0">
                    <Info size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-2">Discount Policy</h4>
                    <ul className="text-sm text-slate-600 space-y-2 font-medium list-disc ml-4 opacity-80">
                      <li>Sundays and National Holidays: 10% Flat Discount for Card Users.</li>
                      <li>Smart Cards / NCMC cards get up to 10% discount on non-peak hours.</li>
                      <li>Peak hours apply a 5% discount for card users only.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="bg-white border-t border-slate-100 py-16">
        <div className="max-w-6xl mx-auto px-4 text-center md:text-left">
          <div className="flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="space-y-4">
              <div className="flex items-center justify-center md:justify-start gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-xl">
                  <TrainFront size={20} />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">BMRCL NAV</h1>
              </div>
              <p className="text-slate-400 text-sm font-medium">Your reliable companion for navigating Bengaluru's Metro network.</p>
            </div>
            
            <div className="flex flex-col items-center md:items-end gap-2">
              <div className="flex gap-8 text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                 <a href="#" className="hover:text-purple-theme transition-colors">Safety</a>
                 <a href="#" className="hover:text-purple-theme transition-colors">Privacy</a>
                 <a href="#" className="hover:text-purple-theme transition-colors">Help</a>
              </div>
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                &copy; 2025 Bangalore Metro Rail Corp. Ltd.
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Map Modal */}
      <AnimatePresence>
        {showMap && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMap(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 40 }}
              className="relative bg-white w-full max-w-6xl h-[85vh] rounded-[48px] shadow-[0_0_100px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col"
            >
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-purple-theme text-white flex items-center justify-center shadow-lg shadow-purple-200">
                    <TrainFront size={28} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-900">System Map</h3>
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Network Visualization</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMap(false)} 
                  className="w-14 h-14 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-all flex items-center justify-center"
                >
                  <X size={28} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-12 bg-slate-50 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
                   {Object.entries(METRO_LINES).map(([key, line]) => (
                     <div key={key} className="space-y-8">
                        <div className="flex items-center gap-4">
                           <div className="px-5 py-2.5 text-[10px] font-black text-white rounded-xl uppercase tracking-[0.2em] shadow-xl transition-transform hover:scale-105 cursor-default" style={{ backgroundColor: line.color }}>
                              {line.name}
                           </div>
                           <div className="h-[2px] flex-1 bg-slate-200 rounded-full"></div>
                        </div>
                        <div className="space-y-5 px-2">
                           {line.stations.map((s, i) => (
                             <div key={i} className="flex items-center gap-5 group">
                                <div className="relative flex flex-col items-center">
                                   <div className={`w-3.5 h-3.5 rounded-full border-[3px] bg-white z-10 transition-all duration-300 group-hover:scale-150 group-hover:shadow-lg shadow-black/5`} style={{ borderColor: line.color }} />
                                   {i !== line.stations.length - 1 && (
                                     <div className="w-[3px] h-12 -mb-5 bg-slate-200 rounded-full" />
                                   )}
                                </div>
                                <span className={`text-sm font-bold tracking-tight transition-colors ${INTERCHANGES.includes(s) ? 'text-purple-theme py-1 px-3 bg-purple-50 rounded-lg group-hover:bg-purple-600 group-hover:text-white' : 'text-slate-500 group-hover:text-slate-900'}`}>
                                  {s}
                                  {INTERCHANGES.includes(s) && <span className="ml-2 text-[8px] font-black uppercase tracking-widest opacity-60">Interchange</span>}
                                </span>
                             </div>
                           ))}
                        </div>
                     </div>
                   ))}
                </div>
              </div>

              <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex flex-wrap items-center justify-center gap-10">
                   <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-purple-theme ring-8 ring-purple-50" />
                      <span className="text-sm font-extrabold text-slate-700">Interchange Point</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-slate-200" />
                      <span className="text-sm font-extrabold text-slate-400">Regular Station</span>
                   </div>
                </div>
                <div className="px-6 py-2.5 bg-emerald-100 text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                  Official Network Version 2025.1
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
