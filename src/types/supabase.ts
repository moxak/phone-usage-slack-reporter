// src/types/supabase.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * Supabaseデータベースの型定義
 */
export interface Database {
  public: {
    Tables: {
      hourly_phone_usage: {
        Row: {
          id: string
          user_id: string
          date: string
          hour: number
          app_name: string
          usage_time: number
          open_count: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          hour: number
          app_name: string
          usage_time: number
          open_count: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          hour?: number
          app_name?: string
          usage_time?: number
          open_count?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hourly_phone_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      users: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          id: number
          user_id: string
          daily_usage_goal: number | null
          notification_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          daily_usage_goal?: number | null
          notification_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          daily_usage_goal?: number | null
          notification_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      daily_usage_summary: {
        Row: {
          user_id: string
          date: string
          total_usage_time: number
          unique_apps_used: number
          app_usage: Json
        }
        Relationships: [
          {
            foreignKeyName: "hourly_phone_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

/**
 * データベーステーブルから型を抽出するためのユーティリティ型
 */
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

/**
 * データベースビューから型を抽出するためのユーティリティ型
 */
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row']

/**
 * 時間ごとのスマホ使用状況データの型
 */
export type HourlyPhoneUsage = Tables<'hourly_phone_usage'>
export type InsertHourlyPhoneUsage = InsertTables<'hourly_phone_usage'>
export type UpdateHourlyPhoneUsage = UpdateTables<'hourly_phone_usage'>

/**
 * 日次使用状況サマリービューの型
 */
export type DailyUsageSummary = Views<'daily_usage_summary'>

/**
 * ユーザー情報の型
 */
export type User = Tables<'users'>
export type InsertUser = InsertTables<'users'>
export type UpdateUser = UpdateTables<'users'>

/**
 * ユーザー設定の型
 */
export type UserSettings = Tables<'user_settings'>
export type InsertUserSettings = InsertTables<'user_settings'>
export type UpdateUserSettings = UpdateTables<'user_settings'>

/**
 * アプリ使用状況の型 (集計データの内部構造)
 */
export interface AppUsageData {
  appName: string;
  usageTime: number;
  openCount: number;
}