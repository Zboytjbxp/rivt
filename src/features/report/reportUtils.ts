export interface ReportData {
  jobTitle: string;
  jobLocation: string;
  contractorName: string;
  trade: string;
  startDate: string;
  endDate: string;
  hoursWorked: number;
  totalAmount: number;
  materials: string[];
  notes: string;
  generatedAt: string;
}

export function encodeReport(data: ReportData): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify(data)));
  } catch {
    return "";
  }
}

export function decodeReport(encoded: string): ReportData | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded))) as ReportData;
  } catch {
    return null;
  }
}

export function getReportUrl(data: ReportData): string {
  const encoded = encodeReport(data);
  return `${window.location.origin}/?report=${encoded}`;
}

export function buildReportFromStorage(jobTitle: string): ReportData {
  // Reads rivt.* localStorage keys to build report data
  const profile = (() => { try { return JSON.parse(localStorage.getItem("rivt.profile.v1") ?? "null"); } catch { return null; } })();
  const rateCard = (() => { try { return JSON.parse(localStorage.getItem("rivt.rateCard.v1") ?? "null"); } catch { return null; } })();
  const sessions = (() => { try { return JSON.parse(localStorage.getItem("rivt.sessions.v1") ?? "[]") as Array<{start:string;end:string|null;jobTitle?:string}>; } catch { return []; } })();
  const expenses = (() => { try { return JSON.parse(localStorage.getItem("rivt.expenses.v1") ?? "[]") as Array<{jobTitle?:string;category:string;amount:number;description:string}>; } catch { return []; } })();

  const relevantSessions = sessions.filter(s => s.end && (!s.jobTitle || s.jobTitle === jobTitle));
  const hoursWorked = relevantSessions.reduce((sum, s) => {
    if (!s.end) return sum;
    return sum + (new Date(s.end).getTime() - new Date(s.start).getTime()) / 3600000;
  }, 0);

  const hourlyRate = rateCard?.hourlyRate ?? 75;
  const relevantExpenses = expenses.filter(e => !e.jobTitle || e.jobTitle === jobTitle);
  const materialCost = relevantExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalAmount = Math.round(hoursWorked * hourlyRate + materialCost);
  const materials = relevantExpenses.slice(0, 8).map(e => `${e.description} (${e.category})`);

  const dates = relevantSessions.map(s => s.start).sort();

  return {
    jobTitle,
    jobLocation: profile?.location ?? "",
    contractorName: profile?.displayName ?? "Your Contractor",
    trade: profile?.primaryTrade ?? rateCard?.primaryTrade ?? "Contractor",
    startDate: dates[0] ? new Date(dates[0]).toLocaleDateString() : new Date().toLocaleDateString(),
    endDate: dates.at(-1) ? new Date(dates.at(-1)!).toLocaleDateString() : new Date().toLocaleDateString(),
    hoursWorked: Math.round(hoursWorked * 10) / 10,
    totalAmount,
    materials,
    notes: "",
    generatedAt: new Date().toISOString(),
  };
}
