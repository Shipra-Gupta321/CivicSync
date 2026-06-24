import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { Issue, IssueCategory, IssueStatus, Comment, Alert, AreaInsight } from './src/types';

dotenv.config();

// Initialize Gemini API
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (geminiApiKey && geminiApiKey !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini API initialized successfully!");
  } catch (error) {
    console.error("Failed to initialize Gemini API:", error);
  }
} else {
  console.log("No valid GEMINI_API_KEY found. Running in demo mode with local mock responses.");
}

const app = express();
const PORT = 3000;

// Setup JSON body parser with 50mb limit for base64 image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- Mock Database In-Memory State ---
let issues: Issue[] = [
  {
    id: "iss-101",
    title: "Craters on Main St Pedestrian Crossing",
    category: "Pothole",
    description: "Three deep potholes right inside the pedestrian crosswalk in front of the public library. Vehicles are swerving aggressively to avoid them, risking pedestrian safety.",
    imageUrl: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
    location: {
      latitude: 37.7785,
      longitude: -122.4112,
      address: "100 Main St, Downtown Core"
    },
    reporterName: "Sarah Jenkins",
    reporterId: "usr-402",
    status: "Investigating",
    urgencyScore: 8,
    urgencyReason: "Located on a high-traffic pedestrian crossing, posing immediate crash and triphazard risks.",
    upvotes: 14,
    upvoters: ["usr-401", "usr-403", "usr-405"],
    department: "Department of Public Works",
    duplicateOf: null,
    createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(), // 36h ago
    updatedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    comments: [
      {
        id: "c-1",
        userName: "Mark R.",
        userRole: "Citizen",
        text: "I almost twisted my ankle here yesterday. Highly dangerous!",
        createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "c-2",
        userName: "Officer Davis",
        userRole: "Authority",
        text: "Assigned inspection team to survey the depth of the repair. Fill-in scheduled.",
        createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()
      }
    ],
    history: [
      {
        id: "h-1",
        status: "Pending",
        updatedBy: "Sarah Jenkins",
        notes: "Issue reported with photo upload",
        timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "h-2",
        status: "Investigating",
        updatedBy: "Department of Public Works",
        notes: "Assigned inspector to estimate tarmac requirements.",
        timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()
      }
    ]
  },
  {
    id: "iss-102",
    title: "Overflowing Garbage Bin & Litter",
    category: "Waste Management",
    description: "The commercial recycling bins have not been emptied for over a week. Trash is blowing onto the sidewalk, creating bad odors and attracting pests.",
    imageUrl: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80",
    location: {
      latitude: 37.7812,
      longitude: -122.4156,
      address: "450 Oak Avenue, Greenwood District"
    },
    reporterName: "James Carter",
    reporterId: "usr-403",
    status: "Pending",
    urgencyScore: 4,
    urgencyReason: "Sanitation nuisance and public health concern, but doesn't present an active physical danger.",
    upvotes: 6,
    upvoters: ["usr-402", "usr-406"],
    department: "Sanitation Department",
    duplicateOf: null,
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12h ago
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    comments: [],
    history: [
      {
        id: "h-3",
        status: "Pending",
        updatedBy: "James Carter",
        notes: "Reported overflowing bins behind Greenwood Shopping Plaza.",
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      }
    ]
  },
  {
    id: "iss-103",
    title: "Burst Water Pipe / Flooding Alleyway",
    category: "Water Leakage",
    description: "Pressurized clean water is spraying out from the main valve connection in the alley, flooding the entire walkway and freezing or pooling onto adjacent streets.",
    imageUrl: "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=600&q=80",
    location: {
      latitude: 37.7732,
      longitude: -122.4045,
      address: "88 Industrial Way, Southside Ward"
    },
    reporterName: "Alex Mercer",
    reporterId: "usr-401",
    status: "In Progress",
    urgencyScore: 9,
    urgencyReason: "Major clean water wastage and significant road flooding/slip hazard.",
    upvotes: 21,
    upvoters: ["usr-402", "usr-403", "usr-404", "usr-405", "usr-407"],
    department: "Water & Power Department",
    duplicateOf: null,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h ago
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    comments: [
      {
        id: "c-3",
        userName: "Superintendent Vance",
        userRole: "Authority",
        text: "Emergency valve shutdown completed. Technicians are on-site replacing the standard seal gaskets.",
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      }
    ],
    history: [
      {
        id: "h-4",
        status: "Pending",
        updatedBy: "Alex Mercer",
        notes: "Reported water spraying out of main utility cabinet.",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "h-5",
        status: "Investigating",
        updatedBy: "Water & Power Department",
        notes: "Sewer team dispatched to locate shutoff valve.",
        timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "h-6",
        status: "In Progress",
        updatedBy: "Water & Power Department",
        notes: "Valve shut down. Repair crew working on gasket replacement.",
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      }
    ]
  }
];

