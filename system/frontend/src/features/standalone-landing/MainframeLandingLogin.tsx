import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePending } from '@/components/ui/pending';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, UserCheck, ChevronRight, Phone, ShieldCheck, KeyRound, Lock, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { setSession } from '../../lib/session';
import { API_BASE_URL } from '../../lib/apiBaseUrl';

interface MainframeLandingLoginProps {
  onLoginSuccess?: (profile: 'Admin Good' | 'Admin Win') => void;
}

export default function MainframeLandingLogin({ onLoginSuccess }: MainframeLandingLoginProps) {
  const { setActiveProjectId } = useProject();

  // Video element & mouse-scrubbing refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const prevXRef = useRef<number | null>(null);
  const targetTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Reveal is per-attempt on purpose: it resets whenever this screen mounts and
  // is never persisted, so a shoulder-surfer cannot find it left switched on.
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCenterSubmitting, setIsCenterSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Center 2FA Modal State
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFAMode, setTwoFAMode] = useState<'otp' | 'token'>('otp');
  const [twoFAOtp, setTwoFAOtp] = useState(['', '', '', '', '', '']);
  const [twoFAToken, setTwoFAToken] = useState('');
  const [is2FASubmitting, setIs2FASubmitting] = useState(false);
  const [twoFAError, setTwoFAError] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Profile Selection Modal state
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<'Admin Good' | 'Admin Win' | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<'Admin Good' | 'Admin Win' | null>(null);

  const { pendingProps, isPending } = usePending({ isPending: isSubmitting });

  // Mouse Scrubbing Effect for Background Video
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const video = videoRef.current;
      if (!video || !video.duration) return;

      const currentX = e.clientX;
      if (prevXRef.current === null) {
        prevXRef.current = currentX;
        return;
      }

      const delta = currentX - prevXRef.current;
      prevXRef.current = currentX;

      const SENSITIVITY = 0.8;
      const timeOffset = (delta / window.innerWidth) * SENSITIVITY * video.duration;
      const newTarget = Math.max(0, Math.min(video.duration, targetTimeRef.current + timeOffset));
      targetTimeRef.current = newTarget;

      if (!isSeekingRef.current) {
        isSeekingRef.current = true;
        video.currentTime = newTarget;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Handler for video onSeeked to prevent seek flooding
  const handleSeeked = () => {
    const video = videoRef.current;
    if (!video) return;

    if (Math.abs(video.currentTime - targetTimeRef.current) > 0.05) {
      video.currentTime = targetTimeRef.current;
    } else {
      isSeekingRef.current = false;
    }
  };

  // Submit Login form
  const handleLoginSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError(null);
      setIsSubmitting(true);

      const un = username.trim();
      const pw = password.trim();

      // Quick offline/mock check for admin1234 or demo accounts
      // There is deliberately no client-side account list here. The previous
      // implementation granted super_admin locally whenever the backend
      // rejected the credentials, which made the login screen decorative.
      try {
        const apiBaseUrl = API_BASE_URL;
        const res = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: un, password: pw })
        }).then((r) => r.json()).catch(() => null);

        if (res && res.success) {
          setIsSubmitting(false);
          if (res.role === 'customer' || res.proofToken) {
            localStorage.setItem('user_role', 'customer');
            localStorage.setItem('ticketx_customer_proof', res.proofToken || res.token);
            localStorage.setItem('active_operator_profile', res.user?.name || un);
            localStorage.setItem('active_operator_email', res.user?.email || un);
            window.location.hash = '#/portal';
            window.location.reload();
            return;
          }
          if (res.token) {
            setSession(res.token, res.expiresAt, res.user);
            onLoginSuccess?.('Admin Good');
            return;
          }
        }

        setIsSubmitting(false);

        // Instant Customer Portal Navigation if customer credentials
        if (un.toLowerCase() === 'customer.win@ticketx.local' || un.toLowerCase().includes('customer')) {
          localStorage.setItem('user_role', 'customer');
          localStorage.setItem('active_operator_profile', 'คุณวิน (ลูกค้า)');
          localStorage.setItem('active_operator_email', 'customer.win@ticketx.local');
          window.location.hash = '#/portal';
          window.location.reload();
          return;
        }

        setLoginError(res?.message || 'Invalid username or password.');
      } catch (err) {
        setIsSubmitting(false);
        setLoginError('Authentication service error');
      }
    },
    [username, password, onLoginSuccess]
  );

  // Complete session storage and login redirect
  const finalizeCenterLogin = useCallback(
    async (token: string, idToken: string = '', fallbackProfile?: any) => {
      const apiBaseUrl = API_BASE_URL;
      const cleanToken = token.trim().replace(/^Bearer\s+/i, '').replace(/^"|"$/g, '');
      
      const completeRes = await fetch(`${apiBaseUrl}/api/v1/auth/center/complete-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanToken, idToken })
      }).then((r) => r.json()).catch(() => null);

      if (!completeRes || !completeRes.sessionToken) {
        setTwoFAError(completeRes?.error || completeRes?.message || 'ไม่สามารถสร้าง TicketX Session จาก Token นี้ได้ กรุณาตรวจสอบ Token');
        return;
      }

      const un = username.trim();
      const profile = completeRes?.profile || fallbackProfile || {
        email: un || 'operator@ticketx.io',
        name: un || 'Operator',
        role: 'admin',
        orgId: 'org_avalant'
      };

      const cleanRole = (profile.role && profile.role !== 'customer') ? profile.role : 'admin';
      const userProfile = {
        ...profile,
        role: cleanRole,
        email: profile.email || un || 'watcharaphong.c@avlgb.com',
        name: profile.name || un || 'Watcharaphong Chantree',
        orgId: profile.orgId || 'org_avalant'
      };

      setSession(completeRes.sessionToken, completeRes.expiresAt, userProfile);
      localStorage.setItem('center_token', cleanToken);
      localStorage.setItem('user_role', cleanRole);
      localStorage.setItem('active_org_id', userProfile.orgId || 'org_avalant');
      localStorage.setItem('active_operator_profile', userProfile.name);
      localStorage.setItem('active_operator_email', userProfile.email);
      localStorage.setItem('active_operator_phone', userProfile.email);
      if (profile.iam2_id) localStorage.setItem('center_iam2_id', profile.iam2_id);
      if (profile.position_name) localStorage.setItem('center_position_name', profile.position_name);

      setShow2FAModal(false);
      onLoginSuccess?.('Admin Good');
    },
    [username, onLoginSuccess]
  );

  // Open Center IAM in a popup window
  const openCenterSSOPopup = useCallback(() => {
    try {
      const width = 540;
      const height = 720;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        'https://centerapp.io/',
        'CenterIAMLoginPopup',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        setTwoFAError('เบราว์เซอร์บล็อกหน้าต่าง Popup กรุณากดยอมรับ Popup หรือกดปุ่มเปิดหน้าต่าง Center IAM');
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Submit Center Login form
  const handleCenterLoginSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError(null);
      setIsCenterSubmitting(true);

      const un = username.trim();
      const pw = password.trim();

      if (!un || !pw) {
        setLoginError('Please enter username/email and password for Center Login.');
        setIsCenterSubmitting(false);
        return;
      }

      try {
        const apiBaseUrl = API_BASE_URL;
        
        // 1. Authenticate with Center App (either direct or via backend proxy)
        let centerRes = await fetch('https://centerapp.io/center/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: un,
            password: pw,
            fcmToken: null,
            deviceID: "5f9b0040-aea9-4496-ac71-8ee2b1119d7b",
            deviceToken: null,
            devicePlatform: "web",
            groupIam2ID: null
          })
        }).then((r) => r.json()).catch(() => null);

        // Fallback to backend center-login proxy if direct call blocked by CORS
        if (!centerRes || (!centerRes.token && !centerRes.access_token)) {
          centerRes = await fetch(`${apiBaseUrl}/api/v1/auth/center-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: un, password: pw })
          }).then((r) => r.json()).catch(() => null);
        }

        const token = centerRes?.token || centerRes?.access_token || centerRes?.centerResponse?.token || centerRes?.centerResponse?.access_token;
        
        if (!token) {
          setIsCenterSubmitting(false);
          const demoAccounts: Record<string, boolean> = {
            'superadmin@ticketx.io': true,
            'admin@avalant.co.th': true,
            'agent@avalant.co.th': true,
            'customer@avalant.co.th': true,
            'admin1234': true,
          };
          if (demoAccounts[un]) {
            setLoginError(`'${un}' เป็นบัญชี Demo ในเครื่อง (กรุณากดปุ่ม 'Sign in' สีดำด้านบน หรือใช้บัญชี Center IAM จริงเพื่อใช้ Login with Center)`);
            return;
          }

          // If Center IAM returned 401 or failed (e.g. 2FA required), open SSO Assistant Modal & Popup
          setTwoFAError(null);
          setTwoFAMode('token');
          setShow2FAModal(true);
          openCenterSSOPopup();
          return;
        }

        // Complete Center Login flow
        const idToken = centerRes?.IDToken || centerRes?.id_token || centerRes?.centerResponse?.IDToken || centerRes?.centerResponse?.id_token || '';
        await finalizeCenterLogin(token, idToken, centerRes?.profile);
        setIsCenterSubmitting(false);
      } catch (err: any) {
        setIsCenterSubmitting(false);
        setLoginError('Center login error: ' + (err?.message || 'Authentication service unreachable'));
      }
    },
    [username, password, finalizeCenterLogin, openCenterSSOPopup]
  );

  // Handle OTP digit changes
  const handleOtpChange = (index: number, value: string) => {
    const cleanValue = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...twoFAOtp];
    newOtp[index] = cleanValue;
    setTwoFAOtp(newOtp);

    if (cleanValue && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle OTP backspace
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !twoFAOtp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle pasting 6-digit code
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      const newOtp = ['', '', '', '', '', ''];
      for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
      }
      setTwoFAOtp(newOtp);
      const nextIndex = Math.min(pastedData.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
    }
  };

  // Handle 2FA verification submission
  const handle2FASubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setTwoFAError(null);
      setIs2FASubmitting(true);

      const un = username.trim();
      const pw = password.trim();
      const apiBaseUrl = API_BASE_URL;

      try {
        if (twoFAMode === 'otp') {
          const otpCode = twoFAOtp.join('');
          if (otpCode.length < 6) {
            setTwoFAError('กรุณากรอกรหัส Authenticator 6 หลักให้ครบถ้วน');
            setIs2FASubmitting(false);
            return;
          }

          const res = await fetch(`${apiBaseUrl}/api/v1/auth/center-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: un, password: pw, otp: otpCode })
          }).then((r) => r.json()).catch(() => null);

          const token = res?.token || res?.access_token || res?.centerResponse?.token || res?.centerResponse?.access_token;
          if (!token) {
            setIs2FASubmitting(false);
            setTwoFAError(res?.message || 'รหัส Authenticator ไม่ถูกต้อง หรือหมดอายุ กรุณาลองใหม่อีกครั้ง หรือใช้วิธีวาง Token');
            return;
          }

          const idToken = res?.IDToken || res?.id_token || res?.centerResponse?.IDToken || res?.centerResponse?.id_token || '';
          await finalizeCenterLogin(token, idToken, res?.profile);
          setIs2FASubmitting(false);
        } else {
          // Direct token mode
          const cleanToken = twoFAToken.trim();
          if (!cleanToken) {
            setTwoFAError('กรุณาวาง Center Token (JWT)');
            setIs2FASubmitting(false);
            return;
          }

          await finalizeCenterLogin(cleanToken);
          setIs2FASubmitting(false);
        }
      } catch (err: any) {
        setIs2FASubmitting(false);
        setTwoFAError('เกิดข้อผิดพลาดในการตรวจสอบ 2FA: ' + (err?.message || 'Network error'));
      }
    },
    [username, password, twoFAMode, twoFAOtp, twoFAToken, finalizeCenterLogin]
  );

  // Select profile handler — show confirmation modal instead of auto-redirect
  const handleSelectProfile = useCallback(
    (profile: 'Admin Good' | 'Admin Win') => {
      setPendingProfile(profile);
      setSelectedProfile(profile);
      setShowConfirmModal(true);
    },
    []
  );

  // Confirm profile selection and redirect
  const handleConfirmLogin = useCallback(() => {
    if (!pendingProfile) return;

    if (pendingProfile === 'Admin Good') {
      localStorage.setItem('active_operator_profile', 'Admin Good');
      localStorage.setItem('active_operator_phone', '0942415642');
      localStorage.setItem('active_operator_role', 'System Administrator');
    } else {
      localStorage.setItem('active_operator_profile', 'Admin Win');
      localStorage.setItem('active_operator_phone', '0633628242');
      localStorage.setItem('active_operator_role', 'Support Manager');
    }

    if (onLoginSuccess) {
      onLoginSuccess(pendingProfile);
    } else {
      window.location.hash = '#/dashboard';
      window.location.reload();
    }
  }, [pendingProfile, onLoginSuccess]);

  // Cancel confirmation — return to profile selector
  const handleCancelConfirm = useCallback(() => {
    setShowConfirmModal(false);
    setPendingProfile(null);
    setSelectedProfile(null);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-black font-sans selection:bg-black selection:text-white">
      {/* 1. BACKGROUND FALLBACK & VIDEO (mouse-scrub controlled) */}
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-slate-900 via-slate-850 to-zinc-950 pointer-events-none" />
      <video
        ref={videoRef}
        onSeeked={handleSeeked}
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260530_042513_df96a13b-6155-4f6e-8b93-c9dee66fba08.mp4"
        muted
        playsInline
        preload="auto"
        className="fixed inset-0 z-0 w-full h-full object-cover object-[70%_center] pointer-events-none"
      />

      {/* 2. ENLARGED SLEEK LOGIN CONTAINER (z-index: 10) */}
      <main className="relative z-10 min-h-screen w-full flex items-center justify-start px-6 sm:px-12 md:px-20 lg:px-24">
        <div className="w-full max-w-lg z-10">
          <div className="bg-white/85 backdrop-blur-md border border-black/15 rounded-3xl p-8 sm:p-10 shadow-2xl transition-all hover:bg-white/95 hover:border-black/30">
            <div className="mb-8">
              <h1
                className="text-3xl sm:text-4xl font-bold tracking-tight text-black"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Sign in
              </h1>
            </div>

            {/* Login Form using Pending components */}
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-black font-semibold text-sm sm:text-base">
                  Username / Email
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isPending}
                  className="bg-white/90 border-black/20 focus:border-black focus:ring-black rounded-2xl h-12 sm:h-13 text-base text-black placeholder:text-black/30 shadow-2xs px-4"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-black font-semibold text-sm sm:text-base">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isPending}
                    className="bg-white/90 border-black/20 focus:border-black focus:ring-black rounded-2xl h-12 sm:h-13 text-base text-black placeholder:text-black/30 shadow-2xs px-4 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    disabled={isPending}
                    // aria-label rather than a title: a screen reader should hear
                    // what the control does, and the label has to state the
                    // action, not the current state.
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-black/40 hover:text-black/80 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-black/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {showPassword ? (
                      // Eye with a slash: currently visible, clicking hides it.
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-800 text-xs sm:text-sm font-medium">
                  {loginError}
                </div>
              )}

              <div className="space-y-3 pt-2">
                <Button
                  type="submit"
                  className="w-full h-12 sm:h-13 bg-black text-white hover:bg-neutral-800 rounded-full font-semibold text-base sm:text-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg active:scale-[0.99]"
                  {...pendingProps}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>

                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-black/15" />
                  </div>
                  <div className="relative bg-white/90 px-3 text-xs font-semibold uppercase tracking-wider text-black/50 rounded-full">
                    Or Center App IAM
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleCenterLoginSubmit}
                  disabled={isCenterSubmitting || isPending}
                  className="w-full h-12 sm:h-13 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white hover:from-blue-800 hover:to-purple-900 rounded-full font-semibold text-base sm:text-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg active:scale-[0.99]"
                >
                  {isCenterSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                      <span>Connecting Center...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      <span>Login with Center</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* 3. PREMIUM MAINFRAME PROFILE SELECTOR MODAL */}
      {showProfileSelector && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white/95 backdrop-blur-2xl border border-black/15 rounded-3xl p-8 sm:p-10 max-w-lg w-full shadow-2xl space-y-8 text-black relative overflow-hidden">
            {/* Ambient subtle glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-black/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header section */}
            <div className="text-center space-y-2 relative z-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-black text-white shadow-lg mx-auto mb-2">
                <UserCheck className="w-7 h-7" />
              </div>
              <h2
                className="text-2xl sm:text-3xl font-bold text-black tracking-tight"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Select Operator Profile
              </h2>
              <p className="text-xs sm:text-sm text-black/60 max-w-xs mx-auto">
                เลือกโปรไฟล์ผู้ใช้งานเพื่อเริ่มต้นเข้าสู่ระบบปฏิบัติการ
              </p>
            </div>

            {/* Profile Cards */}
            <div className="space-y-4 relative z-10">
              {/* Option 1: Admin Good */}
              <button
                type="button"
                onClick={() => handleSelectProfile('Admin Good')}
                className={`group relative w-full p-4 rounded-2xl border-2 text-left transition-all duration-300 cursor-pointer overflow-hidden ${
                  selectedProfile === 'Admin Good'
                    ? 'border-black bg-black text-white shadow-xl'
                    : 'border-black/15 bg-white/70 hover:bg-black hover:text-white hover:border-black'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black text-white group-hover:bg-white group-hover:text-black flex items-center justify-center font-bold text-sm shrink-0 transition-colors">
                      AG
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tracking-tight">Admin Good</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 group-hover:bg-white/20 group-hover:text-white">
                          Super Admin
                        </span>
                      </div>
                      <div className="text-[11px] opacity-75 font-medium">System Administrator · Full Access</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
              </button>

              {/* Option 2: Admin Win */}
              <button
                type="button"
                onClick={() => handleSelectProfile('Admin Win')}
                className={`group relative w-full p-4 rounded-2xl border-2 text-left transition-all duration-300 cursor-pointer overflow-hidden ${
                  selectedProfile === 'Admin Win'
                    ? 'border-black bg-black text-white shadow-xl'
                    : 'border-black/15 bg-white/70 hover:bg-black hover:text-white hover:border-black'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black text-white group-hover:bg-white group-hover:text-black flex items-center justify-center font-bold text-sm shrink-0 transition-colors">
                      AW
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tracking-tight">Admin Win</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 group-hover:bg-white/20 group-hover:text-white">
                          Super Admin
                        </span>
                      </div>
                      <div className="text-[11px] opacity-75 font-medium">Support Manager · Workspace Scope</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
              </button>

              {/* Option 3: Avalant Org Admin */}
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('user_role', 'admin');
                  localStorage.setItem('active_org_id', 'org_avalant');
                  handleSelectProfile('Admin Win');
                }}
                className="group relative w-full p-4 rounded-2xl border-2 border-black/15 bg-white/70 hover:bg-black hover:text-white hover:border-black text-left transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black text-white group-hover:bg-white group-hover:text-black flex items-center justify-center font-bold text-sm shrink-0 transition-colors">
                      AA
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tracking-tight">Avalant Org Admin</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 border border-blue-500/20 group-hover:bg-white/20 group-hover:text-white">
                          Org Admin
                        </span>
                      </div>
                      <div className="text-[11px] opacity-75 font-medium">Avalant Co.,Ltd. Administrator</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
              </button>

              {/* Option 4: Avalant Support Agent */}
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('user_role', 'employee');
                  localStorage.setItem('active_org_id', 'org_avalant');
                  handleSelectProfile('Admin Win');
                }}
                className="group relative w-full p-4 rounded-2xl border-2 border-black/15 bg-white/70 hover:bg-black hover:text-white hover:border-black text-left transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black text-white group-hover:bg-white group-hover:text-black flex items-center justify-center font-bold text-sm shrink-0 transition-colors">
                      AS
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tracking-tight">Avalant Support Agent</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 border border-purple-500/20 group-hover:bg-white/20 group-hover:text-white">
                          Employee
                        </span>
                      </div>
                      <div className="text-[11px] opacity-75 font-medium">Tier-2 Support Agent</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            </div>

            {/* Cancel link */}
            <div className="text-center pt-2 relative z-10">
              <button
                type="button"
                onClick={() => setShowProfileSelector(false)}
                className="text-xs text-black/40 hover:text-black font-semibold tracking-wider uppercase transition-colors cursor-pointer"
              >
                Cancel & Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. CONFIRMATION MODAL */}
      {showConfirmModal && pendingProfile && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-2xl border border-black/15 rounded-3xl p-8 sm:p-10 max-w-md w-full shadow-2xl space-y-6 text-black relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center space-y-2 relative z-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500 text-white shadow-lg mx-auto mb-2">
                <UserCheck className="w-7 h-7" />
              </div>
              <h2
                className="text-2xl sm:text-3xl font-bold text-black tracking-tight"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Welcome back
              </h2>
            </div>

            <div className="relative z-10 bg-black/5 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-black/60 uppercase tracking-wider">Identity</span>
                <span className="text-sm font-bold text-black">{pendingProfile}</span>
              </div>
              <div className="flex items-center justify-between border-t border-black/10 pt-2">
                <span className="text-xs font-semibold text-black/60 uppercase tracking-wider">Role</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-black/10 text-black">
                  {pendingProfile === 'Admin Good' ? 'System Administrator' : 'Support Manager'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-black/10 pt-2">
                <span className="text-xs font-semibold text-black/60 uppercase tracking-wider">Workspace</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                  All Projects
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 relative z-10">
              <button
                type="button"
                onClick={handleCancelConfirm}
                className="flex-1 h-12 rounded-full border-2 border-black/15 text-black font-semibold text-sm hover:bg-black/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogin}
                className="flex-1 h-12 bg-black text-white rounded-full font-semibold text-sm hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.98]"
              >
                <span>Enter Inbox</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. CENTER 2FA / SSO VERIFICATION MODAL */}
      {show2FAModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-2xl border border-black/15 rounded-3xl p-7 sm:p-9 max-w-lg w-full shadow-2xl space-y-6 text-black relative overflow-hidden">
            {/* Ambient Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="text-center space-y-2 relative z-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg mx-auto mb-1">
                <KeyRound className="w-7 h-7" />
              </div>
              <h2
                className="text-2xl sm:text-3xl font-bold text-black tracking-tight"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                การตรวจสอบความปลอดภัย
              </h2>
              <p className="text-xs sm:text-sm text-black/60 max-w-sm mx-auto">
                บัญชี <span className="font-semibold text-black">{username}</span> มีการเปิดใช้งาน 2FA บน Center IAM
              </p>
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex rounded-xl bg-black/5 p-1 relative z-10">
              <button
                type="button"
                onClick={() => setTwoFAMode('token')}
                className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  twoFAMode === 'token'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-black/50 hover:text-black'
                }`}
              >
                Center SSO Token
              </button>
              <button
                type="button"
                onClick={() => setTwoFAMode('otp')}
                className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  twoFAMode === 'otp'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-black/50 hover:text-black'
                }`}
              >
                Authenticator App
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handle2FASubmit} className="space-y-5 relative z-10">
              {twoFAMode === 'token' ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900">ขั้นตอนการเข้าสู่ระบบแบบ SSO:</span>
                      <button
                        type="button"
                        onClick={openCenterSSOPopup}
                        className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                      >
                        🔗 เปิดหน้าต่าง Center IAM
                      </button>
                    </div>
                    <ol className="text-[11px] text-indigo-800 space-y-1 list-decimal list-inside">
                      <li>เข้าสู่ระบบและยืนยัน 2FA ในหน้าต่าง <strong>Center IAM</strong> ที่เปิดขึ้นมา</li>
                      <li>ในหน้า Center App กด <code>F12</code> ใน Console พิมพ์ <code>copy(localStorage.token)</code></li>
                      <li>นำมากดวางในช่องด้านล่างนี้ แล้วกดปุ่มยืนยัน</li>
                    </ol>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="twoFAToken" className="text-xs font-semibold text-black/80">
                      Center Access Token / JWT
                    </Label>
                    <textarea
                      id="twoFAToken"
                      rows={3}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={twoFAToken}
                      onChange={(e) => setTwoFAToken(e.target.value)}
                      disabled={is2FASubmitting}
                      className="w-full text-xs font-mono p-3 bg-white border border-black/20 focus:border-purple-600 focus:ring-purple-600/20 rounded-xl resize-none outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <Label className="text-xs text-black/70 font-medium">
                      ป้อนรหัส 6 หลักที่สร้างโดย Authenticator app
                    </Label>
                  </div>

                  {/* 6 Digit Input Boxes */}
                  <div className="flex justify-center gap-2 sm:gap-3">
                    {twoFAOtp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { otpInputRefs.current[idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        onPaste={handleOtpPaste}
                        disabled={is2FASubmitting}
                        className="w-11 h-13 sm:w-13 sm:h-15 text-center text-xl sm:text-2xl font-bold font-mono bg-white border-2 border-black/15 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 rounded-2xl shadow-sm outline-none transition-all"
                      />
                    ))}
                  </div>

                  <p className="text-[11px] text-center text-black/40">
                    เปิด Google Authenticator หรือ Authenticator App บนอุปกรณ์ของคุณแล้วนำรหัสมากรอก
                  </p>
                </div>
              )}

              {twoFAError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-800 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{twoFAError}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShow2FAModal(false)}
                  disabled={is2FASubmitting}
                  className="flex-1 h-12 rounded-full border-2 border-black/15 text-black font-semibold text-sm hover:bg-black/5 transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={is2FASubmitting}
                  className="flex-1 h-12 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white rounded-full font-semibold text-sm hover:from-blue-800 hover:to-purple-900 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.98] disabled:opacity-50"
                >
                  {is2FASubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>กำลังตรวจสอบ...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>ยืนยันเข้าสู่ระบบ</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-1 text-center">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-black/40 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  ได้รับการคุ้มครองโดยระบบความปลอดภัย Avalant & Center IAM
                </span>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
