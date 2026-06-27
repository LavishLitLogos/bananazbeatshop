export interface Beat {
  id: string;
  title: string;
  cover_art_url?: string;
  audio_file_url?: string;
  price: number;
  is_free: boolean;
  sold: boolean;
  release_download: boolean;
  exclusive: boolean;
  bananaz_exclusive: boolean;
  no_sharing: boolean;
  hidden: boolean;
  admin_approved?: boolean;
  admin_notes?: string;
  style?: string;
  vibe?: string;
  genre?: string;
  type?: string;
  mood?: string;
  artist_suggestion?: string;
  description?: string;
  terms?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  beat_id?: string;
  beat_name: string;
  beat_thumbnail?: string;
  buyer_name: string;
  buyer_email: string;
  payment_method: string;
  payment_destination?: string;
  amount?: number;
  status: 'Pending Verification' | 'Released' | 'Sold' | 'Rejected';
  release_download: boolean;
  sold: boolean;
  admin_approved?: boolean;
  admin_notes?: string;
  payment_received?: boolean;
  created_at: string;
  updated_at: string;
}

export interface BeatTape {
  id: string;
  title: string;
  cover_art_url?: string;
  price: number;
  is_free: boolean;
  colab_usable: boolean;
  hidden: boolean;
  admin_approved?: boolean;
  admin_notes?: string;
  description?: string;
  tracks?: BeatTapeTrack[];
  created_at: string;
  updated_at: string;
}

export interface BeatTapeTrack {
  id: string;
  tape_id: string;
  title: string;
  audio_file_url?: string;
  track_order: number;
  created_at: string;
}

export interface ProdBySong {
  id: string;
  title: string;
  artist_name?: string;
  audio_file_url?: string;
  cover_art_url?: string;
  description?: string;
  rights_text?: string;
  hidden: boolean;
  admin_approved?: boolean;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LabMessage {
  id: string;
  sender_type: 'guest' | 'admin';
  sender_name: string;
  sender_avatar?: string;
  text?: string;
  attachments: any[];
  room: string;
  topic?: string;
  reactions: Record<string, string[]>;
  reply_to?: string;
  is_automated: boolean;
  admin_approved?: boolean;
  created_at: string;
}

export interface Submission {
  id: string;
  buyer_name: string;
  buyer_email: string;
  beat_id?: string;
  song_file_url?: string;
  song_title: string;
  status: 'Pending' | 'Accepted' | 'Rejected';
  mic_rating?: number;
  accepted: boolean;
  rejected: boolean;
  produced_by_toggle: boolean;
  exclusive_toggle: boolean;
  list_eligible_toggle: boolean;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: string;
  payment_methods: {
    paypal: string;
    cashapp: string;
  };
  profile: {
    image?: string;
    quote?: string;
    bio?: string;
    email?: string;
    other_link?: string;
    media?: string[];
  };
  social_links: {
    other?: string;
  };
  leasing_terms: string;
  notification_email: string;
  automated_comments_enabled: boolean;
  bananaz_mode_settings: {
    colorTheme: string;
    active: boolean;
  };
  famz_count: number;
  sales_count: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  read: boolean;
  data: any;
  created_at: string;
}

export type Room =
  | 'home'
  | 'beatlab'
  | 'freedls'
  | 'beattapes'
  | 'prodby'
  | 'credits'
  | 'thelab'
  | 'beatbayngr'
  | 'supamaster'
  | 'submission'
  | 'profile'
  | 'admin'
  | 'exclusives';

export type LabTopic =
  | 'chat'
  | 'drops'
  | 'exclusives'
  | 'giftdrop'
  | 'updates'
  | 'colab'
  | 'prodtalk'
  | 'cookup';