let alerts: Alert[] = [
  {
    id: "alt-1",
    title: "Critical Water Flooding",
    message: "A major water main burst on 88 Industrial Way has caused slight street pooling. Work crews are currently fixing the leakage.",
    type: "warning",
    createdAt: new Date().toISOString()
  },
  {
    id: "alt-2",
    title: "Active Road Repair",
    message: "Main St crosswalk repaving will commence tomorrow morning. Expect slight lane delays.",
    type: "info",
    createdAt: new Date().toISOString()
  }
];

let insights: AreaInsight[] = [
  {
    id: "ins-1",
    areaName: "Downtown Core",
    totalIssues: 24,
    resolvedIssues: 18,
    topCategory: "Pothole",
    riskScore: 68,
    riskLevel: "Medium",
    recommendation: "Increase street resurfacing inspections in downtown pedestrian corridors."
  },
  {
    id: "ins-2",
    areaName: "Greenwood District",
    totalIssues: 12,
    resolvedIssues: 10,
    topCategory: "Waste Management",
    riskScore: 32,
    riskLevel: "Low",
    recommendation: "Ensure garbage bin clearout schedule is adjusted ahead of weekends."
  },
  {
    id: "ins-3",
    areaName: "Southside Ward",
    totalIssues: 38,
    resolvedIssues: 22,
    topCategory: "Water Leakage",
    riskScore: 82,
    riskLevel: "High",
    recommendation: "Aged underground valve networks require seismic inspections and proactive seal replacements."
  }
];

// --- Utility: Distance Calculator (for Duplicate Checking) ---
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper to estimate location addresses if none provided
function getMockAddress(lat: number, lng: number): string {
  // Approximate neighborhood based on SF mock coordinates
  if (lat > 37.780) {
    return `${Math.round((lat - 37.77) * 5000)} Greenwood Ave, Greenwood District`;
  } else if (lng < -122.41) {
    return `${Math.round((lng + 122.42) * 5000)} Main St, Downtown Core`;
  } else {
    return `${Math.round((lat - 37.77) * 3000)} Industrial Way, Southside Ward`;
  }
}

// --- API Endpoints ---

