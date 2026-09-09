import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Building2,
  FolderKanban,
  CheckCircle2,
  ArrowRightLeft,
  KeyRound,
  Mail,
  Phone,
  Sun,
  Moon,
  LogOut,
  Save,
  Loader2,
  Sparkles
} from 'lucide-react';
import { useCustomerSession } from '../../auth/CustomerSessionContext';
import { customerApi } from '../../api/customerApi';
import { useTheme } from '../../../../theme/themeProvider';

export function CustomerSettingsModal() {
  const {
    profile,
    isSettingsOpen,
    setIsSettingsOpen,
    switchProject,
    updateProfileData,
    logout,
    isGuest
  } = useCustomerSession();

  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'projects' | 'profile' | 'preferences'>('projects');
  
  // Projects state
  const [projects, setProjects] = useState<Array<{
    id: number;
    name: string;
    companyId: number;
    companyName: string;
    orgId: string;
    isActive: boolean;
  }>>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [switchingId, setSwitchingId] = useState<number | null>(null);

  // Profile edit state
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  useEffect(() => {
    if (isSettingsOpen) {
      if (profile) {
        setNameInput(profile.name || '');
        setPhoneInput(profile.phone || '');
      }
      loadProjects();
    }
  }, [isSettingsOpen, profile]);

  // Reload after a project is linked by code.
  //
  // `loadProjects` returns early while isGuest is true, and joining by code
  // flips that only after the socket event lands. Without this the panel kept
  // whatever it fetched while still a guest — an empty list — and displayed
  // "สลับโครงการ (0)" even though the customer had just joined one.
  useEffect(() => {
    const onSwitched = () => {
      if (isSettingsOpen) loadProjects();
    };
    window.addEventListener('ticketx:project_switched', onSwitched);
    return () => window.removeEventListener('ticketx:project_switched', onSwitched);
  }, [isSettingsOpen, isGuest]);

  const loadProjects = async () => {
    if (isGuest) return;
    setIsLoadingProjects(true);
    try {
      const res = await customerApi.getProjects();
      if (res.projects) {
        setProjects(res.projects);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleSwitch = async (projectId: number) => {
    setSwitchingId(projectId);
    try {
      await switchProject(projectId);
      await loadProjects();
    } catch (err: any) {
      alert('ไม่สามารถสลับโปรเจกต์ได้: ' + (err.message || 'เกิดข้อผิดพลาด'));
    } finally {
      setSwitchingId(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSaveSuccess(false);
    try {
      await updateProfileData({
        name: nameInput.trim(),
        phone: phoneInput.trim(),
      });
      setProfileSaveSuccess(true);
      setTimeout(() => setProfileSaveSuccess(false), 3000);
    } catch (err: any) {
      alert('บันทึกข้อมูลไม่สำเร็จ: ' + (err.message || 'เกิดข้อผิดพลาด'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">การตั้งค่าบัญชี & โครงการ</h2>
              <p className="text-xs text-muted-foreground">จัดการโปรเจกต์ ข้อมูลผู้ใช้งาน และการตั้งค่าระบบ</p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="ปิดหน้าต่าง"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-card/60 px-6 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-all ${
              activeTab === 'projects'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FolderKanban className="h-4 w-4" />
            <span>สลับโครงการ ({projects.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-all ${
              activeTab === 'profile'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="h-4 w-4" />
            <span>ข้อมูลส่วนตัว</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-all ${
              activeTab === 'preferences'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>ปรับแต่งระบบ</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto">
          {/* TAB 1: PROJECTS */}
          {activeTab === 'projects' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">โครงการที่ท่านได้รับสิทธิ์เข้าใช้งาน</h3>
                <p className="text-xs text-muted-foreground">
                  เลือกโครงการที่ต้องการทำงาน ข้อมูลตั๋วงานและบทสนทนาจะถูกสลับตามโครงการที่เลือกทันที
                </p>
              </div>

              {isLoadingProjects ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : projects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  ไม่พบโครงการอื่นที่เชื่อมต่ออยู่
                </div>
              ) : (
                <div className="space-y-2.5">
                  {projects.map((proj) => (
                    <div
                      key={proj.id}
                      className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
                        proj.isActive
                          ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-950/20'
                          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground truncate">{proj.name}</span>
                          {proj.isActive && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" /> กำลังใช้งาน
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{proj.companyName}</span>
                          <span className="text-muted-foreground/40">•</span>
                          <span className="font-mono text-[11px]">ID: {proj.id}</span>
                        </div>
                      </div>

                      {!proj.isActive && (
                        <button
                          onClick={() => handleSwitch(proj.id)}
                          disabled={switchingId !== null}
                          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shadow-xs disabled:opacity-50"
                        >
                          {switchingId === proj.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          )}
                          <span>สลับโครงการ</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Join Code Section */}
              <div className="mt-6 pt-5 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-semibold text-foreground">เชื่อมต่อโครงการใหม่ด้วยรหัส (Project Code)</h4>
                </div>
                {/*
                  Never print a real join code here. The two codes that used to
                  stand in as "examples" were live, active codes for project 101
                  (กรมสรรพสามิต) and project 8 — anyone opening this panel as a
                  guest could copy one and link themselves into that project.
                  A join code is a credential; the format is enough of a hint.
                */}
                <p className="text-[11px] text-muted-foreground">
                  หากได้รับรหัสโครงการจากผู้ดูแล (รูปแบบ TX-XXXX-XXXX) ให้กรอกที่ช่องแชทหรือพิมพ์บอกบอทเพื่อเชื่อมต่อได้ทันทีค่ะ
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">ชื่อ-นามสกุล / ชื่อที่ใช้แสดง</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="กรอกชื่อของคุณ"
                    className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">อีเมลที่ใช้งาน (เชื่อมกับระบบ)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    className="w-full rounded-xl border border-border bg-muted/50 pl-9 pr-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">เบอร์โทรศัพท์ติดต่อ</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="เช่น 081-234-5678"
                    className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">หน่วยงาน / บริษัท</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={profile?.companyName || 'องค์กรทั่วไป'}
                    disabled
                    className="w-full rounded-xl border border-border bg-muted/50 pl-9 pr-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>

              {profileSaveSuccess && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้วค่ะ</span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>บันทึกข้อมูล</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: PREFERENCES */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-3">ธีมและการแสดงผล</h4>
                <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground">
                      {isDarkMode ? <Moon className="h-4 w-4 text-amber-400" /> : <Sun className="h-4 w-4 text-amber-500" />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">
                        {isDarkMode ? 'โหมดมืด (Dark Mode)' : 'โหมดสว่าง (Light Mode)'}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        คลิกเพื่อสลับโทนสีของแอปพลิเคชัน
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    สลับเป็น{isDarkMode ? 'โหมดสว่าง' : 'โหมดมืด'}
                  </button>
                </div>
              </div>

              {/* Danger Zone: Logout */}
              <div className="pt-5 border-t border-border">
                <h4 className="text-xs font-semibold text-destructive mb-3">ความปลอดภัย</h4>
                <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 p-3.5">
                  <div>
                    <div className="text-xs font-semibold text-foreground">ออกจากระบบ</div>
                    <div className="text-[11px] text-muted-foreground">
                      ล้างเซสชันการเข้าสู่ระบบออกจากเบราว์เซอร์นี้
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-xs"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
