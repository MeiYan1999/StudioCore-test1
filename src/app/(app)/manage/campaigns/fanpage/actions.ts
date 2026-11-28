"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { analyzeAdsWithHub, analyzeAdsPeriod, approvePosts, connectAds, draftPosts, resolveAssistantReply, savePageAssistant, syncAds, writePostDraft } from "@/lib/services/page-marketing-service";
import { parseVietnamDateTimeLocal } from "@/lib/utils";
import { and, eq } from "drizzle-orm";
import { pageAssistants, facebookPages } from "@/lib/db/schema";
import { assertBranchAccess, assertPermission } from "@/lib/auth/permissions";
import { ZodError } from "zod";

export async function marketingForm(form: FormData) {
  const actor = await requireActor();
  const db = getDb();
  const value = (name:string) => String(form.get(name) ?? "").trim();
  const path = "/manage/campaigns/fanpage";
  let message = "Đã lưu.";
  try {
    assertPermission(actor, "customers.manage");
    switch (value("action")) {
      case "draft": {
        const drafts = value("batch").split(/\r?\n/).filter(Boolean).map(line => {
          const pos = line.indexOf("|");
          if (pos<0) throw new Error("Mỗi dòng cần giờ đăng và nội dung ngăn bằng |.");
          const publishAt = parseVietnamDateTimeLocal(line.slice(0,pos).trim());
          if (!publishAt) throw new Error("Giờ đăng không hợp lệ.");
          return {publishAt,content:line.slice(pos+1).trim()};
        });
        draftPosts(db,actor,value("page"),drafts); break;
      }
      case "approve": approvePosts(db,actor,form.getAll("post").map(String)); break;
      case "account": await connectAds(db,actor,value("account"),value("token")); break;
      case "sync": await syncAds(db,actor,value("account"),value("since"),value("until")); break;
      case "model": message=await analyzeAdsWithHub(db,actor,value("period"),value("campaign"),value("compare")||undefined); break;
      case "analyze": message = analyzeAdsPeriod(db,actor,value("period"),value("campaign"),value("compare") || undefined); break;
      case "assistant": {
        const facts = value("knowledge").split(/\r?\n/).filter(Boolean).map(line=>{
          const pos=line.indexOf("|");
          if(pos<0) throw new Error("Mỗi dòng cần một câu hỏi và câu trả lời ngăn bằng |.");
          return {question:line.slice(0,pos),answer:line.slice(pos+1)};
        });
        savePageAssistant(db,actor,value("page"),value("name"),facts,form.has("enabled")); break;
      }
      case "preview": {
        const page = db.select().from(facebookPages).where(and(eq(facebookPages.tenantId,actor.tenantId),eq(facebookPages.id,value("page")))).get();
        if(!page) throw new Error("Chưa kết nối trang.");
        assertBranchAccess(actor,page.branchId);
        const agent = db.select().from(pageAssistants).where(and(eq(pageAssistants.tenantId,actor.tenantId),eq(pageAssistants.pageId,page.id))).get();
        const answer=await resolveAssistantReply(db,actor.tenantId,value("question"),agent?.knowledge??[]);
        message=answer.reply?"Trả lời: "+answer.reply+(answer.via==="model"?" · Khớp bằng AI Hub · chi phí "+answer.costUsd+" USD.":" · Khớp chính xác câu hỏi đã lưu."):"Câu hỏi này sẽ được chuyển nhân viên phụ trách."+(answer.costUsd?" Chi phí AI Hub "+answer.costUsd+" USD.":""); break;
      }
      case "write": {
        const publishAt = parseVietnamDateTimeLocal(value("publishAt"));
        if (!publishAt) throw new Error("Giờ đăng không hợp lệ.");
        message=await writePostDraft(db,actor,value("page"),value("brief"),publishAt); break;
      }
      default: throw new Error("Thao tác không hợp lệ.");
    }
  } catch (err) {
    message = err instanceof ZodError ? "Dữ liệu thiếu hoặc sai định dạng." : err instanceof Error ? err.message : "Thao tác thất bại.";
  }
  revalidatePath(path);
  redirect(path+"?result="+encodeURIComponent(message));
}