// 1. Gemini AI Analysis (Auto-fill issue data from image or description)
app.post('/api/gemini/analyze-issue', async (req, res) => {
  const { image, description, categoryHint } = req.body;

  if (!image && !description) {
    return res.status(400).json({ error: "Missing both image and description. At least one is required for Gemini AI analysis." });
  }

  // Fallback / Demo Mode if Gemini isn't configured
  if (!ai) {
    console.log("Using Mock AI Model analyzer...");
    // Simulate thinking delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simple keyword analyzer for offline demo resilience
    let cat: IssueCategory = "Other";
    let score = 5;
    let reason = "Standard community report analyzed by hyperlocal routing rules.";
    let title = "Reported Community Maintenance Item";
    let desc = description || "Unsanitary or faulty community condition reported near location.";
    let dept = "Department of Public Works";

    const textToAnalyze = ((description || "") + " " + (categoryHint || "")).toLowerCase();
    if (textToAnalyze.includes("pothole") || textToAnalyze.includes("crater") || textToAnalyze.includes("road") || textToAnalyze.includes("asphalt")) {
      cat = "Pothole";
      title = "Pothole / Road Repair Request";
      score = 7;
      reason = "Road holes damage suspension systems and can cause vehicles to swerve unexpectedly.";
      dept = "Department of Public Works";
    } else if (textToAnalyze.includes("garbage") || textToAnalyze.includes("trash") || textToAnalyze.includes("dump") || textToAnalyze.includes("litter") || textToAnalyze.includes("waste")) {
      cat = "Waste Management";
      title = "Accumulated Litter / Garbage Overflow";
      score = 4;
      reason = "Presents public sanitation and odor concerns, but does not present an immediate traffic hazard.";
      dept = "Sanitation Department";
    } else if (textToAnalyze.includes("water") || textToAnalyze.includes("leak") || textToAnalyze.includes("spray") || textToAnalyze.includes("burst") || textToAnalyze.includes("pipe")) {
      cat = "Water Leakage";
      title = "Water Main Pipe Leakage";
      score = 8;
      reason = "Continuous water discharge wastes clean water resource and risks road undermining or slippage.";
      dept = "Water & Power Department";
    } else if (textToAnalyze.includes("light") || textToAnalyze.includes("street-light") || textToAnalyze.includes("dark") || textToAnalyze.includes("lamp") || textToAnalyze.includes("bulb")) {
      cat = "Streetlight";
      title = "Malfunctioning Streetlight Corridor";
      score = 5;
      reason = "Reduced street visibility increases local security vulnerability and pedestrian hazard after dark.";
      dept = "Transportation Authority";
    } else if (textToAnalyze.includes("wire") || textToAnalyze.includes("falling tree") || textToAnalyze.includes("collapse") || textToAnalyze.includes("hazard")) {
      cat = "Road Hazard";
      title = "Critical Street Obstruction / Hazard";
      score = 9;
      reason = "Represents an extreme blocking incident that may result in direct physical collision or bodily harm.";
      dept = "Transportation Authority";
    }

    return res.json({
      title,
      category: cat,
      description: desc,
      urgencyScore: score,
      urgencyReason: reason,
      suggestedDepartment: dept,
      isMock: true
    });
  }

  // Real Gemini Call
  try {
    console.log("Analyzing community issue with Gemini AI...");
    const parts: any[] = [];

    if (image) {
      // image is a base64 encoded string, format could be "data:image/jpeg;base64,..."
      let mimeType = "image/jpeg";
      let base64Data = image;

      if (image.startsWith("data:")) {
        const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
      }

      parts.push({
        inlineData: {
          mimeType,
          data: base64Data
        }
      });
    }

    const promptText = `
      You are an AI-powered hyperlocal problem solver. Your task is to analyze the reported community issue.
      
      Provided Description from user: "${description || 'None provided'}"
      Category hint if any: "${categoryHint || 'None'}"
      
      Output a valid JSON conforming to this schema:
      {
        "title": "Concise, clear, and action-oriented title (maximum 6 words)",
        "category": "Must be exactly one of: 'Pothole', 'Waste Management', 'Water Leakage', 'Streetlight', 'Road Hazard', 'Other'",
        "description": "A professionally formatted detailed description of the problem, explaining the visible hazard, structural damage, or community impact.",
        "urgencyScore": 1-10 integer (where 1-3 is minor convenience/routine, 4-6 is moderate public nuisance, 7-8 is high risk of damage/injury, 9-10 is emergency threat to life/structure safety),
        "urgencyReason": "A 1-sentence analytical justification for the assigned urgency score.",
        "suggestedDepartment": "The city department best suited to fix this: 'Department of Public Works', 'Sanitation Department', 'Water & Power Department', 'Transportation Authority', 'Other'"
      }
    `;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts },
      config: {
        systemInstruction: "You are an expert AI urban planning, city maintenance, and emergency response dispatcher. Always generate a valid JSON representation matching the schema strictly.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            urgencyScore: { type: Type.INTEGER },
            urgencyReason: { type: Type.STRING },
            suggestedDepartment: { type: Type.STRING }
          },
          required: ["title", "category", "description", "urgencyScore", "urgencyReason", "suggestedDepartment"]
        }
      }
    });

    const resultText = response.text || "{}";
    const parsedResult = JSON.parse(resultText.trim());
    return res.json({
      ...parsedResult,
      isMock: false
    });

  } catch (error: any) {
    console.error("Gemini AI API Call failed:", error);
    return res.status(500).json({ error: "Gemini Analysis failed", details: error.message });
  }
});

// 2. Fetch all issues (includes location and duplicate info)
app.get('/api/issues', (req, res) => {
  res.json(issues);
});

