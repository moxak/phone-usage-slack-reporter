// src/types/phoneUsage.ts
export interface PhoneUsageData {
  id: number;
  user_id: string;
  date: string;
  total_usage_time: number; // 分単位
  app_usage: Record<string, number>; // アプリ名: 使用時間(分)
  created_at: string;
}

export interface WeeklyReportData {
  userId: string;
  dates: string[];
  usageTimes: number[];
  topApps: Array<{name: string, time: number}>;
  weeklyAverage: number;
  previousWeekAverage: number;
  changePercentage: number;
}

// src/types/supabase.ts
export interface Database {
  public: {
    Tables: {
      phone_usage: {
        Row: {
          id: number;
          user_id: string;
          date: string;
          total_usage_time: number;
          app_usage: Record<string, number>;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          date: string;
          total_usage_time: number;
          app_usage: Record<string, number>;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          date?: string;
          total_usage_time?: number;
          app_usage?: Record<string, number>;
          created_at?: string;
        };
      };
    };
  };
}