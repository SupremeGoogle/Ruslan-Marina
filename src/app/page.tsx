'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import styles from './page.module.css';
import Petals from '@/components/Petals';
import { supabase } from '@/utils/supabaseClient';

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  ip: string;
}

interface Photo {
  id: string;
  guest_id: string;
  guest_name: string;
  url: string;
  storage_path: string;
  created_at: string;
}

// Helper function to compress image on client side before upload
const compressImage = (file: File, maxWidth = 1600, maxHeight = 1600, quality = 0.85): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image(); // Use window.Image to avoid conflict with NextJS Image component
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas 2d context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas conversion to blob failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function Home() {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  // loginStep: 'welcome' = greeting screen | 'video' = playing video | 'form' = name input
  const [loginStep, setLoginStep] = useState<'welcome' | 'video' | 'form'>('welcome');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isChangingName, setIsChangingName] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  
  // Timer State
  const [timerStatus, setTimerStatus] = useState<'running' | 'paused' | 'reset'>('reset');
  const [remainingSeconds, setRemainingSeconds] = useState(10800); // 3 hours
  
  // Photo State
  const [userPhotos, setUserPhotos] = useState<Photo[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [activeLightboxPhoto, setActiveLightboxPhoto] = useState<Photo | null>(null);
  
  // Upload and Loading States
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [clientIp, setClientIp] = useState('127.0.0.1');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadIndexRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if Supabase is configured
  const isSupabaseConfigured = !!supabase;

  // 1. Detect IP and load guest session
  useEffect(() => {
    // Hard safety: never let the loading screen hang for more than 5s
    const safetyTimeout = setTimeout(() => setLoading(false), 5000);

    async function initSession() {
      // Check demo mode
      if (!isSupabaseConfigured) {
        setIsDemoMode(true);
        console.warn('Supabase credentials not configured. Running in Demo Mode.');
      }

      // Fetch IP in background
      fetch('/api/ip')
        .then(res => res.json())
        .then(data => setClientIp(data.ip || '127.0.0.1'))
        .catch(err => console.error('Failed to detect IP, using local fallback:', err));

      // Load cached session safely and immediately show page
      try {
        const cached = localStorage.getItem('wedding_guest_session');
        if (cached) {
          const parsedGuest = JSON.parse(cached) as Guest;
          if (parsedGuest && parsedGuest.id) {
            // Instantly show the guest page
            setGuest(parsedGuest);
            setLoading(false);

            // Verify in the background if guest still exists in DB
            if (isSupabaseConfigured) {
              supabase
                .from('guests')
                .select('id')
                .eq('id', parsedGuest.id)
                .single()
                .then(({ data, error }: { data: any; error: any }) => {
                  if (error || !data) {
                    console.warn('Cached guest session not found in DB, clearing cache');
                    localStorage.removeItem('wedding_guest_session');
                    setGuest(null);
                    setShowLoginModal(true);
                  }
                })
                .catch((err: unknown) => {
                  console.error('Failed to verify guest in background:', err);
                });
            }
          } else {
            // Invalid session object
            localStorage.removeItem('wedding_guest_session');
            setGuest(null);
            setShowLoginModal(true);
            setLoading(false);
          }
        } else {
          setShowLoginModal(true);
          setLoading(false);
        }
      } catch (sessionErr) {
        console.error('Failed to initialize guest session, clearing cache:', sessionErr);
        localStorage.removeItem('wedding_guest_session');
        setGuest(null);
        setShowLoginModal(true);
        setLoading(false);
      }
    }
    initSession();
    return () => clearTimeout(safetyTimeout);
  }, [isSupabaseConfigured]);

  // 2. Fetch and synchronize Timer State
  const fetchTimerState = async () => {
    try {
      const res = await fetch('/api/timer');
      if (!res.ok) throw new Error('Failed to fetch timer');
      const data = await res.json();
      
      setTimerStatus(data.status);
      setRemainingSeconds(data.remainingSeconds);
      if (data.isDemo !== undefined) {
        setIsDemoMode(data.isDemo);
      }
    } catch (err) {
      console.error('Error fetching timer state:', err);
      if (!isSupabaseConfigured) {
        // Mock timer state from LocalStorage fallback
        const mockTimer = localStorage.getItem('mock_timer_state');
        if (mockTimer) {
          const parsed = JSON.parse(mockTimer);
          setTimerStatus(parsed.status);
          
          if (parsed.status === 'running') {
            const elapsed = Math.floor((Date.now() - parsed.updatedAt) / 1000);
            setRemainingSeconds(Math.max(0, parsed.remainingSeconds - elapsed));
          } else {
            setRemainingSeconds(parsed.remainingSeconds);
          }
        }
      }
    }
  };

  // Poll timer state every 5 seconds
  useEffect(() => {
    fetchTimerState();
    const interval = setInterval(fetchTimerState, 5000);
    return () => clearInterval(interval);
  }, [isSupabaseConfigured]);

  // Local 1-second countdown ticking
  useEffect(() => {
    let tick: NodeJS.Timeout;
    if (timerStatus === 'running' && remainingSeconds > 0) {
      tick = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(tick);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(tick);
  }, [timerStatus, remainingSeconds]);

  // 3. Fetch Photos (all and user-specific) via server endpoint — direct
  // Supabase access is unreliable in regions where supabase.co is filtered
  // (e.g. RU without VPN), so we always go through our own /api routes.
  const fetchPhotos = async () => {
    if (!isSupabaseConfigured) {
      const mockPhotosStr = localStorage.getItem('mock_photos') || '[]';
      const parsedPhotos = JSON.parse(mockPhotosStr) as Photo[];
      const sorted = [...parsedPhotos].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setAllPhotos(sorted);
      if (guest) {
        setUserPhotos(sorted.filter((p) => p.guest_id === guest.id));
      }
      return;
    }

    try {
      const res = await fetch('/api/photo/list', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const photos = (data.photos || []) as Photo[];
      setAllPhotos(photos);
      if (guest) {
        setUserPhotos(photos.filter((p) => p.guest_id === guest.id));
      }
    } catch (err) {
      console.error('Error fetching photos:', err);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [guest, isSupabaseConfigured]);

  // Poll for new photos every 8 seconds. We avoid the Supabase realtime
  // WebSocket because the supabase.co host is regionally filtered.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const interval = setInterval(fetchPhotos, 8000);
    return () => clearInterval(interval);
  }, [guest, isSupabaseConfigured]);

  // 4. Handle Guest Registration (Welcome dialog submission)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!firstName.trim() || !lastName.trim()) {
      setSubmitError('Пожалуйста, введите имя и фамилию.');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    // Safety: never let the button stay disabled forever
    const safetyTimeout = setTimeout(() => {
      setIsSubmitting(false);
      setSubmitError('Сервер не отвечает. Проверьте интернет и попробуйте ещё раз.');
    }, 15000);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const guestData = {
      firstName: cleanFirst,
      lastName: cleanLast,
      ip: clientIp,
    };

    try {
      if (isChangingName && guest) {
        if (!isSupabaseConfigured) {
          const mockGuestsStr = localStorage.getItem('mock_guests') || '[]';
          const mockGuests = JSON.parse(mockGuestsStr);
          const updatedGuests = mockGuests.map((g: any) =>
            g.id === guest.id
              ? { ...g, first_name: cleanFirst, last_name: cleanLast, ip_address: clientIp }
              : g
          );
          localStorage.setItem('mock_guests', JSON.stringify(updatedGuests));

          const mockPhotosStr = localStorage.getItem('mock_photos') || '[]';
          const mockPhotos = JSON.parse(mockPhotosStr) as Photo[];
          const updatedPhotos = mockPhotos.map((photo) =>
            photo.guest_id === guest.id
              ? { ...photo, guest_name: `${cleanFirst} ${cleanLast}` }
              : photo
          );
          localStorage.setItem('mock_photos', JSON.stringify(updatedPhotos));

          const sessionGuest: Guest = {
            id: guest.id,
            firstName: cleanFirst,
            lastName: cleanLast,
            ip: clientIp,
          };

          localStorage.setItem('wedding_guest_session', JSON.stringify(sessionGuest));
          setGuest(sessionGuest);
          setShowLoginModal(false);
          setIsChangingName(false);
          fetchPhotos();
          return;
        }

        try {
          const res = await fetch('/api/guest/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guestId: guest.id,
              firstName: cleanFirst,
              lastName: cleanLast,
              ip: clientIp,
            }),
          });

          const data = await res.json();

          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Rename failed');
          }

          const sessionGuest: Guest = {
            id: guest.id,
            firstName: cleanFirst,
            lastName: cleanLast,
            ip: clientIp,
          };

          localStorage.setItem('wedding_guest_session', JSON.stringify(sessionGuest));
          setGuest(sessionGuest);
          setShowLoginModal(false);
          setIsChangingName(false);
          fetchPhotos();
        } catch (err) {
          console.error('Name change failed:', err);
          setSubmitError('Не удалось изменить имя. Возможно, такой гость уже существует.');
        }
        return;
      }

      if (!isSupabaseConfigured) {
        // Mock register guest
        const mockGuestsStr = localStorage.getItem('mock_guests') || '[]';
        const mockGuests = JSON.parse(mockGuestsStr);
        let existing = mockGuests.find(
          (g: any) => g.first_name === cleanFirst && g.last_name === cleanLast
        );

        if (!existing) {
          existing = {
            id: Math.random().toString(36).substring(2, 15),
            first_name: cleanFirst,
            last_name: cleanLast,
            ip_address: clientIp,
            created_at: new Date().toISOString(),
          };
          mockGuests.push(existing);
          localStorage.setItem('mock_guests', JSON.stringify(mockGuests));
        }

        const sessionGuest: Guest = {
          id: existing.id,
          firstName: existing.first_name,
          lastName: existing.last_name,
          ip: existing.ip_address,
        };

        localStorage.setItem('wedding_guest_session', JSON.stringify(sessionGuest));
        setGuest(sessionGuest);
        setShowLoginModal(false);
        setIsChangingName(false);
        return;
      }

      try {
        // Server-side registration via /api/guest/register: service-role
        // bypasses RLS and we get an explicit fetch timeout.
        const controller = new AbortController();
        const requestTimeout = setTimeout(() => controller.abort(), 10000);

        let res: Response;
        try {
          res = await fetch('/api/guest/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: cleanFirst,
              lastName: cleanLast,
              ip: clientIp,
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(requestTimeout);
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success || !data.guest) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const sessionGuest: Guest = {
          id: data.guest.id,
          firstName: data.guest.firstName,
          lastName: data.guest.lastName,
          ip: data.guest.ip ?? clientIp,
        };

        localStorage.setItem('wedding_guest_session', JSON.stringify(sessionGuest));
        setGuest(sessionGuest);
        setShowLoginModal(false);
        setIsChangingName(false);
      } catch (err) {
        console.error('Registration failed:', err);
        const msg = err instanceof Error && err.name === 'AbortError'
          ? 'Сервер слишком долго отвечает. Проверьте интернет и попробуйте ещё раз.'
          : 'Не удалось войти. Проверьте подключение и попробуйте ещё раз.';
        setSubmitError(msg);
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsSubmitting(false);
    }
  };

  const handleChangeNameClick = () => {
    if (!guest) return;
    setFirstName(guest.firstName);
    setLastName(guest.lastName);
    setIsChangingName(true);
    setLoginStep('form');
    setShowLoginModal(true);
  };

  // Start video, auto-advance to form after 7 seconds
  const handleStartVideo = useCallback(() => {
    setLoginStep('video');
    if (videoTimerRef.current) clearTimeout(videoTimerRef.current);
    videoTimerRef.current = setTimeout(() => {
      setLoginStep('form');
    }, 7000);
  }, []);

  // 5. Image Upload & Replacement Logic
  const handleSlotClick = (index: number) => {
    // If timer is not running or reset, uploading is disabled
    if (timerStatus === 'reset' || timerStatus === 'paused' || remainingSeconds <= 0) {
      return;
    }

    activeUploadIndexRef.current = index;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const index = activeUploadIndexRef.current;
    
    if (!file || index === null || !guest) return;
    
    // Validate file size and type
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('Размер файла превышает 10MB. Выберите изображение поменьше.');
      return;
    }

    setUploadingIndex(index);

    if (!isSupabaseConfigured) {
      // Mock File Upload (Convert to Base64 to show locally)
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        
        const mockPhotosStr = localStorage.getItem('mock_photos') || '[]';
        const mockPhotos = JSON.parse(mockPhotosStr);
        
        const newPhoto: Photo = {
          id: Math.random().toString(36).substring(2, 15),
          guest_id: guest.id,
          guest_name: `${guest.firstName} ${guest.lastName}`,
          url: base64data,
          storage_path: `mock_path_${Date.now()}`,
          created_at: new Date().toISOString()
        };
        
        mockPhotos.push(newPhoto);
        localStorage.setItem('mock_photos', JSON.stringify(mockPhotos));
        
        // Refresh local UI
        fetchPhotos();
        setUploadingIndex(null);
      };
      reader.readAsDataURL(file);
      return;
    }

    try {
      // Compress image client-side to improve loading performance
      let uploadBlob: Blob | File = file;
      try {
        uploadBlob = await compressImage(file);
      } catch (compressErr) {
        console.error('Client-side compression failed, uploading original:', compressErr);
      }

      // Wrap blob so the server gets a filename + content-type.
      const namedFile = new File(
        [uploadBlob],
        file.name.replace(/\.[^/.]+$/, '') + '.jpg',
        { type: 'image/jpeg' }
      );

      const formData = new FormData();
      formData.append('file', namedFile);
      formData.append('guestId', guest.id);
      formData.append('guestName', `${guest.firstName} ${guest.lastName}`);

      // 60s timeout for the upload — large photos on slow uplinks need room.
      const controller = new AbortController();
      const uploadTimeout = setTimeout(() => controller.abort(), 60000);

      let res: Response;
      try {
        res = await fetch('/api/photo/upload', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(uploadTimeout);
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (res.status === 409) {
          alert('Вы уже загрузили максимальное количество фотографий (5). Удалите одну, чтобы заменить её.');
        } else {
          alert(data.error || 'Не удалось загрузить изображение. Попробуйте еще раз.');
        }
        return;
      }

      await fetchPhotos();
    } catch (err) {
      console.error('Upload failed:', err);
      const msg = err instanceof Error && err.name === 'AbortError'
        ? 'Загрузка занимает слишком много времени. Попробуйте ещё раз с более стабильным интернетом.'
        : 'Не удалось загрузить изображение. Попробуйте еще раз.';
      alert(msg);
    } finally {
      setUploadingIndex(null);
      activeUploadIndexRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 6. Delete Photo
  const handleDeletePhoto = async (photoId: string, storagePath: string) => {
    if (!confirm('Вы действительно хотите удалить эту фотографию?')) return;

    if (!isSupabaseConfigured) {
      // Mock Delete
      const mockPhotosStr = localStorage.getItem('mock_photos') || '[]';
      const mockPhotos = JSON.parse(mockPhotosStr) as Photo[];
      const filtered = mockPhotos.filter((p) => p.id !== photoId);
      localStorage.setItem('mock_photos', JSON.stringify(filtered));
      fetchPhotos();
      return;
    }

    try {
      if (!guest) return;
      const res = await fetch('/api/photo/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId, guestId: guest.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await fetchPhotos();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Не удалось удалить фотографию.');
    }
  };

  const downloadPhoto = async (url: string, filename: string) => {
    // Route through the Vercel image optimizer so the bytes come from Vercel's
    // CDN even when supabase.co is filtered on the user's network.
    const proxiedUrl = `/_next/image?url=${encodeURIComponent(url)}&w=3840&q=90`;
    try {
      const response = await fetch(proxiedUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
      window.open(proxiedUrl, '_blank');
    }
  };

  // Helper: format timer digits
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return {
      hours: hrs.toString().padStart(2, '0'),
      minutes: mins.toString().padStart(2, '0'),
      seconds: secs.toString().padStart(2, '0')
    };
  };

  const timerDigits = formatTime(remainingSeconds);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#fbf9f6',
        color: 'var(--color-primary)',
        fontFamily: 'var(--font-serif)',
        gap: '16px'
      }}>
        <div className={styles.spinner} style={{ borderColor: 'rgba(181, 141, 114, 0.2)', borderTopColor: 'var(--color-primary)' }}></div>
        <div style={{ fontSize: '1rem', letterSpacing: '0.05em' }}>Загрузка...</div>
      </div>
    );
  }

  // Determine if uploading is globally disabled (timer is not running)
  const isUploadDisabled = 
    timerStatus === 'reset' || 
    timerStatus === 'paused' || 
    remainingSeconds <= 0;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      {/* Decorative Floating Petals */}
      <Petals />

      {/* Demo Mode Alert Banner */}
      {isDemoMode && (
        <div style={{
          backgroundColor: '#ffe58f',
          color: '#873800',
          textAlign: 'center',
          padding: '8px 16px',
          fontSize: '0.85rem',
          fontWeight: 500,
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          ⚠️ Внимание: База данных Supabase не настроена. Сайт запущен в <strong>демо-режиме</strong>. Фотографии и сессия сохраняются локально в вашем браузере.
        </div>
      )}

      <div className={styles.container}>
        {/* Header Section */}
        <header className={styles.header}>
          <div className={styles.namesSubtitle}>Руслан & Марина</div>
          <h1 className={`${styles.weddingTitle} handwritten`}>Свадебный Альбом</h1>
          
          <div className={`${styles.timerContainer} glass-panel animate-float`}>
            <div className={styles.timerLabel}>Время для загрузки кадров</div>
            <div className={styles.timerDigits}>
              <div className={styles.digitBox}>
                <span>{timerDigits.hours}</span>
                <span className={styles.digitLabel}>часы</span>
              </div>
              <span className={styles.separator}>:</span>
              <div className={styles.digitBox}>
                <span>{timerDigits.minutes}</span>
                <span className={styles.digitLabel}>мин</span>
              </div>
              <span className={styles.separator}>:</span>
              <div className={styles.digitBox}>
                <span>{timerDigits.seconds}</span>
                <span className={styles.digitLabel}>сек</span>
              </div>
            </div>
            
            <div className={`${styles.timerStatusBadge} ${
              timerStatus === 'running' ? styles.statusRunning : 
              timerStatus === 'paused' ? styles.statusPaused : styles.statusReset
            }`}>
              {timerStatus === 'running' ? 'Таймер запущен' : 
               timerStatus === 'paused' ? 'Пауза' : 'Не активен'}
            </div>
          </div>
        </header>

        {/* User bar */}
        {guest && (
          <div className={`${styles.welcomeUserBar} glass-panel-light`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', gap: '16px' }}>
            <div className={styles.userName}>
              Приветствуем, <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{guest.firstName} {guest.lastName}</span>!
            </div>
            <button 
              onClick={handleChangeNameClick}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(255, 255, 255, 0.4)' }}
            >
              Сменить имя
            </button>
          </div>
        )}

        {/* Personal Upload Section */}
        {guest && (
          <section className={`${styles.uploadSection} glass-panel animate-fade-in`}>
            <h2 className={styles.sectionTitle}>Ваши свадебные кадры</h2>
            <p className={styles.sectionSubtitle}>
              Вы можете загрузить до 5 фотографий с вашего устройства в общий альбом.
            </p>

            {isUploadDisabled ? (
              <div className={styles.disabledUploadMessage}>
                {timerStatus === 'reset' ? 
                  'Сброс таймера: возможность загрузки фотографий временно заблокирована администратором.' : 
                  'Загрузка фотографий сейчас отключена. Дождитесь запуска таймера.'}
              </div>
            ) : (
              <div style={{ textAlign: 'center', marginBottom: '20px', color: 'var(--color-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                Загружено {userPhotos.length} из 5 кадров. Вы можете нажать на пустые ячейки для загрузки.
              </div>
            )}

            {/* Upload slots */}
            <div className={styles.gridSlots}>
              {Array.from({ length: 5 }).map((_, i) => {
                const photo = userPhotos[i];
                return (
                  <div 
                    key={i} 
                    className={styles.slotCard}
                    onClick={() => photo ? setActiveLightboxPhoto(photo) : handleSlotClick(i)}
                    style={{ cursor: isUploadDisabled && !photo ? 'default' : 'pointer' }}
                  >
                    {uploadingIndex === i ? (
                      <div className={styles.uploadingOverlay}>
                        <div className={styles.spinner}></div>
                        <span className={styles.slotEmptyText}>Загрузка...</span>
                      </div>
                    ) : photo ? (
                      <>
                        <Image
                          src={photo.url}
                          alt={`Кадр ${i + 1}`}
                          className={styles.slotImage}
                          fill
                          sizes="(max-width: 480px) 50vw, (max-width: 900px) 33vw, 20vw"
                          style={{ objectFit: 'cover' }}
                        />
                        <button
                          className={styles.slotDeleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto(photo.id, photo.storage_path);
                          }}
                          title="Удалить фото"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={styles.slotEmptyIcon}>+</span>
                        <span className={styles.slotEmptyText}>Добавить кадр</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Hidden Input for File Selector */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*"
              onChange={handleFileChange}
            />
          </section>
        )}

        {/* Common Gallery Wall */}
        <section className={`${styles.gallerySection} animate-fade-in`}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: '4px' }}>Общая свадебная фотостена</h2>
          <p className={styles.sectionSubtitle}>Мгновения, запечатленные нашими гостями</p>
          
          {allPhotos.length === 0 ? (
            <div className={styles.emptyGallery}>
              Сюда пока никто не загрузил фотографии. Будьте первыми!
            </div>
          ) : (
            <div className={styles.galleryGrid}>
              {allPhotos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className={styles.galleryItem}
                  onClick={() => setActiveLightboxPhoto(photo)}
                  style={{ cursor: 'pointer' }}
                >
                  <Image
                    src={photo.url}
                    alt={`Фото от ${photo.guest_name}`}
                    className={styles.galleryImage}
                    width={600}
                    height={800}
                    sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, 25vw"
                    loading={idx < 4 ? 'eager' : 'lazy'}
                    priority={idx < 2}
                  />
                  <div className={styles.galleryInfo}>
                    <span className={styles.galleryAuthor}>{photo.guest_name}</span>
                    <span className={styles.galleryTime}>
                      {new Date(photo.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Guest Registration / Welcome Dialog */}
        {showLoginModal && (
          <div className={styles.modalOverlay}>

            {/* Video always plays in background */}
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              className={styles.fullscreenVideo}
            >
              <source src="/wedding_video.mp4" type="video/mp4" />
            </video>

            {/* Dark scrim over video */}
            <div className={styles.videoScrim} />

            {/* ── Welcome card ── */}
            {loginStep === 'welcome' && (
              <div className={styles.glassCard}>
                <h2 className={`${styles.glassCardTitle} handwritten`}>
                  Руслан&nbsp;&amp;&nbsp;Марина
                </h2>
                <p className={styles.glassCardText}>
                  {isChangingName
                    ? 'Обновите имя и фамилию. Ваши уже загруженные фотографии останутся на месте.'
                    : 'Добро пожаловать на наш свадебный день! Мы рады разделить этот особенный момент вместе с вами.'}
                </p>
                <button
                  className={styles.startBtn}
                  onClick={() => setLoginStep('form')}
                >
                  {isChangingName ? 'Продолжить' : 'Начать'}
                </button>
              </div>
            )}

            {/* ── Name form card ── */}
            {loginStep === 'form' && (
              <div className={styles.glassCard}>
                <h2 className={`${styles.glassCardTitle} handwritten`}>
                  {isChangingName ? 'Сменить имя' : 'Как вас зовут?'}
                </h2>
                <p className={styles.glassCardText}>
                  {isChangingName
                    ? 'Введите новое имя и фамилию. Подписи у ваших фотографий обновятся автоматически.'
                    : 'Введите своё имя и фамилию, чтобы делиться моментами в общей галерее.'}
                </p>
                <form onSubmit={handleRegister} className={styles.glassForm} noValidate>
                  <input
                    type="text"
                    name="first-name"
                    required
                    autoComplete="given-name"
                    enterKeyHint="next"
                    autoCapitalize="words"
                    placeholder="Ваше Имя"
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); if (submitError) setSubmitError(''); }}
                    disabled={isSubmitting}
                    className={styles.glassInput}
                  />
                  <input
                    type="text"
                    name="last-name"
                    required
                    autoComplete="family-name"
                    enterKeyHint="go"
                    autoCapitalize="words"
                    placeholder="Ваша Фамилия"
                    value={lastName}
                    onChange={(e) => { setLastName(e.target.value); if (submitError) setSubmitError(''); }}
                    disabled={isSubmitting}
                    className={styles.glassInput}
                  />
                  {submitError && (
                    <div style={{
                      color: '#ffb3b3',
                      background: 'rgba(220, 53, 69, 0.15)',
                      border: '1px solid rgba(220, 53, 69, 0.35)',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      fontSize: '0.85rem',
                      textAlign: 'center',
                    }}>
                      {submitError}
                    </div>
                  )}
                  <button
                    type="submit"
                    className={styles.startBtn}
                    disabled={isSubmitting}
                    style={isSubmitting ? { opacity: 0.7, cursor: 'wait' } : undefined}
                  >
                    {isSubmitting
                      ? 'Подождите...'
                      : isChangingName ? 'Сохранить' : 'Войти'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className={styles.footer}>
          Сделано с любовью для Руслана & Марины <span className={styles.footerHeart}>♥</span> 2026
        </footer>
      </div>

      {/* Lightbox Modal */}
      {activeLightboxPhoto && (
        <div 
          className={styles.lightboxOverlay}
          onClick={() => setActiveLightboxPhoto(null)}
        >
          <div 
            className={styles.lightboxContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className={styles.lightboxCloseBtn}
              onClick={() => setActiveLightboxPhoto(null)}
              title="Закрыть"
            >
              ✕
            </button>
            <Image
              src={activeLightboxPhoto.url}
              alt={`Фото от ${activeLightboxPhoto.guest_name}`}
              className={styles.lightboxImage}
              width={1600}
              height={1600}
              sizes="100vw"
              priority
              style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }}
            />
            <div className={styles.lightboxMeta}>
              <div className={styles.lightboxAuthor}>
                Отправитель: <span>{activeLightboxPhoto.guest_name}</span>
              </div>
              <button 
                className={styles.lightboxDownloadBtn}
                onClick={() => {
                  const safeName = activeLightboxPhoto.guest_name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
                  downloadPhoto(activeLightboxPhoto.url, `wedding_${safeName}_${activeLightboxPhoto.id.substring(0, 5)}.jpg`);
                }}
                title="Скачать фото"
              >
                ⬇️ Скачать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
