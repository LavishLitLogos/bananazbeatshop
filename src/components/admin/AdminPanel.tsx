import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart2,
  Check,
  ChevronLeft,
  Clock,
  DollarSign,
  Edit2,
  Eye,
  FileAudio,
  FileText,
  GripVertical,
  Inbox,
  LayoutDashboard,
  Lock,
  LogOut,
  Music,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import type { Beat, BeatTape, Notification, Order, ProdBySong, Submission } from '../../types';
import { getBeatPriceLabel, isBeatExclusive, isBeatFree, isBeatInBeatLab, isBeatInFreeDLs, isBeatVisibleToBuyer } from '../../utils/beatAccess';
import { BeatUploadModal } from '../modals/BeatUploadModal';
import {
  appStorage,
  BANANAZ_THEME_PALETTE,
  type AdminSettingsState,
  type BananazModeState,
  type ManualSaleState,
  type ProducerProfileState,
} from '../../services/appStorage';
import { loadProducerProfile, saveProducerProfile } from '../../services/profilePersistence';

type AdminTab = 'overview' | 'beats' | 'tapes' | 'prodby' | 'orders' | 'submissions' | 'notifications' | 'settings';
type DetailModal = 'beats' | 'tapes' | 'prodby' | 'orders' | 'submissions' | 'notifications' | null;

interface AuditEntry {
  id?: string;
  admin_action: string;
  target_table: string;
  target_id: string;
  details?: Record<string, unknown>;
  created_at?: string;
}

interface ManualSaleForm {
  buyer_name: string;
  buyer_email: string;
  beat_name: string;
  amount: string;
  payment_method: string;
}

const manualSaleDefault: ManualSaleForm = {
  buyer_name: '',
  buyer_email: '',
  beat_name: '',
  amount: '',
  payment_method: 'Manual',
};

function formatMoney(value?: number | string | null) {
  const numberValue = Number(value || 0);
  return `$${numberValue.toFixed(2)}`;
}

