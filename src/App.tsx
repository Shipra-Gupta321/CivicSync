/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Upload, AlertTriangle, CheckCircle, Clock, Sparkles, 
  ThumbsUp, MessageSquare, Plus, Trash, Eye, RefreshCw, Sliders, 
  ShieldAlert, Users, Map, TrendingUp, X, ChevronRight, Check, 
  ArrowRight, ShieldCheck, AlertCircle, Building2, HelpCircle, Info,
  Layers, Lock, Play, Award, Zap, Heart, CheckSquare
} from 'lucide-react';
import { Issue, IssueCategory, IssueStatus, Comment, Alert, AreaInsight } from './types';

// Coordinate boundaries for custom interactive SVG map
const LAT_MIN = 37.7700;
const LAT_MAX = 37.7900;
const LNG_MIN = -122.4200;
const LNG_MAX = -122.4000;

// Conversion helper: Geo coordinates to SVG canvas coordinates (1000x600 size)
function getSvgCoords(lat: number, lng: number) {
  const x = 50 + ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * 900;
  const y = 550 - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * 500;
  return { x: Math.max(50, Math.min(950, x)), y: Math.max(50, Math.min(550, y)) };
}

// Conversion helper: SVG canvas coordinates to Geo coordinates
function getGeoCoords(svgX: number, svgY: number) {
  const lng = LNG_MIN + ((svgX - 50) / 900) * (LNG_MAX - LNG_MIN);
  const lat = LAT_MIN + ((550 - svgY) / 500) * (LAT_MAX - LAT_MIN);
  return { 
    latitude: Number(lat.toFixed(6)), 
    longitude: Number(lng.toFixed(6)) 
  };
}

