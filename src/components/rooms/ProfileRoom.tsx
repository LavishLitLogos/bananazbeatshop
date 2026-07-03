import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  Download,
  Edit3,
  ExternalLink,
  Flame,
  Image as ImageIcon,
  Link as LinkIcon,
  Plus,
  Save,
  Share2,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { ShareButton } from '../ui/ShareButton';
import { uploadProfileMedia } from '../../services/uploadService';
import {
  appStorage,
  type ProducerProfileState,
  type SocialHandles,
} from '../../services/appStorage';

const MAIN_LOGO = '/assets/images/thisbeatizbananazmainlogo copy.png';
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;
const PROFILE_IMAGE_STORAGE_KEY = 'thisbeatizbananaz.profileImageUrl.v1';

interface PartnerLink {
  id: string;
  title: string;
  url: string;
  image_url?: string | null;
  description?: string | null;
  sort_order?: number | null;
}

interface ProfileMedia {
  id: string;
  url: string;
  type: 'image' | 'video';
  title?: string | null;
  download_enabled?: boolean | null;
  sort_order?: number | null;
}

type ProfileField = {
  label: string;
  value: string;
  field: keyof Pick<
    ProducerProfileState,
    | 'displayName'
    | 'headline'
    | 'sloganQuote'
    | 'aboutProducer'
    | 'bio'
    | 'label'
    | 'partners'
    | 'additionalInfo'
  >;
  textarea?: boolean;
};

type ListField = {
  label: string;
  field: keyof Pick<
    ProducerProfileState,
    'topFiveProducers' | 'favoriteProducers' | 'favoriteDaws'
  >;
  value: string[];
};

type SocialField = {
  label: string;
  field: keyof SocialHandles;
  value: string;
};

function safeUrl(url?: string | null) {
  return url || MAIN_LOGO;
}

function getProfileShareUrl() {
  return `${window.location.origin}${window.location.pathname}#profile`;
}

function readProfileImageUrl() {
  if (typeof window === 'undefined') {
    return MAIN_LOGO;
  }

  return window.localStorage.getItem(PROFILE_IMAGE_STORAGE_KEY) || MAIN_LOGO;
}

function saveProfileImageUrl(url: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PROFILE_IMAGE_STORAGE_KEY, url);
}

