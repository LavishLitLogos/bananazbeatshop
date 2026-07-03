import { supabase } from '../lib/supabase';
import { appStorage, type ProducerProfileState } from './appStorage';

export const PROFILE_IMAGE_STORAGE_KEY = 'thisbeatizbananaz.profileImageUrl.v1';

type ProducerProfileRow = {
  id: string;
  display_name: string | null;
  headline: string | null;
  slogan_quote: string | null;
  about_producer: string | null;
  bio: string | null;
  label: string | null;
  top_5_producers: string[] | null;
  favorite_producers: string[] | null;
  favorite_daws: string[] | null;
  partners: string | null;
  instagram_handle: string | null;
  threads_handle: string | null;
  youtube_handle: string | null;
  facebook_handle: string | null;
  additional_info: string | null;
  profile_image_url: string | null;
  qr_footer_enabled: boolean | null;
};

function readStoredProfileImageUrl() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(PROFILE_IMAGE_STORAGE_KEY) || '';
}

export function saveStoredProfileImageUrl(url: string) {
  if (typeof window === 'undefined') {
    return;
  }

  if (url) {
    window.localStorage.setItem(PROFILE_IMAGE_STORAGE_KEY, url);
  } else {
    window.localStorage.removeItem(PROFILE_IMAGE_STORAGE_KEY);
  }
}

function mapRowToProfile(row: ProducerProfileRow): ProducerProfileState {
  return {
    displayName: row.display_name || 'ThisBeatIzBananaz',
    headline: row.headline || '',
    sloganQuote: row.slogan_quote || '',
    aboutProducer: row.about_producer || '',
    bio: row.bio || '',
    label: row.label || '',
    topFiveProducers: Array.isArray(row.top_5_producers) ? row.top_5_producers.filter(Boolean) : [],
    favoriteProducers: Array.isArray(row.favorite_producers) ? row.favorite_producers.filter(Boolean) : [],
    favoriteDaws: Array.isArray(row.favorite_daws) ? row.favorite_daws.filter(Boolean) : [],
    partners: row.partners || '',
    socials: {
      instagram: row.instagram_handle || '',
      threads: row.threads_handle || '',
      youtube: row.youtube_handle || '',
      facebook: row.facebook_handle || '',
    },
    additionalInfo: row.additional_info || '',
    showQrFooter: row.qr_footer_enabled !== false,
  };
}

function mapProfileToRow(profile: ProducerProfileState, profileImageUrl: string) {
  return {
    display_name: profile.displayName.trim() || 'ThisBeatIzBananaz',
    headline: profile.headline.trim(),
    slogan_quote: profile.sloganQuote.trim(),
    about_producer: profile.aboutProducer.trim(),
    bio: profile.bio.trim(),
    label: profile.label.trim(),
    top_5_producers: profile.topFiveProducers.filter(Boolean),
    favorite_producers: profile.favoriteProducers.filter(Boolean),
    favorite_daws: profile.favoriteDaws.filter(Boolean),
    partners: profile.partners.trim(),
    instagram_handle: profile.socials.instagram.trim(),
    threads_handle: profile.socials.threads.trim(),
    youtube_handle: profile.socials.youtube.trim(),
    facebook_handle: profile.socials.facebook.trim(),
    additional_info: profile.additionalInfo.trim(),
    profile_image_url: profileImageUrl.trim(),
    qr_footer_enabled: profile.showQrFooter,
  };
}

export async function loadProducerProfile() {
  const localProfile = appStorage.getProfile();
  const localImageUrl = readStoredProfileImageUrl();

  const { data, error } = await supabase
    .from('producer_profile')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      profile: localProfile,
      profileImageUrl: localImageUrl,
      profileId: null as string | null,
    };
  }

  const mappedProfile = mapRowToProfile(data as ProducerProfileRow);
  const profileImageUrl = (data as ProducerProfileRow).profile_image_url || localImageUrl;

  appStorage.saveProfile(mappedProfile);
  saveStoredProfileImageUrl(profileImageUrl);

  return {
    profile: mappedProfile,
    profileImageUrl,
    profileId: (data as ProducerProfileRow).id,
  };
}

export async function saveProducerProfile(
  profile: ProducerProfileState,
  profileImageUrl: string,
  existingId?: string | null
) {
  const payload = mapProfileToRow(profile, profileImageUrl);
  let targetId = existingId || null;

  if (!targetId) {
    const { data: existing } = await supabase
      .from('producer_profile')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    targetId = existing?.id || null;
  }

  const query = targetId
    ? supabase.from('producer_profile').update(payload).eq('id', targetId)
    : supabase.from('producer_profile').insert(payload).select('id').single();

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  appStorage.saveProfile(profile);
  saveStoredProfileImageUrl(profileImageUrl);

  return {
    profile,
    profileImageUrl,
    profileId: targetId || (data as { id: string } | null)?.id || null,
  };
}
