/** Derived from checked-in migrations (including collaboration); not generated remotely. */
export type Status = 'todo' | 'in_progress' | 'done';
export type Priority = 'low' | 'normal' | 'high';
export interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string;
  created_at: string;
}
export interface ProjectRow {
  id: string;
  name: string;
  description: string;
  due_date: string | null;
  created_by: string;
  created_at: string;
}
export interface MembershipRow {
  project_id: string;
  user_id: string;
  role: 'leader' | 'member';
  created_at: string;
}
export interface SectionRow {
  id: string;
  project_id: string;
  name: string;
  position: number;
  created_at: string;
}
export interface TaskRow {
  id: string;
  project_id: string;
  section_id: string;
  title: string;
  description: string;
  guidance: string;
  status: Status;
  priority: Priority;
  assignee_id: string | null;
  due_at: string | null;
  position: number;
  created_at: string;
}
export interface StepRow {
  id: string;
  project_id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
}
export interface ResourceRow {
  id: string;
  project_id: string;
  task_id: string;
  title: string;
  url: string;
  description: string;
  position: number;
  created_at: string;
}
export interface SlotRow {
  id: string;
  project_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
}
export type BusyCategory =
  'class' | 'exam' | 'event' | 'study' | 'personal' | 'other';
export interface BusyEventRow {
  id: string;
  user_id: string;
  title: string;
  category: BusyCategory;
  description: string;
  starts_at: string;
  ends_at: string;
  recurrence: 'none' | 'daily' | 'weekly';
  time_zone: string;
  created_at: string;
}
export interface BusyPeriod {
  user_id: string;
  starts_at: string;
  ends_at: string;
}
export interface BusyOccurrence {
  event_id: string;
  starts_at: string;
  ends_at: string;
}
export interface CommentRow {
  id: string;
  project_id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}
export type NotificationKind =
  | 'discussion_added'
  | 'task_assigned'
  | 'task_status_changed'
  | 'task_completed'
  | 'comment_added'
  | 'deadline_changed'
  | 'deadline_approaching';
export interface NotificationRow {
  id: string;
  user_id: string;
  project_id: string;
  task_id: string | null;
  activity_id: string | null;
  actor_id: string | null;
  actor_name: string;
  kind: NotificationKind;
  task_status: Status | null;
  deadline_at: string | null;
  created_at: string;
  read_at: string | null;
}
export type ProjectDiscussionRow = Omit<CommentRow, 'task_id'>;
export type ProjectActivityKind =
  | 'task_created'
  | 'task_assigned'
  | 'task_reassigned'
  | 'task_status_changed'
  | 'task_completed'
  | 'deadline_changed'
  | 'comment_added'
  | 'discussion_added';
export interface ProjectActivityRow {
  id: string;
  project_id: string;
  task_id: string | null;
  task_title: string;
  actor_id: string | null;
  actor_name: string;
  kind: ProjectActivityKind;
  task_status: Status | null;
  deadline_at: string | null;
  assignee_name: string;
  created_at: string;
}
type Table<R, K extends keyof R> = {
  Row: { [P in keyof R]: R[P] };
  Insert: Pick<R, K> & Partial<Omit<R, K>>;
  Update: Partial<R>;
  Relationships: [];
};
// Queries deliberately select scalar columns and use the minimal roster RPC;
// relationship embeddings are not used. Generate relationship metadata from the
// applied schema before adding embedded selects; this type covers scalar access.
export interface Database {
  public: {
    Tables: {
      project_discussion_comments: Table<
        ProjectDiscussionRow,
        'project_id' | 'body'
      >;
      project_activities: Table<
        ProjectActivityRow,
        'project_id' | 'actor_name' | 'kind'
      >;
      task_comments: Table<CommentRow, 'project_id' | 'task_id' | 'body'>;
      notifications: Table<NotificationRow, 'user_id' | 'project_id' | 'kind'>;
      busy_events: Table<
        BusyEventRow,
        'user_id' | 'title' | 'category' | 'starts_at' | 'ends_at' | 'time_zone'
      >;
      profiles: Table<ProfileRow, 'id'>;
      projects: Table<ProjectRow, 'name' | 'created_by'>;
      project_members: Table<MembershipRow, 'project_id' | 'user_id' | 'role'>;
      sections: Table<SectionRow, 'project_id' | 'name'>;
      tasks: Table<TaskRow, 'project_id' | 'section_id' | 'title'>;
      task_steps: Table<StepRow, 'project_id' | 'task_id' | 'title'>;
      task_resources: Table<
        ResourceRow,
        'project_id' | 'task_id' | 'title' | 'url'
      >;
      availability_slots: Table<
        SlotRow,
        'project_id' | 'user_id' | 'starts_at' | 'ends_at'
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      refresh_deadline_reminders: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_own_busy_occurrences: {
        Args: { p_start: string; p_end: string };
        Returns: BusyOccurrence[];
      };
      get_project_busy_periods: {
        Args: { p_project_id: string; p_start: string; p_end: string };
        Returns: BusyPeriod[];
      };
      create_project: {
        Args: {
          p_name: string;
          p_description?: string;
          p_due_date?: string | null;
        };
        Returns: string;
      };
      add_project_member_by_email: {
        Args: { p_project_id: string; p_email: string };
        Returns: undefined;
      };
      remove_project_member: {
        Args: { p_project_id: string; p_user_id: string };
        Returns: undefined;
      };
      delete_project: { Args: { p_project_id: string }; Returns: undefined };
      get_project_member_display: {
        Args: { p_project_id: string };
        Returns: { user_id: string; display_name: string }[];
      };
      reorder_sections: {
        Args: { p_project_id: string; p_ids: string[] };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
export type Member = MembershipRow & { display_name: string };
export interface ProjectBundle {
  project: ProjectRow;
  sections: SectionRow[];
  tasks: TaskRow[];
  members: Member[];
}
