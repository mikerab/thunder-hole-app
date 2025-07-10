import { useState, useEffect } from 'react';
import { Clock, TrendingUp, TrendingDown, Loader2, AlertCircle, Mountain, MapPin } from 'lucide-react';

type Prediction = { t: string; v: string; type: 'H' | 'L' };

type Tide = {
  time: string;
  date: string;
  height: string;
  type: string;
  timestamp: number;
};

type TideData = {
  location: string;
  coordinates: { lat: number; lon: number };
  tides: Tide[];
  nextTide: Tide;
  currentTide: string;
};

const ThunderHoleTracker = () => {
  const [tideData, setTideData] = useState<TideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Swan's Island, Maine coordinates and NOAA station ID
  const LOCATION = {
    name: "Swan's Island, Maine",
    lat: 44.1539,
    lon: -68.4447,
    //noaaStation: '8413320' // Bar Harbor station (closest to Swan's Island)
    noaaStation: '8413825' // Mackerel Covestation (closest to Swan's Island)
  };

  const fetchNOAATideData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 2);
      
      const beginDate = today.toISOString().split('T')[0].replace(/-/g, '');
      const endDate = tomorrow.toISOString().split('T')[0].replace(/-/g, '');
      
      // NOAA API endpoint for tide predictions
      const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=NOS.COOPS.TAC.WL&begin_date=${beginDate}&end_date=${endDate}&datum=MLLW&station=${LOCATION.noaaStation}&time_zone=lst_ldt&units=english&interval=hilo&format=json`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`NOAA API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }
      
      const tides = data.predictions.map((prediction: Prediction) => ({
        time: new Date(prediction.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date(prediction.t).toLocaleDateString(),
        height: parseFloat(prediction.v).toFixed(1),
        type: prediction.type === 'H' ? 'High' : 'Low',
        timestamp: new Date(prediction.t).getTime()
      }));
      
      // Find current tide direction
      const now = Date.now();
      const currentTideDirection = getCurrentTideDirection(tides, now);
      
      setTideData({
        location: LOCATION.name,
        coordinates: { lat: LOCATION.lat, lon: LOCATION.lon },
        tides: tides,
        nextTide: tides.find((tide: Tide) => tide.timestamp > now) || tides[0],
        currentTide: currentTideDirection
      });
      
    } catch (err) {
      if (err instanceof Error) {
        setError(`Failed to fetch tide data: ${err.message}`);
      } else {
        setError('Failed to fetch tide data: Unknown error');
      }
    } finally {
      setLoading(false);
    }
  };

  const getCurrentTideDirection = (tides: Tide[], now: number) => {
    const futureTides = tides.filter(tide => tide.timestamp > now);
    if (futureTides.length < 2) return 'Unknown';
    
    const nextTide = futureTides[0];
    const prevTide = tides.filter(tide => tide.timestamp < now).slice(-1)[0];
    
    if (!prevTide) return 'Unknown';
    
    // If moving toward high tide, it's rising; toward low tide, it's falling
    return nextTide.type === 'High' ? 'Rising' : 'Falling';
  };

  const calculateThunderHoleTime = (tides: Tide[]) => {
    const now = new Date();
    
    // Calculate sunrise and sunset for Swan's Island (approximate)
    const sunrise = new Date(now);
    sunrise.setHours(6, 0, 0, 0);
    const sunset = new Date(now);
    sunset.setHours(19, 30, 0, 0); // Earlier sunset in Maine
    
    // Find the best Thunder Hole time
    for (let tide of tides) {
      const tideType = tide.type;
      const tideTime = new Date(tide.timestamp);

      let thunderHoleTime = new Date();

      // New calculation is 2 hours past a low tide and 3 hours past a high tide
      if (tideType === 'Low') {
        thunderHoleTime = new Date(tideTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours after
      } else {
        thunderHoleTime = new Date(tideTime.getTime() + 3 * 60 * 60 * 1000); // 3 hours after
      }
      
      // Check if the time is during daylight hours and in the future
      if (thunderHoleTime > now && thunderHoleTime >= sunrise && thunderHoleTime <= sunset) {
        return {
          time: thunderHoleTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: thunderHoleTime.toLocaleDateString(),
          relatedTide: tide,
          timestamp: thunderHoleTime.getTime(),
          hoursFromNow: (thunderHoleTime.getTime() - now.getTime()) / (1000 * 60 * 60)
        };
      }
    }
    
    return null;
  };

  useEffect(() => {
    fetchNOAATideData();
    // Refresh data every 30 minutes
    const interval = setInterval(fetchNOAATideData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const TideCard = ({ tide }: { tide: Tide }) => (
    <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 border border-white/30 hover:bg-white/25 transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-blue-100">{tide.date}</span>
        <div className="flex items-center gap-1">
          {tide.type === 'High' ? (
            <TrendingUp className="w-4 h-4 text-emerald-300" />
          ) : (
            <TrendingDown className="w-4 h-4 text-orange-300" />
          )}
          <span className={`text-sm font-semibold ${
            tide.type === 'High' ? 'text-emerald-300' : 'text-orange-300'
          }`}>
            {tide.type}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-white">{tide.time}</span>
        <span className="text-lg font-medium text-blue-100">{tide.height} ft</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-10">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              width: `${Math.random() * 80 + 40}px`,
              height: `${Math.random() * 80 + 40}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${4 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
            ⚡ Thunder Hole Tracker
          </h1>
          <div className="flex items-center justify-center gap-2 text-blue-200 text-lg mb-2">
            <MapPin className="w-5 h-5" />
            <span>Swan's Island, Maine</span>
          </div>
          <p className="text-blue-200">Find the perfect time to witness nature's power</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
            <p className="text-blue-100">Fetching real-time tide data from NOAA...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/20 backdrop-blur-md rounded-xl p-4 mb-8 border border-red-400/30">
            <div className="flex items-center gap-2 text-red-100">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchNOAATideData}
              className="mt-3 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Thunder Hole Data */}
        {tideData && !loading && (
          <div className="space-y-6">
            {/* Thunder Hole Section - Main Feature */}
            <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 backdrop-blur-md rounded-2xl p-8 border border-orange-400/40">
              <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <Mountain className="w-8 h-8" />
                Best Time for Thunder Hole
              </h2>
              {(() => {
                const thunderHoleTime = calculateThunderHoleTime(tideData.tides);
                if (thunderHoleTime) {
                  return (
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-6">
                        <div className="text-center bg-white/10 rounded-xl p-4">
                          <p className="text-orange-200 text-sm mb-2">Optimal Time</p>
                          <p className="text-3xl font-bold text-white">{thunderHoleTime.time}</p>
                          <p className="text-orange-200 text-sm">{thunderHoleTime.date}</p>

                          <p className="text-orange-200 text-sm mb-2 mt-6">Time Remaining</p>
                          <p className="text-3xl font-bold text-white">{thunderHoleTime.hoursFromNow.toFixed(1)}h</p>
                          <p className="text-orange-200 text-sm">from now</p>
                          <p className="text-orange-200 text-sm mb-2 mt-6">Related Tide</p>
                          <p className="text-2xl font-bold text-white">{thunderHoleTime.relatedTide.type}</p>
                          <p className="text-orange-200 text-sm">at {thunderHoleTime.relatedTide.time}</p>
                        </div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-4">
                        <p className="text-orange-100 text-center">
                          ⚡ Perfect conditions for massive waves! Visit 3 hours past high tide or 2 hours past low tide when the water conditions are best.
                        </p>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="bg-white/10 rounded-xl p-8 text-center">
                      <p className="text-orange-200 text-xl mb-3">No optimal viewing times during daylight hours</p>
                      <p className="text-orange-300 text-sm">
                        Thunder Hole is best experienced during daylight for safety. The next optimal viewing time falls outside hiking hours.
                      </p>
                    </div>
                  );
                }
              })()}
            </div>

            {/* Current Status */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-2xl font-bold text-white mb-4">Current Tide Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/20 rounded-xl p-4">
                  <p className="text-blue-100 text-sm mb-1">Tide Direction</p>
                  <p className="text-2xl font-bold text-white">{tideData.currentTide}</p>
                </div>
                <div className="bg-white/20 rounded-xl p-4">
                  <p className="text-blue-100 text-sm mb-1">Next Tide</p>
                  <p className="text-xl font-bold text-white">
                    {tideData.nextTide.type} at {tideData.nextTide.time}
                  </p>
                </div>
              </div>
            </div>

            {/* Tide Schedule */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Clock className="w-6 h-6" />
                Tide Schedule
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tideData.tides.map((tide, index) => (
                  <TideCard key={index} tide={tide} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-blue-200">
          <p className="text-sm">
            ⚡ Real-time data from NOAA • Updates every 30 minutes • Built for Thunder Hole enthusiasts
          </p>
        </div>
      </div>
    </div>
  );
};

export default ThunderHoleTracker;