// 3. Report a new issue
app.post('/api/issues', (req, res) => {
  const { title, category, description, imageUrl, location, reporterName, reporterId, urgencyScore, urgencyReason, department } = req.body;

  if (!title || !category || !description || !location) {
    return res.status(400).json({ error: "Missing required fields (title, category, description, location)." });
  }

  // Set default coordinates if empty
  const lat = parseFloat(location.latitude) || 37.7749;
  const lng = parseFloat(location.longitude) || -122.4194;
  const address = location.address || getMockAddress(lat, lng);

  // Core Advanced AI feature: Real-time duplicate checking
  // If there's an existing unresolved issue within 250 meters of the same category, mark as potential duplicate
  let duplicateOfId: string | null = null;
  const thresholdMeters = 250;

  for (const existing of issues) {
    if (existing.status !== 'Resolved' && existing.category === category && !existing.duplicateOf) {
      const distance = getDistanceInMeters(lat, lng, existing.location.latitude, existing.location.longitude);
      if (distance <= thresholdMeters) {
        duplicateOfId = existing.id;
        console.log(`Duplicate detected! Issue "${title}" matches existing issue ID: ${existing.id} (distance: ${Math.round(distance)}m)`);
        break;
      }
    }
  }

  const newIssue: Issue = {
    id: `iss-${Math.floor(100 + Math.random() * 900)}`,
    title,
    category: category as IssueCategory,
    description,
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80",
    location: {
      latitude: lat,
      longitude: lng,
      address
    },
    reporterName: reporterName || "Anonymous Citizen",
    reporterId: reporterId || "usr-anon",
    status: "Pending",
    urgencyScore: parseInt(urgencyScore) || 5,
    urgencyReason: urgencyReason || "Citizen reported community maintenance item.",
    upvotes: 1,
    upvoters: [reporterId || "usr-anon"],
    department: department || "Department of Public Works",
    duplicateOf: duplicateOfId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    comments: [],
    history: [
      {
        id: `h-${Math.floor(1000 + Math.random() * 9000)}`,
        status: "Pending",
        updatedBy: reporterName || "Anonymous Citizen",
        notes: duplicateOfId 
          ? `Issue reported. AI flagged this as a duplicate of issue #${duplicateOfId} due to high geographic proximity.`
          : "Issue filed and successfully uploaded to district dispatch queue.",
        timestamp: new Date().toISOString()
      }
    ]
  };

  issues.unshift(newIssue); // Put newest first

  // Push system alert if score is high
  if (newIssue.urgencyScore >= 8) {
    alerts.unshift({
      id: `alt-${Math.floor(100 + Math.random() * 900)}`,
      title: `Critical ${category} Reported`,
      message: `${title} was flagged with urgency score ${newIssue.urgencyScore}/10 on ${address}. Dispatch assigned.`,
      type: "danger",
      createdAt: new Date().toISOString()
    });
  }

  // Update dynamic predictive insights statistics
  const areaName = address.includes("Downtown") ? "Downtown Core" : address.includes("Greenwood") ? "Greenwood District" : "Southside Ward";
  const insightIndex = insights.findIndex(ins => ins.areaName === areaName);
  if (insightIndex !== -1) {
    insights[insightIndex].totalIssues += 1;
    insights[insightIndex].riskScore = Math.min(100, insights[insightIndex].riskScore + 3);
    insights[insightIndex].riskLevel = insights[insightIndex].riskScore > 75 ? "High" : insights[insightIndex].riskScore > 40 ? "Medium" : "Low";
  }

  res.status(201).json(newIssue);
});

// 4. Upvote / verify issue
app.post('/api/issues/:id/upvote', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const issue = issues.find(iss => iss.id === id);
  if (!issue) {
    return res.status(404).json({ error: "Issue not found." });
  }

  if (issue.upvoters.includes(userId)) {
    // Undo upvote (toggle)
    issue.upvoters = issue.upvoters.filter(uid => uid !== userId);
    issue.upvotes = Math.max(0, issue.upvotes - 1);
  } else {
    // Upvote
    issue.upvoters.push(userId);
    issue.upvotes += 1;

    // Smart Community Verification: if upvotes cross 5, log it as "Community Verified" and raise priority
    if (issue.upvotes === 5 && issue.status === "Pending") {
      issue.history.push({
        id: `h-${Math.floor(1000 + Math.random() * 9000)}`,
        status: issue.status,
        updatedBy: "System (Community Verification)",
        notes: "Issue confirmed by multiple verified citizens. Escalated to dispatch prioritization.",
        timestamp: new Date().toISOString()
      });
      alerts.unshift({
        id: `alt-${Math.floor(100 + Math.random() * 900)}`,
        title: "Community Confirmed",
        message: `Issue "${issue.title}" has been confirmed and upvoted by 5+ local citizens. Priority prioritized.`,
        type: "success",
        createdAt: new Date().toISOString()
      });
    }
  }

  issue.updatedAt = new Date().toISOString();
  res.json(issue);
});

