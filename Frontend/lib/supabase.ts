import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          domain: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          domain: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          domain?: string
          created_at?: string
        }
      }
      admins: {
        Row: {
          id: string
          email: string
          name: string | null
          company_id: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          company_id: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          company_id?: string
          created_at?: string
        }
      }
      employees: {
        Row: {
          id: string
          email: string
          name: string | null
          company_id: string
          joined_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          company_id: string
          joined_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          company_id?: string
          joined_at?: string
        }
      }
      training_modules: {
        Row: {
          id: string
          company_id: string
          title: string
          description: string | null
          content_type: string
          content_url: string
          gpt_summary: string | null
          transcription: string | null
          ai_modules: string | null
          ai_topics: string | null
          ai_objectives: string | null
          processing_status: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          title: string
          description?: string | null
          content_type: string
          content_url: string
          gpt_summary?: string | null
          transcription?: string | null
          ai_modules?: string | null
          ai_topics?: string | null
          ai_objectives?: string | null
          processing_status?: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          title?: string
          description?: string | null
          content_type?: string
          content_url?: string
          gpt_summary?: string | null
          transcription?: string | null
          ai_modules?: string | null
          ai_topics?: string | null
          ai_objectives?: string | null
          processing_status?: string
          created_at?: string
        }
      },
      assessments: {
        Row: {
          id: string;
          type: string; // e.g., 'baseline', 'module', etc.
          questions: string; // JSON stringified array of questions
          created_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          questions: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          questions?: string;
          created_at?: string;
        };
      },
      employee_assessments: {
        Row: {
          id: string;
          employee_id: string;
          assessment_id: string;
          score: number;
          max_score: number;
          answers: any; // jsonb
          feedback: string; // summary feedback
          question_feedback: any; // jsonb, new: question-wise feedback
        };
        Insert: {
          id?: string;
          employee_id: string;
          assessment_id: string;
          score: number;
          max_score: number;
          answers: any;
          feedback: string;
          question_feedback: any;
        };
        Update: {
          id?: string;
          employee_id?: string;
          assessment_id?: string;
          score?: number;
          max_score?: number;
          answers?: any;
          feedback?: string;
          question_feedback?: any;
        };
      }
    }
  }
}