function joinList(items: string[]) {
  return items.filter(Boolean).join(', ');
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanHandle(value: string) {
  return value.trim().replace(/^@+/, '');
}

function socialUrl(platform: keyof SocialHandles, handle: string) {
  const clean = cleanHandle(handle);
  if (!clean) return '';

  if (platform === 'instagram') return `https://instagram.com/${clean}`;
  if (platform === 'threads') return `https://threads.net/@${clean}`;
  if (platform === 'youtube') return `https://youtube.com/@${clean}`;
  return `https://facebook.com/${clean}`;
}

function SocialLink({ platform, handle }: { platform: keyof SocialHandles; handle: string }) {
  const clean = cleanHandle(handle);
  const url = socialUrl(platform, clean);

  if (!clean || !url) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-xl bg-black/45 border border-[#242424] px-3 py-2 text-xs text-[#ddd] hover:border-[#f5c518]/45 hover:text-[#f5c518] transition-all flex items-center justify-between gap-2"
    >
      <span className="uppercase tracking-[0.16em] text-[9px] text-[#777]">
        {platform === 'youtube' ? 'YT' : platform}
      </span>
      <span className="truncate">@{clean}</span>
    </a>
  );
}

export function ProfileRoom() {
  const {
    goBack,
    setCurrentRoom,
    isAdmin,
    addToast,
    refreshContent,
    refreshKey,
  } = useApp();

  const [profile, setProfile] = useState<ProducerProfileState>(() => appStorage.getProfile());
  const [profileImageUrl, setProfileImageUrl] = useState(readProfileImageUrl);
  const [partners, setPartners] = useState<PartnerLink[]>([]);
  const [media, setMedia] = useState<ProfileMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [partnersOpen, setPartnersOpen] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [profileUploading, setProfileUploading] = useState(false);

  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const fetchProfileExtras = useCallback(async () => {
    setLoading(true);
    setProfile(appStorage.getProfile());
    setProfileImageUrl(readProfileImageUrl());

    const { data: partnerData } = await supabase
      .from('profile_partners')
      .select('*')
      .order('sort_order', { ascending: true });

    setPartners((partnerData || []) as PartnerLink[]);

    const { data: mediaData } = await supabase
      .from('profile_media')
      .select('*')
      .order('sort_order', { ascending: true });

    setMedia((mediaData || []) as ProfileMedia[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfileExtras();
  }, [fetchProfileExtras, refreshKey]);

  useEffect(() => {
    const handleStorageUpdate = () => {
      setProfile(appStorage.getProfile());
      setProfileImageUrl(readProfileImageUrl());
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('bananaz-app-storage:update', handleStorageUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('bananaz-app-storage:update', handleStorageUpdate);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('profile-room-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profile_partners' },
        () => {
          fetchProfileExtras();
          refreshContent();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profile_media' },
        () => {
          fetchProfileExtras();
          refreshContent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProfileExtras, refreshContent]);

  const profileRows = useMemo<ProfileField[]>(
    () => [
      { label: 'Display Name', value: profile.displayName, field: 'displayName' },
      { label: 'Headline / Tags', value: profile.headline, field: 'headline' },
      { label: 'Slogan / Quote', value: profile.sloganQuote, field: 'sloganQuote', textarea: true },
      { label: 'About the Producer', value: profile.aboutProducer, field: 'aboutProducer', textarea: true },
      { label: 'Bio', value: profile.bio, field: 'bio', textarea: true },
      { label: 'Label', value: profile.label, field: 'label' },
      { label: 'Partners', value: profile.partners, field: 'partners', textarea: true },
      { label: 'Additional Info', value: profile.additionalInfo, field: 'additionalInfo', textarea: true },
    ],
    [profile]
  );

  const listRows = useMemo<ListField[]>(
    () => [
      { label: 'Top 5 Producers', field: 'topFiveProducers', value: profile.topFiveProducers },
      { label: 'Favorite Producers', field: 'favoriteProducers', value: profile.favoriteProducers },
      { label: 'Favorite DAWs', field: 'favoriteDaws', value: profile.favoriteDaws },
    ],
    [profile]
  );

  const socialRows = useMemo<SocialField[]>(
    () => [
      { label: 'Instagram @', field: 'instagram', value: profile.socials.instagram },
      { label: 'Threads @', field: 'threads', value: profile.socials.threads },
      { label: 'YouTube @', field: 'youtube', value: profile.socials.youtube },
      { label: 'Facebook @', field: 'facebook', value: profile.socials.facebook },
    ],
    [profile.socials]
  );

  const visibleProfileRows = profileRows.filter((row) => editMode || row.value.trim());
  const visibleListRows = listRows.filter((row) => editMode || row.value.length > 0);
  const hasSocials = Object.values(profile.socials).some((value) => value.trim());

  const updateProfileField = (field: ProfileField['field'], value: string) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateListField = (field: ListField['field'], value: string) => {
    setProfile((current) => ({
      ...current,
      [field]: splitList(value),
    }));
  };

  const updateSocialField = (field: keyof SocialHandles, value: string) => {
    setProfile((current) => ({
      ...current,
      socials: {
        ...current.socials,
        [field]: cleanHandle(value),
      },
    }));
  };

  const handleSaveProfile = () => {
    setSaving(true);
    appStorage.saveProfile(profile);
    saveProfileImageUrl(profileImageUrl);
    addToast('Profile saved.', 'success');
    setSaving(false);
    setEditMode(false);
    refreshContent();
  };

  const handleProfileImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      addToast('Max upload is 40MB.', 'error');
      return;
    }

    setProfileUploading(true);

    try {
      const result = await uploadProfileMedia(file);
      setProfileImageUrl(result.url);
      saveProfileImageUrl(result.url);
      addToast('Profile image uploaded.', 'success');
    } catch {
      addToast('Profile image upload failed. Check profile-media storage bucket.', 'error');
    }

    setProfileUploading(false);
  };

  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      addToast('Max upload is 40MB.', 'error');
      return;
    }

    setMediaUploading(true);

    try {
      const result = await uploadProfileMedia(file);
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      const { error } = await supabase.from('profile_media').insert({
        url: result.url,
        type: mediaType,
        title: file.name.replace(/\.[^/.]+$/, ''),
        download_enabled: false,
        sort_order: media.length + 1,
      });

      if (error) {
        addToast('Media save failed.', 'error');
        setMediaUploading(false);
        return;
      }

      addToast('Media uploaded.', 'success');
      await fetchProfileExtras();
      refreshContent();
    } catch {
      addToast('Media upload failed. Check profile-media storage bucket.', 'error');
    }

    setMediaUploading(false);
  };

  const handleAddPartner = async () => {
    const title = window.prompt('Partner name:');
    if (!title?.trim()) return;

    const url = window.prompt('Partner link URL:');
    if (!url?.trim()) return;

    const { error } = await supabase.from('profile_partners').insert({
      title: title.trim(),
      url: url.trim(),
      image_url: '',
      description: '',
      sort_order: partners.length + 1,
    });

    if (error) {
      addToast('Partner save failed.', 'error');
      return;
    }

    addToast('Partner added.', 'success');
    await fetchProfileExtras();
    refreshContent();
  };

  const handleEditPartner = async (partner: PartnerLink) => {
    const title = window.prompt('Partner name:', partner.title);
    if (!title?.trim()) return;

    const url = window.prompt('Partner link URL:', partner.url);
    if (!url?.trim()) return;

    const imageUrl = window.prompt('Preview image URL:', partner.image_url || '') || '';
    const description = window.prompt('Description:', partner.description || '') || '';

    const { error } = await supabase
      .from('profile_partners')
      .update({
        title: title.trim(),
        url: url.trim(),
        image_url: imageUrl.trim(),
        description: description.trim(),
      })
      .eq('id', partner.id);

    if (error) {
      addToast('Partner update failed.', 'error');
      return;
    }

    addToast('Partner updated.', 'success');
    await fetchProfileExtras();
    refreshContent();
  };

  const handleDeletePartner = async (partner: PartnerLink) => {
    const confirmed = window.confirm(`Delete partner "${partner.title}"?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('profile_partners')
      .delete()
      .eq('id', partner.id);

    if (error) {
      addToast('Partner delete failed.', 'error');
      return;
    }

    addToast('Partner deleted.', 'success');
    await fetchProfileExtras();
    refreshContent();
  };

  const handleToggleMediaDownload = async (item: ProfileMedia) => {
    const { error } = await supabase
      .from('profile_media')
      .update({
        download_enabled: !item.download_enabled,
      })
      .eq('id', item.id);

    if (error) {
      addToast('Media permission update failed.', 'error');
      return;
    }

    addToast('Download permission updated.', 'success');
    await fetchProfileExtras();
    refreshContent();
  };

  const handleDeleteMedia = async (item: ProfileMedia) => {
    const confirmed = window.confirm(`Delete "${item.title || 'media'}"?`);
    if (!confirmed) return;

    const { error } = await supabase.from('profile_media').delete().eq('id', item.id);

    if (error) {
      addToast('Media delete failed.', 'error');
      return;
    }

    addToast('Media deleted.', 'success');
    await fetchProfileExtras();
    refreshContent();
  };

  const handleDownloadMedia = (item: ProfileMedia) => {
    if (!item.download_enabled && !isAdmin) {
      addToast('Download is not enabled for this media.', 'info');
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = item.url;
    anchor.download = item.title || 'thisbeatizbananaz-media';
    anchor.rel = 'noopener';
    anchor.click();
  };

  const handleShareProfile = async () => {
    const url = getProfileShareUrl();

    const shareData = {
      title: `${profile.displayName || 'ThisBeatIzBananaz'} Profile`,
      text: profile.sloganQuote || 'Tap into ThisBeatIzBananaz.',
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(url);
      addToast('Profile link copied.', 'success');
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        addToast('Profile link copied.', 'success');
      } catch {
        addToast('Share failed.', 'error');
      }
    }
  };

  return (
    <div id="profile" className="min-h-screen">
      <div className="sticky top-0 z-40 bg-[#080808]/92 backdrop-blur-xl border-b border-[#1a1a1a] pt-safe">
        <div className="flex items-center justify-between px-3 py-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors flex-shrink-0"
              aria-label="Back"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              onClick={() => setCurrentRoom('home')}
              className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0"
              aria-label="Home"
            >
              <img src={MAIN_LOGO} alt="Home" className="w-full h-full object-contain" />
            </button>

            <div className="min-w-0">
              <h1 className="font-display font-900 text-lg uppercase tracking-wide text-white leading-none truncate">
                Profile
              </h1>

              <p className="text-[10px] text-[#555] mt-0.5 truncate">
                {profile.displayName || 'ThisBeatIzBananaz'} · Profile
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ShareButton
              small
              title={`${profile.displayName || 'ThisBeatIzBananaz'} Profile`}
              text={profile.sloganQuote || 'Tap into ThisBeatIzBananaz.'}
            />

            <button
              onClick={handleShareProfile}
              className="p-2 rounded-xl bg-[#111] border border-[#1e1e1e] text-[#888] hover:text-[#f5c518] transition-all"
              aria-label="Share profile"
            >
              <Share2 size={15} />
            </button>

            {isAdmin && (
              <button
                onClick={() => setEditMode(!editMode)}
                className={`p-2 rounded-xl border transition-all ${
                  editMode
                    ? 'bg-[#f5c518] border-[#f5c518] text-black'
                    : 'bg-[#111] border-[#1e1e1e] text-[#888]'
                }`}
                title="Edit profile"
              >
                {editMode ? <X size={15} /> : <Edit3 size={15} />}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 py-4 pb-32 space-y-4">
        {loading ? (
          <div className="rounded-3xl bg-[#111] border border-[#1e1e1e] h-80 animate-pulse" />
        ) : (
          <>
            <div className="rounded-3xl bg-[#0f0f0f] border border-[#1e1e1e] overflow-hidden">
              <div className="relative h-36 bg-[radial-gradient(circle_at_50%_0%,rgba(245,197,24,0.28),transparent_55%)]">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0f0f0f]" />

                <div className="absolute left-4 -bottom-12">
                  <button
                    onClick={() => isAdmin && editMode && profileImageInputRef.current?.click()}
                    className="w-28 h-28 rounded-3xl overflow-hidden bg-black border-2 border-[#f5c518]/35 shadow-2xl"
                  >
                    <img
                      src={safeUrl(profileImageUrl)}
                      alt={profile.displayName || 'ThisBeatIzBananaz'}
                      className="w-full h-full object-cover"
                    />
                  </button>

                  <input
                    ref={profileImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfileImageUpload}
                  />
                </div>
              </div>

              <div className="pt-16 px-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display font-900 text-2xl text-white uppercase leading-tight break-words">
                      {profile.displayName || 'ThisBeatIzBananaz'}
                    </h2>

                    {(profile.headline || editMode) && (
                      <p className="text-[#f5c518] text-xs uppercase tracking-[0.18em] mt-1 break-words">
                        {profile.headline || 'Add profile headline in admin edit mode'}
                      </p>
                    )}

                    {profile.sloganQuote && (
                      <p className="text-sm text-[#d8d8d8] mt-3 leading-relaxed italic">
                        "{profile.sloganQuote}"
                      </p>
                    )}
                  </div>

                  {profileUploading && (
                    <span className="text-[10px] text-[#f5c518]">
                      Uploading...
                    </span>
                  )}
                </div>

                {editMode && isAdmin && (
                  <div className="rounded-2xl bg-black/35 border border-[#1e1e1e] p-3 mt-5">
                    <div className="text-[10px] text-[#666] uppercase tracking-[0.22em] mb-2">
                      Profile Image
                    </div>

                    <button
                      onClick={() => profileImageInputRef.current?.click()}
                      className="w-full rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-[#ddd] hover:border-[#f5c518]/45 transition-all flex items-center justify-center gap-2"
                    >
                      <Upload size={15} />
                      Upload Profile Image
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 mt-5">
                  {visibleProfileRows.map((row) => (
                    <div
                      key={row.field}
                      className="rounded-2xl bg-black/35 border border-[#1e1e1e] p-3"
                    >
                      <div className="text-[10px] text-[#666] uppercase tracking-[0.22em] mb-1">
                        {row.label}
                      </div>

                      {editMode && isAdmin ? (
                        row.textarea ? (
                          <textarea
                            value={row.value}
                            onChange={(event) => updateProfileField(row.field, event.target.value)}
                            className="w-full min-h-[90px] bg-[#0d0d0d] border border-[#222] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f5c518]/45 resize-none"
                          />
                        ) : (
                          <input
                            value={row.value}
                            onChange={(event) => updateProfileField(row.field, event.target.value)}
                            className="w-full bg-[#0d0d0d] border border-[#222] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f5c518]/45"
                          />
                        )
                      ) : (
                        <div className="text-sm text-[#ddd] leading-relaxed whitespace-pre-wrap">
                          {row.value || '-'}
                        </div>
                      )}
                    </div>
                  ))}

                  {visibleListRows.map((row) => (
                    <div
                      key={row.field}
                      className="rounded-2xl bg-black/35 border border-[#1e1e1e] p-3"
                    >
                      <div className="text-[10px] text-[#666] uppercase tracking-[0.22em] mb-1">
                        {row.label}
                      </div>

                      {editMode && isAdmin ? (
                        <input
                          value={joinList(row.value)}
                          onChange={(event) => updateListField(row.field, event.target.value)}
                          placeholder="Comma-separated. You input all data."
                          className="w-full bg-[#0d0d0d] border border-[#222] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#f5c518]/45"
                        />
                      ) : (
                        <div className="text-sm text-[#ddd] leading-relaxed">
                          {row.value.length > 0 ? joinList(row.value) : '-'}
                        </div>
                      )}
                    </div>
                  ))}

                  {(editMode || hasSocials) && (
                    <div className="rounded-2xl bg-black/35 border border-[#1e1e1e] p-3">
                      <div className="text-[10px] text-[#666] uppercase tracking-[0.22em] mb-3">
                        Social Media
                      </div>

                      {editMode && isAdmin ? (
                        <div className="grid grid-cols-1 gap-2">
                          {socialRows.map((row) => (
                            <label key={row.field} className="block">
                              <span className="text-[10px] text-[#777] uppercase tracking-[0.16em]">
                                {row.label}
                              </span>
                              <div className="mt-1 flex items-center gap-2 rounded-xl bg-[#0d0d0d] border border-[#222] px-3 py-2 focus-within:border-[#f5c518]/45">
                                <span className="text-[#666]">@</span>
                                <input
                                  value={row.value}
                                  onChange={(event) => updateSocialField(row.field, event.target.value)}
                                  className="w-full bg-transparent text-white text-sm outline-none"
                                />
                              </div>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <SocialLink platform="instagram" handle={profile.socials.instagram} />
                          <SocialLink platform="threads" handle={profile.socials.threads} />
                          <SocialLink platform="youtube" handle={profile.socials.youtube} />
                          <SocialLink platform="facebook" handle={profile.socials.facebook} />
                        </div>
                      )}
                    </div>
                  )}

                  {editMode && isAdmin && (
                    <label className="rounded-2xl bg-black/35 border border-[#1e1e1e] p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] text-[#666] uppercase tracking-[0.22em]">
                          Profile Footer
                        </div>
                        <div className="text-sm text-[#ddd]">
                          Show "Scan the QRs" footer
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setProfile((current) => ({
                            ...current,
                            showQrFooter: !current.showQrFooter,
                          }))
                        }
                        className={`w-14 h-8 rounded-full p-1 transition-all ${
                          profile.showQrFooter ? 'bg-[#f5c518]' : 'bg-[#222]'
                        }`}
                      >
                        <span
                          className={`block w-6 h-6 rounded-full bg-black transition-transform ${
                            profile.showQrFooter ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </label>
                  )}
                </div>

                {editMode && isAdmin && (
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="btn-gold w-full py-3 rounded-2xl mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                )}
              </div>
            </div>

            {profile.showQrFooter && (
              <div className="rounded-3xl bg-[#0f0f0f] border border-[#1e1e1e] p-4 text-center">
                <div className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black/45 border border-[#f5c518]/25 px-4 py-3 text-[#f5c518] uppercase tracking-[0.18em] text-xs font-bold">
                  <span>Scan the QR</span>
                  <Flame size={16} />
                </div>
              </div>
            )}

            <div className="rounded-3xl bg-[#0f0f0f] border border-[#1e1e1e] p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-display font-900 text-white uppercase tracking-wide">
                    Partners
                  </h3>
                  <p className="text-[10px] text-[#666]">
                    Tap in with partner links and featured looks.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {isAdmin && (
                    <button
                      onClick={handleAddPartner}
                      className="p-2 rounded-xl bg-[#111] border border-[#1e1e1e] text-[#f5c518]"
                      title="Add partner"
                    >
                      <Plus size={15} />
                    </button>
                  )}

                  <button
                    onClick={() => setPartnersOpen(!partnersOpen)}
                    className="p-2 rounded-xl bg-[#111] border border-[#1e1e1e] text-[#888]"
                    title="Toggle partners"
                  >
                    <LinkIcon size={15} />
                  </button>
                </div>
              </div>

              {partnersOpen && (
                <div className="grid grid-cols-3 gap-2">
                  {partners.map((partner) => (
                    <div
                      key={partner.id}
                      className="aspect-square rounded-2xl bg-black border border-[#222] overflow-hidden relative group"
                    >
                      <button
                        onClick={() => window.open(partner.url, '_blank', 'noopener,noreferrer')}
                        className="w-full h-full"
                      >
                        <img
                          src={safeUrl(partner.image_url)}
                          alt={partner.title}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
                        <span className="absolute left-1.5 right-1.5 bottom-1.5 text-[8px] text-white font-bold uppercase truncate">
                          {partner.title}
                        </span>
                      </button>

                      {isAdmin && (
                        <div className="absolute top-1 right-1 flex gap-1">
                          <button
                            onClick={() => handleEditPartner(partner)}
                            className="w-6 h-6 rounded-lg bg-black/80 text-[#f5c518] flex items-center justify-center"
                          >
                            <Edit3 size={11} />
                          </button>

                          <button
                            onClick={() => handleDeletePartner(partner)}
                            className="w-6 h-6 rounded-lg bg-red-950/80 text-red-300 flex items-center justify-center"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {partners.length === 0 && (
                    <div className="col-span-3 text-center text-xs text-[#555] py-10">
                      No partner links yet.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-[#0f0f0f] border border-[#1e1e1e] p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-display font-900 text-white uppercase tracking-wide">
                    Media
                  </h3>
                  <p className="text-[10px] text-[#666]">
                    Images and videos from the producer vault
                  </p>
                </div>

                {isAdmin && (
                  <>
                    <input
                      ref={mediaInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleMediaUpload}
                    />

                    <button
                      onClick={() => mediaInputRef.current?.click()}
                      disabled={mediaUploading}
                      className="p-2 rounded-xl bg-[#111] border border-[#1e1e1e] text-[#f5c518] disabled:opacity-50"
                      title="Upload media"
                    >
                      <Upload size={15} />
                    </button>
                  </>
                )}
              </div>

              {mediaUploading && (
                <div className="rounded-2xl bg-black/35 border border-[#1e1e1e] p-3 mb-3 text-xs text-[#f5c518]">
                  Uploading media...
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {media.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-black border border-[#222] overflow-hidden relative"
                  >
                    <div className="aspect-video bg-[#050505] flex items-center justify-center">
                      {item.type === 'video' ? (
                        <video
                          src={item.url}
                          className="w-full h-full object-cover"
                          controls
                        />
                      ) : (
                        <img
                          src={safeUrl(item.url)}
                          alt={item.title || 'Profile media'}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="p-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-[#777] uppercase tracking-[0.14em]">
                        {item.type === 'video' ? <Video size={12} /> : <ImageIcon size={12} />}
                        <span className="truncate">{item.title || item.type}</span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                          className="flex-1 rounded-lg bg-[#111] border border-[#222] py-1.5 text-[10px] text-[#aaa] flex items-center justify-center gap-1"
                        >
                          <ExternalLink size={11} />
                          Open
                        </button>

                        <button
                          onClick={() => handleDownloadMedia(item)}
                          className="flex-1 rounded-lg bg-[#111] border border-[#222] py-1.5 text-[10px] text-[#aaa] flex items-center justify-center gap-1"
                        >
                          <Download size={11} />
                          DL
                        </button>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <button
                            onClick={() => handleToggleMediaDownload(item)}
                            className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold ${
                              item.download_enabled
                                ? 'bg-[#f5c518] text-black'
                                : 'bg-[#111] border border-[#222] text-[#777]'
                            }`}
                          >
                            {item.download_enabled ? 'DL ON' : 'DL OFF'}
                          </button>

                          <button
                            onClick={() => handleDeleteMedia(item)}
                            className="w-8 rounded-lg bg-red-950/45 border border-red-900/45 py-1.5 text-red-300 flex items-center justify-center"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {media.length === 0 && (
                  <div className="col-span-3 text-center text-xs text-[#555] py-10 rounded-2xl border border-dashed border-[#222]">
                    No profile media yet.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}



