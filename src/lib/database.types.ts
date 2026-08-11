export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PanelType =
  | "tasks"
  | "habits"
  | "mood"
  | "priorities"
  | "water"
  | "weather"
  | "calendar"
  | "time";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          timezone: string;
          location: string | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          timezone?: string;
          location?: string | null;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      dashboards: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dashboards"]["Insert"]>;
      };
      dashboard_panels: {
        Row: {
          id: string;
          dashboard_id: string;
          user_id: string;
          panel_type: string;
          config: Json;
          x: number;
          y: number;
          w: number;
          h: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dashboard_id: string;
          user_id: string;
          panel_type: string;
          config?: Json;
          x?: number;
          y?: number;
          w?: number;
          h?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dashboard_panels"]["Insert"]>;
      };
      captures: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          tags: string[];
          priority: "low" | "medium" | "high" | null;
          visibility: "private" | "public";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          tags?: string[];
          priority?: "low" | "medium" | "high" | null;
          visibility?: "private" | "public";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["captures"]["Insert"]>;
      };
      blog_posts: {
        Row: {
          id: string;
          user_id: string;
          post_date: string;
          private_summary: string;
          public_summary: string;
          notes_snapshot: Json;
          day_context: Json;
          is_public: boolean;
          model: string | null;
          generated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          post_date: string;
          private_summary: string;
          public_summary: string;
          notes_snapshot?: Json;
          day_context?: Json;
          is_public?: boolean;
          model?: string | null;
          generated_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blog_posts"]["Insert"]>;
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          notes: string | null;
          status: "todo" | "done";
          priority: "low" | "medium" | "high";
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          notes?: string | null;
          status?: "todo" | "done";
          priority?: "low" | "medium" | "high";
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
      };
      habits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["habits"]["Insert"]>;
      };
      habit_logs: {
        Row: {
          id: string;
          user_id: string;
          habit_id: string;
          log_date: string;
          completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          habit_id: string;
          log_date: string;
          completed?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["habit_logs"]["Insert"]>;
      };
      mood_logs: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          mood: number;
          energy: number | null;
          stress: number | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          log_date: string;
          mood: number;
          energy?: number | null;
          stress?: number | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["mood_logs"]["Insert"]>;
      };
      daily_priorities: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          tier: "must" | "should" | "nice";
          done: boolean;
          priority_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          tier: "must" | "should" | "nice";
          done?: boolean;
          priority_date?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_priorities"]["Insert"]>;
      };
      water_logs: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          glasses: number;
          goal: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          log_date?: string;
          glasses?: number;
          goal?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["water_logs"]["Insert"]>;
      };
      calendar_events: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          starts_at: string;
          ends_at: string | null;
          all_day: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          starts_at: string;
          ends_at?: string | null;
          all_day?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["calendar_events"]["Insert"]>;
      };
      time_entries: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          description: string;
          started_at: string;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id?: string | null;
          description?: string;
          started_at: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["time_entries"]["Insert"]>;
      };
    };
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Dashboard = Database["public"]["Tables"]["dashboards"]["Row"];
export type DashboardPanel =
  Database["public"]["Tables"]["dashboard_panels"]["Row"];
export type Capture = Database["public"]["Tables"]["captures"]["Row"];
export type BlogPost = Database["public"]["Tables"]["blog_posts"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Habit = Database["public"]["Tables"]["habits"]["Row"];
export type HabitLog = Database["public"]["Tables"]["habit_logs"]["Row"];
export type MoodLog = Database["public"]["Tables"]["mood_logs"]["Row"];
export type DailyPriority =
  Database["public"]["Tables"]["daily_priorities"]["Row"];
export type WaterLog = Database["public"]["Tables"]["water_logs"]["Row"];
export type CalendarEvent =
  Database["public"]["Tables"]["calendar_events"]["Row"];
export type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];
