// src/types/phoneUsage.ts

// 週間レポートデータの型定義（時間帯別積み上げ棒グラフ対応）
export interface WeeklyReportData {
  userId: string;
  dates: string[];
  usageTimes: number[];
  topApps: Array<{name: string, time: number, openCount: number}>;
  weeklyAverage: number;
  previousWeekAverage: number;
  changePercentage: number;
  hourlyDistribution: number[]; // 時間帯別の使用時間分布 (0-23時)
  // 日毎の積み上げ棒グラフ用データ
  stackedBarData: Array<{
    appName: string;
    values: number[]; // 各日付の使用時間
  }>;
  
  // 時間帯別積み上げ棒グラフ用データ
  hourlyStackedData: Array<{
    appName: string;
    values: number[]; // 各時間帯の使用時間
  }>;
  hourLabels: string[]; // 時間ラベル (0時-23時)
}

// 日次レポートデータの型定義
export interface DailyReportData {
  userId: string;
  date: string; // YYYY-MM-DD形式
  formattedDate: string; // 表示用フォーマット (例: 2025年4月3日)
  
  // 1日の集計データ
  totalUsageTime: number; // 合計使用時間（分）
  previousDayTotalUsageTime: number; // 前日の合計使用時間
  changePercentage: number; // 前日との変化率
  
  // 時間帯別データ
  hourlyUsage: number[]; // 時間ごとの合計使用時間 (0-23時)
  hourLabels: string[]; // 時間ラベル (0時-23時)
  
  // アプリ別使用時間
  appUsage: Array<{
    appName: string;
    usageTime: number;
    percentage: number;
    openCount: number;
  }>;
  
  // 時間帯別アプリ使用データ (積み上げ棒グラフ用)
  hourlyAppData: Array<{
    appName: string;
    values: number[]; // 各時間帯の使用時間 (0-23時)
  }>;
  
  // 追加指標
  mostActiveHour: number; // 最も使用時間が多い時間帯
  mostUsedApp: string; // 最も使用時間が長いアプリ
  appCount: number; // 使用されたアプリの数
}


/**
 * 毎時レポートデータの型定義を更新
 */
export interface HourlyReportData {
  userId: string;
  currentHour: number; // 現在の時間 (0-23)
  currentHourUsage: number; // 現在の時間の合計使用時間
  previousHourUsage: number; // 前の時間の合計使用時間
  changePercentage: number; // 使用時間の変化率
  topAppsCurrentHour: Array<{name: string, time: number, openCount: number}>; // 現在の時間のトップアプリ
  dailyAccumulatedTime: number; // 今日の累積使用時間
  yesterdayAccumulatedTime: number; // 昨日の同時刻までの累積使用時間
  dailyChangePercentage: number; // 昨日との比較
  hourlyTrend: {hours: string[], values: number[]}; // 過去6時間の時間別使用時間
  // 追加: 過去6時間の時間帯別アプリ使用データ（積み上げ棒グラフ用）
  hourlyAppStackData: Array<{
    appName: string;
    values: number[]; // 各時間帯の使用時間 (最大6時間分)
  }>;
}