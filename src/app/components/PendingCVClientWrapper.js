'use client';

import { useState, useEffect } from 'react';
import { 
  Bell, 
  Check, 
  X, 
  ChevronRight, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info,
  CheckCheck,
  Loader2
} from 'lucide-react';
import { resolvePendingCVImport } from '../hitl_actions';
import { markNotificationRead, markAllNotificationsRead } from '../notification_actions';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/ui/select';

function timeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PendingCVClientWrapper({ initialPending = [], initialNotifications = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingItems, setPendingItems] = useState(initialPending);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  // Keep state synced with props if layout revalidates
  useEffect(() => {
    setPendingItems(initialPending);
  }, [initialPending]);

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 15000);
    return () => clearInterval(interval);
  }, [router]);

  const hasUnread = notifications.some(n => !n.is_read) || pendingItems.length > 0;
  const unreadNotificationsCount = notifications.filter(n => !n.is_read).length;

  const handleResolve = async (id, action, resolutionPayload = {}) => {
    setIsProcessing(true);
    const res = await resolvePendingCVImport(id, action, resolutionPayload);
    if (res.success) {
      // Optimistic update
      setPendingItems(prev => prev.filter(item => item.id !== id));
      router.refresh();
    } else {
      alert("Error: " + res.error);
    }
    setIsProcessing(false);
  };

  const handleMarkRead = async (id) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await markNotificationRead(id);
    router.refresh();
  };

  const handleMarkAllRead = async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await markAllNotificationsRead();
    router.refresh();
  };

  const getSeverityIcon = (notif) => {
    const type = notif?.type;
    const severity = notif?.severity;

    // Type-specific icons
    if (type === 'campaign_started') {
      return <Loader2 size={16} className="text-amber-400 shrink-0 mt-0.5 animate-spin" />;
    }
    if (type === 'warm_join_needs_attention') {
      return <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />;
    }
    if (type === 'campaign_completed') {
      if (severity === 'error') return <XCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />;
      if (severity === 'warning') return <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />;
      return <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />;
    }

    switch (severity) {
      case 'success':
        return <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />;
      case 'error':
        return <XCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />;
      case 'info':
      default:
        return <Info size={16} className="text-sky-400 shrink-0 mt-0.5" />;
    }
  };

  return (
    <>
      {/* Bell Icon */}
      <button 
        onClick={() => setIsOpen(true)}
        className="relative flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-800 transition-colors"
        title="Notification Center & CV Imports Queue"
      >
        <Bell size={18} className={hasUnread ? "text-amber-400" : "text-slate-400"} />
        {hasUnread && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse"></span>
        )}
      </button>

      {/* Modal / Slide-out Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-[500px] h-full bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Bell size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-100">
                    Notification Center
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {pendingItems.length} pending review · {unreadNotificationsCount} unread alerts
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title="Close panel"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              
              {/* SECTION 1: PENDING CV IMPORTS (HITL QUEUE) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="text-amber-400" size={16} />
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Pending CV Imports ({pendingItems.length})
                    </h3>
                  </div>
                </div>

                {pendingItems.length === 0 ? (
                  <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl text-center">
                    <p className="text-xs text-slate-500">No pending CV imports waiting for review.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingItems.map(item => (
                      <ImportQueueCard 
                        key={item.id} 
                        item={item} 
                        onResolve={handleResolve} 
                        isProcessing={isProcessing} 
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 2: SYSTEM NOTIFICATIONS */}
              <div className="space-y-3 pt-2 border-t border-slate-800/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="text-sky-400" size={16} />
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Notifications ({notifications.length})
                    </h3>
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
                      title="Mark all notifications as read"
                    >
                      <CheckCheck size={13} />
                      Mark all read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl text-center">
                    <p className="text-xs text-slate-500">No notifications recorded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map(notif => (
                      <div 
                        key={notif.id}
                        className={`p-3 rounded-xl border transition-colors flex items-start gap-3 ${
                          notif.is_read 
                            ? 'bg-slate-900/40 border-slate-800/60 text-slate-400' 
                            : 'bg-slate-900/90 border-slate-700/80 text-slate-200 shadow-sm'
                        }`}
                      >
                        {getSeverityIcon(notif)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <h4 className={`text-xs leading-tight truncate ${notif.is_read ? 'font-medium text-slate-300' : 'font-bold text-slate-100'}`}>
                              {notif.title}
                            </h4>
                            <span className="text-[10px] text-slate-500 shrink-0">
                              {timeAgo(notif.created_at)}
                            </span>
                          </div>
                          {notif.message && (
                            <p className="text-[11px] text-slate-400 leading-snug break-words">
                              {notif.message}
                            </p>
                          )}
                        </div>
                        {!notif.is_read && (
                          <button
                            onClick={() => handleMarkRead(notif.id)}
                            className="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-800 transition shrink-0"
                            title="Mark as read"
                          >
                            <Check size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ImportQueueCard({ item, onResolve, isProcessing }) {
  const { match_status, matched_details, payload, id } = item;
  const isConflict = match_status === 'CONFLICT';
  
  // Candidates list: unified array support
  const candidatesList = matched_details?.candidates || (matched_details?.candidate ? [matched_details.candidate] : []);
  
  // For UPDATE, default to the 1 matched candidate. For CONFLICT, let user choose targetCandidateId
  const [selectedTargetId, setSelectedTargetId] = useState(
    candidatesList.length === 1 ? candidatesList[0].id : null
  );

  const activeTargetCand = candidatesList.find(c => c.id === selectedTargetId) || candidatesList[0];

  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectedFieldUpdates, setSelectedFieldUpdates] = useState({});
  const [cvStrategy, setCvStrategy] = useState('APPEND');

  // Compute new contacts that do not exist on the active target candidate
  const targetContacts = activeTargetCand?.contacts || [];
  const newContacts = (payload.contactPoints || []).filter(cp => {
    return !targetContacts.some(
      ec => ec.type?.toLowerCase() === cp.type?.toLowerCase() && ec.value?.trim().toLowerCase() === cp.value?.trim().toLowerCase()
    );
  });

  const toggleContact = (cp) => {
    if (selectedContacts.some(x => x.type === cp.type && x.value === cp.value)) {
      setSelectedContacts(prev => prev.filter(x => !(x.type === cp.type && x.value === cp.value)));
    } else {
      setSelectedContacts(prev => [...prev, cp]);
    }
  };

  const toggleFieldUpdate = (field, newValue) => {
    setSelectedFieldUpdates(prev => {
      const next = { ...prev };
      if (next[field] !== undefined) {
        delete next[field];
      } else {
        next[field] = newValue;
      }
      return next;
    });
  };

  // Field comparisons: full_name, dob, address, notes
  const fieldDiffs = [];
  if (activeTargetCand) {
    const fieldsToCompare = [
      { key: 'full_name', label: 'Full Name' },
      { key: 'dob', label: 'Date of Birth' },
      { key: 'address', label: 'Address' },
      { key: 'notes', label: 'Notes' }
    ];

    for (const f of fieldsToCompare) {
      const oldVal = (activeTargetCand[f.key] || '').toString().trim();
      const newVal = (payload[f.key] || '').toString().trim();
      if (newVal && oldVal.toLowerCase() !== newVal.toLowerCase()) {
        fieldDiffs.push({ key: f.key, label: f.label, oldVal: oldVal || '(empty)', newVal });
      }
    }
  }

  const handleMerge = () => {
    if (!activeTargetCand?.id) return;
    onResolve(id, 'MERGE', {
      targetCandidateId: activeTargetCand.id,
      newContactPoints: selectedContacts,
      cvUrlStrategy: cvStrategy,
      newCvUrl: payload.cv_url,
      fieldUpdates: selectedFieldUpdates
    });
  };

  const handleForceCreate = () => {
    onResolve(id, 'FORCE_CREATE');
  };

  return (
    <div className="bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800 rounded-xl p-3 shadow-sm relative overflow-hidden transition-colors">
      <div className={`absolute top-0 left-0 w-1 h-full ${isConflict ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
      
      <div className="pl-3 space-y-3">
        {/* Header */}
        <div className="flex justify-between items-start gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-100">{payload.full_name || 'Incoming CV'}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                isConflict ? 'bg-amber-500/20 text-amber-400 border-amber-900/50' : 'bg-sky-500/20 text-sky-400 border-sky-900/50'
              }`}>
                {isConflict ? `${candidatesList.length} Matching Profiles` : '1 Existing Match'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Parsed from: <span className="text-slate-300 font-medium">{payload.original_filename || 'CV File'}</span>
            </p>
          </div>
        </div>

        {/* Multi-match Candidate Selection (for CONFLICT) */}
        {isConflict && (
          <div className="space-y-2 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Select which candidate profile to merge with:
            </span>
            <div className="space-y-2">
              {candidatesList.map((cand) => {
                const isSelected = selectedTargetId === cand.id;
                // Highlight matched contacts
                const matchedContactValues = (cand.contacts || []).filter(c => 
                  (payload.contactPoints || []).some(pc => pc.value?.trim().toLowerCase() === c.value?.trim().toLowerCase())
                );

                return (
                  <label 
                    key={cand.id} 
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-slate-900 border-amber-500/50 text-slate-100 shadow-sm' 
                        : 'bg-slate-900/50 border-slate-800/80 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name={`target-${id}`} 
                      className="mt-1 text-amber-500 bg-slate-950 border-slate-700 focus:ring-0 focus:ring-offset-0"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedTargetId(cand.id);
                        setSelectedFieldUpdates({});
                        setSelectedContacts([]);
                      }}
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-100">{cand.full_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">ID: {cand.display_number || cand.id?.slice(0, 6)}</span>
                      </div>
                      
                      {/* Matching Contacts Badge */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {matchedContactValues.map((mc, mIdx) => (
                          <span key={mIdx} className="text-[10px] bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20">
                            Matched {mc.type}: {mc.value}
                          </span>
                        ))}
                      </div>

                      {/* Warnings for this candidate */}
                      {cand.blocked && (
                        <div className="mt-1 text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          ⛔ Blacklisted: {cand.blacklist_note || 'No note'}
                        </div>
                      )}
                      {cand.active_applications?.length > 0 && (
                        <div className="mt-1 text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          ⚠️ {cand.active_applications.length} Active Application(s) In Progress
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Target Profile Details & Merge Options */}
        {activeTargetCand && (
          <div className="space-y-2.5">
            {/* Single match candidate header & warnings */}
            {!isConflict && (
              <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Target Profile: <strong className="text-slate-200">{activeTargetCand.full_name}</strong></span>
                  <span className="text-[10px] text-slate-500 font-mono">ID: {activeTargetCand.display_number || activeTargetCand.id?.slice(0, 6)}</span>
                </div>

                {activeTargetCand.blocked && (
                  <div className="text-[11px] text-rose-400 bg-rose-500/10 p-1.5 rounded border border-rose-500/20 font-medium">
                    ⛔ Hồ sơ này đang bị Blacklist — cân nhắc kỹ trước khi merge ({activeTargetCand.blacklist_note || 'Không có ghi chú'})
                  </div>
                )}
                {activeTargetCand.active_applications?.length > 0 && (
                  <div className="text-[11px] text-amber-300 bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                    ⚠️ Ứng viên đang có {activeTargetCand.active_applications.length} đơn ứng tuyển In Progress — merge có thể ảnh hưởng tới pipeline hiện tại.
                  </div>
                )}
              </div>
            )}

            {/* Field Comparison Table */}
            {fieldDiffs.length > 0 && (
              <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Field Updates (Select fields to overwrite in profile):
                </span>
                <div className="border border-slate-800 rounded overflow-hidden overflow-x-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="px-2 py-1">Field</th>
                        <th className="px-2 py-1">Current in DB</th>
                        <th className="px-2 py-1">New in CV</th>
                        <th className="px-2 py-1 text-center">Update</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {fieldDiffs.map(diff => (
                        <tr key={diff.key} className="hover:bg-slate-900/40">
                          <td className="px-2 py-1 font-medium text-slate-300">{diff.label}</td>
                          <td className="px-2 py-1 text-slate-500 truncate max-w-[90px]" title={diff.oldVal}>{diff.oldVal}</td>
                          <td className="px-2 py-1 text-emerald-400 font-medium truncate max-w-[90px]" title={diff.newVal}>{diff.newVal}</td>
                          <td className="px-2 py-1 text-center">
                            <input 
                              type="checkbox" 
                              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                              checked={selectedFieldUpdates[diff.key] !== undefined}
                              onChange={() => toggleFieldUpdate(diff.key, diff.newVal)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* New Contacts List */}
            {newContacts.length > 0 && (
              <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Check size={11} className="text-emerald-400" /> New Contacts from CV to Add:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {newContacts.map((cp, idx) => {
                    const isChecked = selectedContacts.some(x => x.type === cp.type && x.value === cp.value);
                    return (
                      <label key={idx} className="flex items-center gap-1.5 p-1.5 bg-slate-900 rounded border border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          checked={isChecked}
                          onChange={() => toggleContact(cp)}
                        />
                        <span className="text-[11px] text-slate-200">
                          <span className="text-slate-500 mr-1 font-mono">[{cp.type}]</span>
                          {cp.value}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CV File Action Strategy */}
            {payload.cv_url && (
              <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FileText size={11} className="text-sky-400" /> CV File Storage Action:
                </span>
                <Select value={cvStrategy} onValueChange={setCvStrategy}>
                  <SelectTrigger className="w-full h-7 px-2 bg-slate-900 border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 focus:ring-1 focus:ring-emerald-500 transition-colors">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                    <SelectItem value="APPEND" className="text-xs focus:bg-slate-800 focus:text-emerald-400 cursor-pointer">Append to CV History (Recommended)</SelectItem>
                    <SelectItem value="REPLACE" className="text-xs focus:bg-slate-800 focus:text-emerald-400 cursor-pointer">Replace Primary CV</SelectItem>
                    <SelectItem value="IGNORE" className="text-xs focus:bg-slate-800 focus:text-emerald-400 cursor-pointer">Ignore CV File</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
          <div>
            <button
              onClick={() => onResolve(id, isConflict ? 'DISMISS' : 'REJECT')}
              disabled={isProcessing}
              className="px-2.5 py-1 text-slate-400 hover:text-slate-200 text-xs font-medium rounded hover:bg-slate-800 transition-colors"
            >
              {isConflict ? 'Dismiss' : 'Reject'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isConflict && (
              <button
                onClick={handleForceCreate}
                disabled={isProcessing}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 transition-colors"
                title="Create a completely separate candidate profile from this CV"
              >
                Create New Profile
              </button>
            )}

            <button
              onClick={handleMerge}
              disabled={isProcessing || (isConflict && !selectedTargetId)}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 text-xs font-bold rounded shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check size={13} className="stroke-[3]" /> Merge Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
