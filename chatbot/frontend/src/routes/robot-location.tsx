import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Bot, Compass, Clock, BookOpen, CheckCircle2, 
  RotateCcw, Sparkles, AlertCircle, ArrowLeft, Loader2, Play
} from "lucide-react";
import { toast } from "sonner";
import { ZONES } from "@/lib/mock-data";

export const Route = createFileRoute("/robot-location")({
  head: () => ({ meta: [{ title: "Libi Bot — 실시간 로봇 위치 관제" }] }),
  component: RobotLocationPage,
});

type RobotTask = {
  id: number;
  memberId: number;
  bookId: number;
  status: "requested" | "moving" | "retrieved" | "delivering" | "completed" | "failed";
  zone: string;
  shelf: string;
  createdAt: string;
  updatedAt: string;
  bookTitle: string;
};

const ZONE_COORDS: Record<string, { x: number; y: number }> = {
  A: { x: 27.5, y: 22.5 },
  B: { x: 70, y: 22.5 },
  C: { x: 25, y: 52.5 },
  D: { x: 57.5, y: 52.5 },
  E: { x: 82.5, y: 52.5 },
  F: { x: 27.5, y: 81 },
  CAFE: { x: 62.5, y: 81 },
  WC: { x: 84, y: 81 },
};

const STATION_COORD = { x: 15, y: 90 }; // 충전소 위치
const DESK_COORD = { x: 45, y: 90 }; // 안내/대출 데스크 위치

function RobotLocationPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tasks, setTasks] = useState<RobotTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Robot's physical visual coordinates on the map
  const [robotPos, setRobotPos] = useState(STATION_COORD);
  const [transitionDuration, setTransitionDuration] = useState("duration-[1000ms]");

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem("libi.memberToken");
    if (!token) {
      void navigate({ to: "/login", search: { redirect: "/robot-location" } });
    }
  }, [navigate]);

  // Fetch tasks helper
  async function fetchTasks() {
    const token = localStorage.getItem("libi.memberToken");
    if (!token) return;

    try {
      const res = await fetch("/api/robot/tasks", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("libi.memberToken");
          localStorage.removeItem("libi.memberInfo");
          void navigate({ to: "/login", search: { redirect: "/robot-location" } });
          return;
        }
        throw new Error("작업 목록을 불러올 수 없습니다.");
      }
      const data = await res.json() as RobotTask[];
      setTasks(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "서버와 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  // Poll for live state changes every 2 seconds
  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => {
      fetchTasks();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Update robot position based on the active task
  const activeTask = tasks.find(
    (t) => t.status === "requested" || t.status === "moving" || t.status === "retrieved" || t.status === "delivering"
  ) || tasks[0]; // fallback to latest task if all completed

  useEffect(() => {
    if (!activeTask) {
      // Return to charging station
      setTransitionDuration("duration-[2000ms]");
      setRobotPos(STATION_COORD);
      return;
    }

    const zoneCode = activeTask.zone.split("-")[0];
    const targetZone = ZONE_COORDS[zoneCode] || ZONE_COORDS["A"];

    switch (activeTask.status) {
      case "requested":
        setTransitionDuration("duration-[1000ms]");
        setRobotPos(STATION_COORD);
        break;
      case "moving":
        // Moves from Station to Zone. Matches the 4-second delay in backend.
        setTransitionDuration("duration-[4000ms]");
        setRobotPos(targetZone);
        break;
      case "retrieved":
        // Stay at target shelf
        setTransitionDuration("duration-[1000ms]");
        setRobotPos(targetZone);
        break;
      case "delivering":
        // Moves from Zone to Delivery Desk. Matches the 4-second delay in backend.
        setTransitionDuration("duration-[4000ms]");
        setRobotPos(DESK_COORD);
        break;
      case "completed":
        // Stay at Desk
        setTransitionDuration("duration-[1000ms]");
        setRobotPos(DESK_COORD);
        break;
      default:
        setTransitionDuration("duration-[1000ms]");
        setRobotPos(STATION_COORD);
        break;
    }
  }, [activeTask?.status, activeTask?.zone]);

  // Create a mock simulation task
  async function triggerMockTask() {
    const token = localStorage.getItem("libi.memberToken");
    if (!token) return;

    try {
      // 1. Fetch available in-stock books to call
      const booksRes = await fetch("/api/books");
      if (!booksRes.ok) throw new Error("도서 목록을 가져오지 못했습니다.");
      const books = await booksRes.json();
      const availableBooks = books.filter((b: any) => b.inStock);

      if (availableBooks.length === 0) {
        toast.error("현재 대출 가능한 도서가 없습니다. 도서 리셋이 필요합니다.");
        return;
      }

      // Pick a random book
      const randomBook = availableBooks[Math.floor(Math.random() * availableBooks.length)];

      // 2. Call robot
      const res = await fetch("/api/robot/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ book_id: Number(randomBook.id) })
      });

      if (!res.ok) {
        throw new Error("로봇 호출에 실패했습니다.");
      }

      toast.success(`『${randomBook.title.KR}』 도서 배달 로봇 호출 시작!`);
      fetchTasks();
    } catch (err: any) {
      toast.error(err.message || "시뮬레이션 시작 오류");
    }
  }

  // Reset task helper
  async function handleReset(taskId: number) {
    const token = localStorage.getItem("libi.memberToken");
    if (!token) return;

    try {
      const res = await fetch(`/api/robot/tasks/${taskId}/reset`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        toast.success("로봇 시뮬레이션 상태가 리셋되었습니다.");
        fetchTasks();
      }
    } catch (err) {
      console.error("Failed to reset task", err);
    }
  }

  // Status visual label configs
  function getStatusLabel(status: RobotTask["status"]) {
    switch (status) {
      case "requested":
        return { text: "준비 중", color: "bg-amber-500 text-white" };
      case "moving":
        return { text: "이동 중", color: "bg-blue-500 text-white animate-pulse" };
      case "retrieved":
        return { text: "수거 완료", color: "bg-indigo-500 text-white" };
      case "delivering":
        return { text: "배송 중", color: "bg-purple-500 text-white animate-pulse" };
      case "completed":
        return { text: "배달 완료", color: "bg-green-500 text-white" };
      default:
        return { text: "대기", color: "bg-slate-400 text-white" };
    }
  }

  return (
    <AppShell>
      <div className="px-5 pb-8 pt-3 max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Link to="/home" className="p-1 rounded-lg hover:bg-card-soft text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">🤖 실시간 로봇 관제</h1>
        </div>

        {/* Live Map Panel */}
        <div className="rounded-3xl border border-border bg-card p-4 shadow-lg mb-6 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-foreground">실시간 맵 모니터</span>
            </div>
            {activeTask && (
              <span className="text-[10px] text-muted-foreground font-mono">
                Active Task: #{activeTask.id}
              </span>
            )}
          </div>

          {/* Interactive Library Layout */}
          <div className="relative aspect-[4/3.2] overflow-hidden rounded-2xl bg-paper border border-border shadow-inner">
            {/* Grid Pattern Background */}
            <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(to_right,oklch(0.27_0.12_273)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.27_0.12_273)_1px,transparent_1px)] [background-size:16px_16px]" />
            
            {/* Dotted Guide Paths from stations to shelves */}
            <svg className="absolute inset-0 size-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              {/* Station -> Zone Paths */}
              {activeTask && activeTask.status !== "completed" && (
                <>
                  <path 
                    d={`M ${STATION_COORD.x}% ${STATION_COORD.y}% L ${ZONE_COORDS[activeTask.zone.split("-")[0]]?.x || 27}% ${ZONE_COORDS[activeTask.zone.split("-")[0]]?.y || 22}%`}
                    fill="none" 
                    stroke="var(--color-primary)" 
                    strokeWidth="1.5" 
                    strokeDasharray="4,4"
                    className="opacity-40"
                  />
                  <path 
                    d={`M ${ZONE_COORDS[activeTask.zone.split("-")[0]]?.x || 27}% ${ZONE_COORDS[activeTask.zone.split("-")[0]]?.y || 22}% L ${DESK_COORD.x}% ${DESK_COORD.y}%`}
                    fill="none" 
                    stroke="var(--color-primary)" 
                    strokeWidth="1.5" 
                    strokeDasharray="4,4"
                    className="opacity-40"
                  />
                </>
              )}
            </svg>

            {/* Render Static Zones */}
            {ZONES.map((z) => {
              const isActiveTarget = activeTask && activeTask.status !== "completed" && activeTask.zone.startsWith(z.id);
              return (
                <div
                  key={z.id}
                  className={`absolute flex flex-col items-center justify-center rounded-xl text-[10px] font-bold border border-border/60 transition-all ${z.color} ${
                    isActiveTarget 
                      ? "ring-2 ring-primary/80 shadow-md scale-[1.03] z-10" 
                      : "opacity-75"
                  }`}
                  style={{
                    left: `${z.x}%`,
                    top: `${z.y}%`,
                    width: `${z.w}%`,
                    height: `${z.h}%`,
                  }}
                >
                  <span className="font-mono text-[9px] text-foreground/50">{z.id}</span>
                  <span className="text-foreground text-[10px] leading-none mt-0.5">{z.label}</span>
                </div>
              );
            })}

            {/* Static Charging Station & Desk Icons */}
            <div 
              className="absolute size-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-xs shadow-sm"
              style={{ left: `calc(${STATION_COORD.x}% - 16px)`, top: `calc(${STATION_COORD.y}% - 16px)` }}
              title="로봇 충전소"
            >
              🔌
            </div>
            <div 
              className="absolute size-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs shadow-sm font-bold text-primary"
              style={{ left: `calc(${DESK_COORD.x}% - 16px)`, top: `calc(${DESK_COORD.y}% - 16px)` }}
              title="안내/수령대"
            >
              📥
            </div>

            {/* Smooth-glide Pulsing Robot Node */}
            <div
              className={`absolute size-9 rounded-full bg-primary text-white flex items-center justify-center shadow-lg transition-all ease-in-out ${transitionDuration} z-20`}
              style={{
                left: `calc(${robotPos.x}% - 18px)`,
                top: `calc(${robotPos.y}% - 18px)`,
              }}
            >
              <div className="absolute inset-0 rounded-full bg-primary opacity-35 animate-ping" />
              <Bot className="size-5 shrink-0 relative z-10" />
            </div>
          </div>

          {/* Map Legends */}
          <div className="flex justify-center gap-4 mt-3 text-[10px] text-muted-foreground border-t border-border pt-3">
            <span className="flex items-center gap-1">🔌 충전소</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary inline-block" /> 로봇 (Libi Bot)</span>
            <span className="flex items-center gap-1">📥 도서 수령대</span>
          </div>
        </div>

        {/* Current Active Task Card */}
        {activeTask && (activeTask.status !== "completed" || tasks.length > 0) ? (
          <div className="rounded-3xl border border-border bg-card p-5 shadow-lg mb-6 relative overflow-hidden">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground font-mono">
                  CURRENT RUNNING STATUS
                </span>
                <h3 className="font-bold text-foreground text-base mt-0.5">
                  {activeTask.bookTitle}
                </h3>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${getStatusLabel(activeTask.status).color}`}>
                {getStatusLabel(activeTask.status).text}
              </span>
            </div>

            <div className="text-xs text-muted-foreground space-y-1 bg-card-soft p-3 rounded-2xl border border-border mb-4">
              <div>• <strong>위치:</strong> {activeTask.zone} 구역 ({activeTask.shelf})</div>
              <div>• <strong>동선:</strong> 충전소 ➡️ {activeTask.zone.split("-")[0]} 구역 ➡️ 도서 수령대</div>
              <div>
                • <strong>상태:</strong>{" "}
                {activeTask.status === "requested" && "호출 명령을 수신했습니다. 잠시 후 출발합니다."}
                {activeTask.status === "moving" && `${activeTask.zone.split("-")[0]} 구역으로 주행 이동하고 있습니다.`}
                {activeTask.status === "retrieved" && "서가에 도착하여 도서 수거 그리퍼를 작동 중입니다."}
                {activeTask.status === "delivering" && "수령대(데스크)로 배달 이송 주행 중입니다."}
                {activeTask.status === "completed" && "배달 완료! 수령대에서 책을 픽업해주세요."}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleReset(activeTask.id)}
                className="inline-flex h-9 items-center gap-1.5 px-3 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="size-3" />
                시뮬레이션 리셋
              </button>
              {activeTask.status === "completed" && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-green-600 animate-bounce">
                  <Sparkles className="size-3.5" />
                  배송 완료!
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-border bg-card p-6 text-center mb-6 shadow-md">
            <Bot className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <h3 className="font-bold text-foreground text-sm">로봇이 충전소에서 대기 중입니다</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              현재 활성화된 도서 호출 이송 작업이 없습니다. 98% 완충 상태로 호출 대기 모드입니다.
            </p>
          </div>
        )}

        {/* Action button to trigger simulation for test */}
        <div className="space-y-4">
          <button
            onClick={triggerMockTask}
            className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/95 active:scale-98 cursor-pointer"
          >
            <Play className="size-4 fill-white" />
            임의 도서 호출 시뮬레이션 시작
          </button>

          <Link 
            to="/robot" 
            className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-bold text-foreground hover:bg-card-soft active:scale-98"
          >
            📋 전체 호출 내역 목록 보기
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
