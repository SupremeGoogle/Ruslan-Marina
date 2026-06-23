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

export default function Home() {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  // loginStep: 'welcome' = greeting screen | 'video' = playing video | 'form' = name input
  const [loginStep, setLoginStep] = useState<'welcome' | 'video' | 'form'>('welcome');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isChangingName, setIsChangingName] = useState(false);
  
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
    async function initSession() {
      // Check demo mode
      if (!isSupabaseConfigured) {
        setIsDemoMode(true);
        console.warn('Supabase credentials not configured. Running in Demo Mode.');
      }

      // Fetch IP
      try {
        const ipRes = await fetch('/api/ip');
        const ipData = await ipRes.json();
        setClientIp(ipData.ip || '127.0.0.1');
      } catch (err) {
        console.error('Failed to detect IP, using local fallback:', err);
      }

      // Load cached session
      const cached = localStorage.getItem('wedding_guest_session');
      if (cached) {
        const parsedGuest = JSON.parse(cached) as Guest;
        if (isSupabaseConfigured) {
          try {
            const { data, error } = await supabase
              .from('guests')
              .select('*')
              .eq('id', parsedGuest.id)
              .single();
              
            if (error || !data) {
              console.warn('Cached guest session not found in DB, clearing cache');
              localStorage.removeItem('wedding_guest_session');
              setGuest(null);
              setShowLoginModal(true);
            } else {
              setGuest(parsedGuest);
            }
          } catch (err) {
            console.error('Error verifying guest session:', err);
            setGuest(parsedGuest); // fallback to cached on network error
          }
        } else {
          setGuest(parsedGuest);
        }
      } else {
        setShowLoginModal(true);
      }
      setLoading(false);
    }
    initSession();
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

  // 3. Fetch Photos (all and user-specific)
  const fetchPhotos = async () => {
    if (!isSupabaseConfigured) {
      // Mock photo retrieval
      const mockPhotosStr = localStorage.getItem('mock_photos') || '[]';
      const parsedPhotos = JSON.parse(mockPhotosStr) as Photo[];
      
      // Sort newest first
      const sorted = [...parsedPhotos].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setAllPhotos(sorted);
      
      if (guest) {
        const mine = sorted.filter(p => p.guest_id === guest.id);
        setUserPhotos(mine);
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setAllPhotos(data);
        if (guest) {
          const mine = data.filter((p: any) => p.guest_id === guest.id);
          setUserPhotos(mine);
        }
      }
    } catch (err) {
      console.error('Error fetching photos:', err);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [guest, isSupabaseConfigured]);

  // Real-time listener for photos table changes
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('public-photos-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos' },
        () => {
          fetchPhotos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guest, isSupabaseConfigured]);

  // 4. Handle Guest Registration (Welcome dialog submission)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const guestData = {
      firstName: cleanFirst,
      lastName: cleanLast,
      ip: clientIp,
    };

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
          headers: {
            'Content-Type': 'application/json',
          },
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
        alert('Не удалось изменить имя. Возможно, такой гость уже существует.');
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
          created_at: new Date().toISOString()
        };
        mockGuests.push(existing);
        localStorage.setItem('mock_guests', JSON.stringify(mockGuests));
      }
      
      const sessionGuest: Guest = {
        id: existing.id,
        firstName: existing.first_name,
        lastName: existing.last_name,
        ip: existing.ip_address
      };
      
      localStorage.setItem('wedding_guest_session', JSON.stringify(sessionGuest));
      setGuest(sessionGuest);
      setShowLoginModal(false);
      setIsChangingName(false);
      return;
    }

    try {
      // Try to find if user already exists
      const { data: existing, error: findError } = await supabase
        .from('guests')
        .select('*')
        .eq('first_name', cleanFirst)
        .eq('last_name', cleanLast)
        .maybeSingle();

      if (findError) throw findError;

      let guestId = '';
      if (existing) {
        guestId = existing.id;
      } else {
        // Create new guest
        const { data: created, error: createError } = await supabase
          .from('guests')
          .insert({
            first_name: cleanFirst,
            last_name: cleanLast,
            ip_address: clientIp,
          })
          .select()
          .single();

        if (createError) throw createError;
        guestId = created.id;
      }

      const sessionGuest: Guest = {
        id: guestId,
        firstName: cleanFirst,
        lastName: cleanLast,
        ip: clientIp,
      };

      localStorage.setItem('wedding_guest_session', JSON.stringify(sessionGuest));
      setGuest(sessionGuest);
      setShowLoginModal(false);
      setIsChangingName(false);
    } catch (err) {
      console.error('Registration failed:', err);
      alert('Произошла ошибка при входе. Попробуйте еще раз.');
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
      // Check 5-photo upload limit from database
      const { count, error: countError } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('guest_id', guest.id);

      if (countError) throw countError;

      if (count && count >= 5) {
        alert('Вы уже загрузили максимальное количество фотографий (5). Удалите одну, чтобы заменить её.');
        setUploadingIndex(null);
        return;
      }

      // Upload file to Supabase storage bucket 'photos'
      const fileExt = file.name.split('.').pop();
      const uniqueName = `${guest.id}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(uniqueName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(uniqueName);

      // Save to photos database
      const { error: dbError } = await supabase
        .from('photos')
        .insert({
          guest_id: guest.id,
          guest_name: `${guest.firstName} ${guest.lastName}`,
          url: publicUrl,
          storage_path: uniqueName
        });

      if (dbError) throw dbError;

      fetchPhotos();
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Не удалось загрузить изображение. Попробуйте еще раз.');
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
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove([storagePath]);

      if (storageError) {
        console.warn('Storage deletion warning:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId);

      if (dbError) throw dbError;

      fetchPhotos();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Не удалось удалить фотографию.');
    }
  };

  const downloadPhoto = async (url: string, filename: string) => {
    try {
      const response = await fetch(url, { mode: 'cors' });
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
      console.error('Direct download failed, opening in new tab:', err);
      window.open(url, '_blank');
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
                        <img 
                          src={photo.url} 
                          alt={`Кадр ${i + 1}`}
                          className={styles.slotImage}
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
              {allPhotos.map((photo) => (
                <div 
                  key={photo.id} 
                  className={styles.galleryItem}
                  onClick={() => setActiveLightboxPhoto(photo)}
                  style={{ cursor: 'pointer' }}
                >
                  <img 
                    src={photo.url} 
                    alt={`Фото от ${photo.guest_name}`} 
                    className={styles.galleryImage}
                    loading="lazy"
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
                <form onSubmit={handleRegister} className={styles.glassForm}>
                  <input
                    type="text"
                    required
                    placeholder="Ваше Имя"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={styles.glassInput}
                  />
                  <input
                    type="text"
                    required
                    placeholder="Ваша Фамилия"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={styles.glassInput}
                  />
                  <button type="submit" className={styles.startBtn}>
                    {isChangingName ? 'Сохранить' : 'Войти'}
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
            <img 
              src={activeLightboxPhoto.url} 
              alt={`Фото от ${activeLightboxPhoto.guest_name}`} 
              className={styles.lightboxImage}
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
