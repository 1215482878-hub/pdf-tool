// Supabase 客户端 — 用于记录使用统计（不记也能用）
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// 仅在配置了 Supabase 时初始化
export const supabase =
  supabaseUrl && supabaseKey && !supabaseUrl.includes("your-project")
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export interface DownloadRecord {
  id?: number;
  filename: string;
  page_count: number;
  table_count: number;
  created_at?: string;
}

/**
 * 记录一次下载
 */
export async function recordDownload(
  filename: string,
  pageCount: number,
  tableCount: number
): Promise<void> {
  if (!supabase) return;

  try {
    const { error } = await supabase.from("downloads").insert({
      filename,
      page_count: pageCount,
      table_count: tableCount,
    });

    if (error) {
      console.error("记录下载失败:", error.message);
    }
  } catch (e) {
    // 数据库未建表时会报错，静默忽略
    console.error("Supabase 不可用，跳过记录:", e);
  }
}
