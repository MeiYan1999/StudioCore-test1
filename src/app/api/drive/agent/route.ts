import { NextResponse } from "next/server";
import {
  listDriveShares,
  createDriveShare,
  updateDriveShareStatus,
  type DriveShare,
} from "@/lib/services/drive-service";

// In-memory registry of connected desktop agents
interface ConnectedAgent {
  id: string;
  hostname: string;
  os: "windows" | "macos" | "linux";
  osVersion: string;
  appVersion: string;
  lastPing: string;
  activeSharesCount: number;
}

const connectedAgents: ConnectedAgent[] = [
  {
    id: "agent-win-01",
    hostname: "PC-PhongDung-01",
    os: "windows",
    osVersion: "Windows 11 Pro 64-bit",
    appVersion: "1.0.0",
    lastPing: new Date().toISOString(),
    activeSharesCount: 2,
  },
  {
    id: "agent-mac-02",
    hostname: "Mac Studio M2 Ultra",
    os: "macos",
    osVersion: "macOS Sequoia 15.1",
    appVersion: "1.0.0",
    lastPing: new Date().toISOString(),
    activeSharesCount: 1,
  },
];

// Pending notifications for desktop agents (e.g. client finalized selection, client added comment)
interface AgentNotification {
  id: string;
  shareId: string;
  type: "selection_finalized" | "photo_selected" | "video_comment";
  title: string;
  message: string;
  selectedCodes?: string[];
  createdAt: string;
}

const pendingNotifications: AgentNotification[] = [
  {
    id: "notif-01",
    shareId: "cuoi-minh-lan-dalat",
    type: "selection_finalized",
    title: "Khách chốt ảnh: Cưới Minh & Lan",
    message: "Khách hàng Trần Minh & Phương Lan vừa chốt 14 ảnh để retouch!",
    selectedCodes: ["IMG_0124", "IMG_0138", "IMG_0189", "IMG_0220"],
    createdAt: new Date().toISOString(),
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "agents") {
    return NextResponse.json({ agents: connectedAgents });
  }

  if (action === "notifications") {
    const notifs = [...pendingNotifications];
    return NextResponse.json({ notifications: notifs });
  }

  const shares = listDriveShares();
  return NextResponse.json({
    status: "ok",
    shares,
    connectedAgentsCount: connectedAgents.length,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, connectKey, agentInfo, shareData } = body;

    // Validate Connect Key
    if (!connectKey || !connectKey.startsWith("sc_drive_live_")) {
      return NextResponse.json(
        { error: "Studio Connect Key không hợp lệ hoặc đã hết hạn." },
        { status: 401 },
      );
    }

    // Agent Registration / Heartbeat
    if (action === "register" || action === "ping") {
      const existing = connectedAgents.find((a) => a.hostname === agentInfo.hostname);
      if (existing) {
        existing.lastPing = new Date().toISOString();
        existing.activeSharesCount = agentInfo.activeSharesCount || existing.activeSharesCount;
      } else {
        connectedAgents.push({
          id: `agent-${Date.now()}`,
          hostname: agentInfo.hostname || "Desktop-Studio",
          os: agentInfo.os || "windows",
          osVersion: agentInfo.osVersion || "Unknown",
          appVersion: agentInfo.appVersion || "1.0.0",
          lastPing: new Date().toISOString(),
          activeSharesCount: agentInfo.activeSharesCount || 0,
        });
      }

      return NextResponse.json({
        success: true,
        message: "Kết nối thành công với StudioCore SaaS.",
        serverTime: new Date().toISOString(),
      });
    }

    // Create New Share from Desktop Context Menu or Drag-and-Drop
    if (action === "create_share") {
      const shareId = shareData.id || `drv-${Date.now()}`;
      const newShare: Omit<DriveShare, "viewsCount" | "downloadsCount" | "selectedCount"> = {
        id: shareId,
        tenantId: "tenant-demo",
        title: shareData.title || "Thư mục mới chia sẻ",
        subtitle: shareData.subtitle || "Chia sẻ trực tiếp từ máy tính studio",
        type: shareData.type || "album",
        status: "active",
        localPath: shareData.localPath || "C:/StudioData",
        agentHostname: agentInfo?.hostname || "Studio Desktop",
        agentConnected: true,
        passwordProtected: !!shareData.password,
        allowRawDownload: shareData.allowRawDownload ?? true,
        allowZipDownload: shareData.allowZipDownload ?? true,
        maxSelectCount: shareData.maxSelectCount || 40,
        totalFiles: shareData.items?.length || 0,
        totalSizeBytes: shareData.totalSizeBytes || 104857600,
        totalSizeLabel: shareData.totalSizeLabel || "100 MB",
        createdAt: new Date().toISOString(),
        expiresAt: null,
        items: shareData.items || [],
        videoMeta: shareData.videoMeta,
      };

      const created = createDriveShare(newShare);

      return NextResponse.json({
        success: true,
        shareId: created.id,
        publicUrl: `${new URL(request.url).origin}/drive/${created.id}`,
        share: created,
      });
    }

    // Toggle Status
    if (action === "toggle_status") {
      const { shareId, status } = body;
      const ok = updateDriveShareStatus(shareId, status);
      return NextResponse.json({ success: ok });
    }

    return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "Lỗi xử lý yêu cầu từ desktop agent" },
      { status: 500 },
    );
  }
}