// 5. Add Comment
app.post('/api/issues/:id/comment', (req, res) => {
  const { id } = req.params;
  const { userName, userRole, text } = req.body;

  if (!userName || !text) {
    return res.status(400).json({ error: "Missing required fields (userName, text)." });
  }

  const issue = issues.find(iss => iss.id === id);
  if (!issue) {
    return res.status(404).json({ error: "Issue not found." });
  }

  const newComment: Comment = {
    id: `c-${Math.floor(100 + Math.random() * 900)}`,
    userName,
    userRole: userRole || "Citizen",
    text,
    createdAt: new Date().toISOString()
  };

  issue.comments.push(newComment);
  issue.updatedAt = new Date().toISOString();
  res.status(201).json(issue);
});

// 6. Update Issue Status (Authority portal)
app.post('/api/issues/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, updatedBy, notes, proofUrl } = req.body;

  const issue = issues.find(iss => iss.id === id);
  if (!issue) {
    return res.status(404).json({ error: "Issue not found." });
  }

  const oldStatus = issue.status;
  issue.status = status as IssueStatus;
  issue.updatedAt = new Date().toISOString();

  const newLog = {
    id: `h-${Math.floor(1000 + Math.random() * 9000)}`,
    status: status as IssueStatus,
    updatedBy: updatedBy || "Authorized Officer",
    notes: notes || `Status updated from ${oldStatus} to ${status}.`,
    proofUrl: proofUrl || undefined,
    timestamp: new Date().toISOString()
  };

  issue.history.push(newLog);

  // If status is resolved, decrease risk score of area slightly
  if (status === "Resolved") {
    const areaName = issue.location.address.includes("Downtown") ? "Downtown Core" : issue.location.address.includes("Greenwood") ? "Greenwood District" : "Southside Ward";
    const insightIndex = insights.findIndex(ins => ins.areaName === areaName);
    if (insightIndex !== -1) {
      insights[insightIndex].resolvedIssues += 1;
      insights[insightIndex].riskScore = Math.max(10, insights[insightIndex].riskScore - 8);
      insights[insightIndex].riskLevel = insights[insightIndex].riskScore > 75 ? "High" : insights[insightIndex].riskScore > 40 ? "Medium" : "Low";
    }

    alerts.unshift({
      id: `alt-${Math.floor(100 + Math.random() * 900)}`,
      title: "Problem Resolved!",
      message: `The community hazard "${issue.title}" has been successfully resolved by ${issue.department}.`,
      type: "success",
      createdAt: new Date().toISOString()
    });
  }

  res.json(issue);
});

// 7. Advanced AI feature: Simulate Auto-escalation (Hackathon Demo feature)
app.post('/api/issues/auto-escalate', (req, res) => {
  // Finds any 'Pending' or 'Investigating' issue and escalates it
  const unresolvedIssues = issues.filter(iss => iss.status === 'Pending' || iss.status === 'Investigating');
  let escalatedCount = 0;

  for (const issue of unresolvedIssues) {
    if (!issue.autoEscalated) {
      issue.autoEscalated = true;
      issue.urgencyScore = Math.min(10, issue.urgencyScore + 2);
      issue.department = "Municipal Emergency Management (Escalated)";
      issue.updatedAt = new Date().toISOString();
      issue.history.push({
        id: `h-${Math.floor(1000 + Math.random() * 9000)}`,
        status: issue.status,
        updatedBy: "System Smart-Escalator",
        notes: "AUTOMATIC AI ESCALATION: Repair delay breached 3-day SLA SLA. Urgency boosted. Assigned to Municipal Emergency Management.",
        timestamp: new Date().toISOString()
      });

      alerts.unshift({
        id: `alt-${Math.floor(100 + Math.random() * 900)}`,
        title: "SLA SLA Breach Escalation",
        message: `Issue "${issue.title}" breached standard response SLA. Urgency boosted to ${issue.urgencyScore}/10.`,
        type: "danger",
        createdAt: new Date().toISOString()
      });

      escalatedCount++;
    }
  }

  res.json({ message: `Successfully simulated auto-escalation on ${escalatedCount} outstanding issues.`, escalatedCount });
});

// 8. Fetch alerts
app.get('/api/alerts', (req, res) => {
  res.json(alerts);
});

// 9. Fetch dynamic insights
app.get('/api/insights', (req, res) => {
  res.json(insights);
});

// --- Server & Vite Setup ---
async function startServer() {
  // Vite integration in development mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware mounted.");
  } else {
    // Production serving static files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Community Hero backend server started at http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
