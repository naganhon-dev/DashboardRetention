export type FlowStatus = 'Active' | 'Graduated';
export type SystemStatus = 'Green' | 'Yellow' | 'Red' | 'Graduated' | 'Churn' | 'Freeze';

export interface Flow {
  id: string;
  flow_number: number;
  start_date: string; // ISO date string
  status: FlowStatus;
}

export interface NominalTotals {
  total_base_contacts: number;
  ok_clients_graduated: number;
  archived_slag_churn: number;
  active_training_capital: number;
}

export interface OperationalCards {
  in_norm_green: number;
  lagging_yellow: number;
  critical_red: number;
  not_started: number;
}

export interface GlobalPercentages {
  completion_rate: string;
  operational_active_retention: string;
}

export interface CallQueueItem {
  email: string;
  flow: number;
  current_unit: number;
  delta: number;
  reason: string;
}

export interface AIMetrics {
  nominal_totals: NominalTotals;
  operational_cards: OperationalCards;
  global_percentages: GlobalPercentages;
  today_call_queue: CallQueueItem[];
}

export interface StudentSnapshot {
  id?: string;
  email: string;
  flow_number: number;
  current_unit: number;
  snapshot_date: string; // ISO date string
  calculated_delta: number;
  system_status: SystemStatus;
  no_movement_counter: number;
  next_contact_date?: string; // 'yyyy-MM-dd' or ISO
  manual_status?: 'Freeze' | 'Churn' | 'FollowUp' | 'ND' | null;
}

export type InteractionType = 'Звонок' | 'Telegram';
export type ResultStatus = 'Заморозка' | 'Отказ / Закрыть' | 'В работе / На контроле' | 'НД' | 'Мороз' | 'Перенос потока';

export interface Interaction {
  id: string;
  student_email: string;
  type: InteractionType;
  result_status: ResultStatus;
  comment: string;
  next_contact_date?: string;
  created_at: string;
}
