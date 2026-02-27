import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

const socket = io('https://tech-titans-api-x86h.onrender.com');

// --- 1. SMART ICONS (Outside the App component) ---
// This function returns a different icon based on the emergency type
const getIncidentIcon = (type) => {
  let emoji = "🚨"; 
  if (type === "Fire") emoji = "🔥";
  if (type === "Medical") emoji = "🏥";
  if (type === "Police") emoji = "🚔";

  return L.divIcon({
    className: 'custom-emergency-marker', // We removed Leaflet's default classes
    html: `
      <div style="
        display: flex;
        justify-content: center;
        align-items: center;
        width: 40px;
        height: 40px;
        background: rgba(229, 9, 20, 0.2);
        border: 2px solid #e50914;
        border-radius: 50%;
        font-size: 24px;
        box-shadow: 0 0 15px rgba(229, 9, 20, 0.5);
        animation: pulse 1.5s infinite;
      ">
        ${emoji}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

// --- 2. THE ROUTING ENGINE (Outside the App component) ---
const RoutingMachine = ({ userLoc, destination }) => {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    // 1. Safety check: ensure everything exists
    if (!map || !userLoc || !destination) return;

    // 2. Remove previous route if it exists
    if (routingControlRef.current) {
      try {
        // We check if the container still exists before removing
        if (map.hasLayer(routingControlRef.current)) {
           map.removeControl(routingControlRef.current);
        }
      } catch (e) {
        console.warn("Cleanup ignored:", e);
      }
    }

    // 3. Create the new route
    try {
      routingControlRef.current = L.Routing.control({
        waypoints: [
          L.latLng(userLoc.lat, userLoc.lng),
          L.latLng(destination.lat, destination.lng)
        ],
        lineOptions: {
          styles: [{ color: '#e50914', weight: 8, opacity: 0.9 }]
        },
        addWaypoints: false,
        draggableWaypoints: false,
        show: false, 
        fitSelectedRoutes: true
      }).addTo(map);
    } catch (err) {
      console.error("Routing error:", err);
    }

    // 4. Robust Cleanup
    return () => {
      if (routingControlRef.current && map) {
        try {
          map.removeControl(routingControlRef.current);
          routingControlRef.current = null; // Clear the reference
        } catch (e) {
          // This catches the 'removeLayer' of null error
          console.debug("Routing cleanup handled safely.");
        }
      }
    };
  }, [map, userLoc, destination]);

  return null;
};


// Calculates distance in meters between two GPS coordinates
const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stationId, setStationId] = useState('');
  const [password, setPassword] = useState('');
  const [emergencies, setEmergencies] = useState([]);
  const [activeRoute, setActiveRoute] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const [hideBanner, setHideBanner] = useState(false);
  

  // --- 3. SOUND & SOCKET LOGIC ---
  useEffect(() => {
    if (isAuthenticated) {
      // Get Dashboard's real-time location
      navigator.geolocation.getCurrentPosition((pos) => {
        setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, (err) => alert("Please allow location access to use the Dispatcher!"), 
      { enableHighAccuracy: true });

      socket.on('load_past_incidents', (data) => setEmergencies(data));

      socket.on('new_emergency', (data) => {
        setEmergencies(prev => [data, ...prev]);
        setHideBanner(false);

        // Play the alert sound
        const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        alertSound.play().catch(e => console.log("Sound interaction required"));
      });
    }
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    setIsAuthenticated(true);
    // Unlocks audio for the browser
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 0;
    audio.play().catch(() => {});
  };

  // --- 4. LOGIN UI (Split Panel) ---
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col md:flex-row h-screen w-full bg-[#111111]">
        {/* Left branding panel */}
        <div className="md:w-1/2 h-full bg-gradient-to-br from-[#2b0000] via-[#1a0000] to-black flex flex-col justify-center items-center p-12 text-center border-r border-white/5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#ff0f7b] to-[#f89b29] flex items-center justify-center shadow-[0_0_40px_rgba(229,9,20,0.4)] mb-6">
             <span className="text-4xl text-white">🛡️</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tighter">Authority Dashboard</h1>
          <p className="text-slate-400 max-w-sm">Advanced Emergency Response System for real-time crisis management.</p>
        </div>
        {/* Right login panel */}
        <div className="md:w-1/2 flex items-center justify-center p-8">
          <form onSubmit={handleLogin} className="w-full max-w-sm bg-[#1a1a1a] p-10 rounded-3xl border border-white/5 shadow-2xl">
            <h2 className="text-3xl font-bold text-white mb-2">Sign In</h2>
            <p className="text-slate-500 mb-8 text-sm">Enter Station ID to access Mission Control.</p>
            <input type="text" placeholder="Station ID" value={stationId} onChange={e => setStationId(e.target.value)} className="w-full bg-black/30 border border-white/10 p-4 rounded-xl text-white mb-4 focus:border-red-600 outline-none transition-all" />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black/30 border border-white/10 p-4 rounded-xl text-white mb-8 focus:border-red-600 outline-none transition-all" />
            <button className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-[0_10px_20px_rgba(229,9,20,0.3)] transition-all active:scale-95">ACCESS DASHBOARD</button>
          </form>
        </div>
      </div>
    );
  }



  // HOTSPOT DETECTION LOGIC: Checks if > 5 emergencies are within 500m
  const isCriticalHotspot = emergencies.some(targetEm => {
    const nearbyCount = emergencies.filter(em => 
      getDistanceInMeters(targetEm.lat, targetEm.lng, em.lat, em.lng) <= 500
    ).length;
    return nearbyCount > 5;
  });

  // --- 5. MAIN DASHBOARD UI ---
  return (
    <div className="flex flex-col h-screen font-sans bg-[#f8fafc]">
      {/* Premium Header */}
      <header className="h-20 bg-[#0f172a] text-white flex items-center justify-between px-8 shadow-2xl z-50 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="text-3xl"></div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">DISASTER Control</h1>
            <p className="text-[10px] text-slate-400 tracking-[0.2em] uppercase font-bold italic">Station: {stationId || "ADMIN"}</p>
          </div>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="text-xs font-bold border border-white/20 px-5 py-2 rounded-full hover:bg-white/10 transition-all">LOGOUT SYSTEM ←</button>
      </header>

      {isCriticalHotspot && !hideBanner &&(
        <div className="bg-red-600 animate-pulse text-white text-center py-3 px-4 font-black tracking-widest uppercase border-b-4 border-black z-50 shadow-2xl">
          ⚠️ CRITICAL EMERGENCY HOTSPOT DETECTED (5+ REPORTS IN 500M) - DEPLOY ALL UNITS ASAP ⚠️
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[400px] bg-white border-r border-slate-200 flex flex-col shadow-2xl">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-800 tracking-tight italic">🚨 ACTIVE ALERTS</h2>
            <div className="bg-red-600 text-white text-xs px-3 py-1 rounded-full animate-pulse">{emergencies.length} INCIDENTS</div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {emergencies.map((em, i) => (
              <div key={i} 
                   className={`p-5 rounded-3xl border-2 transition-all cursor-pointer ${activeRoute === em ? 'bg-red-600 border-transparent shadow-2xl scale-[1.02]' : 'bg-white border-slate-100 shadow-sm hover:border-red-200'}`}
                   onClick={() => {
                 setActiveRoute(em);
                 setHideBanner(true);
                 socket.emit('acknowledge_alert'); // 👈 THIS SENDS THE SIGNAL TO THE PHONE
               }}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className={`font-black text-xl italic ${activeRoute === em ? 'text-white' : 'text-red-600'}`}>
                    {em.type ? em.type.toUpperCase() : "GENERAL"} ALERT
                  </h3>
                  <span className={`text-[10px] font-bold ${activeRoute === em ? 'text-white/60' : 'text-slate-400'}`}>JUST NOW</span>
                </div>
                <p className={`text-xs font-mono mb-2 ${activeRoute === em ? 'text-white/80' : 'text-slate-500'}`}>
  COORD: {em.lat.toFixed(5)}, {em.lng.toFixed(5)}
</p>

{/* NEW: VISUAL INTEL (PHOTO) DISPLAY */}
{em.imageBase64 && (
  <div className="mb-4">
    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${activeRoute === em ? 'text-white/60' : 'text-slate-400'}`}>
      📷 VISUAL INTEL
    </p>
    <img 
      // Expo sends raw base64, so we must add the data URI prefix for the web to read it!
      src={`data:image/jpeg;base64,${em.imageBase64}`} 
      alt="Emergency Scene" 
      className="w-full h-32 object-cover rounded-xl border border-white/20 shadow-inner"
    />
  </div>
)}


                {/* DYNAMIC DISPATCH & RESOLVE BUTTONS */}
                {activeRoute === em ? (
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1 py-3 bg-white text-red-600 rounded-xl text-center text-[10px] font-black tracking-widest uppercase border-2 border-red-600 shadow-inner">
                      🗺️ ROUTING...
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation(); // Prevents the card from clicking again
                        setEmergencies(prev => prev.filter(item => item !== em)); // Removes from list
                        setActiveRoute(null); // Clears the map route
                      }}
                      className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-center text-[10px] font-black tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(0,230,118,0.4)]"
                    >
                      ✅ RESOLVED
                    </button>
                  </div>
                ) : (
                  <div className="w-full py-3 mt-2 bg-red-600 text-white rounded-xl text-center text-xs font-black tracking-widest uppercase shadow-md">
                    ⚡ DISPATCH NOW
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Map View */}
        <div className="flex-1 relative">
          <MapContainer center={myLocation || [20.5937, 78.9629]} zoom={14} className="h-full w-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
            
            {/* Dashboard Marker */}
            {myLocation && (
  <Marker 
    position={[myLocation.lat, myLocation.lng]} 
    icon={L.divIcon({
      className: 'user-marker',
      html: `
        <div style="
          font-size: 35px; 
          filter: drop-shadow(0 0 10px rgba(52, 152, 219, 0.8));
          background: white;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          display: flex;
          justify-content: center;
          align-items: center;
          border: 3px solid #3498db;
        ">🚑</div>`,
      iconSize: [50, 50],
      iconAnchor: [25, 25]
    })}
  >
    <Popup className="custom-popup">
      <div className="font-bold text-blue-600 text-center">ADMIN CONTROL</div>
    </Popup>
  </Marker>
)}

            {/* Emergency Markers with Smart Icons */}
            {emergencies.map((em, i) => (
              <Marker key={i} position={[em.lat, em.lng]} icon={getIncidentIcon(em.type)}>
                <Popup><b>{em.type} Emergency</b><br/>Status: Dispatch Pending</Popup>
              </Marker>
            ))}

            {/* Live Routing Line */}
            {activeRoute && <RoutingMachine userLoc={myLocation} destination={activeRoute} />}
          </MapContainer>
        </div>
      </div>

      {/* 👇 ADD THIS NEW FOOTER SECTION 👇 */}
      <footer className="bg-[#0f172a] text-center py-2 border-t border-white/10 z-50">
        <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">
          Made with ❤️ by <span className="text-red-500">Tech_Titans</span>
        </p>
      </footer>
      {/* 👆 END OF FOOTER 👆 */}
    </div>
  );
}

export default App;



