function formatDate(value?: string) {
  if (!value) return 'Unknown';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function matchSearch(values: Array<string | number | undefined | null>, query: string) {
  if (!query.trim()) return true;

  const cleanQuery = query.trim().toLowerCase();

  return values.some((value) => String(value || '').toLowerCase().includes(cleanQuery));
}

export function AdminPanel() {
  const {
    goBack,
    isAdmin,
    logoutAdmin,
    addToast,
    adminEditMode,
    setAdminEditMode,
    reorderMode,
    setReorderMode,
    refreshContent,
    setRoomCounts,
  } = useApp();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [detailModal, setDetailModal] = useState<DetailModal>(null);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [beatTapes, setBeatTapes] = useState<BeatTape[]>([]);
  const [prodBySongs, setProdBySongs] = useState<ProdBySong[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingBeat, setEditingBeat] = useState<Beat | null>(null);
  const [showBeatUpload, setShowBeatUpload] = useState(false);
  const [showManualSale, setShowManualSale] = useState(false);
  const [manualSale, setManualSale] = useState<ManualSaleForm>(manualSaleDefault);
  const [adminSettings, setAdminSettings] = useState<AdminSettingsState>(() => appStorage.getAdminSettings());

  const loadAdminData = useCallback(async () => {
    setLoading(true);

    const [beatsRes, tapesRes, prodByRes, ordersRes, submissionsRes, notificationsRes, auditRes, profileRes] = await Promise.all([
      supabase.from('beats').select('*').order('created_at', { ascending: false }),
      supabase.from('beat_tapes').select('*').order('created_at', { ascending: false }),
      supabase.from('prod_by_songs').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('submissions').select('*').order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(4),
      loadProducerProfile(),
    ]);

    setBeats((beatsRes.data || []) as Beat[]);
    setBeatTapes((tapesRes.data || []) as BeatTape[]);
    setProdBySongs((prodByRes.data || []) as ProdBySong[]);
    const loadedOrders = (ordersRes.data || []) as Order[];
    setOrders(loadedOrders);
    setSubmissions((submissionsRes.data || []) as Submission[]);
    setNotifications((notificationsRes.data || []) as Notification[]);
    setAuditLog((auditRes.data || []) as AuditEntry[]);
    setAdminSettings(appStorage.syncPaidOrderStats(loadedOrders));
    if (profileRes?.profile) {
      appStorage.saveProfile(profileRes.profile);
    }

    const loadedBeats = (beatsRes.data || []) as Beat[];
    const loadedTapes = (tapesRes.data || []) as BeatTape[];
    const loadedSongs = (prodByRes.data || []) as ProdBySong[];
    const loadedSubmissions = (submissionsRes.data || []) as Submission[];

    setRoomCounts({
      total: loadedBeats.length + loadedTapes.length + loadedSongs.length,
      beatlab: loadedBeats.filter((beat) => isBeatInBeatLab(beat, true)).length,
      freedls: loadedBeats.filter((beat) => isBeatInFreeDLs(beat, true)).length,
      beattapes: loadedTapes.filter((tape) => !tape.hidden).length,
      bananazroom: 0,
      prodby: loadedSongs.filter((song) => !song.hidden).length,
      exclusives: loadedBeats.filter((beat) => isBeatExclusive(beat) && isBeatVisibleToBuyer(beat)).length,
      credits: 0,
      thelab: 0,
      submission: loadedSubmissions.length,
      profile: 1,
      beatbayngr: 0,
      supamaster: 0,
    });

    setLoading(false);
  }, [setRoomCounts]);

  useEffect(() => {
    if (!isAdmin) return;

    loadAdminData();

    const channel = supabase
      .channel('admin-panel-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beats' }, loadAdminData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beat_tapes' }, loadAdminData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prod_by_songs' }, loadAdminData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadAdminData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, loadAdminData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, loadAdminData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, loadAdminData]);

  const logAction = async (entry: AuditEntry) => {
    await supabase.from('admin_audit_log').insert({
      admin_action: entry.admin_action,
      target_table: entry.target_table,
      target_id: entry.target_id,
      details: entry.details || {},
    });

    const { data: recentRows } = await supabase
      .from('admin_audit_log')
      .select('id')
      .order('created_at', { ascending: false });

    const staleIds = (recentRows || []).slice(4).map((row) => row.id).filter(Boolean);

    if (staleIds.length > 0) {
      await supabase.from('admin_audit_log').delete().in('id', staleIds);
    }
  };

  const refreshEverything = async () => {
    await loadAdminData();
    refreshContent();
    addToast('Admin panel refreshed.', 'success');
  };

  const deleteRow = async (table: string, id: string, label: string) => {
    if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return;

    setBusyId(id);

    const { error } = await supabase.from(table).delete().eq('id', id);

    if (error) {
      addToast(`Delete failed: ${label}`, 'error');
    } else {
      await logAction({
        admin_action: `deleted_${label}`,
        target_table: table,
        target_id: id,
      });

      await loadAdminData();
      addToast(`${label} deleted.`, 'success');
    }

    setBusyId(null);
  };

  const updateBeat = async (beat: Beat, updates: Partial<Beat>) => {
    setBusyId(beat.id);

    const { error } = await supabase
      .from('beats')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', beat.id);

    if (error) {
      addToast('Beat update failed.', 'error');
    } else {
      setBeats((currentBeats) =>
        currentBeats.map((item) =>
          item.id === beat.id
            ? {
                ...item,
                ...updates,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );

      await logAction({
        admin_action: 'updated_beat',
        target_table: 'beats',
        target_id: beat.id,
        details: updates as Record<string, unknown>,
      });

      refreshContent();
      addToast('Beat updated.', 'success');
    }

    setBusyId(null);
  };

  const updateBeatTape = async (tape: BeatTape, updates: Partial<BeatTape>) => {
    setBusyId(tape.id);

    const { error } = await supabase
      .from('beat_tapes')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tape.id);

    if (error) {
      addToast('Beat tape update failed.', 'error');
    } else {
      setBeatTapes((currentTapes) =>
        currentTapes.map((item) =>
          item.id === tape.id
            ? {
                ...item,
                ...updates,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );

      await logAction({
        admin_action: 'updated_tape',
        target_table: 'beat_tapes',
        target_id: tape.id,
        details: updates as Record<string, unknown>,
      });

      refreshContent();
      addToast('Beat tape updated.', 'success');
    }

    setBusyId(null);
  };

  const updateProdBySong = async (song: ProdBySong, updates: Partial<ProdBySong>) => {
    setBusyId(song.id);

    const { error } = await supabase
      .from('prod_by_songs')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', song.id);

    if (error) {
      addToast('Song update failed.', 'error');
    } else {
      setProdBySongs((currentSongs) =>
        currentSongs.map((item) =>
          item.id === song.id
            ? {
                ...item,
                ...updates,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );

      await logAction({
        admin_action: 'updated_prodby_song',
        target_table: 'prod_by_songs',
        target_id: song.id,
        details: updates as Record<string, unknown>,
      });

      refreshContent();
      addToast('Song updated.', 'success');
    }

    setBusyId(null);
  };

  const updateOrder = async (order: Order, updates: Partial<Order>) => {
    setBusyId(order.id);

    const { error } = await supabase
      .from('orders')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (error) {
      addToast('Order update failed.', 'error');
    } else {
      setOrders((currentOrders) => {
        const nextOrders = currentOrders.map((item) =>
          item.id === order.id
            ? {
                ...item,
                ...updates,
                updated_at: new Date().toISOString(),
              }
            : item
        );

        setAdminSettings(appStorage.syncPaidOrderStats(nextOrders));
        return nextOrders;
      });

      await logAction({
        admin_action: 'updated_order',
        target_table: 'orders',
        target_id: order.id,
        details: updates as Record<string, unknown>,
      });

      addToast('Order updated.', 'success');
    }

    setBusyId(null);
  };

  const updateSubmission = async (submission: Submission, updates: Partial<Submission>) => {
    setBusyId(submission.id);

    const { error } = await supabase
      .from('submissions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submission.id);

    if (error) {
      addToast('Submission update failed.', 'error');
    } else {
      setSubmissions((currentSubmissions) =>
        currentSubmissions.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                ...updates,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );

      await logAction({
        admin_action: 'updated_submission',
        target_table: 'submissions',
        target_id: submission.id,
        details: updates as Record<string, unknown>,
      });

      addToast('Submission updated.', 'success');
    }

    setBusyId(null);
  };

  const markNotificationRead = async (notification: Notification) => {
    setBusyId(notification.id);

    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notification.id);

    if (error) {
      addToast('Notification update failed.', 'error');
    } else {
      setNotifications((currentNotifications) =>
        currentNotifications.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
      );
    }

    setBusyId(null);
  };

  const markAllNotificationsRead = async () => {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('read', false);

    if (error) {
      addToast('Notification update failed.', 'error');
      return;
    }

    setNotifications((currentNotifications) => currentNotifications.map((item) => ({ ...item, read: true })));
    addToast('Notifications marked read.', 'success');
  };

  const createManualSale = async () => {
    const amount = Number(manualSale.amount || 0);
    const beatName = manualSale.beat_name.trim() || 'Untitled Sale';
    const buyerName = manualSale.buyer_name.trim() || 'Private buyer';
    const buyerEmail = manualSale.buyer_email.trim() || 'private@bananaz.local';

    setBusyId('manual-sale');

    const { error } = await supabase.from('orders').insert({
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      beat_name: beatName,
      payment_method: manualSale.payment_method.trim() || 'Manual',
      amount,
      status: 'Sold',
      payment_received: true,
      release_download: false,
      sold: true,
      admin_approved: true,
      admin_notes: 'Manual sale entered by admin. Download still locked until Release is toggled.',
    });

    if (error) {
      addToast('Manual sale failed.', 'error');
    } else {
      await logAction({
        admin_action: 'manual_sale_entry',
        target_table: 'orders',
        target_id: beatName,
        details: {
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          amount,
        },
      });

      setManualSale(manualSaleDefault);
      setShowManualSale(false);
      await loadAdminData();
      addToast('Manual sale added. Release is still locked.', 'success');
    }

    setBusyId(null);
  };

  const logoutToBuyerMode = () => {
    logoutAdmin();
    addToast('Returned to buyer mode.', 'info');
  };

  const filteredBeats = useMemo(
    () => beats.filter((beat) => matchSearch([beat.title, beat.genre, beat.style, beat.type, beat.vibe, beat.price], searchQuery)),
    [beats, searchQuery]
  );

  const filteredTapes = useMemo(
    () => beatTapes.filter((tape) => matchSearch([tape.title, tape.description, tape.price], searchQuery)),
    [beatTapes, searchQuery]
  );

  const filteredSongs = useMemo(
    () => prodBySongs.filter((song) => matchSearch([song.title, song.artist_name, song.description], searchQuery)),
    [prodBySongs, searchQuery]
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) =>
        matchSearch(
          [order.beat_name, order.buyer_name, order.buyer_email, order.payment_method, order.status, order.amount],
          searchQuery
        )
      ),
    [orders, searchQuery]
  );

  const filteredSubmissions = useMemo(
    () =>
      submissions.filter((submission) =>
        matchSearch(
          [submission.song_title, submission.buyer_name, submission.buyer_email, submission.status, submission.admin_notes],
          searchQuery
        )
      ),
    [searchQuery, submissions]
  );

  const analytics = useMemo(() => {
    const pendingOrders = orders.filter((order) => !order.release_download || order.status === 'Pending Verification');
    const releasedOrders = orders.filter((order) => order.release_download);

    return {
      totalItems: beats.length + beatTapes.length + prodBySongs.length,
      visibleBeats: beats.filter((beat) => isBeatVisibleToBuyer(beat)).length,
      freeBeats: beats.filter((beat) => isBeatFree(beat)).length,
      exclusives: beats.filter((beat) => isBeatExclusive(beat)).length,
      paidOrders: adminSettings.lifetimePaidOrders,
      pendingOrders: pendingOrders.length,
      releasedOrders: releasedOrders.length,
      pendingSubmissions: submissions.filter((submission) => submission.status === 'Pending').length,
      unreadNotifications: notifications.filter((notification) => !notification.read).length,
      revenue: adminSettings.lifetimeRevenue,
    };
  }, [adminSettings.lifetimePaidOrders, adminSettings.lifetimeRevenue, beatTapes.length, beats, notifications, orders, prodBySongs.length, submissions]);

  const tabButtons: Array<{ id: AdminTab; label: string; icon: JSX.Element; count?: number }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={15} /> },
    { id: 'beats', label: 'Beats', icon: <Music size={15} />, count: beats.length },
    { id: 'tapes', label: 'Tapes', icon: <FileAudio size={15} />, count: beatTapes.length },
    { id: 'prodby', label: 'Prod By', icon: <FileText size={15} />, count: prodBySongs.length },
    { id: 'orders', label: 'Orders', icon: <ShoppingBag size={15} />, count: analytics.pendingOrders },
    { id: 'submissions', label: 'Submissions', icon: <Inbox size={15} />, count: analytics.pendingSubmissions },
    { id: 'notifications', label: 'Alerts', icon: <Clock size={15} />, count: analytics.unreadNotifications },
    { id: 'settings', label: 'Settings', icon: <Settings size={15} /> },
  ];

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#070707] text-white flex items-center justify-center p-6">
        <div className="beat-card p-6 text-center max-w-sm">
          <Lock size={42} className="mx-auto text-[#444] mb-3" />
          <div className="font-display font-900 text-xl uppercase">Admin Locked</div>
          <p className="text-sm text-[#666] mt-2">Buyer mode cannot view admin tools.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070707] text-white pb-32">
      <div className="sticky top-0 z-40 bg-[#080808]/95 backdrop-blur-xl border-b border-[#1a1a1a] pt-safe">
        <div className="flex items-center justify-between px-4 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0">
              <h1 className="font-display font-900 text-xl uppercase tracking-wide leading-none truncate">Admin Panel</h1>
              <p className="text-[10px] text-[#555] mt-0.5">Owner controls · hidden from buyers</p>
            </div>
          </div>

          <button
            onClick={logoutToBuyerMode}
            className="px-3 py-2 rounded-xl bg-[#111] border border-[#222] text-xs text-[#888] hover:text-white flex items-center gap-2"
          >
            <LogOut size={13} />
            Buyer Mode
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
            <input
              className="input-dark w-full pl-9 pr-3 py-2.5 text-sm"
              placeholder="Search admin records..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="scroll-x flex gap-2 px-4 pb-3">
          {tabButtons.map((button) => (
            <button
              key={button.id}
              onClick={() => setActiveTab(button.id)}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0 transition-all ${
                activeTab === button.id
                  ? 'bg-[#f5c518] text-black'
                  : 'bg-[#111] border border-[#1e1e1e] text-[#888] hover:text-white'
              }`}
            >
              {button.icon}
              {button.label}
              {typeof button.count === 'number' && button.count > 0 && (
                <span
                  className={`min-w-5 h-5 px-1 rounded-full text-[10px] flex items-center justify-center ${
                    activeTab === button.id ? 'bg-black/15 text-black' : 'bg-[#222] text-[#f5c518]'
                  }`}
                >
                  {button.count > 99 ? '99+' : button.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={28} className="animate-spin text-[#f5c518]" />
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                analytics={analytics}
                onOpen={setDetailModal}
                onManualSale={() => setShowManualSale(true)}
                onRefresh={refreshEverything}
              />
            )}

            {activeTab === 'beats' && (
              <BeatsTab
                beats={filteredBeats}
                busyId={busyId}
                reorderMode={reorderMode}
                onNew={() => {
                  setEditingBeat(null);
                  setShowBeatUpload(true);
                }}
                onEdit={(beat) => {
                  setEditingBeat(beat);
                  setShowBeatUpload(true);
                }}
                onDelete={(beat) => deleteRow('beats', beat.id, 'beat')}
                onUpdate={updateBeat}
              />
            )}

            {activeTab === 'tapes' && (
              <TapesTab
                tapes={filteredTapes}
                busyId={busyId}
                onDelete={(tape) => deleteRow('beat_tapes', tape.id, 'beat_tape')}
                onUpdate={updateBeatTape}
              />
            )}

            {activeTab === 'prodby' && (
              <ProdByTab
                songs={filteredSongs}
                busyId={busyId}
                onDelete={(song) => deleteRow('prod_by_songs', song.id, 'prod_by_song')}
                onUpdate={updateProdBySong}
              />
            )}

            {activeTab === 'orders' && (
              <OrdersTab orders={filteredOrders} busyId={busyId} onDelete={(order) => deleteRow('orders', order.id, 'order')} onUpdate={updateOrder} />
            )}

            {activeTab === 'submissions' && (
              <SubmissionsTab
                submissions={filteredSubmissions}
                busyId={busyId}
                onDelete={(submission) => deleteRow('submissions', submission.id, 'submission')}
                onUpdate={updateSubmission}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationsTab
                notifications={notifications}
                busyId={busyId}
                onRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onDelete={(notification) => deleteRow('notifications', notification.id, 'notification')}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsTab
                editMode={adminEditMode}
                reorderMode={reorderMode}
                auditLog={auditLog}
                onEditMode={setAdminEditMode}
                onReorderMode={setReorderMode}
                onRefresh={refreshEverything}
                onLogout={logoutToBuyerMode}
              />
            )}
          </>
        )}
      </div>

      {showBeatUpload && (
        <BeatUploadModal
          beat={editingBeat}
          onClose={() => {
            setShowBeatUpload(false);
            setEditingBeat(null);
          }}
          onSave={() => {
            setShowBeatUpload(false);
            setEditingBeat(null);
            loadAdminData();
            refreshContent();
          }}
        />
      )}

      {showManualSale && (
        <ManualSaleModal
          form={manualSale}
          busy={busyId === 'manual-sale'}
          onChange={setManualSale}
          onClose={() => setShowManualSale(false)}
          onSave={createManualSale}
        />
      )}

      {detailModal && (
        <DetailModalView
          modal={detailModal}
          analytics={analytics}
          beats={beats}
          tapes={beatTapes}
          songs={prodBySongs}
          orders={orders}
          submissions={submissions}
          notifications={notifications}
          onClose={() => setDetailModal(null)}
        />
      )}
    </div>
  );
}

function OverviewTab({
  analytics,
  onOpen,
  onManualSale,
  onRefresh,
}: {
  analytics: {
    totalItems: number;
    visibleBeats: number;
    freeBeats: number;
    exclusives: number;
    paidOrders: number;
    pendingOrders: number;
    releasedOrders: number;
    pendingSubmissions: number;
    unreadNotifications: number;
    revenue: number;
  };
  onOpen: (modal: DetailModal) => void;
  onManualSale: () => void;
  onRefresh: () => void;
}) {
  const cards = [
    { label: 'Catalog Items', value: analytics.totalItems, sub: `${analytics.visibleBeats} visible beats`, modal: 'beats' as DetailModal, icon: <Music size={18} /> },
    { label: 'Revenue', value: formatMoney(analytics.revenue), sub: `${analytics.paidOrders} paid orders`, modal: 'orders' as DetailModal, icon: <DollarSign size={18} /> },
    { label: 'Pending Orders', value: analytics.pendingOrders, sub: `${analytics.releasedOrders} released`, modal: 'orders' as DetailModal, icon: <ShoppingBag size={18} /> },
    { label: 'Submissions', value: analytics.pendingSubmissions, sub: 'need review', modal: 'submissions' as DetailModal, icon: <Inbox size={18} /> },
    { label: 'Free Downloads', value: analytics.freeBeats, sub: 'active/free', modal: 'beats' as DetailModal, icon: <Upload size={18} /> },
    { label: 'Exclusives', value: analytics.exclusives, sub: 'exclusive beats', modal: 'beats' as DetailModal, icon: <Lock size={18} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <button key={card.label} onClick={() => onOpen(card.modal)} className="beat-card p-4 text-left hover:border-[#f5c518]/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[#f5c518]">{card.icon}</div>
              <Eye size={14} className="text-[#444]" />
            </div>
            <div className="font-display font-900 text-2xl text-white">{card.value}</div>
            <div className="text-sm font-medium text-[#f5c518]">{card.label}</div>
            <div className="text-xs text-[#555] mt-1">{card.sub}</div>
          </button>
        ))}
      </div>

      <div className="beat-card p-4 space-y-3">
        <div className="font-display font-800 uppercase text-white flex items-center gap-2">
          <BarChart2 size={16} className="text-[#f5c518]" />
          Quick Controls
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onManualSale} className="btn-gold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
            <Plus size={14} />
            Manual Sale
          </button>

          <button onClick={onRefresh} className="btn-dark py-3 rounded-xl text-sm flex items-center justify-center gap-2">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        <p className="text-xs text-[#666] leading-relaxed">
          Manual sales still keep downloads locked until Release is toggled inside the order.
        </p>
      </div>
    </div>
  );
}

function BeatsTab({
  beats,
  busyId,
  reorderMode,
  onNew,
  onEdit,
  onDelete,
  onUpdate,
}: {
  beats: Beat[];
  busyId: string | null;
  reorderMode: boolean;
  onNew: () => void;
  onEdit: (beat: Beat) => void;
  onDelete: (beat: Beat) => void;
  onUpdate: (beat: Beat, updates: Partial<Beat>) => void;
}) {
  return (
    <div className="space-y-3">
      <button onClick={onNew} className="btn-gold w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2">
        <Plus size={15} />
        Upload / Add Beat
      </button>

      {beats.map((beat) => (
        <AdminCard key={beat.id} title={beat.title} subtitle={`${getBeatPriceLabel(beat)} · ${isBeatExclusive(beat) ? 'Exclusive' : isBeatFree(beat) ? 'Free DL' : 'Beat Lab'}`} image={beat.cover_art_url}>
          <ToggleRow label="Approved" active={beat.admin_approved !== false} disabled={busyId === beat.id} onClick={() => onUpdate(beat, { admin_approved: beat.admin_approved === false })} />
          <ToggleRow label="Hidden" active={beat.hidden} disabled={busyId === beat.id} onClick={() => onUpdate(beat, { hidden: !beat.hidden })} />
          <ToggleRow label="Sold" active={beat.sold} disabled={busyId === beat.id} onClick={() => onUpdate(beat, { sold: !beat.sold })} />
          <ToggleRow label="Release Download" active={beat.release_download} disabled={busyId === beat.id} onClick={() => onUpdate(beat, { release_download: !beat.release_download })} />

          {reorderMode && (
            <CustomOrderControl
              value={Number((beat as Beat & { custom_order?: number }).custom_order || 0)}
              disabled={busyId === beat.id}
              onSave={(customOrder) => onUpdate(beat, { custom_order: customOrder } as Partial<Beat>)}
            />
          )}

          <ActionRow onEdit={() => onEdit(beat)} onDelete={() => onDelete(beat)} />
        </AdminCard>
      ))}
    </div>
  );
}

function TapesTab({
  tapes,
  busyId,
  onDelete,
  onUpdate,
}: {
  tapes: BeatTape[];
  busyId: string | null;
  onDelete: (tape: BeatTape) => void;
  onUpdate: (tape: BeatTape, updates: Partial<BeatTape>) => void;
}) {
  return (
    <div className="space-y-3">
      {tapes.length === 0 && <EmptyState label="No beat tapes found." />}

      {tapes.map((tape) => (
        <AdminCard key={tape.id} title={tape.title} subtitle={`${formatMoney(tape.price)} · Beat Tape`} image={tape.cover_art_url}>
          <ToggleRow label="Approved" active={tape.admin_approved !== false} disabled={busyId === tape.id} onClick={() => onUpdate(tape, { admin_approved: tape.admin_approved === false })} />
          <ToggleRow label="Hidden" active={tape.hidden} disabled={busyId === tape.id} onClick={() => onUpdate(tape, { hidden: !tape.hidden })} />
          <ToggleRow label="Free" active={tape.is_free} disabled={busyId === tape.id} onClick={() => onUpdate(tape, { is_free: !tape.is_free })} />
          <ToggleRow label="Co-Lab Usable" active={tape.colab_usable} disabled={busyId === tape.id} onClick={() => onUpdate(tape, { colab_usable: !tape.colab_usable })} />
          <ActionRow onDelete={() => onDelete(tape)} />
        </AdminCard>
      ))}
    </div>
  );
}

function ProdByTab({
  songs,
  busyId,
  onDelete,
  onUpdate,
}: {
  songs: ProdBySong[];
  busyId: string | null;
  onDelete: (song: ProdBySong) => void;
  onUpdate: (song: ProdBySong, updates: Partial<ProdBySong>) => void;
}) {
  return (
    <div className="space-y-3">
      {songs.length === 0 && <EmptyState label="No Prod By songs found." />}

      {songs.map((song) => (
        <AdminCard key={song.id} title={song.title} subtitle={song.artist_name || 'Produced by ThisBeatIzBananaz'} image={song.cover_art_url}>
          <ToggleRow label="Approved" active={song.admin_approved !== false} disabled={busyId === song.id} onClick={() => onUpdate(song, { admin_approved: song.admin_approved === false })} />
          <ToggleRow label="Hidden" active={song.hidden} disabled={busyId === song.id} onClick={() => onUpdate(song, { hidden: !song.hidden })} />
          <ActionRow onDelete={() => onDelete(song)} />
        </AdminCard>
      ))}
    </div>
  );
}

function OrdersTab({
  orders,
  busyId,
  onDelete,
  onUpdate,
}: {
  orders: Order[];
  busyId: string | null;
  onDelete: (order: Order) => void;
  onUpdate: (order: Order, updates: Partial<Order>) => void;
}) {
  return (
    <div className="space-y-3">
      {orders.length === 0 && <EmptyState label="No orders found." />}

      {orders.map((order) => (
        <AdminCard key={order.id} title={order.beat_name} subtitle={`${order.buyer_name} · ${order.buyer_email}`}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <InfoPill label="Method" value={order.payment_method} />
            <InfoPill label="Amount" value={formatMoney(order.amount)} />
            <InfoPill label="Status" value={order.status} />
            <InfoPill label="Created" value={formatDate(order.created_at)} />
          </div>

          <ToggleRow label="Payment Received" active={Boolean(order.payment_received)} disabled={busyId === order.id} onClick={() => onUpdate(order, { payment_received: !order.payment_received })} />
          <ToggleRow label="Release Download" active={order.release_download} disabled={busyId === order.id} onClick={() => onUpdate(order, { release_download: !order.release_download, status: order.release_download ? 'Sold' : 'Released' })} />
          <ToggleRow label="Sold" active={order.sold} disabled={busyId === order.id} onClick={() => onUpdate(order, { sold: !order.sold })} />
          <ActionRow onDelete={() => onDelete(order)} />
        </AdminCard>
      ))}
    </div>
  );
}

function SubmissionsTab({
  submissions,
  busyId,
  onDelete,
  onUpdate,
}: {
  submissions: Submission[];
  busyId: string | null;
  onDelete: (submission: Submission) => void;
  onUpdate: (submission: Submission, updates: Partial<Submission>) => void;
}) {
  return (
    <div className="space-y-3">
      {submissions.length === 0 && <EmptyState label="No submissions found." />}

      {submissions.map((submission) => (
        <AdminCard key={submission.id} title={submission.song_title} subtitle={`${submission.buyer_name} · ${submission.buyer_email}`}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <InfoPill label="Status" value={submission.status} />
            <InfoPill label="Mics" value={submission.mic_rating ? `${submission.mic_rating}/5` : 'Not rated'} />
          </div>

          {submission.song_file_url && (
            <a href={submission.song_file_url} target="_blank" rel="noreferrer" className="btn-dark w-full py-2 rounded-xl text-xs flex items-center justify-center gap-2">
              <FileAudio size={13} />
              Open Submission File
            </a>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onUpdate(submission, { status: 'Accepted', accepted: true, rejected: false })}
              disabled={busyId === submission.id}
              className="btn-dark py-2 rounded-xl text-xs disabled:opacity-40"
            >
              Handled
            </button>

            <button
              onClick={() => onUpdate(submission, { status: 'Rejected', accepted: false, rejected: true })}
              disabled={busyId === submission.id}
              className="btn-dark py-2 rounded-xl text-xs disabled:opacity-40"
            >
              Reject
            </button>

            <button
              onClick={() => onUpdate(submission, { mic_rating: Math.min((submission.mic_rating || 0) + 1, 5) })}
              disabled={busyId === submission.id}
              className="btn-dark py-2 rounded-xl text-xs disabled:opacity-40"
            >
              + Mic
            </button>
          </div>

          <ToggleRow label="Prod By Eligible" active={submission.produced_by_toggle} disabled={busyId === submission.id} onClick={() => onUpdate(submission, { produced_by_toggle: !submission.produced_by_toggle })} />
          <ToggleRow label="Exclusive Eligible" active={submission.exclusive_toggle} disabled={busyId === submission.id} onClick={() => onUpdate(submission, { exclusive_toggle: !submission.exclusive_toggle })} />
          <ToggleRow label="List Eligible" active={submission.list_eligible_toggle} disabled={busyId === submission.id} onClick={() => onUpdate(submission, { list_eligible_toggle: !submission.list_eligible_toggle })} />
          <ActionRow onDelete={() => onDelete(submission)} />
        </AdminCard>
      ))}
    </div>
  );
}

function NotificationsTab({
  notifications,
  busyId,
  onRead,
  onMarkAllRead,
  onDelete,
}: {
  notifications: Notification[];
  busyId: string | null;
  onRead: (notification: Notification) => void;
  onMarkAllRead: () => void;
  onDelete: (notification: Notification) => void;
}) {
  return (
    <div className="space-y-3">
      <button onClick={onMarkAllRead} className="btn-dark w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2">
        <Check size={14} />
        Mark All Read
      </button>

      {notifications.length === 0 && <EmptyState label="No notifications found." />}

      {notifications.map((notification) => (
        <AdminCard key={notification.id} title={notification.title} subtitle={`${notification.type} · ${formatDate(notification.created_at)}`}>
          {notification.body && <p className="text-xs text-[#888] leading-relaxed">{notification.body}</p>}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onRead(notification)}
              disabled={busyId === notification.id || notification.read}
              className="btn-dark py-2 rounded-xl text-xs disabled:opacity-40"
            >
              {notification.read ? 'Read' : 'Mark Read'}
            </button>

            <button
              onClick={() => onDelete(notification)}
              disabled={busyId === notification.id}
              className="bg-red-950/20 border border-red-900/30 text-red-400 py-2 rounded-xl text-xs disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </AdminCard>
      ))}
    </div>
  );
}

function listToText(items: string[]) {
  return items.join('\n');
}

function textToList(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeHandle(value: string) {
  return value.trim().replace(/^@+/, '');
}

type EditableSectionId =
  | 'adminControls'
  | 'profile'
  | 'stats'
  | 'broadcast'
  | 'manualSale'
  | 'licensing'
  | 'contact';

function SettingsTab({
  editMode,
  reorderMode,
  auditLog,
  onEditMode,
  onReorderMode,
  onRefresh,
  onLogout,
}: {
  editMode: boolean;
  reorderMode: boolean;
  auditLog: AuditEntry[];
  onEditMode: (value: boolean) => void;
  onReorderMode: (value: boolean) => void;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const { addToast } = useApp();
  const [editingSection, setEditingSection] = useState<EditableSectionId | null>(null);
  const [profile, setProfile] = useState<ProducerProfileState>(() => appStorage.getProfile());
  const [adminSettings, setAdminSettings] = useState<AdminSettingsState>(() => appStorage.getAdminSettings());
  const [bananazMode, setBananazMode] = useState<BananazModeState>(() => appStorage.getBananazMode());
  const [manualSaleForm, setManualSaleForm] = useState({
    beatId: '',
    beatName: '',
    price: '',
    buyerName: '',
    buyerEmail: '',
    notes: '',
  });

  useEffect(() => {
    const syncLocalState = () => {
      if (editingSection) return;
      setProfile(appStorage.getProfile());
      setAdminSettings(appStorage.getAdminSettings());
      setBananazMode(appStorage.getBananazMode());
    };

    window.addEventListener('bananaz-app-storage:update', syncLocalState);

    return () => {
      window.removeEventListener('bananaz-app-storage:update', syncLocalState);
    };
  }, [editingSection]);

  const cancelEditing = () => {
    setProfile(appStorage.getProfile());
    setAdminSettings(appStorage.getAdminSettings());
    setBananazMode(appStorage.getBananazMode());
    setManualSaleForm({
      beatId: '',
      beatName: '',
      price: '',
      buyerName: '',
      buyerEmail: '',
      notes: '',
    });
    setEditingSection(null);
  };

  const saveProfile = async () => {
    try {
      const currentProfileMeta = await loadProducerProfile();
      const savedProfile = await saveProducerProfile(
        profile,
        currentProfileMeta.profileImageUrl,
        currentProfileMeta.profileId
      );
      setProfile(savedProfile.profile);
      setEditingSection(null);
      addToast('Profile saved.', 'success');
    } catch {
      addToast('Profile save failed.', 'error');
    }
  };

  const saveAdminSettings = () => {
    const savedSettings = appStorage.saveAdminSettings(adminSettings);
    setAdminSettings(savedSettings);
    setEditingSection(null);
  };

  const saveBananazMode = () => {
    const savedMode = appStorage.saveBananazMode({
      ...bananazMode,
      enabled: false,
      animationsEnabled: false,
    });
    setBananazMode(savedMode);
    setEditingSection(null);
  };

  const updateFamzCount = (field: 'famzCount' | 'bananazAppFamzCount' | 'bananazAppSalesCount', change: number) => {
    const currentValue = adminSettings[field];
    const nextValue = Math.max(0, currentValue + change);

    if (Math.abs(change) > 10 && !window.confirm(`Confirm ${change > 0 ? '+' : ''}${change} change?`)) {
      return;
    }

    setAdminSettings((currentSettings) => ({
      ...currentSettings,
      [field]: nextValue,
    }));
  };

  const addManualSale = () => {
    const sale: Omit<ManualSaleState, 'id' | 'createdAt'> = {
      beatId: manualSaleForm.beatId.trim(),
      beatName: manualSaleForm.beatName.trim() || 'Untitled Sale',
      price: Number(manualSaleForm.price || 0),
      buyerName: manualSaleForm.buyerName.trim(),
      buyerEmail: manualSaleForm.buyerEmail.trim(),
      notes: manualSaleForm.notes.trim(),
    };

    appStorage.addManualSale(sale);
    setAdminSettings(appStorage.getAdminSettings());
    setManualSaleForm({
      beatId: '',
      beatName: '',
      price: '',
      buyerName: '',
      buyerEmail: '',
      notes: '',
    });
  };

  const removeManualSale = (id: string) => {
    if (!window.confirm('Remove this manual app sale entry?')) {
      return;
    }

    appStorage.removeManualSale(id);
    setAdminSettings(appStorage.getAdminSettings());
  };

  const updateProfile = <K extends keyof ProducerProfileState>(field: K, value: ProducerProfileState[K]) => {
    setProfile((currentProfile) => ({
      ...currentProfile,
      [field]: value,
    }));
  };

  const updateAdminSettings = <K extends keyof AdminSettingsState>(field: K, value: AdminSettingsState[K]) => {
    setAdminSettings((currentSettings) => ({
      ...currentSettings,
      [field]: value,
    }));
  };

  const updateBananazMode = <K extends keyof BananazModeState>(field: K, value: BananazModeState[K]) => {
    setBananazMode((currentMode) => ({
      ...currentMode,
      [field]: value,
    }));
  };

  const selectedTheme = BANANAZ_THEME_PALETTE.find((theme) => theme.name === bananazMode.selectedTheme) || BANANAZ_THEME_PALETTE[0];

  return (
    <div className="space-y-4">
      <EditableSettingsSection
        id="adminControls"
        title="Admin Controls"
        subtitle="Locked by default. Unlock this section before changing admin behavior."
        editingSection={editingSection}
        onEdit={setEditingSection}
        onCancel={cancelEditing}
        onSave={saveAdminSettings}
      >
        <ToggleRow label="Edit Mode" active={editMode} onClick={() => onEditMode(!editMode)} />
        <ToggleRow label="Reorder Mode" active={reorderMode} onClick={() => onReorderMode(!reorderMode)} />
        <ToggleRow
          label="Allow Submissions"
          active={adminSettings.allowSubmissions}
          onClick={() => updateAdminSettings('allowSubmissions', !adminSettings.allowSubmissions)}
        />

        <button type="button" onClick={onRefresh} className="btn-dark w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2">
          <RefreshCw size={14} />
          Refresh Counts
        </button>

        <button type="button" onClick={onLogout} className="bg-red-950/20 border border-red-900/30 text-red-400 w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2">
          <LogOut size={14} />
          Logout To Buyer Mode
        </button>
      </EditableSettingsSection>

      <EditableSettingsSection
        id="profile"
        title="Profile Editor"
        subtitle="All profile fields are optional. Nothing is hardcoded here."
        editingSection={editingSection}
        onEdit={setEditingSection}
        onCancel={cancelEditing}
        onSave={saveProfile}
      >
        <AdminTextInput label="Display Name" value={profile.displayName} onChange={(value) => updateProfile('displayName', value)} />
        <AdminTextInput label="Headline / Role Line" value={profile.headline} onChange={(value) => updateProfile('headline', value)} placeholder="Example: Producer · Composer · Sound Architect" />
        <AdminTextInput label="Slogan / Quote" value={profile.sloganQuote} onChange={(value) => updateProfile('sloganQuote', value)} />
        <AdminTextArea label="About The Producer" value={profile.aboutProducer} onChange={(value) => updateProfile('aboutProducer', value)} />
        <AdminTextArea label="Bio" value={profile.bio} onChange={(value) => updateProfile('bio', value)} />
        <AdminTextInput label="Label" value={profile.label} onChange={(value) => updateProfile('label', value)} />

        <AdminTextArea
          label="Top 5 Producers"
          value={listToText(profile.topFiveProducers)}
          onChange={(value) => updateProfile('topFiveProducers', textToList(value))}
          placeholder="One producer per line"
        />

        <AdminTextArea
          label="Favorite Producers"
          value={listToText(profile.favoriteProducers)}
          onChange={(value) => updateProfile('favoriteProducers', textToList(value))}
          placeholder="One producer per line"
        />

        <AdminTextArea
          label="Favorite DAWs"
          value={listToText(profile.favoriteDaws)}
          onChange={(value) => updateProfile('favoriteDaws', textToList(value))}
          placeholder="One DAW per line"
        />

        <AdminTextArea label="Partners" value={profile.partners} onChange={(value) => updateProfile('partners', value)} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AdminTextInput
            label="Instagram @"
            value={profile.socials.instagram}
            onChange={(value) => updateProfile('socials', { ...profile.socials, instagram: sanitizeHandle(value) })}
          />
          <AdminTextInput
            label="Threads @"
            value={profile.socials.threads}
            onChange={(value) => updateProfile('socials', { ...profile.socials, threads: sanitizeHandle(value) })}
          />
          <AdminTextInput
            label="YouTube @"
            value={profile.socials.youtube}
            onChange={(value) => updateProfile('socials', { ...profile.socials, youtube: sanitizeHandle(value) })}
          />
          <AdminTextInput
            label="Facebook @"
            value={profile.socials.facebook}
            onChange={(value) => updateProfile('socials', { ...profile.socials, facebook: sanitizeHandle(value) })}
          />
        </div>

        <AdminTextArea label="Additional Info" value={profile.additionalInfo} onChange={(value) => updateProfile('additionalInfo', value)} />
        <ToggleRow label="Show “scan the QR 🔥” footer" active={profile.showQrFooter} onClick={() => updateProfile('showQrFooter', !profile.showQrFooter)} />
      </EditableSettingsSection>

      <EditableSettingsSection
        id="stats"
        title="FAMZ + App Stats"
        subtitle="Manual controls save inside this app build. Unlock before changing counts."
        editingSection={editingSection}
        onEdit={setEditingSection}
        onCancel={cancelEditing}
        onSave={saveAdminSettings}
      >
        <CounterControl
          label="Total FAMZ Count"
          value={adminSettings.famzCount}
          onMinus={() => updateFamzCount('famzCount', -1)}
          onPlus={() => updateFamzCount('famzCount', 1)}
          onChange={(value) => updateAdminSettings('famzCount', value)}
        />

        <CounterControl
          label="Bananaz App FAMZ Count"
          value={adminSettings.bananazAppFamzCount}
          onMinus={() => updateFamzCount('bananazAppFamzCount', -1)}
          onPlus={() => updateFamzCount('bananazAppFamzCount', 1)}
          onChange={(value) => updateAdminSettings('bananazAppFamzCount', value)}
        />

        <CounterControl
          label="Bananaz App Sales Count"
          value={adminSettings.bananazAppSalesCount}
          onMinus={() => updateFamzCount('bananazAppSalesCount', -1)}
          onPlus={() => updateFamzCount('bananazAppSalesCount', 1)}
          onChange={(value) => updateAdminSettings('bananazAppSalesCount', value)}
        />
      </EditableSettingsSection>

      <EditableSettingsSection
        id="broadcast"
        title="Bananaz Mode Broadcast — Parked"
        subtitle="Controls are locked and forced OFF so this feature cannot break the app."
        editingSection={editingSection}
        onEdit={setEditingSection}
        onCancel={cancelEditing}
        onSave={saveBananazMode}
      >
        <div className="rounded-xl border border-red-900/30 bg-red-950/15 p-3 text-xs text-red-300 leading-relaxed">
          Bananaz Mode is parked for stability. Saving this section forces the mode OFF and disables animations.
        </div>

        <ToggleRow label="Bananaz Mode Active" active={false} disabled onClick={() => undefined} />
        <ToggleRow label="Glow Enabled" active={bananazMode.glowEnabled} onClick={() => updateBananazMode('glowEnabled', !bananazMode.glowEnabled)} />
        <ToggleRow label="Animations Enabled" active={false} disabled onClick={() => undefined} />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BANANAZ_THEME_PALETTE.map((theme) => (
            <button
              key={theme.name}
              type="button"
              onClick={() => updateBananazMode('selectedTheme', theme.name)}
              className={`rounded-xl border p-3 text-left transition-all ${
                bananazMode.selectedTheme === theme.name ? 'border-[#f5c518] bg-[#f5c518]/10' : 'border-[#222] bg-[#0d0d0d]'
              }`}
            >
              <div className="h-6 rounded-lg mb-2" style={{ background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`, boxShadow: `0 0 18px ${theme.glow}` }} />
              <div className="text-xs text-white font-semibold">{theme.label}</div>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-[#222] bg-[#0d0d0d] p-3">
          <div className="text-xs text-[#777] mb-2">Selected Theme</div>
          <div className="text-sm text-white font-bold">{selectedTheme.label}</div>
        </div>

        <AdminTextInput label="Broadcast Title" value={bananazMode.broadcastTitle} onChange={(value) => updateBananazMode('broadcastTitle', value)} />
        <AdminTextArea label="Broadcast Message" value={bananazMode.broadcastMessage} onChange={(value) => updateBananazMode('broadcastMessage', value)} />
      </EditableSettingsSection>

      <EditableSettingsSection
        id="manualSale"
        title="Manual / Private App Sale"
        subtitle="Optional fields. Unlock to add outside/private sales inside app storage."
        editingSection={editingSection}
        onEdit={setEditingSection}
        onCancel={cancelEditing}
        onSave={() => {
          saveAdminSettings();
          setEditingSection(null);
        }}
      >
        <AdminTextInput label="Beat ID" value={manualSaleForm.beatId} onChange={(value) => setManualSaleForm((current) => ({ ...current, beatId: value }))} />
        <AdminTextInput label="Beat Name" value={manualSaleForm.beatName} onChange={(value) => setManualSaleForm((current) => ({ ...current, beatName: value }))} />
        <AdminTextInput label="Price" type="number" value={manualSaleForm.price} onChange={(value) => setManualSaleForm((current) => ({ ...current, price: value }))} />
        <AdminTextInput label="Buyer Name" value={manualSaleForm.buyerName} onChange={(value) => setManualSaleForm((current) => ({ ...current, buyerName: value }))} />
        <AdminTextInput label="Buyer Email" value={manualSaleForm.buyerEmail} onChange={(value) => setManualSaleForm((current) => ({ ...current, buyerEmail: value }))} />
        <AdminTextArea label="Notes" value={manualSaleForm.notes} onChange={(value) => setManualSaleForm((current) => ({ ...current, notes: value }))} />

        <button type="button" onClick={addManualSale} className="btn-dark w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2">
          <Plus size={14} />
          Add Manual Sale
        </button>

        {adminSettings.manualSales.length > 0 && (
          <div className="space-y-2">
            {adminSettings.manualSales.slice(0, 4).map((sale) => (
              <div key={sale.id} className="rounded-xl border border-[#222] bg-[#0d0d0d] p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-white font-semibold truncate">{sale.beatName || 'Untitled Sale'}</div>
                  <div className="text-xs text-[#777] mt-1">{formatMoney(sale.price)} · {sale.buyerName || 'Private buyer'}</div>
                  {sale.notes && <div className="text-[11px] text-[#555] mt-1">{sale.notes}</div>}
                </div>
                <button type="button" onClick={() => removeManualSale(sale.id)} className="text-red-400 p-2 rounded-lg hover:bg-red-950/20" aria-label="Remove manual sale">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </EditableSettingsSection>

      <EditableSettingsSection
        id="licensing"
        title="Protected Licensing Info"
        subtitle="Displayed in the protected licensing tab. Unlock before editing."
        editingSection={editingSection}
        onEdit={setEditingSection}
        onCancel={cancelEditing}
        onSave={saveAdminSettings}
      >
        <AdminTextArea
          label="Beats"
          value={adminSettings.licensingInfo.beats}
          onChange={(value) =>
            updateAdminSettings('licensingInfo', {
              ...adminSettings.licensingInfo,
              beats: value,
            })
          }
        />

        <AdminTextArea
          label="Free DLs"
          value={adminSettings.licensingInfo.freeDownloads}
          onChange={(value) =>
            updateAdminSettings('licensingInfo', {
              ...adminSettings.licensingInfo,
              freeDownloads: value,
            })
          }
        />

        <AdminTextArea
          label="Produced By"
          value={adminSettings.licensingInfo.producedBy}
          onChange={(value) =>
            updateAdminSettings('licensingInfo', {
              ...adminSettings.licensingInfo,
              producedBy: value,
            })
          }
        />
      </EditableSettingsSection>

      <EditableSettingsSection
        id="contact"
        title="Protected Contact Tab"
        subtitle="Social handles only. Payment rails are already wired elsewhere. Unlock before editing."
        editingSection={editingSection}
        onEdit={setEditingSection}
        onCancel={cancelEditing}
        onSave={saveAdminSettings}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AdminTextInput
            label="Instagram @"
            value={adminSettings.contactInfo.socials.instagram}
            onChange={(value) =>
              updateAdminSettings('contactInfo', {
                ...adminSettings.contactInfo,
                socials: {
                  ...adminSettings.contactInfo.socials,
                  instagram: sanitizeHandle(value),
                },
              })
            }
          />
          <AdminTextInput
            label="Threads @"
            value={adminSettings.contactInfo.socials.threads}
            onChange={(value) =>
              updateAdminSettings('contactInfo', {
                ...adminSettings.contactInfo,
                socials: {
                  ...adminSettings.contactInfo.socials,
                  threads: sanitizeHandle(value),
                },
              })
            }
          />
          <AdminTextInput
            label="YouTube @"
            value={adminSettings.contactInfo.socials.youtube}
            onChange={(value) =>
              updateAdminSettings('contactInfo', {
                ...adminSettings.contactInfo,
                socials: {
                  ...adminSettings.contactInfo.socials,
                  youtube: sanitizeHandle(value),
                },
              })
            }
          />
          <AdminTextInput
            label="Facebook @"
            value={adminSettings.contactInfo.socials.facebook}
            onChange={(value) =>
              updateAdminSettings('contactInfo', {
                ...adminSettings.contactInfo,
                socials: {
                  ...adminSettings.contactInfo.socials,
                  facebook: sanitizeHandle(value),
                },
              })
            }
          />
        </div>

        <AdminTextArea
          label="Additional Contact Info"
          value={adminSettings.contactInfo.additionalContact}
          onChange={(value) =>
            updateAdminSettings('contactInfo', {
              ...adminSettings.contactInfo,
              additionalContact: value,
            })
          }
        />
      </EditableSettingsSection>

      <div className="beat-card p-4 space-y-3">
        <div className="font-display font-800 uppercase text-white">Recent Admin Actions</div>

        {auditLog.length === 0 ? (
          <div className="text-xs text-[#555]">No audit activity found.</div>
        ) : (
          auditLog.slice(0, 4).map((entry, index) => (
            <div key={`${entry.admin_action}-${entry.target_id}-${index}`} className="rounded-xl bg-[#0d0d0d] border border-[#1d1d1d] p-3">
              <div className="text-xs text-white font-semibold">{entry.admin_action}</div>
              <div className="text-[11px] text-[#666] mt-1">
                {entry.target_table} · {entry.target_id}
              </div>
              <div className="text-[10px] text-[#444] mt-1">{formatDate(entry.created_at)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EditableSettingsSection({
  id,
  title,
  subtitle,
  editingSection,
  onEdit,
  onCancel,
  onSave,
  children,
}: {
  id: EditableSectionId;
  title: string;
  subtitle?: string;
  editingSection: EditableSectionId | null;
  onEdit: (id: EditableSectionId) => void;
  onCancel: () => void;
  onSave: () => void;
  children: React.ReactNode;
}) {
  const isEditing = editingSection === id;
  const anotherSectionEditing = Boolean(editingSection && !isEditing);

  return (
    <div className={`beat-card p-4 space-y-4 ${anotherSectionEditing ? 'opacity-55' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display font-800 uppercase text-white">{title}</div>
          {subtitle && <p className="text-xs text-[#666] mt-1 leading-relaxed">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-2 rounded-xl bg-[#111] border border-[#252525] text-xs text-[#aaa] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                className="px-3 py-2 rounded-xl bg-[#f5c518] text-black text-xs font-bold uppercase flex items-center gap-1.5"
              >
                <Check size={13} />
                Save
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onEdit(id)}
              disabled={anotherSectionEditing}
              className="px-3 py-2 rounded-xl bg-[#111] border border-[#252525] text-xs text-[#f5c518] hover:bg-[#181818] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Edit2 size={13} />
              Edit
            </button>
          )}
        </div>
      </div>

      {!isEditing && (
        <div className="rounded-xl border border-[#222] bg-black/35 px-3 py-2 text-[11px] text-[#666] uppercase tracking-[0.16em] flex items-center gap-2">
          <Lock size={12} />
          Locked. Tap Edit to unlock this section.
        </div>
      )}

      <fieldset disabled={!isEditing} className={`space-y-4 ${isEditing ? '' : 'opacity-75'}`}>
        {children}
      </fieldset>
    </div>
  );
}

function AdminTextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-[#777] uppercase tracking-wide">{label}</span>
      <input
        className="input-dark w-full px-3 py-2.5 text-sm"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function AdminTextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-[#777] uppercase tracking-wide">{label}</span>
      <textarea
        className="input-dark w-full px-3 py-2.5 text-sm min-h-24 resize-y"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function CounterControl({
  label,
  value,
  onMinus,
  onPlus,
  onChange,
}: {
  label: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-xl border border-[#222] bg-[#0d0d0d] p-3">
      <div className="text-xs text-[#777] uppercase tracking-wide mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <button onClick={onMinus} className="w-10 h-10 rounded-xl bg-[#151515] border border-[#252525] text-white text-lg" aria-label={`Decrease ${label}`}>
          -
        </button>
        <input
          className="input-dark flex-1 px-3 py-2.5 text-sm text-center"
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value || 0)))}
          onBlur={(event) => onChange(Math.max(0, Number(event.target.value || 0)))}
        />
        <button onClick={onPlus} className="w-10 h-10 rounded-xl bg-[#151515] border border-[#252525] text-white text-lg" aria-label={`Increase ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}

function AdminCard({
  title,
  subtitle,
  image,
  children,
}: {
  title: string;
  subtitle?: string;
  image?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="beat-card p-4 space-y-3">
      <div className="flex gap-3">
        {image ? (
          <img src={image} alt="" className="w-14 h-14 rounded-xl object-cover border border-[#222]" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-[#111] border border-[#222] flex items-center justify-center">
            <Music size={18} className="text-[#444]" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="font-display font-800 text-white truncate">{title}</div>
          {subtitle && <div className="text-xs text-[#666] mt-1 truncate">{subtitle}</div>}
        </div>
      </div>

      {children}
    </div>
  );
}

function ToggleRow({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-between py-2 border-t border-[#171717] disabled:opacity-40"
    >
      <span className="text-sm text-[#aaa]">{label}</span>

      <span
        className={`w-10 h-5 rounded-full relative transition-all ${
          active ? 'bg-[#f5c518]' : 'bg-[#222]'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
            active ? 'left-5' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function CustomOrderControl({
  value,
  disabled,
  onSave,
}: {
  value: number;
  disabled?: boolean;
  onSave: (value: number) => void;
}) {
  const [customOrder, setCustomOrder] = useState(String(value || ''));

  return (
    <div className="flex items-center gap-2 border-t border-[#171717] pt-3">
      <GripVertical size={14} className="text-[#555]" />

      <input
        className="input-dark flex-1 px-3 py-2 text-xs"
        type="number"
        placeholder="Custom order"
        value={customOrder}
        onChange={(event) => setCustomOrder(event.target.value)}
      />

      <button
        onClick={() => onSave(Number(customOrder || 0))}
        disabled={disabled}
        className="btn-dark px-3 py-2 rounded-lg text-xs disabled:opacity-40"
      >
        Save
      </button>
    </div>
  );
}

function ActionRow({
  onEdit,
  onDelete,
}: {
  onEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 border-t border-[#171717] pt-3">
      {onEdit ? (
        <button onClick={onEdit} className="btn-dark py-2 rounded-xl text-xs flex items-center justify-center gap-2">
          <Edit2 size={13} />
          Edit
        </button>
      ) : (
        <div />
      )}

      <button
        onClick={onDelete}
        className="bg-red-950/20 border border-red-900/30 text-red-400 py-2 rounded-xl text-xs flex items-center justify-center gap-2"
      >
        <Trash2 size={13} />
        Delete
      </button>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#0d0d0d] border border-[#1d1d1d] p-2">
      <div className="text-[10px] text-[#555] uppercase tracking-[0.14em]">{label}</div>
      <div className="text-xs text-[#ddd] mt-1 truncate">{value}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="beat-card p-8 text-center">
      <XCircle size={30} className="mx-auto text-[#333] mb-3" />
      <div className="text-sm text-[#666]">{label}</div>
    </div>
  );
}

function ManualSaleModal({
  form,
  busy,
  onChange,
  onClose,
  onSave,
}: {
  form: ManualSaleForm;
  busy: boolean;
  onChange: (form: ManualSaleForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = (key: keyof ManualSaleForm, value: string) => {
    onChange({
      ...form,
      [key]: value,
    });
  };

  return (
    <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-box max-w-md w-full p-5 space-y-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-display font-900 text-xl uppercase">Manual Sale</div>
          <button onClick={onClose} title="Close manual sale" aria-label="Close manual sale" className="p-1.5 text-[#666] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <input className="input-dark w-full px-4 py-3 text-sm" placeholder="Buyer name" value={form.buyer_name} onChange={(event) => set('buyer_name', event.target.value)} />
        <input className="input-dark w-full px-4 py-3 text-sm" placeholder="Buyer email/contact" value={form.buyer_email} onChange={(event) => set('buyer_email', event.target.value)} />
        <input className="input-dark w-full px-4 py-3 text-sm" placeholder="Beat/order name" value={form.beat_name} onChange={(event) => set('beat_name', event.target.value)} />
        <input className="input-dark w-full px-4 py-3 text-sm" placeholder="Amount" type="number" value={form.amount} onChange={(event) => set('amount', event.target.value)} />
        <input className="input-dark w-full px-4 py-3 text-sm" placeholder="Payment method" value={form.payment_method} onChange={(event) => set('payment_method', event.target.value)} />

        <button onClick={onSave} disabled={busy} className="btn-gold w-full py-3 rounded-xl text-sm disabled:opacity-40">
          {busy ? 'Saving...' : 'Save Manual Sale'}
        </button>

        <p className="text-xs text-[#666] leading-relaxed">
          This marks payment received, but does not release download access until admin toggles Release Download.
        </p>
      </div>
    </div>
  );
}

function DetailModalView({
  modal,
  analytics,
  beats,
  tapes,
  songs,
  orders,
  submissions,
  notifications,
  onClose,
}: {
  modal: DetailModal;
  analytics: {
    totalItems: number;
    revenue: number;
    pendingOrders: number;
    pendingSubmissions: number;
    unreadNotifications: number;
  };
  beats: Beat[];
  tapes: BeatTape[];
  songs: ProdBySong[];
  orders: Order[];
  submissions: Submission[];
  notifications: Notification[];
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-box max-w-lg w-full p-5 space-y-4 max-h-[82vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-display font-900 text-xl uppercase">Details</div>
          <button onClick={onClose} title="Close details" aria-label="Close details" className="p-1.5 text-[#666] hover:text-white">
            <X size={18} />
          </button>
        </div>

        {modal === 'beats' && (
          <div className="space-y-2">
            <InfoPill label="Total Catalog" value={String(analytics.totalItems)} />
            {beats.slice(0, 25).map((beat) => (
              <InfoPill key={beat.id} label={beat.title} value={`${beat.hidden ? 'Hidden' : 'Visible'} · ${beat.release_download ? 'Released' : 'Locked'}`} />
            ))}
          </div>
        )}

        {modal === 'tapes' && (
          <div className="space-y-2">
            {tapes.slice(0, 25).map((tape) => (
              <InfoPill key={tape.id} label={tape.title} value={`${tape.hidden ? 'Hidden' : 'Visible'} · ${formatMoney(tape.price)}`} />
            ))}
          </div>
        )}

        {modal === 'prodby' && (
          <div className="space-y-2">
            {songs.slice(0, 25).map((song) => (
              <InfoPill key={song.id} label={song.title} value={song.artist_name || 'Artist not set'} />
            ))}
          </div>
        )}

        {modal === 'orders' && (
          <div className="space-y-2">
            <InfoPill label="Revenue" value={formatMoney(analytics.revenue)} />
            <InfoPill label="Pending Orders" value={String(analytics.pendingOrders)} />
            {orders.slice(0, 25).map((order) => (
              <InfoPill key={order.id} label={order.beat_name} value={`${order.status} · ${order.release_download ? 'Released' : 'Locked'}`} />
            ))}
          </div>
        )}

        {modal === 'submissions' && (
          <div className="space-y-2">
            <InfoPill label="Pending Submissions" value={String(analytics.pendingSubmissions)} />
            {submissions.slice(0, 25).map((submission) => (
              <InfoPill key={submission.id} label={submission.song_title} value={`${submission.status} · ${submission.buyer_name}`} />
            ))}
          </div>
        )}

        {modal === 'notifications' && (
          <div className="space-y-2">
            <InfoPill label="Unread" value={String(analytics.unreadNotifications)} />
            {notifications.slice(0, 25).map((notification) => (
              <InfoPill key={notification.id} label={notification.title} value={notification.read ? 'Read' : 'Unread'} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
