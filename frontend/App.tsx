import React, { useState, useEffect, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Plus,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  LayoutDashboard,
  List,
  Wallet,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Download,
  Calendar,
  X,
  TrendingUp,
  Activity,
  Tag,
  Globe,
  User,
  CheckCircle2,
  AlertCircle,
  Edit,
  Save,
} from "lucide-react";
import {
  Transaction,
  TransactionCreate,
  TransactionType,
  DashboardStats,
  YearlyStats,
} from "./types";
import { TRANSLATIONS, Language } from "./translations";

// --- Mock Data Service (Fallback if backend isn't running) ---
const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 1,
    date: new Date().toISOString().split("T")[0],
    amount: 150,
    type: "expense",
    category: "Food",
    note: "Lunch",
  },
  {
    id: 2,
    date: new Date().toISOString().split("T")[0],
    amount: 5000,
    type: "income",
    category: "Salary",
    note: "Freelance",
  },
  {
    id: 3,
    date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
    amount: 1200,
    type: "expense",
    category: "Transport",
    note: "Gas",
  },
  {
    id: 4,
    date: new Date(Date.now() - 172800000).toISOString().split("T")[0],
    amount: 300,
    type: "expense",
    category: "Entertainment",
    note: "Movie",
  },
];

// --- 常數設定 (Constants) ---
const API_URL = ""; // 使用相對路徑 (透過 Proxy 連線至後端)
const EXPENSE_COLOR = "#e11d48";
const INCOME_COLOR = "#059669";
const COLORS = [
  "#3B82F6", // Blue (Food)
  "#10B981", // Emerald (Transport)
  "#F59E0B", // Amber (Entertainment)
  "#8B5CF6", // Violet (Salary)
  "#EF4444", // Red (Bills)
  "#06B6D4", // Cyan (Housing)
  "#EC4899", // Pink (Education)
  "#F97316", // Orange (Shopping)
  "#84CC16", // Lime (Health)
  "#64748B", // Slate (Other)
  "#14B8A6", // Teal
  "#D946EF", // Fuchsia
  "#6366F1", // Indigo
  "#EAB308", // Yellow
  "#A855F7", // Purple
];
const EXPENSE_CATEGORIES = [
  "Food",
  "Transport",
  "Entertainment",
  "Bills",
  "Housing",
  "Education",
  "Shopping",
  "Health",
  "Other",
];

const INCOME_CATEGORIES = [
  "Salary",
  "Investment",
  "Interest",
  "Sponsorship",
  "Other",
];

const INITIAL_CATEGORIES = Array.from(
  new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])
);

// --- Components ---

const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?:
      | "primary"
      | "secondary"
      | "danger"
      | "ghost"
      | "success"
      | "warning";
  }
> = ({ children, variant = "primary", className = "", ...props }) => {
  const baseStyle =
    "px-4 py-2 rounded-lg font-medium transition-all duration-200 active:scale-95 flex items-center justify-center gap-2";
  const variants = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 dark:shadow-none",
    secondary:
      "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600",
    success:
      "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-200 dark:shadow-none",
    warning:
      "bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-200 dark:shadow-none",
    danger:
      "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400",
    ghost:
      "bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800",
  };
  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Card: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }
> = ({ children, className = "", ...props }) => (
  <div
    className={`bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-gray-300 dark:border-slate-700 rounded-2xl shadow-sm p-4 ${className}`}
    {...props}
  >
    {children}
  </div>
);

