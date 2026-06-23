'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './admin.module.css';
import Petals from '@/components/Petals';
import { supabase } from '@/utils/supabaseClient';
import confetti from 'canvas-confetti';

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  ip_address: string;
  created_at: string;
}

interface Photo {
  id: string;
  guest_id: string;
  guest_name: string;
  url: string;
  storage_path: string;
  created_at: string;
}

// Structured guest showing progress
interface ParticipantProgress {
  guestId: string;
  firstName: string;
  lastName: string;
  ipAddress: string;
  photos: Photo[];
}

interface AdaptiveCollageProps {
  photos: Photo[];
  title?: string;
  isWinner?: boolean;
}

const AdaptiveCollage: React.FC<AdaptiveCollageProps> = ({ photos, title, isWinner }) => {
  const [orientations, setOrientations] = useState<Record<string, 'horizontal' | 'vertical'>>({});

  useEffect(() => {
    photos.forEach((photo) => {
      if (orientations[photo.id]) return;
      const img = new globalThis.Image();
      img.src = photo.url;
      img.onload = () => {
        setOrientations((prev) => ({
          ...prev,
          [photo.id]: img.naturalWidth >= img.naturalHeight ? 'horizontal' : 'vertical',
        }));
      };
    });
  }, [photos]);

  return (
    <div className={isWinner ? styles.winnerCollageWrapper : styles.sweepingCollage}>
      {title && <h3 className={styles.collageTitle}>{title}</h3>}
      <div className={styles.collageGrid}>
        {photos.map((photo) => {
          const orientation = orientations[photo.id] || 'horizontal';
          const gridColumn = orientation === 'vertical' ? 'span 2' : 'span 3';
          const gridRow = orientation === 'vertical' ? 'span 3' : 'span 2';
          
          return (
            <div 
              key={photo.id} 
              style={{ 
                gridColumn, 
                gridRow,
                position: 'relative',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '2px solid white'
              }}
            >
              <img 
                src={photo.url} 
                alt="Кадр" 
                className={styles.collageImg}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Timer State
  const [timerStatus, setTimerStatus] = useState<'running' | 'paused' | 'reset'>('reset');
  const [remainingSeconds, setRemainingSeconds] = useState(10800);
  
  // Data State
  const [participants, setParticipants] = useState<ParticipantProgress[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Randomizer Animation States
  const [randomizerActive, setRandomizerActive] = useState(false);
  const [animStage, setAnimStage] = useState<'reveal' | 'scramble' | 'winner'>('reveal');
  const [eligibleGuests, setEligibleGuests] = useState<ParticipantProgress[]>([]);
  const [currentRevealIndex, setCurrentRevealIndex] = useState(0);
  const [revealedGuests, setRevealedGuests] = useState<ParticipantProgress[]>([]);
  const [winner, setWinner] = useState<ParticipantProgress | null>(null);
  const [manualSelections, setManualSelections] = useState<Record<string, boolean>>({});
  const [archiveUrl, setArchiveUrl] = useState<string | null>(null);
  const [isCreatingArchive, setIsCreatingArchive] = useState(false);

  const isSupabaseConfigured = !!supabase;

  const checkArchiveStatus = React.useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const adminPassword = sessionStorage.getItem('admin_password') || '';
    try {
      const res = await fetch('/api/admin/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify({ action: 'check' }),
      });
      const data = await res.json();
      if (res.ok && data.exists) {
        setArchiveUrl(data.archiveUrl);
      } else {
        setArchiveUrl(null);
      }
    } catch (err) {
      console.error('Error checking archive status:', err);
    }
  }, [isSupabaseConfigured]);

  const triggerCreateArchive = React.useCallback(async (): Promise<string | null> => {
    if (!isSupabaseConfigured) return null;
    const adminPassword = sessionStorage.getItem('admin_password') || '';
    setIsCreatingArchive(true);
    try {
      const res = await fetch('/api/admin/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify({ action: 'create' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setArchiveUrl(data.archiveUrl);
        return data.archiveUrl as string;
      }
      alert('Не удалось создать архив: ' + (data.error || 'unknown error'));
      return null;
    } catch (err) {
      console.error('Error triggering archive creation:', err);
      alert('Ошибка при создании архива.');
      return null;
    } finally {
      setIsCreatingArchive(false);
    }
  }, [isSupabaseConfigured]);

  const triggerDownloadArchive = React.useCallback(async () => {
    let url = archiveUrl;
    if (!url) {
      url = await triggerCreateArchive();
      if (!url) return;
    }
    // Open in a new tab/window so the download starts without leaving the panel
    window.open(url, '_blank');
  }, [archiveUrl, triggerCreateArchive]);

  const handleDeleteArchive = React.useCallback(async () => {
    if (!confirm('Вы действительно хотите удалить архив со всеми фотографиями?')) return;
    if (!isSupabaseConfigured) return;
    const adminPassword = sessionStorage.getItem('admin_password') || '';
    try {
      const res = await fetch('/api/admin/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify({ action: 'delete' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setArchiveUrl(null);
        alert('Архив успешно удален.');
      } else {
        alert('Не удалось удалить архив: ' + (data.error || 'unknown error'));
      }
    } catch (err) {
      console.error('Error deleting archive:', err);
      alert('Ошибка при удалении архива.');
    }
  }, [isSupabaseConfigured]);

  // 1. Verify Session Authenticated on Mount — re-verify cached password against the server
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsDemoMode(true);
    }

    const cachedPassword = sessionStorage.getItem('admin_password');
    if (!cachedPassword) return;

    fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: cachedPassword }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated) {
          setIsAuthenticated(true);
        } else {
          sessionStorage.removeItem('admin_password');
        }
      })
      .catch((err) => {
        console.error('Admin re-verify failed:', err);
        sessionStorage.removeItem('admin_password');
      });
  }, [isSupabaseConfigured]);

  // 2. Fetch Dashboard Data (Timer, Guests, Photos)
  const fetchDashboardData = async () => {
    if (!isAuthenticated) return;

    if (!isSupabaseConfigured) {
      // Mock Timer State
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

      // Mock Participants & Photos
      const mockGuestsStr = localStorage.getItem('mock_guests') || '[]';
      const mockPhotosStr = localStorage.getItem('mock_photos') || '[]';
      
      const parsedGuests = JSON.parse(mockGuestsStr) as any[];
      const parsedPhotos = JSON.parse(mockPhotosStr) as Photo[];

      setAllPhotos(parsedPhotos);

      const progressData: ParticipantProgress[] = parsedGuests.map((g: any) => {
        const photos = parsedPhotos.filter(p => p.guest_id === g.id);
        return {
          guestId: g.id,
          firstName: g.first_name,
          lastName: g.last_name,
          ipAddress: g.ip_address,
          photos
        };
      });
      setParticipants(progressData);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch Timer from API to prevent local clock desync
      try {
        const timerRes = await fetch('/api/timer');
        if (timerRes.ok) {
          const timerData = await timerRes.json();
          setTimerStatus(timerData.status);
          setRemainingSeconds(timerData.remainingSeconds);
        } else {
          throw new Error('Failed to fetch timer from API');
        }
      } catch (timerErr) {
        console.error('Error fetching timer via API, falling back to direct fetch:', timerErr);
        const { data: timerData, error: timerError } = await supabase
          .from('timer_state')
          .select('*')
          .eq('id', 1)
          .single();

        if (timerError) throw timerError;
        if (timerData) {
          setTimerStatus(timerData.status as any);
          if (timerData.status === 'running') {
            const lastUpdated = new Date(timerData.updated_at).getTime();
            const elapsed = Math.floor((Date.now() - lastUpdated) / 1000);
            setRemainingSeconds(Math.max(0, timerData.remaining_seconds - elapsed));
          } else {
            setRemainingSeconds(timerData.remaining_seconds);
          }
        }
      }

      // Fetch Guests
      const { data: guestsData, error: guestsError } = await supabase
        .from('guests')
        .select('*')
        .order('created_at', { ascending: false });

      if (guestsError) throw guestsError;

      // Fetch Photos
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('*');

      if (photosError) throw photosError;

      setAllPhotos(photosData || []);

      // Group photos by guest
      if (guestsData) {
        const progressData: ParticipantProgress[] = guestsData.map((g: any) => {
          const photos = (photosData || []).filter((p: any) => p.guest_id === g.id);
          return {
            guestId: g.id,
            firstName: g.first_name,
            lastName: g.last_name,
            ipAddress: g.ip_address,
            photos,
          };
        });
        setParticipants(progressData);
      }
    } catch (err) {
      console.error('Error fetching admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch when logged in
  useEffect(() => {
    fetchDashboardData();
    let pollInterval: NodeJS.Timeout;
    if (isAuthenticated) {
      pollInterval = setInterval(fetchDashboardData, 5000);
      checkArchiveStatus();
    }
    return () => clearInterval(pollInterval);
  }, [isAuthenticated, isSupabaseConfigured, checkArchiveStatus]);

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

  // 3. Admin Authentication Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.authenticated) {
        sessionStorage.setItem('admin_password', password);
        setIsAuthenticated(true);
      } else {
        setLoginError('Неверный пароль администратора.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError('Ошибка соединения с сервером.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_password');
    setIsAuthenticated(false);
    setPassword('');
  };

  // 4. Timer State Control Actions
  const handleTimerAction = async (action: 'start' | 'stop' | 'reset') => {
    const adminPassword = sessionStorage.getItem('admin_password') || '';
    
    if (action === 'reset') {
      if (!confirm('Вы уверены, что хотите сбросить таймер? Это заблокирует загрузку фотографий для гостей.')) {
        return;
      }
    }

    if (!isSupabaseConfigured) {
      // Mock Timer action
      let nextStatus = timerStatus;
      let nextRemaining = remainingSeconds;
      
      if (action === 'start') {
        nextStatus = 'running';
      } else if (action === 'stop') {
        nextStatus = 'paused';
      } else if (action === 'reset') {
        nextStatus = 'reset';
        nextRemaining = 10800;
      }
      
      const mockState = {
        status: nextStatus,
        remainingSeconds: nextRemaining,
        updatedAt: Date.now()
      };
      
      localStorage.setItem('mock_timer_state', JSON.stringify(mockState));
      setTimerStatus(nextStatus);
      setRemainingSeconds(nextRemaining);
      return;
    }

    try {
      const res = await fetch('/api/admin/timer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error('Failed to update timer');
      const data = await res.json();
      if (data.success) {
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Timer action failed:', err);
      alert('Не удалось изменить состояние таймера.');
    }
  };

  // 5. Delete Photo Action (from database & storage)
  const handleDeletePhoto = async (photoId: string, storagePath: string) => {
    if (!confirm('Удалить эту фотографию из галереи гостя?')) return;

    if (!isSupabaseConfigured) {
      // Mock Delete
      const mockPhotosStr = localStorage.getItem('mock_photos') || '[]';
      const mockPhotos = JSON.parse(mockPhotosStr) as Photo[];
      const filtered = mockPhotos.filter((p) => p.id !== photoId);
      localStorage.setItem('mock_photos', JSON.stringify(filtered));
      fetchDashboardData();
      return;
    }

    const adminPassword = sessionStorage.getItem('admin_password') || '';

    try {
      const res = await fetch('/api/admin/delete-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify({ photoId, storagePath }),
      });

      if (!res.ok) throw new Error('Failed to delete photo');
      
      fetchDashboardData();
    } catch (err) {
      console.error('Delete photo failed:', err);
      alert('Не удалось удалить фотографию.');
    }
  };

  // 6. Delete Guest Action (from database & storage)
  const handleDeleteGuest = async (guestId: string, fullName: string) => {
    if (!confirm(`Вы действительно хотите удалить гостя ${fullName} и все его фотографии?`)) return;

    if (!isSupabaseConfigured) {
      // Mock Delete guest
      const mockGuestsStr = localStorage.getItem('mock_guests') || '[]';
      const mockGuests = JSON.parse(mockGuestsStr) as Guest[];
      const filteredGuests = mockGuests.filter((g) => g.id !== guestId);
      localStorage.setItem('mock_guests', JSON.stringify(filteredGuests));

      const mockPhotosStr = localStorage.getItem('mock_photos') || '[]';
      const mockPhotos = JSON.parse(mockPhotosStr) as Photo[];
      const filteredPhotos = mockPhotos.filter((p) => p.guest_id !== guestId);
      localStorage.setItem('mock_photos', JSON.stringify(filteredPhotos));

      fetchDashboardData();
      return;
    }

    const adminPassword = sessionStorage.getItem('admin_password') || '';

    try {
      const res = await fetch('/api/admin/delete-guest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify({ guestId }),
      });

      if (!res.ok) throw new Error('Failed to delete guest');
      
      fetchDashboardData();
    } catch (err) {
      console.error('Delete guest failed:', err);
      alert('Не удалось удалить гостя.');
    }
  };

  // 6. RANDOMIZER ANIMATION LOGIC
  const startRandomizer = () => {
    // Filter guests who are selected manually or have 5 photos by default, and have at least 1 photo
    const activeParticipants = participants.filter(p => {
      const isSelected = manualSelections[p.guestId] ?? (p.photos.length === 5);
      return isSelected && p.photos.length > 0;
    });

    if (activeParticipants.length === 0) {
      alert('Нет участников для розыгрыша! Отметьте галочку «Участвует» у гостей, чтобы добавить их.');
      return;
    }

    // Trigger archive creation/refresh in background when starting randomizer
    triggerCreateArchive();

    setEligibleGuests(activeParticipants);
    setRevealedGuests([]);
    setWinner(null);
    setCurrentRevealIndex(0);
    setAnimStage('reveal');
    setRandomizerActive(true);
  };

  // Play sequential reveal animation
  useEffect(() => {
    if (!randomizerActive || eligibleGuests.length === 0 || animStage !== 'reveal') return;

    const playNextReveal = () => {
      if (currentRevealIndex < eligibleGuests.length) {
        const nextGuest = eligibleGuests[currentRevealIndex];
        // Add to bottom row collages
        setRevealedGuests(prev => [...prev, nextGuest]);
        setCurrentRevealIndex(prev => prev + 1);
      } else {
        // Move to scrambling phase
        setAnimStage('scramble');
      }
    };

    const timer = setTimeout(playNextReveal, 2200); // Show sweeping collage for 2.2s before going to next
    return () => clearTimeout(timer);
  }, [randomizerActive, currentRevealIndex, eligibleGuests, animStage]);

  // Handle Scrambling and Winner selection
  useEffect(() => {
    if (animStage !== 'scramble') return;

    // Scramble for 6.0 seconds, then pick winner
    const scrambleTimer = setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * eligibleGuests.length);
      const chosenWinner = eligibleGuests[randomIndex];
      
      setWinner(chosenWinner);
      setAnimStage('winner');
      
      // Confetti burst logic
      triggerConfettiShow();
    }, 6000);

    return () => clearTimeout(scrambleTimer);
  }, [animStage, eligibleGuests]);

  const triggerConfettiShow = () => {
    const duration = 6 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 35, spread: 360, ticks: 60, zIndex: 1100 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Fire confetti from left and right sides
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const closeRandomizer = () => {
    setRandomizerActive(false);
    setEligibleGuests([]);
    setRevealedGuests([]);
    setWinner(null);
  };

  // Helper format time
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Render Login Card
  if (!isAuthenticated) {
    return (
      <div className={styles.loginOverlay}>
        <Petals />
        <div className={`${styles.loginCard} glass-panel`}>
          <h2 className="handwritten" style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Вход в панель</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
            Пожалуйста, введите пароль администратора для управления таймером и рандомайзером.
          </p>
          
          <form onSubmit={handleLoginSubmit}>
            <input
              type="password"
              required
              placeholder="Пароль администратора"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.inputField}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-color)',
                outline: 'none',
                marginBottom: '16px',
                textAlign: 'center'
              }}
            />
            {loginError && (
              <p style={{ color: '#d9383a', fontSize: '0.85rem', marginBottom: '16px', fontWeight: 500 }}>
                {loginError}
              </p>
            )}
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              Войти как админ
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Helper: Dynamic width and font size based on the number of participating guests
  const getMiniCollageSize = (count: number) => {
    if (count <= 4) return { width: 170, fontSize: '0.75rem' };
    if (count <= 8) return { width: 130, fontSize: '0.65rem' };
    if (count <= 12) return { width: 100, fontSize: '0.55rem' };
    return { width: 75, fontSize: '0.45rem' };
  };

  const count = eligibleGuests.length;
  const { width: miniWidth, fontSize: miniFontSize } = getMiniCollageSize(count);

  // Calculate active (checked) participants count
  const activeCount = participants.filter(
    (p) => manualSelections[p.guestId] ?? (p.photos.length === 5)
  ).length;

  // Render Main Admin Panel
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
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
          ⚠️ Внимание: База данных Supabase не настроена. Панель работает в <strong>демо-режиме</strong> (изменения таймера и удаление фотографий происходят в локальном хранилище браузера).
        </div>
      )}

      <div className={styles.adminContainer}>
        {/* Header */}
        <header className={styles.adminHeader}>
          <div>
            <div className={styles.adminSubtitle}>Свадебный Панель Управления</div>
            <h1 className={styles.adminTitle}>Администрирование сайта</h1>
          </div>
          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
            Выйти
          </button>
        </header>

        {/* Dashboard Content */}
        <div className={styles.dashboardGrid}>
          {/* Left Column: Timer Controls and Actions */}
          <div className={`${styles.controlCard} glass-panel`}>
            <h2 className={styles.cardTitle}>Управление таймером</h2>
            
            <div className={styles.timerStatusSection}>
              <div className={styles.timerLabel}>Статус таймера</div>
              <div className={styles.timerTime}>{formatTime(remainingSeconds)}</div>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: timerStatus === 'running' ? 'var(--color-secondary)' : 
                       timerStatus === 'paused' ? 'var(--color-accent)' : 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {timerStatus === 'running' ? 'Запущен (Идет отсчет)' : 
                 timerStatus === 'paused' ? 'Пауза (Загрузка заблокирована)' : 'Сброшен (Загрузка заблокирована)'}
              </div>
            </div>

            <div className={styles.timerBtnGroup}>
              <button 
                onClick={() => handleTimerAction('start')}
                disabled={timerStatus === 'running' || remainingSeconds <= 0}
                className={`${styles.btnControl} ${styles.btnStart}`}
                style={{ opacity: (timerStatus === 'running' || remainingSeconds <= 0) ? 0.5 : 1 }}
              >
                Запуск
              </button>
              <button 
                onClick={() => handleTimerAction('stop')}
                disabled={timerStatus !== 'running'}
                className={`${styles.btnControl} ${styles.btnPause}`}
                style={{ opacity: timerStatus !== 'running' ? 0.5 : 1 }}
              >
                Пауза
              </button>
              <button 
                onClick={() => handleTimerAction('reset')}
                className={`${styles.btnControl} ${styles.btnReset}`}
              >
                Сброс
              </button>
            </div>

            <h2 className={styles.cardTitle} style={{ marginTop: '16px' }}>Розыгрыш призов</h2>
            <div className={styles.randomizerSection}>
              <button onClick={startRandomizer} className={styles.btnRandomizer}>
                🎉 Запустить Рандомайзер
              </button>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4, marginBottom: '16px' }}>
                Случайный выбор победителя среди гостей, загрузивших фотографии. Анимация проигрывает коллажи участников по очереди.
              </p>

              {/* Archive management section */}
              <div style={{ borderTop: '1px dashed rgba(181, 141, 114, 0.2)', paddingTop: '16px', marginTop: '16px', width: '100%' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-main)', textAlign: 'center', fontWeight: 600 }}>Архив с фотографиями</h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', width: '100%' }}>
                  <button
                    onClick={triggerCreateArchive}
                    disabled={isCreatingArchive}
                    className="btn-secondary"
                    style={{
                      fontSize: '0.85rem',
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-full)',
                      width: '100%',
                      maxWidth: '260px',
                      opacity: isCreatingArchive ? 0.6 : 1,
                      cursor: isCreatingArchive ? 'wait' : 'pointer',
                    }}
                  >
                    {isCreatingArchive
                      ? '⏳ Создаём архив...'
                      : archiveUrl ? '🔄 Пересоздать архив' : '📦 Создать архив сейчас'}
                  </button>

                  <button
                    onClick={triggerDownloadArchive}
                    disabled={isCreatingArchive}
                    className="btn-primary"
                    style={{
                      fontSize: '0.85rem',
                      padding: '10px 16px',
                      borderRadius: 'var(--radius-full)',
                      width: '100%',
                      maxWidth: '260px',
                      backgroundColor: 'var(--color-primary)',
                      color: 'white',
                      fontWeight: 500,
                      border: 'none',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      opacity: isCreatingArchive ? 0.6 : 1,
                      cursor: isCreatingArchive ? 'wait' : 'pointer',
                    }}
                  >
                    ⬇️ Скачать архив (.zip)
                  </button>

                  {archiveUrl && (
                    <button
                      onClick={handleDeleteArchive}
                      className="btn-secondary"
                      style={{
                        fontSize: '0.75rem',
                        padding: '6px 12px',
                        color: '#d9383a',
                        borderColor: 'rgba(217, 56, 58, 0.3)',
                        backgroundColor: 'transparent',
                        borderRadius: 'var(--radius-full)',
                        marginTop: '4px',
                      }}
                    >
                      🗑️ Удалить архив
                    </button>
                  )}

                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', margin: '4px 0 0', lineHeight: 1.4 }}>
                    «Скачать» сначала пересоздаст архив, если его ещё нет.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Participants Progress Table */}
          <div className={`${styles.participantsCard} glass-panel`}>
            <h2 className={styles.cardTitle}>Прогресс гостей ({activeCount} активных / {participants.length} зарегистрировано)</h2>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className={styles.spinner} style={{ margin: '0 auto 10px' }}></div>
                Загрузка данных...
              </div>
            ) : participants.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                На сайте еще никто не зарегистрировался.
              </div>
            ) : (
              <div className={styles.participantsList}>
                {participants.map((p) => (
                  <div key={p.guestId} className={styles.participantItem}>
                    <div className={styles.participantHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className={styles.participantName}>{p.firstName} {p.lastName}</span>
                        <span className={styles.participantIp}> (IP: {p.ipAddress})</span>
                        <button 
                          onClick={() => handleDeleteGuest(p.guestId, `${p.firstName} ${p.lastName}`)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#d9383a',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            opacity: 0.6,
                            transition: 'opacity 0.2s, background-color 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '1';
                            e.currentTarget.style.backgroundColor = 'rgba(217, 56, 58, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '0.6';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          title="Удалить этого гостя и все его фотографии"
                        >
                          🗑️
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span className={styles.participantStats}>Загружено: {p.photos.length} из 5</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
                          <input 
                            type="checkbox"
                            checked={manualSelections[p.guestId] ?? (p.photos.length === 5)}
                            onChange={(e) => {
                              setManualSelections(prev => ({
                                ...prev,
                                [p.guestId]: e.target.checked
                              }));
                            }}
                          />
                          Участвует
                        </label>
                      </div>
                    </div>

                    <div className={styles.participantThumbnails}>
                      {Array.from({ length: 5 }).map((_, idx) => {
                        const photo = p.photos[idx];
                        return photo ? (
                          <div key={photo.id} className={styles.thumbnailWrapper}>
                            <img src={photo.url} alt="Миниатюра" className={styles.thumbnail} />
                            <button
                              onClick={() => handleDeletePhoto(photo.id, photo.storage_path)}
                              className={styles.btnDeleteThumb}
                              title="Удалить фото гостя"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div key={`empty-${idx}`} className={styles.emptyThumbnailPlaceholder} title="Свободная ячейка"></div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FULLSCREEN RANDOMIZER OVERLAY ANIMATION */}
      {randomizerActive && (
        <div className={styles.randomizerOverlay}>
          {/* Overlay Header */}
          <div className={styles.randomizerHeader}>
            <h2 className={styles.randomizerTitle}>Свадебный Рандомайзер</h2>
            <div className={styles.randomizerSubtitle}>
              {animStage === 'reveal' ? 'Сбор счастливых воспоминаний гостей...' :
               animStage === 'scramble' ? 'Перемешивание кадров...' : 'Поздравляем победителя!'}
            </div>
          </div>

          {/* Animation Stage Canvas Area */}
          <div className={styles.animationContainer}>
            {/* Phase 1: Reveal sweeping collages one by one */}
            {animStage === 'reveal' && eligibleGuests[currentRevealIndex] && (
              <AdaptiveCollage 
                key={currentRevealIndex}
                photos={eligibleGuests[currentRevealIndex].photos}
                title={`Снимки от: ${eligibleGuests[currentRevealIndex].firstName} ${eligibleGuests[currentRevealIndex].lastName}`}
              />
            )}

            {/* Phase 2: Scrambled grid animation where all collages rotate & fly */}
            {animStage === 'scramble' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', width: '80%', zIndex: 5 }}>
                {eligibleGuests.map((g, index) => (
                  <div 
                    key={g.guestId} 
                    className={`${styles.miniCollage} ${styles.scramble}`} 
                    style={{
                      width: `${miniWidth}px`,
                      height: `${miniWidth}px`,
                      animationDelay: `${index * 0.05}s`
                    }}
                  >
                    <span className={styles.miniCollageName} style={{ fontSize: miniFontSize }}>{g.firstName} {g.lastName}</span>
                    <div className={styles.miniGrid}>
                      {g.photos.slice(0, 5).map(p => (
                        <img key={p.id} src={p.url} alt="Мини фото" className={styles.miniImg} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Phase 3: Final Winner Reveal and Confetti Loop */}
            {animStage === 'winner' && winner && (
              <div className={styles.winnerRevealCard}>
                <div className={styles.winnerLabel}>Обладатель главного приза!</div>
                <h3 className={styles.winnerName}>{winner.firstName} {winner.lastName}</h3>
                
                <AdaptiveCollage 
                  photos={winner.photos}
                  isWinner={true}
                />

                <button onClick={closeRandomizer} className={styles.btnCloseRandomizer}>
                  Закрыть и продолжить
                </button>
              </div>
            )}
          </div>

          {/* Phase 1: Mini collages row landing at the bottom */}
          {animStage === 'reveal' && (
            <div className={styles.collagesRow}>
              {revealedGuests.map((g) => (
                <div 
                  key={g.guestId} 
                  className={styles.miniCollage}
                  style={{
                    width: `${miniWidth}px`,
                    height: `${miniWidth}px`
                  }}
                >
                  <span className={styles.miniCollageName} style={{ fontSize: miniFontSize }}>{g.firstName} {g.lastName}</span>
                  <div className={styles.miniGrid}>
                    {g.photos.slice(0, 5).map(p => (
                      <img key={p.id} src={p.url} alt="Мини фото" className={styles.miniImg} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Close randomizer overlay early button */}
          {animStage !== 'winner' && (
            <button onClick={closeRandomizer} className="btn-secondary" style={{ color: 'white', borderColor: 'white', marginTop: '20px' }}>
              Прервать
            </button>
          )}
        </div>
      )}
    </div>
  );
}
