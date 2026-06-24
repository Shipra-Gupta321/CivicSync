export type IssueCategory = 'Pothole' | 'Waste Management' | 'Water Leakage' | 'Streetlight' | 'Road Hazard' | 'Other';

export type IssueStatus = 'Pending' | 'Investigating' | 'In Progress' | 'Resolved';

export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

export interface Comment {
  id: string;
  userName: string;
  userRole: 'Citizen' | 'Authority';
  text: string;
  createdAt: string;
}

export interface HistoryLog {
  id: string;
  status: IssueStatus;
  updatedBy: string;
  notes: string;
  proofUrl?: string;
  timestamp: string;
}

export interface Issue {
  id: string;
  title: string;
  category: IssueCategory;
  description: string;
  imageUrl: string;
  location: LocationData;
  reporterName: string;
  reporterId: string;
  status: IssueStatus;
  urgencyScore: number; // 1 to 10
  urgencyReason: string;
  upvotes: number;
  upvoters: string[]; // List of userId strings who upvoted
  department: string;
  duplicateOf: string | null; // ID of the master issue if this is flagged as duplicate
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
  history: HistoryLog[];
  autoEscalated?: boolean;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  createdAt: string;
}

export interface AreaInsight {
  id: string;
  areaName: string;
  totalIssues: number;
  resolvedIssues: number;
  topCategory: IssueCategory;
  riskScore: number; // 1 to 100
  riskLevel: 'Low' | 'Medium' | 'High';
  recommendation: string;
}

export interface AppState {
  issues: Issue[];
  currentUser: {
    id: string;
    name: string;
    role: 'Citizen' | 'Authority';
    department?: string;
  };
  alerts: Alert[];
  insights: AreaInsight[];
}