export default function App() {
  // --- 狀態管理 (State Management) ---
  // 1. 語言與翻譯設定
  const [language, setLanguage] = useState("zh");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const t = (key: keyof (typeof TRANSLATIONS)["en"]) => {
    return TRANSLATIONS[language as Language][key] || TRANSLATIONS["en"][key];
  };

  const tCategory = (categoryName: string) => {
    const key = `cat_${categoryName}` as keyof (typeof TRANSLATIONS)["en"];
    return (
      TRANSLATIONS[language as Language][key] ||
      TRANSLATIONS["en"][key] ||
      categoryName
    );
  };

  // 2. 核心資料狀態 (交易紀錄、年度統計、載入中)
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [yearlyStats, setYearlyStats] = useState<YearlyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "transactions">(
    "dashboard"
  );
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Date Filter State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default to first day of month
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [datePreset, setDatePreset] = useState("");

  // Derived Data (Filtered)
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => t.date >= startDate && t.date <= endDate);
  }, [transactions, startDate, endDate]);
  const [amountInput, setAmountInput] = useState("");
  const [category, setCategory] = useState("Food");
  const [type, setType] = useState<TransactionType>("expense");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [trendCategory, setTrendCategory] = useState("All");
  const [recentPage, setRecentPage] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteTxId, setDeleteTxId] = useState<number | null>(null);
  const timerRef = React.useRef<any>(null); // Use any to avoid NodeJS.Timeout type issues
  const ITEMS_PER_PAGE = 5;
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // 3. 使用者認證狀態 (Auth State)
  const [currentUser, setCurrentUser] = useState<string | null>(
    localStorage.getItem("currentUser")
  );
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const authHeaders = useMemo(() => {
    return currentUser ? { "X-Username": currentUser } : {};
  }, [currentUser]);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // 4. 編輯模式狀態 (Edit Mode)
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTransactions, setEditingTransactions] = useState<{
    [key: number]: Transaction;
  }>({});

  const showToast = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    // 監聽視窗大小改變事件
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    // Cleanup function: 元件卸載時移除監聽器，防止記憶體洩漏
    return () => window.removeEventListener("resize", handleResize);
  }, []); // 空陣列表示只在元件掛載 (Mount) 時執行一次

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredTransactions, rowsPerPage]);

  // Load Theme
  useEffect(() => {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Fetch Data
  // --- API 資料讀取 (API Calls) ---
  const fetchTransactions = async () => {
    // async/await: 非同步語法，讓程式碼看起來像同步執行，方便閱讀與除錯
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/transactions/`, {
        headers: { ...authHeaders },
      });
      if (!res.ok) throw new Error("Failed to connect to backend");
      const data = await res.json();
      setTransactions(
        data.sort(
          (a: Transaction, b: Transaction) =>
            b.date.localeCompare(a.date) || b.id - a.id
        )
      );
    } catch (error) {
      console.warn("Backend not reachable, using mock data for demo.");
      setTransactions(
        [...MOCK_TRANSACTIONS].sort(
          (a, b) => b.date.localeCompare(a.date) || b.id - a.id
        )
      );
    } finally {
      // finally: 無論成功或失敗都會執行的區塊，適合用來關閉 Loading 狀態
      setLoading(false);
    }
  };

  const fetchYearlyStats = async (year: string) => {
    try {
      const res = await fetch(`${API_URL}/stats/year/${year}`, {
        headers: { ...authHeaders },
      });
      if (res.ok) {
        const data = await res.json();
        setYearlyStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch yearly stats", error);
    }
  };

  useEffect(() => {
    fetchTransactions();
    // Default to current year or extracted year from startDate if applicable
    fetchYearlyStats(new Date().getFullYear().toString());
  }, [currentUser]); // Refetch when user changes

  // Update categories based on transactions
  useEffect(() => {
    const uniqueCategories = Array.from(
      new Set([...INITIAL_CATEGORIES, ...transactions.map((t) => t.category)])
    );
    setCategories(uniqueCategories);
  }, [transactions]);

  // Stats Calculation
  const stats: DashboardStats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return filteredTransactions.reduce(
      (acc, t) => {
        if (t.type === "income") acc.totalIncome += t.amount;
        else {
          acc.totalExpense += t.amount;
          if (t.date === today) acc.todayExpense += t.amount;
        }
        acc.balance = acc.totalIncome - acc.totalExpense;
        return acc;
      },
      { totalIncome: 0, totalExpense: 0, balance: 0, todayExpense: 0 }
    );
  }, [filteredTransactions]);

  // Chart Data Preparation
  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    filteredTransactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        data[t.category] = (data[t.category] || 0) + t.amount;
      });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const weeklyData = useMemo(() => {
    const data: Record<string, { date: string; amount: number }> = {};

    // Initialize dates in range to avoid gaps
    const dates = [];
    const currDate = new Date(startDate);
    const lastDate = new Date(endDate);
    while (currDate <= lastDate) {
      dates.push(currDate.toISOString().split("T")[0]);
      currDate.setDate(currDate.getDate() + 1);
    }
    dates.forEach((d) => {
      data[d] = { date: d, amount: 0 };
    });

    filteredTransactions.forEach((t) => {
      if (
        t.type === "expense" &&
        (trendCategory === "All" || t.category === trendCategory)
      ) {
        if (data[t.date]) {
          data[t.date].amount += t.amount;
        }
      }
    });
    return Object.values(data).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions, trendCategory, startDate, endDate]);

  // Handlers
  // --- 事件處理 (Event Handlers) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Simple calculator logic for amount
    let finalAmount = 0;
    try {
      // eslint-disable-next-line no-eval
      finalAmount = eval(amountInput);
    } catch {
      finalAmount = parseFloat(amountInput);
    }

    if (isNaN(finalAmount) || finalAmount <= 0) {
      alert(t("validAmount"));
      return;
    }

    if (!category.trim()) {
      alert(t("validCategory"));
      return;
    }

    // Add custom category to list if it's new
    if (isCustomCategory && !categories.includes(category)) {
      setCategories((prev) => [...prev, category]);
    }

    const newTx: TransactionCreate = {
      date,
      amount: finalAmount,
      type,
      category,
      note,
    };

    try {
      const res = await fetch(`${API_URL}/transactions/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(newTx),
      });
      if (res.ok) {
        await fetchTransactions();
        setShowAddModal(false);
        setAmountInput("");
        setNote("");
        if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
      }
    } catch (err) {
      console.error("Error adding transaction", err);
      // Fallback for demo
      const mockId = Math.max(...transactions.map((t) => t.id), 0) + 1;
      const updatedMock = [...transactions, { ...newTx, id: mockId }].sort(
        (a, b) => b.date.localeCompare(a.date) || b.id - a.id
      );
      setTransactions(updatedMock);
      setShowAddModal(false);
    }
  };

  const performDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/transactions/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders },
      });
      if (res.ok) await fetchTransactions();
    } catch (err) {
      setTransactions(transactions.filter((t) => t.id !== id));
    }
  };

  const handleDeleteClick = async (id: number) => {
    if (confirm(t("confirmDelete"))) {
      await performDelete(id);
    }
  };

  const exportData = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "ID,Date,Type,Category,Amount,Note\n" +
      transactions
        .map(
          (t) =>
            `${t.id},${t.date},${t.type},${t.category},${t.amount},${
              t.note || ""
            }`
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "localflow_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Long Press Handlers
  const handleTouchStart = (id: number) => {
    timerRef.current = setTimeout(() => {
      setDeleteTxId(id);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500); // 500ms long press
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const confirmMobileDelete = async () => {
    if (deleteTxId !== null) {
      await performDelete(deleteTxId);
      setDeleteTxId(null);
    }
  };

  // --- 使用者認證邏輯 (Auth Logic) ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isRegistering ? "/register" : "/login";
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername,
          password: authPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (isRegistering) {
          showToast(t("registerSuccess"), "success");
          setIsRegistering(false);
        } else {
          setCurrentUser(data.username);
          localStorage.setItem("currentUser", data.username);
          setShowAuthModal(false);
          setAuthUsername("");
          setAuthPassword("");
          showToast(t("loginSuccess"), "success");
        }
      } else {
        // Map common backend errors to translated keys
        let errorKey: any = "authFailed";
        if (data.detail === "Username already exists")
          errorKey = "usernameExists";
        if (data.detail === "Invalid username or password")
          errorKey = "authFailed";
        if (
          data.detail === "Username must contain only letters and numbers" ||
          data.detail === "Invalid username header format"
        ) {
          errorKey = "usernameInvalid";
        }

        showToast(t(errorKey), "error");
      }
    } catch (err) {
      showToast(t("connectError"), "error");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
    setTransactions([]);
  };

  // --- Views ---

  // Edit Handlers
  // --- 編輯模式邏輯 (Edit Logic) ---
  const handleEditToggle = async () => {
    if (isEditMode) {
      // Save changes
      try {
        const updatePromises = Object.values(editingTransactions).map((t) =>
          fetch(`${API_URL}/transactions/${t.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-username": currentUser || "",
            },
            body: JSON.stringify(t),
          }).then((res) => {
            if (!res.ok) throw new Error("Failed to update");
            return res.json();
          })
        );

        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
          showToast(t("saveSuccess"), "success");
          fetchTransactions(); // Refresh
        }
        setIsEditMode(false);
        setEditingTransactions({});
      } catch (error) {
        console.error(error);
        showToast(t("connectError"), "error");
      }
    } else {
      setIsEditMode(true);
      setEditingTransactions({});
    }
  };

  const handleCellChange = (
    id: number,
    field: keyof Transaction,
    value: any
  ) => {
    setEditingTransactions((prev) => {
      const current = prev[id] || transactions.find((t) => t.id === id);
      if (!current) return prev;
      return {
        ...prev,
        [id]: { ...current, [field]: value },
      };
    });
  };

  const handleDatePresetChange = (preset: string) => {
    const end = new Date();
    const start = new Date();

    switch (preset) {
      case "1W":
        start.setDate(start.getDate() - 7);
        break;
      case "PREV_WEEK":
        // Previous Monday to Sunday
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        const lastMonday = new Date(start.setDate(diff - 7));
        const lastSunday = new Date(start.setDate(diff - 1));
        start.setTime(lastMonday.getTime());
        end.setTime(lastSunday.getTime());
        break;
      case "PREV_MONTH":
        // First day of previous month to last day of previous month
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        end.setDate(0); // 0th day of current month = last day of prev month
        break;
      case "1M":
        start.setMonth(start.getMonth() - 1);
        break;
      case "3M":
        start.setMonth(start.getMonth() - 3);
        break;
      case "6M":
        start.setMonth(start.getMonth() - 6);
        break;
      case "1Y":
        start.setFullYear(start.getFullYear() - 1);
        break;
      case "ALL":
        start.setFullYear(2000);
        break;
      default:
        return;
    }
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
    setDatePreset(preset);
  };

  const dateFilterSection = (
    <Card className="flex flex-col md:flex-row gap-4 items-center justify-between p-3 mb-6">
      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
        <Calendar size={20} />
        <span className="font-medium">{t("dateRange")}</span>
      </div>

      <select
        className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64 cursor-pointer"
        onChange={(e) => {
          handleDatePresetChange(e.target.value);
        }}
        value={datePreset}
      >
        <option value="" disabled>
          {t("quickSelect")}
        </option>
        <option value="1W">{t("lastWeek")}</option>
        <option value="1M">{t("lastMonth")}</option>
        <option value="3M">{t("last3Months")}</option>
        <option value="6M">{t("last6Months")}</option>
        <option value="1Y">{t("lastYear")}</option>
        <option disabled>──────────</option>
        <option value="PREV_WEEK">{t("prevWeek")}</option>
        <option value="PREV_MONTH">{t("prevMonth")}</option>
        <option disabled>──────────</option>
        <option value="ALL">{t("allRecords")}</option>
      </select>
      <div className="flex gap-2 w-full md:w-auto">
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setDatePreset("");
          }}
          className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 dark:text-white text-sm w-full md:w-auto outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="self-center text-gray-400">-</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setDatePreset("");
          }}
          className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 dark:text-white text-sm w-full md:w-auto outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </Card>
  );

  const dashboardView = (
    <div className="space-y-6 pb-20">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-blue-600 text-gray-800 dark:text-white shadow-sm">
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
            {t("totalBalance")}
          </p>
          <h2 className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">
            ${stats.balance.toFixed(2)}
          </h2>
        </Card>
        <div className="grid grid-cols-2 gap-4 md:col-span-2">
          <Card className="!border-emerald-500 dark:!border-emerald-400 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400">
                <ArrowUpCircle size={24} />
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider">
                  {t("income")}
                </p>
                <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  ${stats.totalIncome.toFixed(0)}
                </p>
              </div>
            </div>
          </Card>
          <Card className="!border-rose-500 dark:!border-rose-400 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-full text-rose-600 dark:text-rose-400">
                <ArrowDownCircle size={24} />
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider">
                  {t("expense")}
                </p>
                <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  ${stats.totalExpense.toFixed(0)}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Today's Insight */}
      <Card className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("spentToday")}
          </p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            ${stats.todayExpense.toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <Button variant="ghost" onClick={exportData} title="Export CSV">
            <Download size={20} />
          </Button>
        </div>
      </Card>

      {/* Yearly Overview Section */}
      {yearlyStats && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">
            {t("yearlyOverview")}
          </h3>
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:grid md:grid-cols-3 md:pb-0 no-scrollbar">
            <Card className="min-w-[85%] sm:min-w-[60%] md:min-w-0 snap-center bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20 border-rose-200 dark:border-rose-800">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                    {t("highestDailySpend")}
                  </p>
                  <div className="mt-2">
                    {yearlyStats.highest_spending_day ? (
                      <>
                        <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                          {yearlyStats.highest_spending_day.date}
                        </p>
                        <p className="text-rose-600 dark:text-rose-400 font-semibold">
                          ${yearlyStats.highest_spending_day.amount.toFixed(2)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        {t("noData")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="p-2 bg-white/50 dark:bg-rose-900/30 rounded-lg text-rose-600">
                  <TrendingUp size={20} />
                </div>
              </div>
            </Card>

            <Card className="min-w-[85%] sm:min-w-[60%] md:min-w-0 snap-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                    {t("mostTransactionsDay")}
                  </p>
                  <div className="mt-2">
                    {yearlyStats.most_frequent_day ? (
                      <>
                        <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                          {yearlyStats.most_frequent_day.date}
                        </p>
                        <p className="text-blue-600 dark:text-blue-400 font-semibold">
                          {yearlyStats.most_frequent_day.count} {t("items")}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        {t("noData")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="p-2 bg-white/50 dark:bg-blue-900/30 rounded-lg text-blue-600">
                  <Activity size={20} />
                </div>
              </div>
            </Card>

            <Card className="min-w-[85%] sm:min-w-[60%] md:min-w-0 snap-center bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                    {t("topCategory")}
                  </p>
                  <div className="mt-2">
                    {yearlyStats.highest_category ? (
                      <>
                        <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                          {tCategory(yearlyStats.highest_category.category)}
                        </p>
                        <p className="text-purple-600 dark:text-purple-400 font-semibold">
                          ${yearlyStats.highest_category.amount.toFixed(2)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        {t("noData")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="p-2 bg-white/50 dark:bg-purple-900/30 rounded-lg text-purple-600">
                  <Tag size={20} />
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:pb-0">
        <Card className="h-80 flex flex-col min-w-full lg:min-w-0 snap-center">
          <h3 className="font-semibold mb-4 text-gray-700 dark:text-gray-200">
            {t("expensesByCategory")}
          </h3>
          <div className="flex-1 min-h-0 flex items-center pr-4 min-w-0">
            {/* Custom Legend - Left Side */}
            <div className="md:w-2/5 min-w-[120px] flex flex-col justify-start gap-3 pl-2 overflow-y-auto max-h-full scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-600">
              {categoryData.map((entry, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 md:w-4 md:h-4 rounded-sm shrink-0"
                    style={{
                      backgroundColor:
                        COLORS[
                          categories.indexOf(entry.name) % COLORS.length
                        ] || "#CCCCCC",
                    }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs md:text-sm text-gray-600 dark:text-gray-300 truncate font-medium">
                      {tCategory(entry.name)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pie Chart - Right Side */}
            <div
              className="flex-1 h-full relative"
              style={{ minWidth: 0, minHeight: "200px" }}
            >
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={isMobile ? 60 : 75}
                      outerRadius={isMobile ? 80 : 100}
                      paddingAngle={5}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      nameKey="name"
                      style={{ outline: "none" }}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            COLORS[
                              categories.indexOf(entry.name) % COLORS.length
                            ] || "#CCCCCC"
                          }
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number, name: string) => [
                        value,
                        tCategory(name),
                      ]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        outline: "none",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm italic">
                  {t("noData")}
                </div>
              )}
            </div>
          </div>
        </Card>
        <Card className="h-80 flex flex-col min-w-full lg:min-w-0 snap-center">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-700 dark:text-gray-200">
              {t("consumptionTrend")}
            </h3>
            <select
              value={trendCategory}
              onChange={(e) => setTrendCategory(e.target.value)}
              className="text-sm border-none bg-gray-100 dark:bg-slate-700 rounded-lg px-2 py-1 outline-none text-gray-700 dark:text-gray-200"
            >
              <option value="All">{t("allExpenses")}</option>
              {categories
                .filter((c) => c !== "Salary")
                .map((c) => (
                  <option key={c} value={c}>
                    {tCategory(c)}
                  </option>
                ))}
            </select>
          </div>
          <div
            className="flex-1 min-h-0 bg-gradient-to-t from-white/0 to-white/0 rounded-xl overflow-hidden"
            style={{ minWidth: 0, minHeight: "200px" }}
          >
            {weeklyData.some((d) => d.amount > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={weeklyData}
                  margin={{ bottom: 10, left: -20, right: 10 }}
                >
                  <defs>
                    <linearGradient
                      id="colorAmount"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={EXPENSE_COLOR}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={EXPENSE_COLOR}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => val.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      outline: "none",
                    }}
                    labelStyle={{ color: "#1f2937" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke={EXPENSE_COLOR}
                    fillOpacity={1}
                    fill="url(#colorAmount)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm italic">
                {t("noData")}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Transactions (Mobile Friendly) */}
      <div className="md:hidden">
        <h3 className="font-semibold mb-2 text-gray-700 dark:text-gray-300 ml-1">
          {t("recentActivity")}
        </h3>
        <div className="space-y-3">
          {filteredTransactions.length > 0 ? (
            filteredTransactions
              .slice(
                (recentPage - 1) * ITEMS_PER_PAGE,
                recentPage * ITEMS_PER_PAGE
              )
              .map((t) => (
                <Card
                  key={t.id}
                  className="flex justify-between items-center py-3 active:scale-[0.98] transition-transform select-none"
                  // @ts-ignore
                  onTouchStart={() => handleTouchStart(t.id)}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  onContextMenu={(e) => e.preventDefault()}
                  onMouseDown={() => handleTouchStart(t.id)}
                  onMouseUp={handleTouchEnd}
                  onMouseLeave={handleTouchEnd}
                >
                  <div className="flex gap-3 items-center pointer-events-none">
                    <div
                      className={`w-2 h-10 rounded-full ${
                        t.type === "expense" ? "bg-rose-500" : "bg-emerald-500"
                      }`}
                    ></div>
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-100">
                        {tCategory(t.category)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t.note || t.date}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-bold ${
                      t.type === "expense"
                        ? "text-rose-600"
                        : "text-emerald-600"
                    } pointer-events-none`}
                  >
                    {t.type === "expense" ? "-" : "+"}${t.amount}
                  </span>
                </Card>
              ))
          ) : (
            <Card className="py-8 text-center text-gray-400 text-sm italic">
              {t("noData")}
            </Card>
          )}
        </div>
        {/* Pagination Controls */}
        {filteredTransactions.length > ITEMS_PER_PAGE && (
          <div className="flex justify-between items-center mt-4 px-2">
            <Button
              variant="ghost"
              onClick={() => setRecentPage((p) => Math.max(1, p - 1))}
              disabled={recentPage === 1}
              className={recentPage === 1 ? "opacity-50" : ""}
            >
              <ChevronLeft size={20} /> {t("prev")}
            </Button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t("page")} {recentPage} {t("of")}{" "}
              {Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE)}
            </span>
            <Button
              variant="ghost"
              onClick={() =>
                setRecentPage((p) =>
                  Math.min(
                    Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE),
                    p + 1
                  )
                )
              }
              disabled={
                recentPage ===
                Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE)
              }
              className={
                recentPage ===
                Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE)
                  ? "opacity-50"
                  : ""
              }
            >
              {t("next")} <ChevronRight size={20} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const transactionsView = (
    <div className="space-y-4 pb-20">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          {t("allTransactions")}
        </h2>
        <div className="flex gap-2">
          <Button
            onClick={handleEditToggle}
            variant={isEditMode ? "warning" : "secondary"}
          >
            {isEditMode ? <Save size={16} /> : <Edit size={16} />}
            {isEditMode ? t("save") : t("edit")}
          </Button>
          <Button onClick={exportData} variant="success">
            <Download size={16} /> {t("exportCSV")}
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-sm border-b dark:border-slate-600">
                <th className="p-4 font-semibold">{t("date")}</th>
                <th className="p-4 font-semibold">{t("category")}</th>
                <th className="p-4 font-semibold">{t("note")}</th>
                <th className="p-4 font-semibold text-right">{t("amount")}</th>
                <th className="p-4 font-semibold text-center">{t("action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredTransactions
                .slice(
                  (currentPage - 1) * rowsPerPage,
                  currentPage * rowsPerPage
                )
                .map((t) => {
                  const currentT = editingTransactions[t.id] || t;
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                        {isEditMode ? (
                          <input
                            type="date"
                            value={currentT.date}
                            onChange={(e) =>
                              handleCellChange(t.id, "date", e.target.value)
                            }
                            className="w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          currentT.date
                        )}
                      </td>
                      <td className="p-4">
                        {isEditMode ? (
                          <select
                            value={currentT.category}
                            onChange={(e) =>
                              handleCellChange(t.id, "category", e.target.value)
                            }
                            className="w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {categories.map((c) => (
                              <option key={c} value={c}>
                                {tCategory(c)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className="px-2 py-1 rounded text-xs font-bold border"
                            style={{
                              backgroundColor: `${
                                COLORS[
                                  categories.indexOf(currentT.category) %
                                    COLORS.length
                                ] || "#888"
                              }20`,
                              color:
                                COLORS[
                                  categories.indexOf(currentT.category) %
                                    COLORS.length
                                ] || "#888",
                              borderColor: `${
                                COLORS[
                                  categories.indexOf(currentT.category) %
                                    COLORS.length
                                ] || "#888"
                              }40`,
                            }}
                          >
                            {tCategory(currentT.category)}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                        {isEditMode ? (
                          <input
                            type="text"
                            value={currentT.note || ""}
                            onChange={(e) =>
                              handleCellChange(t.id, "note", e.target.value)
                            }
                            className="w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          currentT.note
                        )}
                      </td>
                      <td
                        className={`p-4 text-right font-mono font-medium ${
                          currentT.type === "expense"
                            ? "text-rose-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {isEditMode ? (
                          <input
                            type="number"
                            value={currentT.amount}
                            onChange={(e) =>
                              handleCellChange(
                                t.id,
                                "amount",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full text-right bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <>
                            {currentT.type === "expense" ? "-" : "+"}
                            {currentT.amount.toFixed(2)}
                          </>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => performDelete(t.id)}
                          disabled={isEditMode}
                          className={`p-2 transition-colors ${
                            isEditMode
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-400 hover:text-red-500"
                          }`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-gray-500 dark:text-gray-400 italic"
                  >
                    {t("noData")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Desktop Pagination Controls */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>{t("rowsPerPage")}</span>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">
              {filteredTransactions.length > 0
                ? `${t("page")} ${currentPage} ${t("of")} ${Math.ceil(
                    filteredTransactions.length / rowsPerPage
                  )}`
                : `${t("page")} 0 ${t("of")} 0`}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) =>
                    Math.min(
                      Math.ceil(filteredTransactions.length / rowsPerPage),
                      p + 1
                    )
                  )
                }
                disabled={
                  currentPage >=
                  Math.ceil(filteredTransactions.length / rowsPerPage)
                }
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    // --- 主要畫面渲染 (Main Render) ---
    <div className="min-h-screen flex flex-col relative font-sans selection:bg-blue-100 dark:selection:bg-blue-900">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-amber-500 p-1.5 rounded-lg">
            <Wallet className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg text-gray-800 dark:text-white tracking-tight">
            {t("appName")}
          </h1>
        </div>

        {/* Navigation Tabs (Moved to Header) */}
        <div className="hidden md:flex items-center gap-6">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === "dashboard"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <LayoutDashboard size={18} /> {t("dashboard")}
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === "transactions"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <List size={18} /> {t("transactions")}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm shadow-blue-200 dark:shadow-none"
          >
            <Plus size={18} /> {t("add")}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-full">
                <User size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {currentUser}
                </span>
              </div>
              <Button
                variant="ghost"
                className="px-3 !text-rose-600 hover:!text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 !dark:text-rose-400"
                onClick={handleLogout}
              >
                {t("logout")}
              </Button>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsRegistering(false);
                setShowAuthModal(true);
              }}
              className="p-2 sm:px-4 sm:py-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full sm:rounded-lg transition-colors flex items-center gap-2 group"
              title={t("login")}
            >
              <User size={24} className="sm:size-[18px]" />
              <span className="hidden sm:inline text-sm font-bold">
                {t("login")}
              </span>
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              onBlur={() => setTimeout(() => setShowLangMenu(false), 200)}
              className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-500 dark:text-gray-400"
            >
              <Globe size={20} />
              <span className="hidden sm:block text-sm font-medium">
                {
                  { en: "English", zh: "中文", ja: "日本語", ko: "한국어" }[
                    language
                  ]
                }
              </span>
              <span className="hidden sm:block text-xs opacity-50">▼</span>
            </button>

            {showLangMenu && (
              <div className="absolute right-0 top-full mt-2 w-32 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                {[
                  { code: "en", label: "English" },
                  { code: "zh", label: "中文" },
                  { code: "ja", label: "日本語" },
                  { code: "ko", label: "한국어" },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code);
                      setShowLangMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                      language === lang.code
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isDarkMode ? (
              <Sun size={20} className="text-yellow-400" />
            ) : (
              <Moon size={20} className="text-slate-600" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 lg:p-6">
        {dateFilterSection}
        {activeTab === "dashboard" ? dashboardView : transactionsView}
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40 md:hidden">
        <button
          onClick={() => setShowAddModal(true)}
          className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-400/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus size={32} />
        </button>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] animate-in slide-in-from-bottom-10 duration-300">
            <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800 sticky top-0 z-10">
              <h3 className="font-bold text-lg dark:text-white">
                {t("newTransaction")}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                {t("close")}
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Type Toggle */}
              <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-slate-700 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`py-2 rounded-lg font-medium text-sm transition-all ${
                    type === "expense"
                      ? "bg-white dark:bg-slate-600 shadow text-rose-600"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {t("expense")}
                </button>
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`py-2 rounded-lg font-medium text-sm transition-all ${
                    type === "income"
                      ? "bg-white dark:bg-slate-600 shadow text-emerald-600"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {t("income")}
                </button>
              </div>

              {/* Amount Input with Calculator Icon */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  {t("amount")}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full pl-8 pr-10 py-3 text-2xl font-bold rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    autoFocus
                  />
                  <Calculator className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {t("supportsMath")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                    {t("date")}
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                    {t("category")}
                  </label>
                  {isCustomCategory ? (
                    <div className="flex gap-2 w-full">
                      <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="Enter category name..."
                        className="flex-1 min-w-0 p-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 shrink-0"
                        title="Cancel custom category"
                        onClick={() => {
                          setIsCustomCategory(false);
                          setCategory(categories[0]);
                        }}
                      >
                        <X size={18} />
                      </Button>
                    </div>
                  ) : (
                    <select
                      value={category}
                      onChange={(e) => {
                        if (e.target.value === "___custom___") {
                          setIsCustomCategory(true);
                          setCategory("");
                        } else {
                          setCategory(e.target.value);
                        }
                      }}
                      className="w-full p-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
                    >
                      {(type === "expense"
                        ? EXPENSE_CATEGORIES
                        : INCOME_CATEGORIES
                      ).map((c) => (
                        <option key={c} value={c}>
                          {tCategory(c)}
                        </option>
                      ))}
                      {/* Show custom categories if any exist in the global list but not in defaults */}
                      {categories
                        .filter(
                          (c) =>
                            !EXPENSE_CATEGORIES.includes(c) &&
                            !INCOME_CATEGORIES.includes(c)
                        )
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      <option
                        value="___custom___"
                        className="font-bold text-blue-600"
                      >
                        {t("cat_NewCategory")}
                      </option>
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                  {t("note")}
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Lunch with friends..."
                  className="w-full p-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>

              <Button type="submit" className="w-full py-3 text-lg">
                {t("saveTransaction")}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Mobile) */}
      {deleteTxId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-lg dark:text-white mb-2">
              {t("deleteTitle")}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {t("deleteMessage")}
            </p>
            <div className="flex gap-4">
              <Button
                variant="secondary"
                onClick={() => setDeleteTxId(null)}
                className="flex-1"
              >
                {t("cancel")}
              </Button>
              <Button
                variant="danger"
                onClick={confirmMobileDelete}
                className="flex-1"
              >
                {t("delete")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal (Login/Register) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="relative p-8">
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute right-6 top-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title={t("close")}
              >
                <X size={24} />
              </button>

              <div className="mb-8 text-center">
                <div className="inline-flex p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400 mb-4">
                  <Wallet size={32} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {isRegistering ? t("register") : t("login")}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                  {isRegistering
                    ? "Create your personal account"
                    : "Welcome back to Flowing Gold"}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 px-1">
                    {t("username")}
                  </label>
                  <input
                    type="text"
                    required
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 px-1">
                    {t("password")}
                  </label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <Button
                  type="submit"
                  className={`w-full py-3.5 text-lg font-bold shadow-lg mt-4 transition-all ${
                    isRegistering
                      ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200 dark:shadow-none text-white"
                      : "bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-none"
                  }`}
                >
                  {isRegistering ? t("register") : t("login")}
                </Button>
              </form>

              <div className="mt-8 text-center">
                <button
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-sm font-medium transition-all"
                >
                  <span className="text-gray-500 dark:text-gray-400">
                    {isRegistering
                      ? t("switchLoginPrefix")
                      : t("switchRegisterPrefix")}
                  </span>
                  <span
                    className={`${
                      isRegistering
                        ? "text-blue-600 hover:text-blue-700"
                        : "text-rose-600 hover:text-rose-700"
                    } hover:underline ml-1`}
                  >
                    {isRegistering
                      ? t("switchLoginAction")
                      : t("switchRegisterAction")}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[110] animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 border ${
              toast.type === "success"
                ? "bg-emerald-500/90 text-white border-emerald-400"
                : "bg-rose-500/90 text-white border-rose-400"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span className="font-bold tracking-tight">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