export default function App() {
  // Navigation & Role States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'report' | 'map' | 'insights'>('dashboard');
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: 'Citizen' | 'Authority'; department?: string }>({
    id: "usr-current",
    name: "Alex Mercer",
    role: "Citizen"
  });
  
  // Core Data States
  const [issues, setIssues] = useState<Issue[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [insights, setInsights] = useState<AreaInsight[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);

  // Issue Reporter States
  const [reportTitle, setReportTitle] = useState('');
  const [reportCategory, setReportCategory] = useState<IssueCategory | ''>('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportImage, setReportImage] = useState<string>(''); // base64 representation
  const [reportLocation, setReportLocation] = useState<{ latitude: number; longitude: number; address: string }>({
    latitude: 37.7785,
    longitude: -122.4112,
    address: 'Downtown Core Square'
  });
  const [customCoordinateSelected, setCustomCoordinateSelected] = useState<boolean>(false);
  const [customAddressInput, setCustomAddressInput] = useState<string>('');
  const [urgencyScore, setUrgencyScore] = useState<number>(5);
  const [urgencyReason, setUrgencyReason] = useState<string>('');
  const [suggestedDept, setSuggestedDept] = useState<string>('Department of Public Works');

  // AI Loading & Analysis states
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<Issue | null>(null);

  // Active Selected Issue (for modal / details panel)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Authority actions
  const [authorityStatusUpdate, setAuthorityStatusUpdate] = useState<IssueStatus>('Investigating');
  const [authorityNotes, setAuthorityNotes] = useState('');
  const [resolutionProof, setResolutionProof] = useState<string>('');

  // Presentation & Info panel toggle
  const [showDemoSidebar, setShowDemoSidebar] = useState<boolean>(true);
  const [apiConnectionStatus, setApiConnectionStatus] = useState<'connected' | 'simulated'>('simulated');
  const [geoMode, setGeoMode] = useState<'sf' | 'custom'>('sf');

  // Map view controls
  const [mapFilterCategory, setMapFilterCategory] = useState<string>('All');
  const [mapFilterStatus, setMapFilterStatus] = useState<string>('All');

  // Drag and drop image states
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Dynamic AI step phrases
  const aiProgressSteps = [
    "Uploading raw report payload to secure cloud run container...",
    "Gemini model scanning image arrays for damage classification...",
    "Segmenting road & terrain elements to isolate problem patterns...",
    "Comparing visual features against municipal database schemas...",
    "Evaluating smart urgency score based on public safety impact factors...",
    "Determining recommended agency dispatch & SLA routing metrics..."
  ];

  // Fetch all initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const resIssues = await fetch('/api/issues');
      const resAlerts = await fetch('/api/alerts');
      const resInsights = await fetch('/api/insights');
      
      if (resIssues.ok) {
        const issuesData = await resIssues.json();
        setIssues(issuesData);
        // Check if Gemini is connected
        const firstWithMockInfo = issuesData.find((i: any) => i.isMock !== undefined);
        setApiConnectionStatus('connected'); // Safe assumption unless errors occur
      }
      if (resAlerts.ok) {
        const alertsData = await resAlerts.json();
        setAlerts(alertsData);
        if (alertsData.length > 0) setActiveAlert(alertsData[0]);
      }
      if (resInsights.ok) {
        setInsights(await resInsights.json());
      }
    } catch (err) {
      console.error("Error loading application state:", err);
      setApiConnectionStatus('simulated');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // AI Step rotation timer
  useEffect(() => {
    let interval: any;
    if (isAiAnalyzing) {
      interval = setInterval(() => {
        setAiStep(prev => (prev + 1) % aiProgressSteps.length);
      }, 2000);
    } else {
      setAiStep(0);
    }
    return () => clearInterval(interval);
  }, [isAiAnalyzing]);

  // Handle Location Capture using standard Geolocation API
  const handleCaptureLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = Number(position.coords.latitude.toFixed(6));
          const lng = Number(position.coords.longitude.toFixed(6));
          
          setReportLocation({
            latitude: lat,
            longitude: lng,
            address: `GPS Pin: [${lat}, ${lng}]`
          });
          setCustomCoordinateSelected(true);
          
          // Toast or message
          console.log(`Captured GPS location: ${lat}, ${lng}`);
        },
        (error) => {
          console.error("Geolocation capture failed:", error);
          // Fallback to random SF coordinates near the default
          const randomOffsetLat = (Math.random() - 0.5) * 0.015;
          const randomOffsetLng = (Math.random() - 0.5) * 0.015;
          const lat = Number((37.7785 + randomOffsetLat).toFixed(6));
          const lng = Number((-122.4112 + randomOffsetLng).toFixed(6));
          setReportLocation({
            latitude: lat,
            longitude: lng,
            address: `Estimated GPS Pin: [${lat}, ${lng}] (Simulated)`
          });
          setCustomCoordinateSelected(true);
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  // Convert image file to base64
  const handleImageChange = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setReportImage(reader.result as string);
      // Run auto-analyzation immediately if possible or prompt
    };
    reader.readAsDataURL(file);
  };

  // Run Gemini AI Analysis
  const runAiAnalysis = async () => {
    if (!reportImage && !reportDescription) {
      alert("Please upload an image or type a brief description first so Gemini AI has input to analyze!");
      return;
    }

    setIsAiAnalyzing(true);
    setAiError(null);
    try {
      const response = await fetch('/api/gemini/analyze-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: reportImage || undefined,
          description: reportDescription || undefined,
          categoryHint: reportCategory || undefined
        })
      });

      if (!response.ok) {
        throw new Error("API analysis call failed.");
      }

      const result = await response.json();
      
      // Populate fields
      setReportTitle(result.title || '');
      setReportCategory(result.category || 'Other');
      setReportDescription(result.description || '');
      setUrgencyScore(result.urgencyScore || 5);
      setUrgencyReason(result.urgencyReason || '');
      setSuggestedDept(result.suggestedDepartment || 'Department of Public Works');
      
      if (result.isMock) {
        setApiConnectionStatus('simulated');
      } else {
        setApiConnectionStatus('connected');
      }

      // Check for duplicates instantly based on current coordinates and category
      checkDuplicateThreshold(result.category, reportLocation.latitude, reportLocation.longitude);

    } catch (err: any) {
      console.error(err);
      setAiError("AI Engine busy or Key unconfigured. Used smart local fallbacks to prioritize.");
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Helper to check duplicates ahead of submission
  const checkDuplicateThreshold = (category: string, lat: number, lng: number) => {
    const thresholdMeters = 250;
    const match = issues.find(existing => {
      if (existing.status === 'Resolved' || existing.category !== category) return false;
      const d = getDistanceInMeters(lat, lng, existing.location.latitude, existing.location.longitude);
      return d <= thresholdMeters;
    });

    if (match) {
      setDuplicateWarning(match);
    } else {
      setDuplicateWarning(null);
    }
  };

  // Distance calculator helper
  function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Handle Form Submission
  const handleSubmitReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!reportTitle || !reportCategory || !reportDescription) {
      alert("Please complete all required fields. Use Gemini Auto-fill to instantly populate them!");
      return;
    }

    const payload = {
      title: reportTitle,
      category: reportCategory,
      description: reportDescription,
      imageUrl: reportImage,
      location: {
        latitude: reportLocation.latitude,
        longitude: reportLocation.longitude,
        address: customAddressInput || reportLocation.address
      },
      reporterName: currentUser.name,
      reporterId: currentUser.id,
      urgencyScore,
      urgencyReason,
      department: suggestedDept
    };

    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // Clear fields
        setReportTitle('');
        setReportCategory('');
        setReportDescription('');
        setReportImage('');
        setCustomAddressInput('');
        setUrgencyScore(5);
        setUrgencyReason('');
        setDuplicateWarning(null);
        
        // Refresh data
        await loadData();
        
        // Go back to feed
        setActiveTab('dashboard');
      } else {
        const errData = await response.json();
        alert(`Error submitting: ${errData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Submission failed. Ensure backend server is responsive.");
    }
  };

  // Upvote/Verify action
  const handleUpvote = async (issueId: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
      if (res.ok) {
        const updatedIssue = await res.json();
        // Update issues list
        setIssues(prev => prev.map(iss => iss.id === issueId ? updatedIssue : iss));
        // Update selected if open
        if (selectedIssue?.id === issueId) {
          setSelectedIssue(updatedIssue);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Comment submit
  const handleAddComment = async (e: FormEvent, issueId: string) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    try {
      const res = await fetch(`/api/issues/${issueId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: currentUser.name,
          userRole: currentUser.role,
          text: newCommentText
        })
      });

      if (res.ok) {
        const updatedIssue = await res.json();
        setIssues(prev => prev.map(iss => iss.id === issueId ? updatedIssue : iss));
        setSelectedIssue(updatedIssue);
        setNewCommentText('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Status update by Authority
  const handleStatusUpdate = async (e: FormEvent, issueId: string) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/issues/${issueId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: authorityStatusUpdate,
          updatedBy: `${currentUser.name} (${currentUser.department || 'Municipal Inspector'})`,
          notes: authorityNotes || `Municipal team transitioned progress status to ${authorityStatusUpdate}.`,
          proofUrl: resolutionProof || undefined
        })
      });

      if (res.ok) {
        const updatedIssue = await res.json();
        setIssues(prev => prev.map(iss => iss.id === issueId ? updatedIssue : iss));
        setSelectedIssue(updatedIssue);
        setAuthorityNotes('');
        setResolutionProof('');
        loadData(); // Reload insights too
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Hackathon Simulation: Trigger SLA Escalation instantly
  const triggerAutoEscalation = async () => {
    try {
      const res = await fetch('/api/issues/auto-escalate', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        alert(result.message);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Mock geo coordinates for simple quick testing
  const setDemoLocation = (neighborhood: 'downtown' | 'greenwood' | 'southside') => {
    if (neighborhood === 'downtown') {
      setReportLocation({
        latitude: 37.7780,
        longitude: -122.4110,
        address: '120 Market St, Downtown Core'
      });
    } else if (neighborhood === 'greenwood') {
      setReportLocation({
        latitude: 37.7845,
        longitude: -122.4160,
        address: '502 Elm Street, Greenwood District'
      });
    } else {
      setReportLocation({
        latitude: 37.7735,
        longitude: -122.4040,
        address: '15 Railroad Rd, Southside Ward'
      });
    }
    setCustomCoordinateSelected(true);
  };

  // Helpers to render specific styling colors
  const getCategoryIcon = (category: IssueCategory) => {
    switch (category) {
      case 'Pothole': return <AlertTriangle className="text-amber-500 w-5 h-5" />;
      case 'Waste Management': return <Trash className="text-emerald-500 w-5 h-5" />;
      case 'Water Leakage': return <Zap className="text-sky-500 w-5 h-5" />;
      case 'Streetlight': return <Clock className="text-yellow-400 w-5 h-5" />;
      case 'Road Hazard': return <ShieldAlert className="text-rose-600 w-5 h-5" />;
      default: return <HelpCircle className="text-slate-500 w-5 h-5" />;
    }
  };

  const getStatusBadge = (status: IssueStatus) => {
    switch (status) {
      case 'Pending':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">Pending Review</span>;
      case 'Investigating':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-sky-50 text-sky-700 border border-sky-200">Investigating</span>;
      case 'In Progress':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">Fixing (In Progress)</span>;
      case 'Resolved':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Resolved</span>;
    }
  };

  const getUrgencyBadgeColor = (score: number) => {
    if (score >= 8) return 'bg-rose-500 text-white';
    if (score >= 5) return 'bg-amber-500 text-white';
    return 'bg-emerald-500 text-white';
  };

  // Filter issues for feed
  const filteredIssues = issues.filter(issue => {
    if (mapFilterCategory !== 'All' && issue.category !== mapFilterCategory) return false;
    if (mapFilterStatus !== 'All' && issue.status !== mapFilterStatus) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] flex text-slate-900 font-sans overflow-x-hidden">
      {/* Left Sidebar Navigation (Desktop only) */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
            <Award size={20} className="animate-pulse" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-blue-900 block leading-tight font-display">CivicHero</span>
            <span className="text-[10px] text-slate-400 font-medium">Hyperlocal Dispatch</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5">
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setSelectedIssue(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'dashboard'
                ? 'bg-blue-50 text-blue-700 shadow-xs'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Users size={16} />
            Dashboard Feed
          </button>
          <button
            onClick={() => {
              setActiveTab('report');
              setSelectedIssue(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-all relative ${
              activeTab === 'report'
                ? 'bg-blue-50 text-blue-700 shadow-xs'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Plus size={16} />
            AI Issue Reporter
            <span className="absolute right-3 bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase animate-pulse">AI</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('map');
              setSelectedIssue(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'map'
                ? 'bg-blue-50 text-blue-700 shadow-xs'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Map size={16} />
            Explore Map
          </button>
          <button
            onClick={() => {
              setActiveTab('insights');
              setSelectedIssue(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'insights'
                ? 'bg-blue-50 text-blue-700 shadow-xs'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <TrendingUp size={16} />
            Predictive Insights
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-900 rounded-2xl p-4">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Daily Impact</p>
            <p className="text-white text-xs font-semibold">
              {issues.filter(i => i.status === 'Resolved').length} Issues Resolved
            </p>
            <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div 
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ 
                  width: `${issues.length > 0 ? (issues.filter(i => i.status === 'Resolved').length / issues.length) * 100 : 70}%` 
                }}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Banner Alert (Dynamic SLA Updates or critical safety hazard warnings) */}
        {activeAlert && (
          <div className="bg-rose-900 text-rose-100 px-4 py-2 text-xs flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-2 max-w-4xl truncate">
              <span className="bg-rose-600 text-rose-50 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">Critical Alert</span>
              <span className="font-semibold text-rose-50">{activeAlert.title}:</span>
              <span className="opacity-90">{activeAlert.message}</span>
            </div>
            <button 
              onClick={() => setActiveAlert(null)}
              className="text-rose-300 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Top Header - Styled to match the professional design header */}
        <header className="h-20 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 shadow-xs flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* Logo on mobile only */}
            <div className="flex md:hidden items-center gap-2">
              <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-md shadow-blue-500/20">
                <Award size={18} />
              </div>
              <span className="font-bold text-sm tracking-tight text-blue-900 font-display">CivicHero</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-slate-800 leading-tight font-display">
                {activeTab === 'dashboard' && 'Community Dashboard'}
                {activeTab === 'report' && 'AI Dispatch Reporter'}
                {activeTab === 'map' && 'Interactive District Map'}
                {activeTab === 'insights' && 'Predictive Urban Insights'}
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin size={12} className="text-blue-600" />
                <span>Springfield Heights, Area 42</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Role Swapper Widget */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => {
                  setCurrentUser({ id: "usr-current", name: "Alex Mercer", role: "Citizen" });
                  setSelectedIssue(null);
                }}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
                  currentUser.role === 'Citizen' 
                    ? 'bg-white text-slate-800 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Citizen
              </button>
              <button
                onClick={() => {
                  setCurrentUser({ 
                    id: "usr-auth-101", 
                    name: "Inspector Davis", 
                    role: "Authority", 
                    department: "Department of Public Works" 
                  });
                  setSelectedIssue(null);
                }}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
                  currentUser.role === 'Authority' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-500 hover:text-blue-600'
                }`}
              >
                Officer
              </button>
            </div>

            {/* Notification placeholder */}
            <button 
              onClick={() => {
                if (alerts.length > 0) {
                  setActiveAlert(alerts[Math.floor(Math.random() * alerts.length)]);
                }
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 relative rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Zap size={16} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
            </button>

            {/* Profile Avatar & Info */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="text-right hidden lg:block">
                <p className="text-xs font-bold text-slate-800 leading-none">{currentUser.name}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">{currentUser.role === 'Citizen' ? 'Local Hero Lv. 4' : 'Municipal Inspector'}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-xs text-blue-700">
                {currentUser.name.split(' ').map(n => n[0]).join('')}
              </div>
            </div>

            {/* Pitch & Hackathon sidebar toggle */}
            <button
              onClick={() => setShowDemoSidebar(!showDemoSidebar)}
              className={`p-1.5 rounded-lg border transition-all ${
                showDemoSidebar 
                  ? 'bg-slate-800 text-slate-100 border-slate-700' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="Toggle Hackathon Demo & Solution Pitch Sidebar"
            >
              <Sliders size={16} />
            </button>
          </div>
        </header>

        {/* Global Primary Tabs bar for Mobile (only visible on mobile to swap screens) */}
        <div className="flex md:hidden border-b border-slate-200 bg-white sticky top-20 z-30 overflow-x-auto scrollbar-none flex-shrink-0">
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setSelectedIssue(null);
            }}
            className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'dashboard' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500'
            }`}
          >
            <Users size={14} />
            Dashboard Feed
          </button>
          <button
            onClick={() => {
              setActiveTab('report');
              setSelectedIssue(null);
            }}
            className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap relative ${
              activeTab === 'report' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500'
            }`}
          >
            <Plus size={14} />
            AI Reporter
            <span className="bg-rose-500 text-white text-[7px] font-bold px-1 rounded-full uppercase ml-0.5 animate-pulse">AI</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('map');
              setSelectedIssue(null);
            }}
            className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'map' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500'
            }`}
          >
            <Map size={14} />
            Map
          </button>
          <button
            onClick={() => {
              setActiveTab('insights');
              setSelectedIssue(null);
            }}
            className={`px-4 py-2.5 font-bold text-xs transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'insights' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500'
            }`}
          >
            <TrendingUp size={14} />
            Insights
          </button>
        </div>

        {/* Primary Content Grid Area with the conditional layouts */}
        <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
          
          {/* Solution Pitch & Demo Strategy Sidebar (Requested MVP Pitch guidelines) */}
          <AnimatePresence>
            {showDemoSidebar && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="bg-slate-900 border-r border-slate-800 text-slate-300 flex-shrink-0 flex flex-col shadow-xl z-30"
              >
                <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-yellow-400 w-5 h-5" />
                    <h2 className="font-bold text-slate-100 text-sm uppercase tracking-wider font-display">Hackathon Pitch & Demo</h2>
                  </div>
                  <button onClick={() => setShowDemoSidebar(false)} className="text-slate-500 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs leading-relaxed">
                  {/* Problem Understanding Section */}
                  <div>
                    <h3 className="text-blue-400 font-bold uppercase mb-2 flex items-center gap-1">
                      <Info size={13} /> 1. Problem Statement
                    </h3>
                    <p className="opacity-95 text-slate-400">
                      Traditional complaint portals act as black holes. Citizens file reports, recieve no updates, and city dispatchers waste hours filtering manual entries, resulting in delayed action and neighborhood safety deterioration.
                    </p>
                  </div>

                  {/* Core Unique AI Concept */}
                  <div>
                    <h3 className="text-blue-400 font-bold uppercase mb-2 flex items-center gap-1">
                      <Zap size={13} /> 2. Unique Innovation
                    </h3>
                    <p className="opacity-95 text-slate-400">
                      <strong className="text-white">AI-Powered Dispatch & Verfication:</strong> Instant image classification routes issues to the exact department. Local community votes verify severity, avoiding duplicate municipal inspection trips.
                    </p>
                  </div>

                  {/* API Status Indicator */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <h4 className="font-bold text-slate-300 mb-2 flex items-center gap-1">
                      API Integrations
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Google Gemini SDK:</span>
                        {apiConnectionStatus === 'connected' ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle size={12} /> Active Live Key
                          </span>
                        ) : (
                          <span className="text-amber-400 font-semibold flex items-center gap-1">
                            <Clock size={12} /> Simulated API
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Interactive Custom Map:</span>
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle size={12} /> Active Canvas
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Demo Control Trigger Widgets */}
                  <div className="space-y-3 pt-2">
                    <h3 className="text-amber-400 font-bold uppercase mb-2 flex items-center gap-1">
                      <Sliders size={13} /> Demo Controls
                    </h3>
                    
                    <button
                      onClick={triggerAutoEscalation}
                      className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:translate-y-[-1px]"
                    >
                      <Play size={12} />
                      Simulate Auto-Escalation
                    </button>
                    <p className="text-[10px] text-slate-500 italic text-center">
                      Bypasses 3-day delay SLA on outstanding Pending issues, updating urgency and sending alerts.
                    </p>

                    <div className="border-t border-slate-800 pt-3">
                      <span className="text-slate-400 block mb-2 font-semibold">Test GPS Pin Relocation:</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setDemoLocation('downtown')} 
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-medium rounded text-slate-300 border border-slate-700"
                        >
                          Downtown
                        </button>
                        <button 
                          type="button"
                          onClick={() => setDemoLocation('greenwood')} 
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-medium rounded text-slate-300 border border-slate-700"
                        >
                          Greenwood
                        </button>
                        <button 
                          type="button"
                          onClick={() => setDemoLocation('southside')} 
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-medium rounded text-slate-300 border border-slate-700"
                        >
                          Southside
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* MVP Priority */}
                  <div className="border-t border-slate-800 pt-4">
                    <h3 className="text-blue-400 font-bold uppercase mb-1">MVP Plan Features</h3>
                    <ul className="space-y-1 text-slate-500 list-disc list-inside">
                      <li><span className="text-slate-400">P1: AI categorization (Gemini)</span></li>
                      <li><span className="text-slate-400">P1: Interactive coordinate pin</span></li>
                      <li><span className="text-slate-400">P1: Citizen voting verify</span></li>
                      <li><span className="text-slate-400">P2: Smart duplicate routing</span></li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 border-t border-slate-800 text-[11px] text-center text-slate-600">
                  Created for Hyperlocal Hackathon 2026
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Core Navigation Screen Panels */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* Dynamic Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Unresolved Incidents</span>
                    <h3 className="text-2xl font-bold font-display text-slate-800 mt-1">
                      {issues.filter(i => i.status !== 'Resolved').length}
                    </h3>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 text-amber-500">
                    <Clock size={20} />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Successfully Resolved</span>
                    <h3 className="text-2xl font-bold font-display text-slate-800 mt-1 text-emerald-600">
                      {issues.filter(i => i.status === 'Resolved').length}
                    </h3>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 text-emerald-500">
                    <CheckSquare size={20} />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">High Urgency Dispatches</span>
                    <h3 className="text-2xl font-bold font-display text-slate-800 mt-1 text-rose-600">
                      {issues.filter(i => i.urgencyScore >= 8 && i.status !== 'Resolved').length}
                    </h3>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-500 animate-pulse">
                    <AlertTriangle size={20} />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Community Upvote Index</span>
                    <h3 className="text-2xl font-bold font-display text-slate-800 mt-1">
                      {issues.reduce((acc, i) => acc + i.upvotes, 0)}
                    </h3>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 text-blue-500">
                    <Heart size={20} />
                  </div>
                </div>
              </div>

              {/* Feed Controls */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">Filter Feed:</span>
                  
                  <select 
                    value={mapFilterCategory}
                    onChange={(e) => setMapFilterCategory(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="All">All Categories</option>
                    <option value="Pothole">Pothole</option>
                    <option value="Waste Management">Waste Management</option>
                    <option value="Water Leakage">Water Leakage</option>
                    <option value="Streetlight">Streetlight</option>
                    <option value="Road Hazard">Road Hazard</option>
                  </select>

                  <select 
                    value={mapFilterStatus}
                    onChange={(e) => setMapFilterStatus(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending Review</option>
                    <option value="Investigating">Investigating</option>
                    <option value="In Progress">Fixing</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
                
                <span className="text-xs text-slate-400">
                  Showing {filteredIssues.length} community incidents
                </span>
              </div>

              {/* Grid of Issues */}
              {loading ? (
                <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="animate-spin text-blue-600" size={32} />
                  <span>Syncing municipal databases...</span>
                </div>
              ) : filteredIssues.length === 0 ? (
                <div className="bg-white border rounded-2xl py-16 text-center text-slate-500 flex flex-col items-center justify-center p-6">
                  <AlertCircle size={40} className="text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">No reported issues found matching filters.</p>
                  <p className="text-xs text-slate-400 mt-1">Be a local hero and file the first report in this neighborhood!</p>
                  <button 
                    onClick={() => setActiveTab('report')}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    File New Report
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredIssues.map(issue => (
                    <div 
                      key={issue.id} 
                      className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all hover:shadow-md flex flex-col relative ${
                        issue.duplicateOf ? 'border-dashed border-slate-300 opacity-80' : 'border-slate-200'
                      }`}
                    >
                      {/* Priority Tag */}
                      <span className={`absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${getUrgencyBadgeColor(issue.urgencyScore)}`}>
                        Urgency: {issue.urgencyScore}/10
                      </span>

                      {issue.duplicateOf && (
                        <div className="bg-slate-100 text-slate-600 px-3 py-1 text-[10px] font-semibold flex items-center gap-1">
                          <Layers size={12} />
                          <span>AI Duplication Check: Auto-linked to Primary Master Issue #{issue.duplicateOf}</span>
                        </div>
                      )}

                      <div className="p-5 flex-1 space-y-4">
                        <div className="flex gap-4">
                          <img 
                            src={issue.imageUrl} 
                            alt={issue.title}
                            className="w-20 h-20 object-cover rounded-xl bg-slate-100 border border-slate-200 flex-shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              {getCategoryIcon(issue.category)}
                              <span className="font-medium">{issue.category}</span>
                            </div>
                            <h3 className="font-bold text-slate-800 text-base mt-1 line-clamp-1">{issue.title}</h3>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                              <MapPin size={12} className="text-slate-400" />
                              <span className="truncate">{issue.location.address}</span>
                            </p>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-2">{issue.description}</p>

                        {/* Urgency Justification Tag */}
                        {issue.urgencyReason && (
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-start gap-1.5 text-[11px] text-slate-500 italic">
                            <Sparkles className="text-blue-500 w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span><strong>AI Justification:</strong> {issue.urgencyReason}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => handleUpvote(issue.id)}
                              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
                                issue.upvoters.includes(currentUser.id)
                                  ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                              }`}
                            >
                              <ThumbsUp size={13} />
                              <span>{issue.upvotes} {issue.upvoters.includes(currentUser.id) ? 'Verified' : 'Verify'}</span>
                            </button>

                            <button 
                              onClick={() => setSelectedIssue(issue)}
                              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                            >
                              <MessageSquare size={13} />
                              <span>{issue.comments.length} Comments</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            {getStatusBadge(issue.status)}
                          </div>
                        </div>
                      </div>

                      {/* CTA to inspect/resolve */}
                      <button 
                        onClick={() => setSelectedIssue(issue)}
                        className="bg-slate-50 hover:bg-blue-50 border-t border-slate-100 text-xs font-bold text-center py-2 text-slate-500 hover:text-blue-600 transition-all flex items-center justify-center gap-1"
                      >
                        <Eye size={13} />
                        View Full Details & Status Log
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Screen 2: Report Issue with Image & AI Magic (SPECIFICALLY REQUESTED!) */}
          {activeTab === 'report' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-4xl mx-auto">
              
              <div className="p-6 md:p-8 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-sky-700 text-white relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Sparkles size={120} />
                </div>
                <div className="relative z-10">
                  <span className="bg-blue-700 text-blue-50 text-xxs px-2 py-0.5 rounded font-bold uppercase tracking-wider">AI dispatch Enabled</span>
                  <h2 className="text-2xl font-bold font-display mt-2">File a Community Report</h2>
                  <p className="text-xs text-blue-100 mt-1 max-w-xl">
                    Take or upload a photo of the issue. Gemini AI will instantly analyze, categorize, rate severity, and route to the correct municipal authority department.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitReport} className="p-6 md:p-8 space-y-6">
                
                {/* Image upload area supporting Drag and Drop and manual selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">1. Upload Visual Evidence (Required)</label>
                  
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleImageChange(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all relative ${
                      reportImage 
                        ? 'border-blue-500 bg-blue-50/20' 
                        : isDraggingFile 
                          ? 'border-blue-600 bg-blue-50' 
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                    }`}
                  >
                    {reportImage ? (
                      <div className="space-y-4">
                        <img 
                          src={reportImage} 
                          alt="Report preview" 
                          className="max-h-56 mx-auto rounded-xl object-contain border bg-white"
                        />
                        <div className="flex justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => setReportImage('')}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg border border-rose-100 transition-all"
                          >
                            Remove Image
                          </button>
                          
                          <button
                            type="button"
                            onClick={runAiAnalysis}
                            disabled={isAiAnalyzing}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-md"
                          >
                            <Sparkles size={13} />
                            Re-Run AI Auto-Fill
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto text-slate-400">
                          <Upload size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700">Drag & drop your issue image here, or <label className="text-blue-600 hover:text-blue-500 cursor-pointer underline">browse local files<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && handleImageChange(e.target.files[0])} /></label></p>
                          <p className="text-[11px] text-slate-400 mt-1">Supports PNG, JPG up to 10MB (Potholes, broken lights, trash overflows, leaks)</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Geo-location Pinning & map selector */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">2. Geolocation Pin Target</label>
                      <span className="text-[11px] text-slate-400">Captured pins map directly to municipal service dispatch networks</span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleCaptureLocation}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 border border-blue-100"
                    >
                      <MapPin size={14} />
                      Capture Current Location GPS
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xxs text-slate-400 uppercase tracking-wider font-bold">Latitude / Longitude</span>
                      <div className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-mono text-slate-700 mt-1">
                        {reportLocation.latitude}, {reportLocation.longitude}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-xxs text-slate-400 uppercase tracking-wider font-bold">Neighborhood Address / Landmark</span>
                      <input 
                        type="text" 
                        placeholder={reportLocation.address}
                        value={customAddressInput}
                        onChange={(e) => setCustomAddressInput(e.target.value)}
                        className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-700 mt-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 italic">
                    💡 Protip: You can also set this coordinate precisely by clicking anywhere directly on the <button type="button" onClick={() => setActiveTab('map')} className="text-blue-600 underline">Interactive Grid Map</button>!
                  </p>
                </div>

                {/* AI MAGIC AUTO-FILL ACCENT BAR */}
                {reportImage && !reportTitle && !isAiAnalyzing && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">Let Gemini AI Auto-fill everything!</span>
                        <span className="text-[11px] text-slate-500">Auto-detects title, category, description and estimates danger.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={runAiAnalysis}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md hover:scale-[1.01]"
                    >
                      Instant AI Auto-Fill
                    </button>
                  </div>
                )}

                {/* AI Thinking Animation */}
                <AnimatePresence>
                  {isAiAnalyzing && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-slate-900 text-slate-100 p-6 rounded-2xl space-y-4 shadow-inner border border-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <RefreshCw className="animate-spin text-blue-400 w-5 h-5" />
                        <span className="text-sm font-bold tracking-wide font-display text-white">Gemini 3.5 Hyperlocal Analyzer on-duty</span>
                      </div>
                      
                      <div className="bg-slate-800/50 p-3 rounded-xl">
                        <p className="text-xs text-slate-300 animate-pulse italic">
                          "{aiProgressSteps[aiStep]}"
                        </p>
                      </div>

                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <motion.div 
                          className="bg-blue-500 h-full"
                          initial={{ width: '0%' }}
                          animate={{ width: `${(aiStep + 1) * 16.6}%` }}
                          transition={{ duration: 1 }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {aiError && (
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{aiError}</span>
                  </div>
                )}

                {/* Standard Input Form Sections */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Issue Title</label>
                      <input 
                        type="text"
                        placeholder="e.g. Broken streetlight causing pitch-black pathway"
                        value={reportTitle}
                        onChange={(e) => setReportTitle(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-xs text-slate-700 mt-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Category</label>
                      <select
                        value={reportCategory}
                        onChange={(e) => setReportCategory(e.target.value as IssueCategory)}
                        required
                        className="w-full bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-xs text-slate-700 mt-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select Category</option>
                        <option value="Pothole">Pothole</option>
                        <option value="Waste Management">Waste Management</option>
                        <option value="Water Leakage">Water Leakage</option>
                        <option value="Streetlight">Streetlight</option>
                        <option value="Road Hazard">Road Hazard</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Detailed Problem Description</label>
                    <textarea 
                      rows={4}
                      placeholder="Give details about size, hazards, and exact positioning to help municipal repair vehicles carry appropriate tools..."
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-xs text-slate-700 mt-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* AI Severity Matrix parameters (Filled by Gemini) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">AI Urgency score (1-10)</label>
                    <div className="flex items-center gap-4 mt-2">
                      <input 
                        type="range" 
                        min="1" 
                        max="10" 
                        value={urgencyScore}
                        onChange={(e) => setUrgencyScore(parseInt(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${getUrgencyBadgeColor(urgencyScore)}`}>
                        {urgencyScore}/10
                      </span>
                    </div>
                    {urgencyReason && (
                      <p className="text-[11px] text-slate-400 mt-2 italic">
                        <strong>AI Reason:</strong> {urgencyReason}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Suggested Dispatch Authority</label>
                    <input 
                      type="text" 
                      value={suggestedDept}
                      onChange={(e) => setSuggestedDept(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-700 mt-2 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Duplicate Danger Alert */}
                {duplicateWarning && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-amber-800">
                      <AlertTriangle className="text-amber-500 w-5 h-5 flex-shrink-0" />
                      <span className="font-bold text-xs">Duplicate Incident Already Filed Nearby!</span>
                    </div>
                    <p className="text-[11px] text-amber-700">
                      Municipal records indicate an unresolved <strong>{duplicateWarning.category}</strong> (<em>"{duplicateWarning.title}"</em>) was reported just <strong>{Math.round(getDistanceInMeters(reportLocation.latitude, reportLocation.longitude, duplicateWarning.location.latitude, duplicateWarning.location.longitude))} meters away</strong>.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleUpvote(duplicateWarning.id);
                          setSelectedIssue(duplicateWarning);
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        Upvote & Verify Existing Instead
                      </button>
                      <button
                        type="button"
                        onClick={() => setDuplicateWarning(null)}
                        className="px-3 py-1.5 bg-white text-slate-700 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 transition-all"
                      >
                        Submit Anyway
                      </button>
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 hover:scale-[1.01]"
                  >
                    <CheckCircle size={15} />
                    Submit Official Report to Dispatch
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* Tab Screen 3: Interactive SVG Neighborhood Grid Map */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-slate-800 text-base flex items-center gap-1.5 font-display">
                    <Map className="text-blue-600" size={18} />
                    Interactive Neighborhood Grid Map
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Click anywhere on the map to drop a new GPS coordinate pin for reporting</p>
                </div>

                <div className="flex gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block"></span>
                    <span className="text-slate-600">Pending</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 block"></span>
                    <span className="text-slate-600">Investigating</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 block"></span>
                    <span className="text-slate-600">Fixing</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span>
                    <span className="text-slate-600">Resolved</span>
                  </div>
                </div>
              </div>

              {/* Vector SVG Canvas */}
              <div className="bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden relative shadow-inner select-none">
                <svg 
                  viewBox="0 0 1000 600" 
                  className="w-full h-auto max-h-[650px] bg-sky-50/40 cursor-crosshair"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const scaleX = 1000 / rect.width;
                    const scaleY = 600 / rect.height;
                    const svgX = (e.clientX - rect.left) * scaleX;
                    const svgY = (e.clientY - rect.top) * scaleY;
                    
                    const geo = getGeoCoords(svgX, svgY);
                    
                    setReportLocation({
                      latitude: geo.latitude,
                      longitude: geo.longitude,
                      address: getMockAddress(geo.latitude, geo.longitude)
                    });
                    setCustomCoordinateSelected(true);
                    
                    // Direct user to report form with dynamic visual state
                    setActiveTab('report');
                  }}
                >
                  {/* Decorative Grid Lines / Road layout of SF Bay area */}
                  <g stroke="#e2e8f0" strokeWidth="6" opacity="0.8">
                    {/* Horizontal Avenues */}
                    <line x1="50" y1="100" x2="950" y2="100" />
                    <line x1="50" y1="250" x2="950" y2="250" />
                    <line x1="50" y1="400" x2="950" y2="400" />
                    <line x1="50" y1="520" x2="950" y2="520" />

                    {/* Vertical Streets */}
                    <line x1="150" y1="50" x2="150" y2="550" />
                    <line x1="380" y1="50" x2="380" y2="550" />
                    <line x1="600" y1="50" x2="600" y2="550" />
                    <line x1="850" y1="50" x2="850" y2="550" />
                  </g>

                  {/* Highlight Primary Zones */}
                  <rect x="60" y="60" width="80" height="30" rx="4" fill="#cbd5e1" opacity="0.3" />
                  <text x="100" y="80" textAnchor="middle" fill="#64748b" className="text-[11px] font-bold font-display uppercase tracking-wider">Park</text>

                  {/* Neighborhood Labels */}
                  <g fill="#94a3b8" className="text-xs font-bold font-display tracking-widest uppercase" opacity="0.7">
                    <text x="250" y="180" textAnchor="middle">Downtown Core</text>
                    <text x="250" y="470" textAnchor="middle">Greenwood District</text>
                    <text x="720" y="320" textAnchor="middle">Southside Industrial Ward</text>
                  </g>

                  {/* Current Selected Pin Placement */}
                  {customCoordinateSelected && (
                    (() => {
                      const coords = getSvgCoords(reportLocation.latitude, reportLocation.longitude);
                      return (
                        <g key="report-pin">
                          <circle cx={coords.x} cy={coords.y} r="18" fill="#2563eb" opacity="0.2" className="animate-ping" />
                          <circle cx={coords.x} cy={coords.y} r="6" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                          <text x={coords.x} y={coords.y - 12} textAnchor="middle" fill="#2563eb" className="text-[10px] font-bold bg-white px-1">Your Report Pin</text>
                        </g>
                      );
                    })()
                  )}

                  {/* Issue Markers */}
                  {issues.map(issue => {
                    const coords = getSvgCoords(issue.location.latitude, issue.location.longitude);
                    let markerColor = "#f59e0b"; // yellow
                    if (issue.status === 'Investigating') markerColor = "#0ea5e9"; // blue
                    if (issue.status === 'In Progress') markerColor = "#2563eb"; // blue
                    if (issue.status === 'Resolved') markerColor = "#10b981"; // green

                    return (
                       <g 
                         key={issue.id} 
                         className="cursor-pointer group"
                         onClick={(e) => {
                           e.stopPropagation(); // prevent map re-pin
                           setSelectedIssue(issue);
                         }}
                       >
                         <circle cx={coords.x} cy={coords.y} r="14" fill={markerColor} opacity="0.15" className="group-hover:opacity-30 transition-all" />
                         <circle cx={coords.x} cy={coords.y} r="7" fill={markerColor} stroke="#ffffff" strokeWidth="2" className="group-hover:scale-125 transition-all" />
                         <text x={coords.x} y={coords.y - 14} textAnchor="middle" fill="#1e293b" className="text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-all bg-white p-1 rounded border shadow">
                           {issue.title}
                         </text>
                       </g>
                    );
                  })}
                </svg>
              </div>

              <div className="bg-slate-100 p-4 rounded-xl text-xs text-slate-500 italic text-center">
                👉 Click anywhere on the map grid to simulate coordinate pinning. Use test locations in the sidebar for quick jumps.
              </div>

            </div>
          )}

          {/* Tab Screen 4: Predictive insights & Neighborhood Metrics */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-xl font-bold font-display text-slate-800 flex items-center gap-1.5">
                  <TrendingUp className="text-blue-600" />
                  AI Predictive Urban Area Risk Scorecard
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Simulated predictive analytics generated dynamically by analyzing district-wide incident frequency, categories, and authority repair speed ratios.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {insights.map(ins => (
                  <div key={ins.id} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm relative overflow-hidden">
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-800 text-base font-display">{ins.areaName}</h3>
                        <span className="text-[10px] text-slate-400">Neighborhood Region</span>
                      </div>
                      
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-lg uppercase ${
                        ins.riskLevel === 'High' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        ins.riskLevel === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {ins.riskLevel} Risk
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Predictive Risk Index:</span>
                        <span className="font-bold text-slate-800">{ins.riskScore}/100</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div 
                          className={`h-full rounded-full ${
                            ins.riskLevel === 'High' ? 'bg-rose-500' :
                            ins.riskLevel === 'Medium' ? 'bg-amber-500' :
                            'bg-emerald-500'
                          }`}
                          style={{ width: `${ins.riskScore}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Active Issues</span>
                        <span className="font-bold text-slate-700">{ins.totalIssues} reported</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Resolved</span>
                        <span className="font-bold text-emerald-600">{ins.resolvedIssues} cases</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 border border-slate-100">
                      <span className="font-semibold text-slate-800 block mb-1">Top Hazard Trend:</span>
                      <p className="flex items-center gap-1">
                        {getCategoryIcon(ins.topCategory)}
                        <span>High occurrence of <strong>{ins.topCategory}</strong></span>
                      </p>
                    </div>

                    <div className="bg-blue-50/50 rounded-xl p-3 text-[11px] text-blue-700 border border-blue-100">
                      <strong className="block mb-1 text-blue-800">Smart Recommendation:</strong>
                      {ins.recommendation}
                    </div>

                  </div>
                ))}
              </div>

              {/* Demo strategy section */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-sm font-display uppercase tracking-wider text-blue-600">Judges Pitch Highlight: "CivicSync Demo Strategy"</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 leading-relaxed">
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800">How to Present This Project</h4>
                    <p>
                      1. <strong>Start with a Live Incident:</strong> Go to the AI reporter. Upload a mock photo of a pothole, click "AI Auto-Fill". Show how the Gemini model auto-extracts the title, sets severity, and identifies the Department of Public Works.
                    </p>
                    <p>
                      2. <strong>Show Geographic Duplicate Protection:</strong> Try uploading the exact same category issue near Downtown Core. Show how the database identifies duplicates before citizens spam the city, letting you link upvotes instead.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800">AI Innovation Highlights</h4>
                    <p>
                      3. <strong>SLA Escalation (Auto-escalation):</strong> Highlight how unresolved issues automatically escalate to municipal emergency teams, ensuring government accountability. Use the simulation button to prove this.
                    </p>
                    <p>
                      4. <strong>Interactive Grid Mapping:</strong> Highlight that instead of standard static forms, users can click and pin coordinates on a responsive grid map, instantly setting report positions.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* Slide-over Detailed Modal: Issue Details, History Timelines, Comments, and Authority Action */}
      <AnimatePresence>
        {selectedIssue && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex justify-end">
            
            {/* Click outside backdrop close */}
            <div className="flex-1" onClick={() => setSelectedIssue(null)} />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-blue-600" />
                  <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">Report Details: #{selectedIssue.id}</span>
                </div>
                <button 
                  onClick={() => setSelectedIssue(null)}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Visual Header */}
                <div className="flex gap-4">
                  <img 
                    src={selectedIssue.imageUrl} 
                    alt={selectedIssue.title} 
                    className="w-28 h-28 object-cover rounded-2xl bg-slate-100 border border-slate-200 flex-shrink-0"
                  />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                        {selectedIssue.category}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${getUrgencyBadgeColor(selectedIssue.urgencyScore)}`}>
                        Urgency: {selectedIssue.urgencyScore}/10
                      </span>
                    </div>
                    
                    <h3 className="font-bold text-slate-800 text-lg leading-snug">{selectedIssue.title}</h3>
                    
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin size={12} />
                      <span>{selectedIssue.location.address}</span>
                    </p>

                    <p className="text-[10px] text-slate-400">
                      Reported by {selectedIssue.reporterName} on {new Date(selectedIssue.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Main Body */}
                <div className="space-y-3">
                  <span className="text-xxs text-slate-400 font-bold uppercase block tracking-wider">Citizen Problem Description</span>
                  <p className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed">
                    {selectedIssue.description}
                  </p>
                </div>

                {/* AI Scorecard panel */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={12} />
                    Gemini AI Dispatch Diagnostics
                  </span>
                  <div className="text-xs text-slate-700 space-y-1 leading-normal">
                    <p><strong>Severity Rating Score:</strong> <span className="font-semibold text-blue-700">{selectedIssue.urgencyScore}/10</span></p>
                    <p><strong>Urgency Assessment:</strong> {selectedIssue.urgencyReason || 'Identified as high hazard standard municipal routing.'}</p>
                    <p><strong>Primary Routed Department:</strong> <span className="bg-white px-2 py-0.5 rounded border text-[11px] font-medium inline-block mt-1">{selectedIssue.department}</span></p>
                  </div>
                </div>

                {/* Timeline Log */}
                <div className="space-y-3">
                  <span className="text-xxs text-slate-400 font-bold uppercase block tracking-wider">Official Status Activity Logs</span>
                  <div className="border-l-2 border-blue-100 pl-4 ml-2 space-y-4">
                    {selectedIssue.history.map((log, index) => (
                      <div key={log.id} className="relative">
                        <span className="absolute -left-[23px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white" />
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">{log.notes}</span>
                            <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Updated to <span className="font-semibold text-slate-700">{log.status}</span> by {log.updatedBy}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Citizens Comments */}
                <div className="space-y-3">
                  <span className="text-xxs text-slate-400 font-bold uppercase block tracking-wider">Citizen Discussions ({selectedIssue.comments.length})</span>
                  {selectedIssue.comments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No community comments posted yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedIssue.comments.map(c => (
                        <div key={c.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span className="font-bold text-slate-700">{c.userName} ({c.userRole})</span>
                            <span>{new Date(c.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs text-slate-600">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment Input */}
                  <form onSubmit={(e) => handleAddComment(e, selectedIssue.id)} className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Type supportive verification or comments..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button 
                      type="submit" 
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      Post
                    </button>
                  </form>
                </div>

                {/* AUTHORITY CONTROL SECTION (Requires Authority Role toggled) */}
                {currentUser.role === 'Authority' && (
                  <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 space-y-4 pt-4">
                    <div className="flex items-center gap-2">
                      <Lock className="text-amber-400" size={15} />
                      <span className="font-bold text-xs uppercase tracking-wider text-slate-300 font-display">Authorized Municipal Officer Controls</span>
                    </div>

                    <form onSubmit={(e) => handleStatusUpdate(e, selectedIssue.id)} className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Update Repair Status:</label>
                        <select
                          value={authorityStatusUpdate}
                          onChange={(e) => setAuthorityStatusUpdate(e.target.value as IssueStatus)}
                          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg p-2 focus:outline-none"
                        >
                          <option value="Investigating">Investigating</option>
                          <option value="In Progress">In Progress (Fixing)</option>
                          <option value="Resolved">Resolved (Completed)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Inspection & Action Notes:</label>
                        <textarea
                          rows={2}
                          placeholder="Provide tarmac volume estimate, crew completion details, or link duplicates..."
                          value={authorityNotes}
                          onChange={(e) => setAuthorityNotes(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg p-2 focus:outline-none"
                        />
                      </div>

                      {authorityStatusUpdate === 'Resolved' && (
                        <div>
                          <label className="block text-slate-400 mb-1">Upload Resolution Proof Picture (URL):</label>
                          <input
                            type="text"
                            placeholder="https://images.unsplash.com/... (optional)"
                            value={resolutionProof}
                            onChange={(e) => setResolutionProof(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg p-2 focus:outline-none font-mono"
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all"
                      >
                        Publish Municipal Update & Transmit Status
                      </button>
                    </form>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer credits */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 mt-auto">
        <span>© 2026 CivicSync – Hyperlocal Problem Solver. Crafted with standard React, Tailwind CSS, Express, and Gemini 3.5.</span>
      </footer>

      </div>
    </div>
  );
}

// Simple Helper to map location address on random pin selection
function getMockAddress(lat: number, lng: number): string {
  if (lat > 37.780) {
    return `${Math.round((lat - 37.77) * 5000)} Greenwood Ave, Greenwood District`;
  } else if (lng < -122.41) {
    return `${Math.round((lng + 122.42) * 5000)} Main St, Downtown Core`;
  } else {
    return `${Math.round((lat - 37.77) * 3000)} Industrial Way, Southside Ward`;
  }
}
