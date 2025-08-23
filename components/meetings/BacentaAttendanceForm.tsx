import React, { useState, useMemo, useRef } from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import { formatDisplayDate } from '../../utils/dateUtils';
import { CameraIcon, CalendarIcon, UserIcon, UsersIcon, TrashIcon, PhotoIcon, PlusIcon, XMarkIcon } from '../icons';
import Button from '../ui/Button';
import ImageCropper from '../ui/ImageCropper';

interface BacentaAttendanceFormProps {
  bacentaId: string;
  meetingDate: string;
  onBack: () => void;
  existingRecord?: any; // View/edit of a saved meeting record
}

const BacentaAttendanceForm: React.FC<BacentaAttendanceFormProps> = ({
  bacentaId,
  meetingDate,
  onBack,
  existingRecord
}) => {
  const { bacentas, members, saveMeetingRecordHandler, updateMeetingRecordHandler, deleteMeetingRecordHandler } = useAppContext();

  // View/Edit mode state
  const [isViewMode, setIsViewMode] = useState(!!existingRecord);
  const [showImageModal, setShowImageModal] = useState(false);

  // Form state
  const [meetingImageBase64, setMeetingImageBase64] = useState<string>(existingRecord?.meetingImage || '');
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState<string>('');
  const [messagePreached, setMessagePreached] = useState(existingRecord?.messagePreached || '');
  const [discussionLedBy, setDiscussionLedBy] = useState(existingRecord?.discussionLedBy || '');
  const [bacentaLeaderName, setBacentaLeaderName] = useState(existingRecord?.bacentaLeaderName || '');
  // New lightweight attendance/finance state
  const [firstTimerNames, setFirstTimerNames] = useState<string[]>(existingRecord?.guests || []);
  const [firstTimerInput, setFirstTimerInput] = useState('');
  const [cashOffering, setCashOffering] = useState<number>(existingRecord?.cashOffering ?? 0);
  const [onlineOffering, setOnlineOffering] = useState<number>(existingRecord?.onlineOffering ?? 0);
  const [converts, setConverts] = useState<number>(existingRecord?.converts ?? 0);
  const [testimonies, setTestimonies] = useState<number>(existingRecord?.testimonies ?? 0);

  // Track present members (manually ticked) – keep this near other state to avoid use-before-declare
  const [presentMemberIds, setPresentMemberIds] = useState<string[]>(existingRecord?.presentMemberIds || []);
  const [memberQuery, setMemberQuery] = useState('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get bacenta and leader info
  const bacenta = bacentas.find(b => b.id === bacentaId);
  const bacentaMembers = members.filter(m => m.bacentaId === bacentaId && !m.frozen);

  // Enhanced leader detection logic with proper hierarchy
  const bacentaLeader = useMemo(() => {
    console.log('🔍 Bacenta Leader Detection Debug:', {
      bacentaId,
      bacentaName: bacenta?.name,
      totalMembers: members.length,
      bacentaMembers: bacentaMembers.length,
      memberRoles: bacentaMembers.map(m => ({
        id: m.id,
        name: `${m.firstName} ${m.lastName}`,
        role: m.role,
        bacentaId: m.bacentaId
      }))
    });

    // First, look for a Bacenta Leader in this specific bacenta
    const bacentaLeaderRole = bacentaMembers.find(m => m.role === 'Bacenta Leader');
    if (bacentaLeaderRole) {
      console.log('✅ Found Bacenta Leader:', bacentaLeaderRole);
      return bacentaLeaderRole;
    }

    // If no Bacenta Leader, look for Fellowship Leader in this bacenta
    const fellowshipLeaderRole = bacentaMembers.find(m => m.role === 'Fellowship Leader');
    if (fellowshipLeaderRole) {
      console.log('✅ Found Fellowship Leader:', fellowshipLeaderRole);
      return fellowshipLeaderRole;
    }

    // No leader found
    console.log('❌ No leader found for bacenta:', bacentaId);
    return null;
  }, [bacentaMembers, bacentaId, bacenta?.name, members.length]);

  // Initialize leader names
  React.useEffect(() => {
    if (bacentaLeader && !existingRecord) {
      const leaderFullName = `${bacentaLeader.firstName} ${bacentaLeader.lastName || ''}`.trim();
      setBacentaLeaderName(leaderFullName);
      if (!discussionLedBy) {
        setDiscussionLedBy(leaderFullName);
      }
    }
  }, [bacentaLeader, existingRecord, discussionLedBy]);

  // Auto-populate discussion leader when manual bacenta leader name is entered
  React.useEffect(() => {
    if (!bacentaLeader && bacentaLeaderName && !discussionLedBy) {
      setDiscussionLedBy(bacentaLeaderName);
    }
  }, [bacentaLeaderName, bacentaLeader, discussionLedBy]);

  // Minimal form only - no totals/attendance



  // No attendance initialization needed



  // Image processing functions
  const validateImageFile = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPG, PNG, or WEBP)');
      return false;
    }

    if (file.size > maxSize) {
      alert('Image size must be less than 5MB');
      return false;
    }

    return true;
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && validateImageFile(file)) {
      const imageUrl = URL.createObjectURL(file);
      setTempImageUrl(imageUrl);
      setShowImageCropper(true);
    }
    // Reset input value to allow re-uploading the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageCrop = (croppedImageBase64: string) => {
    setMeetingImageBase64(croppedImageBase64);
    setShowImageCropper(false);
    if (tempImageUrl) {
      URL.revokeObjectURL(tempImageUrl);
      setTempImageUrl('');
    }
  };

  const handleCropCancel = () => {
    setShowImageCropper(false);
    if (tempImageUrl) {
      URL.revokeObjectURL(tempImageUrl);
      setTempImageUrl('');
    }
  };

  const removeImage = () => {
    setMeetingImageBase64('');
    setShowImageCropper(false);
    if (tempImageUrl) {
      URL.revokeObjectURL(tempImageUrl);
      setTempImageUrl('');
    }
  };

  const handleEdit = () => {
    setIsViewMode(false);
  };

  const handleCancelEdit = () => {
    if (existingRecord) {
      // Reset to original values
      setMeetingImageBase64(existingRecord.meetingImage || '');
      setMessagePreached(existingRecord.messagePreached || '');
      setDiscussionLedBy(existingRecord.discussionLedBy || '');
      setBacentaLeaderName(existingRecord.bacentaLeaderName || '');
  setFirstTimerNames(existingRecord.guests || []);
  setFirstTimerInput('');
  setCashOffering(existingRecord.cashOffering ?? 0);
  setOnlineOffering(existingRecord.onlineOffering ?? 0);
  setConverts(existingRecord.converts ?? 0);
  setTestimonies(existingRecord.testimonies ?? 0);
  setPresentMemberIds(existingRecord.presentMemberIds || []);
      setIsViewMode(true);
    } else {
      onBack();
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this meeting record? This action cannot be undone.')) {
      try {
        if (existingRecord?.id) {
          await deleteMeetingRecordHandler(existingRecord.id);
          onBack();
        }
      } catch (error) {
        console.error('Error deleting meeting record:', error);
        // Error handling is done by the context handler
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const meetingRecord = {
        id: `${bacentaId}_${meetingDate}`,
        bacentaId,
        date: meetingDate,
        meetingImage: meetingImageBase64,
        bacentaLeaderName: bacentaLeader ? `${bacentaLeader.firstName} ${bacentaLeader.lastName}` : bacentaLeaderName,
        messagePreached,
        discussionLedBy,
  presentMemberIds,
  // Updated lightweight sections
  cashOffering,
  onlineOffering,
  totalOffering: (cashOffering || 0) + (onlineOffering || 0),
  converts,
  firstTimers: firstTimerNames.length,
  testimonies,
  guests: firstTimerNames,
        createdAt: existingRecord?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existingRecord) {
        await updateMeetingRecordHandler(meetingRecord);
      } else {
        await saveMeetingRecordHandler(meetingRecord);
      }

      onBack();
    } catch (error) {
      console.error('Error saving meeting details:', error);
    }
  };


  if (!bacenta) {
    return <div>Bacenta not found</div>;
  }

  // Friendly date helpers for header
  const meetingDateObj = useMemo(() => new Date(meetingDate), [meetingDate]);
  const weekday = useMemo(
    () => meetingDateObj.toLocaleDateString(undefined, { weekday: 'long' }),
    [meetingDateObj]
  );
  const longDate = useMemo(
    () => meetingDateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    [meetingDateObj]
  );

  const sortedBacentaMembers = useMemo(() => {
    const sorted = [...bacentaMembers].sort((a, b) => (
      `${a.firstName} ${a.lastName || ''}`.localeCompare(`${b.firstName} ${b.lastName || ''}`)
    ));
    if (!memberQuery.trim()) return sorted;
    const q = memberQuery.trim().toLowerCase();
    return sorted.filter(m => `${m.firstName} ${m.lastName || ''}`.toLowerCase().includes(q));
  }, [bacentaMembers, memberQuery]);

  // Toggle present members
  const toggleMemberPresent = (id: string) => {
    if (isViewMode) return;
    setPresentMemberIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const totalOffering = (cashOffering || 0) + (onlineOffering || 0);
  const totalCount = presentMemberIds.length + firstTimerNames.length;
  const attendeeMembers = useMemo(() => {
    return bacentaMembers
      .filter(m => presentMemberIds.includes(m.id))
      .sort((a, b) => (`${a.firstName} ${a.lastName || ''}`).localeCompare(`${b.firstName} ${b.lastName || ''}`));
  }, [bacentaMembers, presentMemberIds]);

  const addFirstTimer = () => {
    const name = firstTimerInput.trim();
    if (!name) return;
    setFirstTimerNames(prev => [...prev, name]);
    setFirstTimerInput('');
  };

  // Removed bulk select/clear actions for Name List per request

  const removeFirstTimer = (index: number) => {
    setFirstTimerNames(prev => prev.filter((_, i) => i !== index));
  };

  // Lightweight Zoom/Pan for fullscreen image
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const lastOffsetRef = useRef({ x: 0, y: 0 });
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1);

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
  const resetZoomPan = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  React.useEffect(() => {
    if (showImageModal) resetZoomPan();
  }, [showImageModal]);

  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = -e.deltaY; // up to zoom in
    const next = clamp(zoom + (delta > 0 ? 0.15 : -0.15), 1, 4);
    setZoom(next);
    if (next === 1) setOffset({ x: 0, y: 0 });
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom === 1) return;
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX, y: e.clientY };
    lastOffsetRef.current = { ...offset };
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setOffset({ x: lastOffsetRef.current.x + dx, y: lastOffsetRef.current.y + dy });
  };

  const onMouseUp = () => {
    isPanningRef.current = false;
  };

  const distance = (
    a: { clientX: number; clientY: number },
    b: { clientX: number; clientY: number }
  ) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      pinchStartDistRef.current = distance(e.touches[0], e.touches[1]);
      pinchStartZoomRef.current = zoom;
    } else if (e.touches.length === 1 && zoom > 1) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastOffsetRef.current = { ...offset };
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dist = distance(e.touches[0], e.touches[1]);
      const ratio = dist / pinchStartDistRef.current;
      const next = clamp(pinchStartZoomRef.current * ratio, 1, 4);
      setZoom(next);
      if (next === 1) setOffset({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isPanningRef.current) {
      const dx = e.touches[0].clientX - panStartRef.current.x;
      const dy = e.touches[0].clientY - panStartRef.current.y;
      setOffset({ x: lastOffsetRef.current.x + dx, y: lastOffsetRef.current.y + dy });
    }
  };

  const onTouchEnd = () => {
    if (pinchStartDistRef.current) {
      pinchStartDistRef.current = null;
    }
    isPanningRef.current = false;
  };

  const onDoubleClick = () => {
    if (zoom > 1) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    } else {
      setZoom(2);
    }
  };

  return (
    <>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Centered Header & Actions */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow mb-3">
            <CalendarIcon className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">Meeting Details</h1>
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white text-sm text-gray-700">
            <CalendarIcon className="w-4 h-4 text-blue-600" />
            <span>{weekday} · {longDate}</span>
          </div>
          {isViewMode && existingRecord && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <button onClick={handleEdit} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700">Edit</button>
              <button onClick={handleDelete} className="px-5 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700">Delete</button>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">Total Present</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{String(totalCount).padStart(2,'0')}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">First Timers</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{String(firstTimerNames.length).padStart(2,'0')}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">Converts</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{String(converts).padStart(2,'0')}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">Offering</div>
            <div className="mt-1 text-xl font-extrabold text-slate-900">R{(totalOffering||0).toFixed(2)}</div>
          </div>
        </div>

  {/* Meeting Info Card removed as requested */}

  <form onSubmit={isViewMode ? (e) => e.preventDefault() : handleSubmit} className="space-y-8">
          {/* Enhanced Meeting Photo Section */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl mb-3 shadow-lg">
                <CameraIcon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Meeting Photo</h2>
              <p className="text-sm text-gray-600 mt-1">
                {isViewMode ? 'Visual record of your meeting' : 'Capture a moment from your meeting'}
              </p>
            </div>

              {/* Hidden input always present for Replace/Upload actions */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleImageUpload}
                className="hidden"
                id="meeting-image-input"
              />

            {meetingImageBase64 ? (
              /* Enhanced Image Preview */
              <div className="relative">
                <div className="relative rounded-2xl overflow-hidden border-2 border-gray-100 shadow-lg group">
                  <img
                    src={meetingImageBase64}
                    alt="Meeting photo"
                    className={`w-full h-64 object-cover transition-all duration-300 cursor-pointer ${isViewMode ? 'hover:scale-105' : ''}`}
                    onClick={() => setShowImageModal(true)}
                  />
                  {!isViewMode && (
                    <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
                      <div className="flex space-x-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center space-x-2 shadow-lg"
                        >
                          <PhotoIcon className="w-4 h-4" />
                          <span>Replace</span>
                        </button>
                        <button
                          type="button"
                          onClick={removeImage}
                          className="bg-red-500/90 backdrop-blur-sm hover:bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center space-x-2 shadow-lg"
                        >
                          <TrashIcon className="w-4 h-4" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {isViewMode && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  )}
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-600 font-medium">
                    {isViewMode ? '✨ Click image to view full size' : '📸 Tap image to preview • Use buttons below to replace/remove'}
                  </p>
                </div>
                {!isViewMode && (
                  <div className="mt-3 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
                    >
                      <PhotoIcon className="w-4 h-4" />
                      <span>Replace</span>
                    </button>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 shadow-sm"
                    >
                      <TrashIcon className="w-4 h-4" />
                      <span>Remove</span>
                    </button>
                  </div>
                )}
              </div>
            ) : isViewMode ? (
              /* Enhanced No Image State */
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CameraIcon className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-lg font-medium text-gray-600 mb-2">No Meeting Photo</p>
                <p className="text-sm text-gray-500">No photo was uploaded for this meeting</p>
              </div>
            ) : (
              /* Enhanced Upload Interface */
              <div className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl p-12 text-center transition-all duration-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 group cursor-pointer">
                <label htmlFor="meeting-image-input" className="cursor-pointer block">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <CameraIcon className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-3">
                    <p className="text-xl font-semibold text-gray-800 group-hover:text-blue-700 transition-colors duration-300">
                      Upload Meeting Photo
                    </p>
                    <p className="text-base text-gray-600 group-hover:text-blue-600 transition-colors duration-300">
                      📸 Click to select or drag and drop your photo
                    </p>
                    <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-100 rounded-lg text-sm text-blue-700 font-medium">
                      <span>✨ Supports JPG, PNG, WEBP (max 5MB)</span>
                    </div>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Fullscreen Image Modal with Zoom/Pan */}
          {showImageModal && meetingImageBase64 && (
            <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
              <div className="flex items-center justify-between p-4">
                <span className="text-white text-sm">Tap/scroll to zoom, drag to pan</span>
                <button
                  type="button"
                  onClick={() => setShowImageModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                >
                  Close
                </button>
              </div>
              <div
                className="flex-1 overflow-hidden touch-none select-none flex items-center justify-center"
                onWheel={handleWheelZoom}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onDoubleClick={onDoubleClick}
              >
                <img
                  src={meetingImageBase64}
                  alt="Full size meeting"
                  className="max-w-none will-change-transform"
                  style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
                  draggable={false}
                />
              </div>
            </div>
          )}

          {/* Image Cropper Overlay */}
          {showImageCropper && tempImageUrl && (
            <ImageCropper
              image={tempImageUrl}
              onCropComplete={handleImageCrop}
              onCancel={handleCropCancel}
            />
          )}

    {/* Meeting Details */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl mb-3 shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
        <h2 className="text-xl font-semibold text-gray-900">Meeting Details</h2>
        <p className="text-sm text-gray-600 mt-1">Essential information about this meeting</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="space-y-2">
                <label className="flex items-center text-sm font-semibold text-gray-700">
                  <CalendarIcon className="w-4 h-4 mr-2 text-blue-500" />
                  Meeting Date
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatDisplayDate(meetingDate)}
                    readOnly
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gradient-to-r from-gray-50 to-blue-50 text-gray-700 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-sm font-semibold text-gray-700">
                  <UserIcon className="w-4 h-4 mr-2 text-green-500" />
                  Bacenta Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={bacenta.name}
                    readOnly
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gradient-to-r from-gray-50 to-green-50 text-gray-700 font-medium"
                  />
                </div>
              </div>

        <div className="space-y-2">
                <label className="flex items-center text-sm font-semibold text-gray-700">
                  <UsersIcon className="w-4 h-4 mr-2 text-purple-500" />
                  Bacenta Leader
                  {!bacentaLeader && !isViewMode && (
                    <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded-lg font-medium">editable</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={bacentaLeader ? `${bacentaLeader.firstName} ${bacentaLeader.lastName}` : bacentaLeaderName}
                    onChange={(e) => setBacentaLeaderName(e.target.value)}
                    readOnly={!!bacentaLeader || isViewMode}
                    placeholder={bacentaLeader ? '' : 'Enter bacenta leader name'}
                    className={`w-full px-4 py-3 border-2 rounded-xl font-medium transition-all duration-200 ${
                      bacentaLeader || isViewMode
                        ? 'border-gray-200 bg-gradient-to-r from-gray-50 to-purple-50 text-gray-700'
                        : 'border-blue-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                </div>
                {!bacentaLeader && !isViewMode && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center">
                    <svg className="w-3 h-3 mr-1 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    No leader detected automatically. Please enter manually.
                  </p>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message Preached</label>
                <textarea
                  value={messagePreached}
                  onChange={(e) => setMessagePreached(e.target.value)}
                  rows={4}
                  readOnly={isViewMode}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isViewMode
                      ? 'bg-gray-50 text-gray-600'
                      : 'focus:outline-none focus:ring-2 focus:ring-blue-500'
                  }`}
                  placeholder="Enter details about the message or sermon..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discussion Led By</label>
                <input
                  type="text"
                  value={discussionLedBy}
                  onChange={(e) => setDiscussionLedBy(e.target.value)}
                  readOnly={isViewMode}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                    isViewMode
                      ? 'bg-gray-50 text-gray-600'
                      : 'focus:outline-none focus:ring-2 focus:ring-blue-500'
                  }`}
                  placeholder={bacentaLeader ? "Enter name of discussion leader" : "Enter name of discussion leader (defaults to bacenta leader)"}
                />
                {!bacentaLeader && bacentaLeaderName && !discussionLedBy && (
                  <button
                    type="button"
                    onClick={() => setDiscussionLedBy(bacentaLeaderName)}
                    className="mt-1 text-xs text-blue-600 hover:text-blue-700 underline"
                  >
                    Use bacenta leader name
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name List & First Timers (edit) / Attendees (view) */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            {isViewMode ? (
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl mb-3 shadow-lg">
                    <UsersIcon className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Attendees</h2>
                  <p className="text-sm text-gray-600 mt-1">Only people who attended this meeting</p>
                </div>
                {(attendeeMembers.length > 0 || firstTimerNames.length > 0) ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {attendeeMembers.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Members</h3>
                        <ul className="space-y-2">
                          {attendeeMembers.map((m, idx) => (
                            <li key={m.id} className="flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                              <span className="text-gray-800">{idx + 1}. {m.firstName} {m.lastName}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {firstTimerNames.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">First Timers</h3>
                        <div className="flex flex-wrap gap-2">
                          {firstTimerNames.map((name, idx) => (
                            <span key={`${name}-${idx}`} className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              {idx + 1}. {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-gray-600">No attendees recorded.</p>
                )}
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl mb-3 shadow-lg">
                    <UsersIcon className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Name List</h2>
                  <p className="text-sm text-gray-600 mt-1">Show existing members of this bacenta</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="text"
                        value={memberQuery}
                        onChange={(e)=>setMemberQuery(e.target.value)}
                        placeholder="Search members..."
                        className="flex-1 px-3 py-2 border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <ul className="space-y-2 max-h-[420px] overflow-auto pr-2">
                      {sortedBacentaMembers.map((m, idx) => {
                        const checked = presentMemberIds.includes(m.id);
                        return (
                          <li key={m.id} className={`flex items-center rounded-lg border px-3 py-2 ${checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'} transition-colors`}>
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                              checked={checked}
                              onChange={() => toggleMemberPresent(m.id)}
                              aria-label={`Mark ${m.firstName} ${m.lastName} present`}
                            />
                            <span className="ml-3 text-gray-800 flex-1">{idx + 1}. {m.firstName} {m.lastName}</span>
                            {checked && (
                              <span className="ml-2 inline-flex items-center text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Present</span>
                            )}
                          </li>
                        );
                      })}
                      {sortedBacentaMembers.length === 0 && (
                        <li className="text-gray-500">No members found for this bacenta</li>
                      )}
                    </ul>
                    {sortedBacentaMembers.length > 0 && (
                      <div className="mt-3 text-sm text-gray-600">Checked: <span className="font-semibold">{presentMemberIds.length}</span> of {sortedBacentaMembers.length}</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add people not in the bacenta (first timers)
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={firstTimerInput}
                        onChange={(e) => setFirstTimerInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addFirstTimer();
                          }
                        }}
                        placeholder="Type a name and press Enter"
                        className="flex-1 px-3 py-2 border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button type="button" onClick={addFirstTimer} className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                        <PlusIcon className="w-5 h-5" />
                      </button>
                    </div>

                    {firstTimerNames.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {firstTimerNames.map((name, idx) => (
                          <span key={`${name}-${idx}`} className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {idx + 1}. {name}
                            <button type="button" onClick={() => removeFirstTimer(idx)} className="ml-2 text-blue-600 hover:text-blue-800">
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-center">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-lg font-semibold">{String(totalCount).padStart(2, '0')}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-center">
                        <p className="text-xs text-gray-500">Total cash offering</p>
                        <p className="text-lg font-semibold">R{(cashOffering || 0).toFixed(2)}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-center">
                        <p className="text-xs text-gray-500">Total online offering</p>
                        <p className="text-lg font-semibold">R{(onlineOffering || 0).toFixed(2)}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-center">
                        <p className="text-xs text-gray-500">Total offering</p>
                        <p className="text-lg font-semibold">R{(totalOffering || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Divider */}
          <div className="my-8 flex items-center" aria-hidden>
            <div className="flex-1 border-t border-dashed border-gray-300"></div>
            <div className="px-4 text-gray-400">•••••</div>
            <div className="flex-1 border-t border-dashed border-gray-300"></div>
          </div>

          {/* Stats & Offerings Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
                <p className="text-sm font-medium text-gray-700 mb-2">Converts</p>
                {isViewMode ? (
                  <p className="text-2xl font-semibold">{String(converts).padStart(2, '0')}</p>
                ) : (
                  <input type="number" min={0} value={converts} onChange={(e) => setConverts(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}
              </div>
              <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
                <p className="text-sm font-medium text-gray-700 mb-2">First Timers</p>
                <p className="text-2xl font-semibold">{String(firstTimerNames.length).padStart(2, '0')}</p>
              </div>
              <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
                <p className="text-sm font-medium text-gray-700 mb-2">Testimonies</p>
                {isViewMode ? (
                  <p className="text-2xl font-semibold">{String(testimonies).padStart(2, '0')}</p>
                ) : (
                  <input type="number" min={0} value={testimonies} onChange={(e) => setTestimonies(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}
              </div>
              <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
                <p className="text-sm font-medium text-gray-700 mb-2">Offerings (Cash / Online)</p>
                {isViewMode ? (
                  <p className="text-base font-semibold">R{(cashOffering || 0).toFixed(2)} / R{(onlineOffering || 0).toFixed(2)}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" min={0} step="0.01" value={cashOffering} onChange={(e) => setCashOffering(Number(e.target.value))} placeholder="Cash" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="number" min={0} step="0.01" value={onlineOffering} onChange={(e) => setOnlineOffering(Number(e.target.value))} placeholder="Online" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}
                <p className="mt-2 text-sm text-gray-600">Total: <span className="font-semibold">R{(totalOffering || 0).toFixed(2)}</span></p>
              </div>
            </div>

          {/* Additional sections removed for redesign */}

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            {isViewMode ? (
              <Button
                type="button"
                variant="secondary"
                onClick={onBack}
              >
                Back to Meetings
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="px-8">
                  {existingRecord ? 'Update Details' : 'Save Details'}
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </>
  );
};

export default BacentaAttendanceForm;
