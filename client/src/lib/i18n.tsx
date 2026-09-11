'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'id' | 'en';

export const DICTIONARY = {
  id: {
    // Brand
    brandSubtitle: 'Online Photobooth studio interaktif dengan beragam frame estetik. Ambil foto sendiri, berdua, atau rame-rame dalam grup!',
    badgeSoloDuoGroup: 'Solo, Duo & Grup',
    badgePrivateSecure: 'Privat & Aman dengan PIN',
    badgeVariousFrame: '93+ Desain Frame',
    badgeExportHd: 'Ekspor HD',

    // Modes
    chooseMode: 'PILIH MODE PHOTOBOOTH:',
    modeSolo: 'Solo',
    modeSoloSub: '1 Orang',
    modeSoloDesc: 'Foto sendiri tanpa menunggu partner',
    modeDuo: 'Berdua',
    modeDuoSub: '2 Orang',
    modeDuoDesc: 'Online sync berdua via link room',
    modeGroup: 'Grup',
    modeGroupSub: 'Maks. 6 Orang',
    modeGroupDesc: 'Rame-rame hingga 6 orang sekaligus',

    // PIN
    pinLabelRequired: 'PIN Keamanan Room (4-6 Digit Angka):',
    pinDescription: 'Tentukan PIN 4-6 digit angka untuk mengamankan room dari orang lain.',
    pinPlaceholder: 'Contoh: 1234 (4-6 angka)',
    pinSoloNotice: 'Mode Solo instan tanpa PIN — foto langsung disimpan ke browsermu.',
    pinRequiredError: 'PIN room wajib 4 hingga 6 digit angka!',
    pinDigitRule: 'PIN harus berupa 4 hingga 6 digit angka (0-9)',
    pinPromptTitle: 'Gabung ke Room',
    pinPromptRoomCode: 'Kode Room:',
    pinPromptDesc: 'Room ini dilindungi dengan PIN oleh Host. Masukkan PIN dan namamu untuk bergabung:',
    pinPromptPlaceholder: 'Masukkan PIN (4-6 angka)…',
    pinPromptEmptyError: 'Silakan masukkan 4-6 digit PIN room terlebih dahulu',
    pinIncorrectError: 'PIN Room salah! Silakan masukkan PIN yang benar.',

    // Modal Create Room
    createRoomModalTitle: 'Buat Room Photobooth',
    createRoomModalDesc: 'Atur PIN keamanan dan namamu sebelum membuat room.',
    createRoomModalDescSolo: 'Masukkan namamu untuk memulai photobooth sendiri.',
    createRoomHostNameLabel: 'Nama Panggilanmu (Host):',
    createRoomHostNamePlaceholder: 'Contoh: Daffa',
    nameRequiredError: 'Nama panggilan wajib diisi!',
    btnCreateNow: 'Buat Room Sekarang',
    guestNameLabel: 'Nama Panggilanmu:',
    guestNamePlaceholder: 'Contoh: Sarah',
    joinRoomModalDesc: 'Room ini dilindungi dengan PIN oleh Host. Masukkan PIN dan namamu untuk bergabung:',
    joinRoomModalDescNoPin: 'Masukkan nama panggilanmu untuk bergabung ke room ini:',
    pinLengthHint: '{count}/6 angka (min. 4)',

    // Actions
    btnCreateSolo: 'Mulai Photobooth Sendiri',
    btnCreateDuo: 'Buat Room Berdua (Host)',
    btnCreateGroup: 'Buat Room Grup (Maks. 6)',
    btnPreparing: 'Menyiapkan Sesi…',
    btnJoin: 'Gabung',
    btnCancel: 'Batal',
    btnEnterRoom: 'Masuk ke Room',
    btnEnterRoomConfirm: 'Masuk ke Ruangan',

    // Join with Code
    orJoinWithCode: 'ATAU GABUNG DENGAN KODE ROOM',
    roomCodePlaceholder: 'KODE ROOM (6 DIGIT)',
    roomCodeInvalidError: 'Masukkan kode room 6 karakter yang valid',

    // Steps
    step1Title: 'Shoot',
    step1Desc: 'Ambil foto',
    step2Title: 'Frame',
    step2Desc: 'Pilih template',
    step3Title: 'Place',
    step3Desc: 'Atur posisi',
    step4Title: 'Finish',
    step4Desc: 'Simpan PNG',
    footerNotice: 'Tanpa registrasi · Peer-to-Peer Encrypted · Privasi Terlindungi',

    // Lobby
    lobbySoloTitle: 'SOLO PHOTOBOOTH',
    lobbyGroupTitle: 'SNAPSYNC LOBBY',
    lobbySoloHeading: 'Sesi Foto Sendiri',
    lobbyGroupHeading: 'Ruang Tunggu Photobooth',
    lobbyCodeLabel: 'Kode Room:',
    lobbyCopy: 'Salin',
    lobbyCopied: 'Tersalin',
    lobbyInviteTitle: 'UNDANG TEMAN / BUKA DI HP',
    lobbyInviteDesc: 'Scan QR code dengan kamera HP atau bagikan link untuk masuk secara instan.',
    lobbyParticipants: 'Peserta',
    lobbyCapacitySolo: 'Mode Solo',
    lobbyCapacityDuo: '2 Orang Diperlukan',
    lobbyCapacityGroup: 'Grup (Min. 2, Maks. 6)',
    lobbyWaitingDuo: 'Menunggu teman kedua bergabung…',
    lobbyWaitingGroup: 'Menunggu teman lain bergabung…',
    lobbySlotsLeft: 'tersedia {count} slot lagi',
    lobbyStartBtn: 'Mulai Sesi Photobooth',
    lobbyWaitingHost: 'Menunggu Host Memulai…',
    lobbyYouTag: '(Kamu)',
    lobbyHostTag: 'Host',
    lobbyGuestTag: 'Guest',
    lobbyStatusOnline: 'Online',
    lobbyStatusConnecting: 'Menghubungkan',

    // Capture
    captureShotNum: 'Pengambilan Foto #{num}',
    captureShotSoloNum: 'Foto Solo #{num}',
    capturePhotosSaved: '{count}/{max} Tersimpan',
    captureFilterLabel: 'Filter Kamera:',
    captureSmileCountdown: 'Senyum! Hitungan Mundur…',
    captureReadyBadge: 'Siap Mengambil Foto',
    captureReviewBadge: 'Review Hasil Foto',
    captureSavedBadge: 'Foto Tersimpan!',
    captureTakePhotoBtn: 'Ambil Foto',
    captureRetakeBtn: 'Foto Ulang',
    captureKeepBtn: 'Simpan Foto Ini',
    captureWaitingPartner: 'Menunggu Partner Menyimpan…',
    captureNextShotBtn: 'Ambil Foto Berikutnya',
    captureDoneBtn: 'Selesai & Pilih Frame',
    captureConnectingPeer: 'Menghubungkan {name}…',
    micOn: 'Mic On',
    micOff: 'Mic Off',

    // Name Entry
    nameEntryTitle: 'Masuk Photobooth',
    nameEntryLabel: 'Nama Panggilanmu',
    nameEntryPlaceholder: 'Masukkan nama kamu…',
    nameEntryPinLabel: 'PIN Keamanan Room (4-6 Digit Angka)',
    nameEntryPinPlaceholder: 'Masukkan 4-6 digit PIN…',

    // Leave Confirm Modal
    leaveConfirm: 'Apakah kamu yakin ingin keluar dari photobooth? Sesi yang berjalan akan dibatalkan.',
    leaveConfirmTitle: 'Tinggalkan Sesi Photobooth?',
    leaveConfirmDesc: 'Sesi foto yang sedang berjalan akan terhenti jika kamu keluar dari ruangan.',
    btnStay: 'Tetap di Ruangan',
    btnLeave: 'Ya, Keluar',

    // Connection Status
    connConnected: 'Terhubung',
    connConnecting: 'Menyambungkan kembali ke server…',
    connDisconnected: 'Koneksi terputus! Memeriksa jaringan…',
    connReconnectBtn: 'Hubungkan Ulang',
    connOffline: 'Perangkat sedang offline',
    connectingRoom: 'Menghubungkan ke room {code}…',
    connectingWaitHelp: 'Menyelaraskan koneksi dan memuat sesi photobooth',
    connectingTakingLong: 'Koneksi memakan waktu lebih lama dari biasanya…',
    btnManualEntry: 'Masuk Manual',
    btnRetry: 'Coba Lagi',

    // Creator & Support / Donation
    developedBy: 'Dikembangkan oleh',
    contactMe: 'Kontak & Media Sosial',
    buyMeCoffeeBtn: 'Traktir Kopi ☕',
    supportTitle: 'Dukung Kreator SnapSync ☕',
    supportDesc: 'SnapSync dibuat 100% gratis tanpa iklan dan tanpa watermark berbayar. Jika kamu menikmati photobooth ini, traktiran kopi sangat berarti untuk biaya server & pengembangan fitur baru!',
    supportDonateVia: 'Pilih Cara Dukungan:',
    supportCopyEmail: 'Salin Email',
    emailCopied: 'Email Berhasil Disalin!',
    supportClose: 'Tutup',
  },

  en: {
    // Brand
    brandSubtitle: 'Interactive online photobooth studio with aesthetic frames. Snap solo, as a couple, or with your whole group!',
    badgeSoloDuoGroup: 'Solo, Duo & Group',
    badgePrivateSecure: 'Private & Secure with PIN',
    badgeVariousFrame: '93+ Frame Designs',
    badgeExportHd: 'HD Export',

    // Modes
    chooseMode: 'SELECT PHOTOBOOTH MODE:',
    modeSolo: 'Solo',
    modeSoloSub: '1 Person',
    modeSoloDesc: 'Instant solo shoot without waiting',
    modeDuo: 'Duo',
    modeDuoSub: '2 People',
    modeDuoDesc: 'Synchronized pair shoot via room link',
    modeGroup: 'Group',
    modeGroupSub: 'Max 6 People',
    modeGroupDesc: 'Party with up to 6 friends together',

    // PIN
    pinLabelRequired: 'Room Security PIN (4-6 Numeric Digits):',
    pinDescription: 'Set a 4-6 digit numeric PIN to secure your room from unauthorized access.',
    pinPlaceholder: 'e.g. 1234 (4-6 digits)',
    pinSoloNotice: 'Solo mode requires no PIN — photos are stored directly in your browser.',
    pinRequiredError: 'Room PIN must be 4 to 6 numeric digits!',
    pinDigitRule: 'PIN must be 4 to 6 numeric digits (0-9)',
    pinPromptTitle: 'Join Room',
    pinPromptRoomCode: 'Room Code:',
    pinPromptDesc: 'This room is protected with a security PIN set by the Host. Enter the PIN and your name to join:',
    pinPromptPlaceholder: 'Enter PIN (4-6 digits)…',
    pinPromptEmptyError: 'Please enter the 4-6 digit room PIN first',
    pinIncorrectError: 'Incorrect Room PIN! Please enter the valid PIN.',

    // Modal Create Room
    createRoomModalTitle: 'Create Photobooth Room',
    createRoomModalDesc: 'Configure security PIN and your display name before creating the room.',
    createRoomModalDescSolo: 'Enter your display name to start your solo photobooth.',
    createRoomHostNameLabel: 'Your Display Name (Host):',
    createRoomHostNamePlaceholder: 'e.g. Alex',
    nameRequiredError: 'Display name is required!',
    btnCreateNow: 'Create Room Now',
    guestNameLabel: 'Your Display Name:',
    guestNamePlaceholder: 'e.g. Sarah',
    joinRoomModalDesc: 'This room is protected with a PIN by the Host. Enter the PIN and your display name to join:',
    joinRoomModalDescNoPin: 'Enter your display name to join this room:',
    pinLengthHint: '{count}/6 digits (min. 4)',

    // Actions
    btnCreateSolo: 'Start Solo Photobooth',
    btnCreateDuo: 'Create Duo Room (Host)',
    btnCreateGroup: 'Create Group Room (Max 6)',
    btnPreparing: 'Setting Up Session…',
    btnJoin: 'Join',
    btnCancel: 'Cancel',
    btnEnterRoom: 'Enter Room',
    btnEnterRoomConfirm: 'Enter Photobooth',

    // Join with Code
    orJoinWithCode: 'OR JOIN WITH ROOM CODE',
    roomCodePlaceholder: 'ROOM CODE (6 CHARS)',
    roomCodeInvalidError: 'Please enter a valid 6-character room code',

    // Steps
    step1Title: 'Shoot',
    step1Desc: 'Take photos',
    step2Title: 'Frame',
    step2Desc: 'Pick template',
    step3Title: 'Place',
    step3Desc: 'Arrange photos',
    step4Title: 'Finish',
    step4Desc: 'Save PNG',
    footerNotice: 'No registration · Peer-to-Peer Encrypted · Privacy Protected',

    // Lobby
    lobbySoloTitle: 'SOLO PHOTOBOOTH',
    lobbyGroupTitle: 'SNAPSYNC LOBBY',
    lobbySoloHeading: 'Solo Photobooth Session',
    lobbyGroupHeading: 'Photobooth Waiting Room',
    lobbyCodeLabel: 'Room Code:',
    lobbyCopy: 'Copy',
    lobbyCopied: 'Copied',
    lobbyInviteTitle: 'INVITE FRIENDS / OPEN ON PHONE',
    lobbyInviteDesc: 'Scan QR code with your phone camera or share the link to join instantly.',
    lobbyParticipants: 'Participants',
    lobbyCapacitySolo: 'Solo Mode',
    lobbyCapacityDuo: '2 People Required',
    lobbyCapacityGroup: 'Group (Min 2, Max 6)',
    lobbyWaitingDuo: 'Waiting for 2nd person to join…',
    lobbyWaitingGroup: 'Waiting for other friends to join…',
    lobbySlotsLeft: '{count} slots left',
    lobbyStartBtn: 'Start Photobooth Session',
    lobbyWaitingHost: 'Waiting for Host to Start…',
    lobbyYouTag: '(You)',
    lobbyHostTag: 'Host',
    lobbyGuestTag: 'Guest',
    lobbyStatusOnline: 'Online',
    lobbyStatusConnecting: 'Connecting',

    // Capture
    captureShotNum: 'Photo Shot #{num}',
    captureShotSoloNum: 'Solo Photo #{num}',
    capturePhotosSaved: '{count}/{max} Saved',
    captureFilterLabel: 'Camera Filter:',
    captureSmileCountdown: 'Smile! Counting Down…',
    captureReadyBadge: 'Ready to Snap',
    captureReviewBadge: 'Review Shot',
    captureSavedBadge: 'Photo Saved!',
    captureTakePhotoBtn: 'Take Photo',
    captureRetakeBtn: 'Retake',
    captureKeepBtn: 'Keep This Shot',
    captureWaitingPartner: 'Waiting for Partner to Keep…',
    captureNextShotBtn: 'Take Next Photo',
    captureDoneBtn: 'Done & Choose Frame',
    captureConnectingPeer: 'Connecting {name}…',
    micOn: 'Mic On',
    micOff: 'Mic Off',

    // Name Entry
    nameEntryTitle: 'Enter Photobooth',
    nameEntryLabel: 'Your Display Name',
    nameEntryPlaceholder: 'Enter your name…',
    nameEntryPinLabel: 'Room Security PIN (4-6 Numeric Digits)',
    nameEntryPinPlaceholder: 'Enter 4-6 digit PIN…',

    // Leave Confirm Modal
    leaveConfirm: 'Are you sure you want to leave the photobooth? Current session will be canceled.',
    leaveConfirmTitle: 'Leave Photobooth Session?',
    leaveConfirmDesc: 'Your ongoing photobooth session will stop if you leave the room now.',
    btnStay: 'Stay in Room',
    btnLeave: 'Yes, Leave',

    // Connection Status
    connConnected: 'Connected',
    connConnecting: 'Reconnecting to server…',
    connDisconnected: 'Connection lost! Checking network…',
    connReconnectBtn: 'Reconnect',
    connOffline: 'Your device is offline',
    connectingRoom: 'Connecting to room {code}…',
    connectingWaitHelp: 'Synchronizing connection and loading photobooth session',
    connectingTakingLong: 'Connection is taking longer than expected…',
    btnManualEntry: 'Manual Entry',
    btnRetry: 'Try Again',

    // Creator & Support / Donation
    developedBy: 'Developed by',
    contactMe: 'Contact & Social Links',
    buyMeCoffeeBtn: 'Buy Me a Coffee ☕',
    supportTitle: 'Support SnapSync Creator ☕',
    supportDesc: 'SnapSync is 100% free with no ads and no watermarks. If you enjoy this photobooth, buying a coffee directly supports server costs & new feature development!',
    supportDonateVia: 'Choose Support Method:',
    supportCopyEmail: 'Copy Email',
    emailCopied: 'Email Copied to Clipboard!',
    supportClose: 'Close',
  },
};

export type TranslationKey = keyof typeof DICTIONARY.id;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'id',
  setLanguage: () => {},
  t: (key: TranslationKey) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('id');

  useEffect(() => {
    const saved = localStorage.getItem('app_lang') as Language;
    if (saved === 'id' || saved === 'en') {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_lang', lang);
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = DICTIONARY[language]?.[key] || DICTIONARY.id[key] || String(key);
    if (params) {
      Object.entries(params).forEach(([paramKey, val]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
