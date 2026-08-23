"use client";

/* ════════════════════════════════════════════════════════════════════════════
   SillaBustan.jsx — «بستان صِلة» · برنامج أسوة
   ─────────────────────────────────────────────────────────────────────────────
   مرجع تصميم وسلوك. اقرأ CLAUDE.md أولًا — فيه المواصفات الكاملة.

   الفكرة: الطالب يسجّل سننه اليومية، وكل سنّة تبني شيئًا في بستانه.
           البستان مساحة محدودة يتجوّل فيها وتنمو حتى تكتمل في ٣٠ يومًا.

   البنية:
     • DEFAULT_SECS     — الأصل: ٢٦ سنّة في ٦ أقسام، هو ما يبدأ منه كل مستخدم
     • SUNAN / ITEMS    — المخزن الحيّ: ما يراه المستخدم بعد تعديلاته
     • setSunan()       — بوّابة التعديل الوحيدة: تصحّح، تحفظ، تُخطر كل الشاشات
     • DRAW             — رسّام لكل بناء، يأخذ (x, y, n) حيث n = عدد الأيام (سقف ٣٠)
     • SPOT             — موضع كل بناء داخل الأرض
     • <Village/>       — المشهد: تجوّل + سلايدر الأيام + معاينة اليوم ٣٠
     • <Recorder/>      — التعبئة: أقسام + شبكة ٣×٣ + سنن سريعة
     • <SunanEditor/>   — التحرير: أضِف وسمِّ ولوِّن الأقسام، وحرّر كل سنّة وحديثها
     • useSillaState()  — الحالة: السجلّ اليومي والجواهر والأبنية

   ⚠ اختبر كل رسّام عند n = 30 قبل التسليم (انظر §١٣ في CLAUDE.md).
   ════════════════════════════════════════════════════════════════════════════ */

import React, { useState, useRef, useEffect, useMemo, useCallback,
         useSyncExternalStore } from "react";

/* ════════ ثوابت ════════ */
export const DAYS_TOTAL = 30;          // أيام الشهر — سقف كل بناء
const W = 1080, H = 830;               // أبعاد أرض البستان
const PAD = 52;                        // شريط السور حول الأرض
const IN = { x: PAD, y: PAD, w: W - PAD * 2, h: H - PAD * 2 };
const ZOOM = 0.44;                     // تكبير ثابت — البستان مصغّر دائمًا

/* ════════ الإسقاط الإيزومتري ════════
   الأرض تُدار ٤٥° وتُضغط رأسيًا للنصف، فتصير مربّعاتها معيّنات ويظهر العمق.
   ما يستلقي على الأرض (الصحن، القنوات، النهر) يُرسم بالتحويل نفسه،
   وما يقف عليها (الأبنية، الأشجار، اللاعب) يُرسم منتصبًا عند موضعه المُسقَط —
   وهذا هو أصل الإيزومتري: أرضٌ مائلة وأجسامٌ قائمة.
   المعامل مختار ليملأ المعيّنُ عرض الأرض تمامًا ويبقى فوقه فسحة لارتفاعات البناء. */
/* سقف النموّ: أيام الشهر المعروض. كان ثابتًا ٣٠، فشهرُ ٢٩ يومًا لا يبلغ
   فيه أيّ بناء تمامَه — والنهر يقف قبل آخره. تضبطه <Village/> كل إطار. */
let DCAP = 30;
/* آخر عددٍ رآه المشهد — خارج المكوّن ليبقى بين تبديل التبويبات، وإلا
   عاد المستخدم من «حفظ وبناء» فلم يجد ما ينمو أمامه. */
const LASTN = { v: null };
const IK = 0.565;                       /* (١٠٨٠+٨٣٠)×IK = عرض الأرض */
const IZ = 0.62;                        /* الضغط الرأسي — أقلّ من ٢:١ فيملأ المعيّن اللوحة */
const IOX = 469, IOY = 118;             /* ١١٨ فسحة علوية لأعلى بناء (المئذنة ٩٢) */
export const IX = (x, y) => (x - y) * IK + IOX;
export const IY = (x, y) => (x + y) * IK * IZ + IOY;
/* العكس: من بكسل على الشاشة إلى موضع على الأرض */
export const unIso = (sx, sy) => {
  const u = (sx - IOX) / IK, v = (sy - IOY) / (IK * IZ);
  return [(u + v) / 2, (v - u) / 2];
};

/* بصمة كل مجموعة في فضاء الأرض — تُملأ أثناء الرسم فلا تُكرَّر أرقامها،
   وعليها يقع اختيار البناء عند اللمس. */
export const EXTENT = {};

export const ar = (n) => String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
export const fmt = (n) => ar(Math.round(n).toLocaleString("en-US"));

/* ألوان الأقسام — من هوية الموقع */
export const SEC_COLOR = {
  salah: "#1F9CF0", dhikr: "#C9A227", tuhr: "#38A3D1",
  wasl: "#7B6FD0", akhlaq: "#E89B3C", layl: "#5D5FA8",
};

/* ════════ الأيقونات ════════
   نمط lucide: مسارات بسماكة ١٫٨–٢ داخل مربّع مستدير.
   كل مفتاح هنا يقابل بناءً في DRAW — والاسم واحد في الموضعين. */

const IC = {
  mihrab:  '<path d="M4 21V11a8 8 0 0 1 16 0v10"/><path d="M9 21v-6a3 3 0 0 1 6 0v6"/><path d="M2 21h20"/>',
  house:   '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  sundial: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  minaret: '<path d="M9 22V10h6v12"/><path d="M8 10h8"/><path d="M10 10V7h4v3"/><path d="M12 7V4"/><circle cx="12" cy="3" r="1"/><path d="M7 22h10"/>',
  gate:    '<path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.6v16.1a1 1 0 0 1-1.2 1L5 20V5.6a2 2 0 0 1 1.5-2l4-1A2 2 0 0 1 13 4.6z"/>',
  rug:     '<path d="M2 7h20l-2 10H4z"/><path d="M5 11h14"/><path d="M5.6 14h12.8"/>',
  palm:    '<path d="M12 3v18"/><path d="M12 8c-3-3-7-2-9 1 3-2 6-1 9 2"/><path d="M12 8c3-3 7-2 9 1-3-2-6-1-9 2"/><path d="M12 6c0-3 2-4 4-4-1 2-1 3-1 4"/><path d="M9 21h6"/>',
  garden:  '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  pattern: '<path d="m12 2 10 10-10 10L2 12z"/><path d="m12 8 4 4-4 4-4-4z"/>',
  fort:    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M8 3v6"/><path d="M16 3v6"/><path d="M12 9v6"/><path d="M8 15v6"/><path d="M16 15v6"/>',
  fountain:'<path d="M7 16.3c2.2 0 4-1.8 4-4 0-1.2-.6-2.3-1.7-3.2S7.3 6.8 7 5.3c-.3 1.5-1.1 2.8-2.3 3.8S3 11.1 3 12.3c0 2.2 1.8 4 4 4z"/><path d="M12.6 6.6A11 11 0 0 0 14 3c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 0 1-11.9 5"/>',
  stream:  '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  arak:    '<path d="M8 19a4 4 0 0 1-2.2-7.3A3.5 3.5 0 0 1 9 6V6a3 3 0 1 1 6 0v.1a3.5 3.5 0 0 1 3.2 5.6A4 4 0 0 1 16 19Z"/><path d="M12 19v3"/><path d="M9 22h6"/>',
  bighouse:'<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 7h4"/><path d="M10 11h4"/><path d="M10 15h4"/><path d="M10 19h4"/>',
  bridge:  '<path d="M2 14h20"/><path d="M5 21V6"/><path d="M19 21V6"/><path d="M2 9c4.5 5.5 15.5 5.5 20 0"/>',
  tent:    '<path d="M3 21h18"/><path d="M12 4 3 21"/><path d="m12 4 9 17"/><path d="M12 12 8 21"/><path d="m12 12 4 9"/>',
  flower:  '<circle cx="12" cy="12" r="2.6"/><path d="M12 16.6a4.6 4.6 0 1 1-4.6-4.6 4.6 4.6 0 1 1 4.6-4.6 4.6 4.6 0 1 1 4.6 4.6 4.6 4.6 0 1 1-4.6 4.6"/>',
  path:    '<ellipse cx="6" cy="18" rx="3.2" ry="2.1"/><ellipse cx="12" cy="13" rx="3.2" ry="2.1"/><ellipse cx="18" cy="8" rx="3.2" ry="2.1"/>',
  fruit:   '<path d="M12 20.9c1.5 0 2.7 1.1 4 1.1 3 0 6-8 6-12.2A4.9 4.9 0 0 0 17 5c-2.2 0-4 1.4-5 2-1-.6-2.8-2-5-2a4.9 4.9 0 0 0-5 4.8C2 14 5 22 8 22c1.2 0 2.5-1.1 4-1.1Z"/><path d="M10 2c1 .5 2 2 2 5"/>',
  spring:  '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  lamp:    '<path d="M8 2h8l4 10H4z"/><path d="M12 12v6"/><path d="M8 22v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2z"/>',
  well:    '<path d="M6 22V13h12v9"/><ellipse cx="12" cy="13" rx="6" ry="1.8"/><path d="M12 10V6"/><path d="m6 6 6-3 6 3"/>',
  crescent:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  shieldL: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.5 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>',
  fence:   '<path d="M4 3 2 5v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z"/><path d="M6 9h4"/><path d="M6 17h4"/><path d="m12 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z"/><path d="M14 9h4"/><path d="M14 17h4"/><path d="m20 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z"/>',

/* ── مكتبة إضافية للاختيار من لوحة الإدارة ──
   هذه أيقونات واجهة فقط: تغييرها لا يغيّر ما يُبنى في البستان. */
  mosque:  '<path d="M4 21h16"/><path d="M6 21v-8h12v8"/><path d="M6 13a6 6 0 0 1 12 0"/><path d="M12 7V5"/><path d="M20 21V9"/><path d="M20 9V6"/><circle cx="20" cy="4.5" r="1"/>',
  book:    '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  star:    '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  sparkle: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18 16.5 19 19l2.5 1-2.5 1-1 2.5-1-2.5L14.5 20l2.5-1z"/>',
  sun:     '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>',
  sunrise: '<path d="M12 2v6"/><path d="m9 5 3-3 3 3"/><path d="M2 18h20"/><path d="M4 14a8 8 0 0 1 16 0"/><path d="M2 22h20"/>',
  moonstar:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="m17 2 .8 1.7 1.7.8-1.7.8L17 7l-.8-1.7-1.7-.8 1.7-.8z"/>',
  bed:     '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M2 16h20"/><path d="M6 10V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3"/><path d="M2 20v2"/><path d="M22 20v2"/>',
  phone:   '<path d="M13 2a9 9 0 0 1 9 9"/><path d="M13 6a5 5 0 0 1 5 5"/><path d="M15.5 15.5 14 17a13 13 0 0 1-7-7l1.5-1.5a1.5 1.5 0 0 0 .3-1.7L7.4 3.6A1.5 1.5 0 0 0 6 2.7H4a2 2 0 0 0-2 2.2A17 17 0 0 0 19.1 22a2 2 0 0 0 2.2-2v-2a1.5 1.5 0 0 0-.9-1.4l-3.2-1.4a1.5 1.5 0 0 0-1.7.3z"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  users:   '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  steps:   '<rect x="3" y="4" width="6" height="9" rx="3"/><rect x="3.5" y="15" width="5" height="4.5" rx="2.2"/><rect x="15" y="7" width="6" height="9" rx="3"/><rect x="15.5" y="18" width="5" height="4" rx="2"/>',
  cup:     '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M3 22h15"/>',
  leaf:    '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.7 4.5-7"/>',
  key:     '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.5 12.5 8-8"/><path d="m16 6 2 2"/><path d="m19 3 2 2"/>',
  feather: '<path d="M20 4 9 15"/><path d="M12.7 3.3a5 5 0 0 1 7 7L12 18H6v-6z"/><path d="M9 21H3"/>',
  bell:    '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/>',
  heart:   '<path d="M12 21s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5c0 5.1-7 9.5-7 9.5Z"/>',
  dome:    '<path d="M4 21h16"/><path d="M5 21v-7a7 7 0 0 1 14 0v7"/><path d="M12 6V4"/><circle cx="12" cy="3" r="1"/>',
};

export const svg = (n) => IC[n] || "";
export const ICON_NAMES = Object.keys(IC);

/* ════════ السنن الـ٢٦ ════════
   type: 'bool' نعم/لا · 'cycle' عدّاد ٠→max · 'time' دقائق
   g: جواهر كل خطوة (لا تُشترط الإتمام)
   b: ما يبنيه في البستان · h: الحديث أو الفضل
   q/qt: وسم السنن السريعة (الوقت والتلميح)                                  */

const DEFAULT_SECS=[
 {id:'salah',t:'سنن الصلاة',items:[
  {k:'iqama',n:'إقامة الصلاة',i:'mihrab',b:'محراب',type:'cycle',max:5,g:2,
   h:'«الصلاة عماد الدين» — يرتفع محرابك مع كل صلاة تقيمها.'},
  {k:'r12',n:'١٢ ركعة سنة',i:'house',b:'بيت',type:'bool',g:10,
   h:'«من صلى اثنتي عشرة ركعة في يوم وليلة بُني له بيت في الجنة» — مسلم.'},
  {k:'waqt',n:'الصلاة على وقتها',i:'sundial',b:'ساعة شمسية',type:'cycle',max:5,g:2,
   h:'سُئل ﷺ أيّ العمل أحبّ إلى الله؟ قال: «الصلاة على وقتها».'},
  {k:'mubah',n:'الصلاة ضمن الوقت المباح',i:'minaret',b:'مئذنة',type:'cycle',max:5,g:1,
   h:'المحافظة على أدائها في وقتها المشروع — ترتفع مئذنتك كلما حافظت.'},
  {k:'tawaj',n:'دعاء التوجه',i:'gate',b:'بوابة',type:'cycle',max:5,g:1,
   h:'«وجّهت وجهي للذي فطر السماوات والأرض» — بابٌ تدخل منه إلى بستانك.'},
  {k:'muk',n:'المكوث',i:'rug',b:'سجادة',type:'bool',g:4,q:'٥ د',qt:'امكث بعد صلاة واحدة',
   h:'«الملائكة تصلي على أحدكم ما دام في مصلاه: اللهم اغفر له، اللهم ارحمه».'}]},
 {id:'dhikr',t:'الأذكار والاستشفاع',items:[
  {k:'tahlil',n:'١٠٠ تهليل',i:'palm',b:'نخلة',type:'bool',g:6,q:'٣ د',qt:'١٠٠ تهليل — دقائق وأنت ماشٍ',
   h:'«من قال سبحان الله العظيم وبحمده غُرست له نخلة في الجنة» — الترمذي.'},
  {k:'dubur',n:'٣٣ دبر كل صلاة',i:'garden',b:'بستان',type:'cycle',max:5,g:2,
   h:'«معقّبات لا يخيب قائلهنّ» — يتّسع بستانك مع كل تسبيح.'},
  {k:'shafa',n:'استشفاع',i:'nur',b:'قبة نور',type:'bool',g:8,q:'١ د',qt:'عشر صلوات على النبي ﷺ',
   h:'«من صلى عليّ صلاةً واحدة صلى الله عليه بها عشرًا» — تشعّ قبّة النور في بستانك.'},
  {k:'basm',n:'البسملة',i:'pattern',b:'نقش',type:'bool',g:2,q:'ثوانٍ',qt:'قلها عند أي عمل تبدؤه',
   h:'«كل أمر ذي بال لا يُبدأ فيه ببسم الله فهو أبتر» — نقشٌ يزيّن بستانك.'},
  {k:'tard',n:'طاردات الشيطان',i:'fort',b:'حصن',type:'bool',g:4,q:'٢ د',qt:'أذكار تحصّنك',
   h:'الأذكار حصنٌ من الشيطان — يعلو سور حصنك يومًا بعد يوم.'}]},
 {id:'tuhr',t:'سنن الطهارة',items:[
  {k:'wudu',n:'سنن الوضوء',i:'fountain',b:'نافورة',type:'cycle',max:5,g:2,
   h:'«من توضأ فأحسن الوضوء خرجت خطاياه من جسده حتى تخرج من تحت أظفاره».'},
  {k:'onwudu',n:'البقاء على وضوء',i:'stream',b:'جدول ماء',type:'bool',g:4,
   h:'«لا يحافظ على الوضوء إلا مؤمن» — جدولٌ يجري في أرض بستانك.'},
  {k:'siwak',n:'السواك',i:'arak',b:'شجرة أراك',type:'cycle',max:5,g:1,q:'١ د',qt:'سواك واحد يكفي لتبدأ',
   h:'«السواك مطهرة للفم مرضاة للرب» — تنمو شجرة أراكك.'}]},
 {id:'wasl',t:'الصلة والإحسان',items:[
  {k:'birr',n:'بر الوالدين',i:'bighouse',b:'دار كبيرة',type:'bool',g:8,
   h:'«رضا الرب في رضا الوالد، وسخط الرب في سخط الوالد».'},
  {k:'ahl',n:'التواصل مع الأهل والإخوة',i:'bridge',b:'جسر',type:'bool',g:5,q:'٥ د',qt:'رسالة أو اتصال لأخيك',
   h:'«من أحبّ أن يُبسط له في رزقه ويُنسأ في أثره فليصل رحمه».'},
  {k:'hajah',n:'قضاء حاجة أخيك',i:'tent',b:'خيمة ضيافة',type:'bool',g:5,
   h:'«والله في عون العبد ما كان العبد في عون أخيه».'}]},
 {id:'akhlaq',t:'سنن الأخلاق',items:[
  {k:'ibt',n:'الابتسامة',i:'flower',b:'زهرة',type:'bool',g:2,q:'ثوانٍ',qt:'ابتسم في وجه من تلقاه',
   h:'«تبسّمك في وجه أخيك صدقة» — تتفتّح زهرة في بستانك.'},
  {k:'salam',n:'السلام',i:'path',b:'ممر',type:'bool',g:2,q:'ثوانٍ',qt:'ألقِ السلام على من تمرّ به',
   h:'«أفشوا السلام بينكم تحابّوا» — يمتدّ ممرّك بين البيوت.'},
  {k:'shukr',n:'الشكر',i:'fruit',b:'شجرة مثمرة',type:'bool',g:2,q:'١ د',qt:'اشكر الله واشكر من أحسن إليك',
   h:'«لئن شكرتم لأزيدنّكم» — تثمر شجرتك بشكرك.'},
  {k:'lisan',n:'تجنب آفات اللسان',i:'spring',b:'ينبوع صافٍ',type:'bool',g:5,
   h:'«من صمت نجا» — يصفو ينبوعك بصمتك عمّا لا يعني.'},
  {k:'tariq',n:'آداب الطريق',i:'lamp',b:'مصباح',type:'bool',g:2,
   h:'«إماطة الأذى عن الطريق صدقة» — يضيء مصباح في طريق بستانك.'},
  {k:'jalis',n:'الشرب جالسًا',i:'well',b:'بئر',type:'bool',g:2,q:'ثوانٍ',qt:'اجلس عند شربك',
   h:'من هديه ﷺ في شرابه — يُحفر بئرٌ في أرضك.'}]},
 {id:'layl',t:'سنن الليل',items:[
  {k:'nawm',n:'سنن النوم',i:'crescent',b:'هلال',type:'bool',g:3,q:'٢ د',qt:'وضوء واضطجاع على الأيمن',
   h:'«إذا أويت إلى فراشك فتوضأ وضوءك للصلاة، ثم اضطجع على شقك الأيمن».'},
  {k:'kursi',n:'آية الكرسي',i:'shieldL',b:'درع نور',type:'bool',g:5,q:'١ د',qt:'آية واحدة قبل نومك',
   h:'«لا يزال عليك من الله حافظ ولا يقربك شيطان حتى تصبح».'},
  {k:'himaya',n:'دعاء الحماية',i:'fence',b:'سياج نور',type:'bool',g:3,q:'١ د',qt:'دعاء المساء',
   h:'«من قالها حين يمسي لم يضره شيء» — سياجٌ يحوط بستانك.'}]}];

/* ════════ مخزن السنن الحيّ ════════
   السنن لم تعد ثابتة: <SunanEditor/> يعدّلها، والمخزن يخطر كل الشاشات فتتحدّث
   فورًا. الشكل المحفوظ في localStorage هو نفسه شكل DEFAULT_SECS أعلاه، فما
   تصدّره اللوحة يمكن لصقه هنا ليصير هو الأصل.
     • i  = البناء في المشهد (مفتاح في DRAW/SPOT)
     • ic = أيقونة الواجهة — تغييرها لا يمسّ ما يُبنى                        */

export const LS_SUNAN = "silla.sunan.v1";
const FALLBACK_C = "#7B8FA6";

/* لون القسم: لون محفوظ عليه، وإلا لون الهوية، وإلا لون محايد */
export const secColor = (s) => (s && s.c) || (s && SEC_COLOR[s.id]) || FALLBACK_C;

/* يضبط الحقول المشتقّة ويصحّح القيم — كل ما يدخل المخزن يمرّ من هنا */
export function normalizeSecs(list) {
  return (Array.isArray(list) ? list : []).filter((s) => s && s.id).map((s) => {
    const c = secColor(s);
    return {
      id: String(s.id), t: String(s.t || s.id), c,
      items: (Array.isArray(s.items) ? s.items : []).filter((i) => i && i.k).map((i) => {
        const type = i.type === "cycle" ? "cycle" : "bool";
        /* المسجد صار أساس القرية لا بناءَ سنّة — فمن حُفظ عنده على «dome» يُنقل */
        const bld = i.i === "dome" ? "nur" : i.i;
        const it = {
          ...i, k: String(i.k), n: String(i.n || ""), i: bld,
          ic: (i.ic === "dome" ? "nur" : i.ic) || bld,
          b: String(i.b || ""), h: String(i.h || ""),
          type, g: Math.max(0, Math.round(+i.g || 0)), sec: String(s.id), c,
        };
        if (type === "cycle") it.max = Math.max(2, Math.min(99, Math.round(+i.max || 5)));
        else delete it.max;
        if (i.q) { it.q = String(i.q); it.qt = String(i.qt || ""); }
        else { delete it.q; delete it.qt; }
        return it;
      }),
    };
  });
}

const DEFAULTS = normalizeSecs(DEFAULT_SECS);
const deep = (l) => JSON.parse(JSON.stringify(l));
export const defaultSunan = () => deep(DEFAULTS);

/* ارتباطات حيّة: إعادة الإسناد هنا تصل إلى كل من يستورد الاسم */
export let SUNAN = defaultSunan();
export let ITEMS = SUNAN.flatMap((s) => s.items);
export let TOTAL = ITEMS.length;
export const findItem = (k) => ITEMS.find((i) => i.k === k);
export const QUICK = () => ITEMS.filter((i) => i.q);

let sunanVer = 0;
const sunanSubs = new Set();

export function setSunan(next, { persist = true } = {}) {
  SUNAN = normalizeSecs(next);
  ITEMS = SUNAN.flatMap((s) => s.items);
  TOTAL = ITEMS.length;
  sunanVer++;
  if (persist) {
    try { window.localStorage.setItem(LS_SUNAN, JSON.stringify(SUNAN)); } catch (e) { /* تجاهل */ }
  }
  sunanSubs.forEach((f) => f());
}

export function resetSunan() {
  try { window.localStorage.removeItem(LS_SUNAN); } catch (e) { /* تجاهل */ }
  setSunan(defaultSunan(), { persist: false });
}

/* القراءة من التخزين تتم بعد التركيب فقط — حتى لا يختلف خادم Next عن المتصفّح */
export function hydrateSunan() {
  try {
    const raw = window.localStorage.getItem(LS_SUNAN);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) setSunan(parsed, { persist: false });
  } catch (e) { /* تجاهل */ }
}

const subSunan = (f) => { sunanSubs.add(f); return () => sunanSubs.delete(f); };
const getVer = () => sunanVer;

/* كل شاشة تقرأ السنن تستدعي هذا فتعاد بناؤها عند أي تعديل */
export function useSunanVersion() {
  return useSyncExternalStore(subSunan, getVer, getVer);
}

/* ════════ الأصوات ════════
   مولّدة بـ Web Audio لا ملفات — الصفحة المنشورة تمنع أي مضيف خارجي،
   والنغمة المولّدة بضع مئات البايتات من الكود بدل مئات الكيلوبايتات.
   سياسة المتصفّحات تمنع الصوت قبل لمسة المستخدم، فالسياق يُنشأ عند أول لمسة. */

/* حدٌّ داكن سميك حول كل جسم — أظهر ما يميّز المشهد.
   المشهد يُرسم بتكبير ٠٫٤٤، فحدٌّ بعرض ٢ يظهر أقلّ من بكسل. والعرض هنا
   بمقياس المشهد: يُقسَم على ZOOM ليصل إلى العين بالسماكة المقصودة. */
const OUT = () => (DK() ? "#0A1A14" : "#22392C");
function edge(w) {
  X.strokeStyle = OUT(); X.lineWidth = (w || 1) / ZOOM;
  X.lineJoin = "round"; X.lineCap = "round"; X.stroke(); return true;
}

/* تشبّعٌ مركزيّ: بدل تغيير كل لون في السـتّة والعشرين رسّامًا، يمرّ اللون
   من هنا فيشتدّ تشبّعه ويتباعد فاتحه عن داكنه — وهو جوهر ألوان المشهد. */
const SATC = {};
function sat(hex) {
  if (typeof hex !== "string" || hex[0] !== "#" || hex.length < 7) return hex;
  const memo = SATC[hex]; if (memo) return memo;
  const r = parseInt(hex.slice(1, 3), 16) / 255,
        g = parseInt(hex.slice(3, 5), 16) / 255,
        b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, sv = 0;
  if (mx !== mn) {
    const d = mx - mn;
    sv = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  sv = Math.min(1, sv * 2.35 + .16);
  /* ودفعُ الفاتح إلى الفتوح والداكن إلى العمق — التباين هو ما يُحيي المشهد */
  const L = Math.min(.95, Math.max(.06, l + (l > .55 ? .09 : l < .34 ? -.10 : 0)));
  const q = L < .5 ? L * (1 + sv) : L + sv - L * sv, pq = 2 * L - q;
  const ch = (t) => {
    t = (t + 1) % 1;
    const v = t < 1 / 6 ? pq + (q - pq) * 6 * t
            : t < 1 / 2 ? q
            : t < 2 / 3 ? pq + (q - pq) * (2 / 3 - t) * 6 : pq;
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return (SATC[hex] = "#" + ch(h + 1 / 3) + ch(h) + ch(h - 1 / 3));
}

/* ════════ المراتب ════════
   الأجر غيبٌ بعيد، والجواهر رقمٌ يكبر بلا أثر. فالمراتب تجعل للتقدّم
   اسمًا يُنادى به وأثرًا يُرى في الأرض كلّها — يبلغ الطالب عتبةً فتترقّى
   بستانه وتتبدّل ألوانها. يضبطها صاحب المشروع من شاشة التحرير.        */
/* ما تفتحه المراتب — كلٌّ منها شيءٌ يُرى في البستان، لا رقمٌ ولا لون.
   وهي إضافاتٌ على المشهد، لا تمسّ الأبنية الـ٢٦ ولا مواضعها (§٣). */
export const PERKS = {
  jet:     { n:"نافورة البحرة",   ic:"fountain", d:"يتدفّق الماء من قلب الصحن." },
  flag:    { n:"رايات الأسوار",   ic:"feather",  d:"راياتٌ ترفرف على سور بستانك كلّه." },
  blossom: { n:"زهرٌ في الريح",   ic:"leaf",     d:"وريقاتٌ تتطاير في أرضك." },
  birds:   { n:"طيورٌ تحلّق",     ic:"feather",  d:"أسرابٌ تعبر سماء بستانك." },
  lantern: { n:"فوانيس الممرّات", ic:"lamp",     d:"فوانيس تضيء دروبك." },
  stars:   { n:"سماء النجوم",     ic:"star",     d:"نجومٌ تتلألأ فوق البستان." },
};
export const PERK_KEYS = Object.keys(PERKS);

export const LS_TIERS = "silla.tiers.v1";
/* ألوانٌ متباعدة عمدًا: المسار يُقرأ قوسَ ألوانٍ صاعدًا، لا تدرّجًا أخضرَ
   واحدًا — والتباعد هو ما يجعل كلَّ مرتبةٍ تُميَّز من بعيد. */
const DEFAULT_TIERS = [
  { id:"t1", n:"غَرْس",    g:0,    c:"#00D6A6", r:"",        d:"بدأتَ الغرس — أوّل أثرٍ في أرضك." },
  { id:"t2", n:"رَوْضة",   g:200,  c:"#4BE04B", r:"jet",     d:"اخضرّت أرضك، وتدفّقت بحرتها." },
  { id:"t3", n:"مُثمِر",   g:500,  c:"#FFC414", r:"flag",    d:"أثمر غرسك، وعَلَت راياتك على السور." },
  { id:"t4", n:"ظِلال",    g:900,  c:"#FF7A18", r:"blossom", d:"امتدّت ظلالها، وتطاير زهرها." },
  { id:"t5", n:"وارِف",    g:1400, c:"#FF3D68", r:"birds",   d:"وَرَفَ ظلّه، وعبرت سماءه الطير." },
  { id:"t6", n:"نُور",     g:2000, c:"#A03CFF", r:"lantern", d:"أضاءت دروبه بالفوانيس." },
  { id:"t7", n:"سَكينة",   g:2800, c:"#1E90FF", r:"stars",   d:"سكن تحت سماءٍ من نجوم." },
  { id:"t8", n:"زاهِر",    g:4000, c:"#FFD426", r:"",        d:"بلغتَ أعلاه — بستانٌ زاهرٌ تامّ." },
];
export let TIERS = DEFAULT_TIERS.map((t) => ({ ...t }));
let tierVer = 0;
const tierSubs = new Set();
export const defaultTiers = () => DEFAULT_TIERS.map((t) => ({ ...t }));
export function setTiers(list) {
  TIERS = (Array.isArray(list) ? list : [])
    .filter((t) => t && t.id)
    .map((t) => ({ id:String(t.id), n:String(t.n||""), g:Math.max(0,Math.round(+t.g||0)),
                   c:t.c||"#6BBFB2", d:String(t.d||""),
                   r:PERKS[t.r] ? t.r : "" }))
    .sort((a, b) => a.g - b.g);
  if (!TIERS.length) TIERS = defaultTiers();
  tierVer++; tierSubs.forEach((f) => f());
  try { window.localStorage.setItem(LS_TIERS, JSON.stringify(TIERS)); } catch (e) { /* تجاهل */ }
}
export function resetTiers() {
  try { window.localStorage.removeItem(LS_TIERS); } catch (e) { /* تجاهل */ }
  TIERS = defaultTiers(); tierVer++; tierSubs.forEach((f) => f());
}
export function hydrateTiers() {
  try {
    const raw = window.localStorage.getItem(LS_TIERS);
    if (raw) { const v = JSON.parse(raw); if (Array.isArray(v) && v.length) setTiers(v); }
  } catch (e) { /* تجاهل */ }
}
export function useTiers() {
  return useSyncExternalStore(
    (f) => { tierSubs.add(f); return () => tierSubs.delete(f); },
    () => tierVer, () => tierVer);
}
/* المرتبة الحالية وما بعدها */
export function tierAt(gems) {
  let i = 0;
  for (let k = 0; k < TIERS.length; k++) if (gems >= TIERS[k].g) i = k;
  return { i, cur: TIERS[i], next: TIERS[i + 1] || null,
           /* ما بلغه من الطريق إلى التالية */
           p: TIERS[i + 1]
              ? Math.min(1, (gems - TIERS[i].g) / Math.max(1, TIERS[i + 1].g - TIERS[i].g))
              : 1 };
}
/* المكافآت المفتوحة عند رصيدٍ معيّن */
export function perksAt(gems) {
  const on = {};
  TIERS.forEach((t) => { if (t.r && gems >= t.g) on[t.r] = 1; });
  return on;
}
let TIERC = "#6BBFB2";          /* لون المرتبة — تقرؤه الأرض */
let PERKON = {};                /* ما فُتح — تقرؤه حلقة الرسم */

export const LS_SOUND = "silla.sound.v1";
const AUD = { ctx: null, master: null, on: true };
let soundVer = 0;
const soundSubs = new Set();

export const soundOn = () => AUD.on;
export function setSound(on) {
  AUD.on = !!on;
  if (AUD.master) AUD.master.gain.value = AUD.on ? 1 : 0;
  try { window.localStorage.setItem(LS_SOUND, AUD.on ? "1" : "0"); } catch (e) { /* تجاهل */ }
  soundVer++; soundSubs.forEach((f) => f());
}
export function hydrateSound() {
  try { if (window.localStorage.getItem(LS_SOUND) === "0") setSound(false); } catch (e) { /* تجاهل */ }
}
export function useSound() {
  return useSyncExternalStore(
    (f) => { soundSubs.add(f); return () => soundSubs.delete(f); },
    () => soundVer, () => soundVer);
}

function actx() {
  if (AUD.ctx) { if (AUD.ctx.state === "suspended") AUD.ctx.resume(); return AUD.ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  AUD.ctx = new AC();
  AUD.master = AUD.ctx.createGain();
  AUD.master.gain.value = AUD.on ? 1 : 0;
  AUD.master.connect(AUD.ctx.destination);
  return AUD.ctx;
}

/* نغمة واحدة: تردّد يبدأ من f وينزلق إلى to، بغلافٍ سريع لا يطقطق */
function tone(f, { to, dur = .1, type = "sine", vol = .16, at = 0 } = {}) {
  const c = actx(); if (!c || !AUD.on) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + .014);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(AUD.master);
  o.start(t); o.stop(t + dur + .03);
}

/* سلّم المقام — نغمات متآلفة لا نشاز */
const N = { do:523.25, re:587.33, mi:659.25, sol:784, la:880, do2:1046.5, mi2:1318.5 };

export const SFX = {
  tap:   () => tone(N.re, { dur: .07, vol: .1, type: "triangle" }),
  step:  () => { tone(N.mi, { dur: .08, vol: .12, type: "triangle" }); },
  done:  () => { tone(N.sol, { dur: .12, vol: .15, type: "triangle" });
                 tone(N.do2, { dur: .18, vol: .13, type: "triangle", at: .09 }); },
  gem:   () => { tone(N.do2, { dur: .09, vol: .1, type: "sine" });
                 tone(N.mi2, { dur: .13, vol: .09, type: "sine", at: .07 }); },
  undo:  () => { tone(N.mi, { to: N.do * .85, dur: .2, vol: .12, type: "sine" }); },
  open:  () => tone(N.la, { dur: .1, vol: .09, type: "sine" }),
  nav:   () => tone(N.do, { dur: .07, vol: .08, type: "sine" }),
  build: () => { tone(N.do * .5, { dur: .16, vol: .13, type: "triangle" });
                 tone(N.sol, { dur: .1, vol: .07, type: "sine", at: .04 }); },
  rank:  () => [N.do, N.mi, N.sol, N.do2, N.mi2].forEach((f, i) =>
                 tone(f, { dur: .42, vol: .15, type: "triangle", at: i * .11 })),
  save:  () => [N.do, N.mi, N.sol, N.do2].forEach((f, i) =>
                 tone(f, { dur: .22, vol: .13, type: "triangle", at: i * .085 })),
};

/* ════════ التاريخ الهجري ════════ */
export const HM = ["محرّم","صفر","ربيع الأول","ربيع الآخر","جمادى الأولى","جمادى الآخرة",
                   "رجب","شعبان","رمضان","شوّال","ذو القعدة","ذو الحجة"];
export const GM = ["يناير","فبراير","مارس","أبريل","مايو","يونيو",
                   "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
export const WD = ["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];

const DAYMS = 86400000;
const p2 = (n) => (n < 10 ? "0" + n : "" + n);
/* مفتاح اليوم: تاريخ ميلادي نصّي — هو ما يُخزَّن في قاعدة البيانات */
export const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const fromIso = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const today = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };
export const dateOf = (off) => { const d = today(); d.setDate(d.getDate() + off); return d; };

export function hijri(d) {
  try {
    const f = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura",
      { day: "numeric", month: "numeric", year: "numeric" }).formatToParts(d);
    const g = (t) => +f.find((x) => x.type === t).value;
    return { d: g("day"), m: g("month"), y: g("year") };
  } catch { return { d: d.getDate(), m: d.getMonth() + 1, y: 1447 }; }
}

/* أول يوم في الشهر الهجري الذي يقع فيه هذا التاريخ */
export function monthStart(anchor) {
  let d = new Date(anchor); d.setHours(12, 0, 0, 0);
  for (let i = 0; i < 40 && hijri(d).d !== 1; i++) d = new Date(+d - DAYMS);
  return d;
}
/* أيام الشهر كاملةً — ٢٩ أو ٣٠ حسب الشهر الحقيقي */
export function monthDays(startDate) {
  const out = [], m0 = hijri(startDate).m;
  let d = new Date(startDate);
  while (out.length < 31 && hijri(d).m === m0) { out.push(new Date(d)); d = new Date(+d + DAYMS); }
  return out;
}
export const shiftMonth = (start, dir) =>
  dir < 0 ? monthStart(new Date(+start - DAYMS))
          : monthStart(new Date(+start + monthDays(start).length * DAYMS));

export const hLabel = (d) => { const h = hijri(d); return `${ar(h.d)} ${HM[h.m - 1]}`; };
export const hMonthLabel = (d) => { const h = hijri(d); return `${HM[h.m - 1]} ${ar(h.y)}`; };
export const gLabel = (d) => `الموافق ${ar(d.getDate())} ${GM[d.getMonth()]}`;

/* ════════ الحالة ════════
   LOG["2026-08-19"][sunnahKey] = value
   البرنامج يستمرّ طوال السنة: كل شهر هجري بستانٌ مستقلّ يُبنى في ٣٠ يومًا،
   والشهور السابقة تبقى أرشيفًا يُتصفَّح. اقلب MONTHLY إلى false لبستانٍ واحد
   تتراكم طوال السنة.                                                       */
export const MONTHLY = true;

export function useSillaState(initialLog = {}) {
  const sv = useSunanVersion();          /* أي تعديل على السنن يعيد حساب ما تحته */
  const [log, setLog] = useState(initialLog);
  const [start, setStart] = useState(() => monthStart(today()));   // بداية الشهر المعروض
  const [dayKey, setDayKey] = useState(() => iso(today()));        // اليوم المفتوح للتعبئة

  const days = useMemo(() => monthDays(start), [start]);
  const day = log[dayKey] || {};
  const todayKey = iso(today());
  const isFuture = (d) => iso(d) > todayKey;

  /* ضغطة على سنّة: bool يقلب · cycle يزيد ١ ثم يعود ٠ بعد max */
  const hit = useCallback((k) => {
    const i = findItem(k);
    if (!i || dayKey > iso(today())) return;      /* لا تعبئة ليوم لم يأتِ */
    setLog((L) => {
      const d = { ...(L[dayKey] || {}) };
      const b = d[k] || 0;
      const n = i.type === "bool" ? (b ? 0 : 1) : b >= i.max ? 0 : b + 1;
      d[k] = n;
      const wasDone = i.type === "cycle" ? b >= i.max : b > 0;
      const nowDone = i.type === "cycle" ? n >= i.max : n > 0;
      if (nowDone && !wasDone) SFX.done();
      else if (!nowDone && wasDone) SFX.undo();
      else SFX.step();
      return { ...L, [dayKey]: d };
    });
  }, [dayKey, sv]);

  const setTime = useCallback((k, v) => {
    setLog((L) => ({ ...L, [dayKey]: { ...(L[dayKey] || {}), [k]: Math.max(0, parseInt(v) || 0) } }));
  }, [dayKey]);

  const isDone = (i, v) => (i.type === "cycle" ? v >= i.max : v > 0);

  const dayGems = useCallback((key) => {
    const L = log[key] || {};
    return ITEMS.reduce((a, i) => {
      const v = L[i.k] || 0;
      return a + (i.type === "cycle" ? v * i.g : v ? i.g : 0);
    }, 0);
  }, [log, sv]);

  const monthGems = useMemo(() => days.reduce((a, d) => a + dayGems(iso(d)), 0), [days, dayGems]);
  const allGems = useMemo(
    () => Object.keys(log).reduce((a, k) => a + dayGems(k), 0), [log, dayGems]);

  /* كم يومًا اكتملت فيه كل سنّة، حتى يوم معيّن من الشهر المعروض.
     upto = ترتيب اليوم داخل الشهر (١ فأكثر) · preview = الحالة المثالية */
  const tally = useCallback((upto, preview) => {
    const t = {};
    const cap = MONTHLY ? days.length : DAYS_TOTAL;
    ITEMS.forEach((i) => (t[i.k] = preview ? cap : 0));
    if (preview) return t;
    const span = MONTHLY ? days.slice(0, upto)
                         : Object.keys(log).sort().map(fromIso);
    span.forEach((d) => {
      const L = log[iso(d)];
      if (!L) return;
      ITEMS.forEach((i) => { if (isDone(i, L[i.k] || 0) && t[i.k] < cap) t[i.k]++; });
    });
    return t;
  }, [log, days, sv]);

  /* عدد الأيام المكتملة جزئيًا في الشهر — للتقويم */
  const dayScore = useCallback((key) => {
    const L = log[key] || {};
    return ITEMS.filter((i) => isDone(i, L[i.k] || 0)).length;
  }, [log, sv]);

  const doneCount = ITEMS.filter((i) => isDone(i, day[i.k] || 0)).length;

  return { log, setLog, day, dayKey, setDayKey, start, setStart, days, isFuture,
           hit, setTime, isDone, dayGems, monthGems, allGems, tally, dayScore, doneCount };
}


/* ════════════════════════════════════════════════════════════════════
   محرّك الرسم — كل رسّام يأخذ (x, y, n) و n = عدد الأيام (سقف ٣٠)
   ⚠ كل رسّام يجب أن يعمل عند n = 0 و n = 30 بلا خطأ.
   ════════════════════════════════════════════════════════════════════ */
let X = null;      // سياق الرسم — يُضبط داخل <Village/>
let ph = 0;        // طور الحركة (الماء، التوهّج)
let DKMODE = false;
const DK = () => DKMODE;

/* الظلّ يستلقي على الأرض المائلة، فيُضغط رأسيًا ويميل كما تميل الأرض */
function shadow(x, y, w, h, op) {
  for (let i = 3; i >= 1; i--) {
    X.fillStyle = `rgba(20,35,30,${(op || 0.2) / i})`;
    X.beginPath();
    X.ellipse(x + w * 0.18, y + 2, w * 1.18 * (1 + i * 0.13), h * IZ * (1 + i * 0.13),
              -0.42, 0, 7);
    X.fill();
  }
}

/* غبارٌ ينفض عند نشأة البناء — حلقةٌ تتّسع وتخفت على مستوى الأرض */
function puff(x, y, e) {
  const k = 1 - e;
  const r = 8 + e * 46;
  for (let i = 0; i < 11; i++) {
    const a = i * 0.571 + 0.25;
    const rr = r * (0.72 + (i % 3) * 0.16);
    const sz = (9 + e * 13) * (0.7 + (i % 2) * 0.4);
    X.globalAlpha = k * k * 0.72;
    X.fillStyle = DK() ? "#8FA096" : "#C9BC9C";
    X.beginPath();
    X.ellipse(x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr * IZ + 2 - e * 9,
              sz, sz * IZ, 0, 0, 7);
    X.fill();
  }
  /* حلقة أرضية تندفع خارجةً */
  X.globalAlpha = k * 0.5; X.lineWidth = 3 * k;
  X.strokeStyle = DK() ? "#A9BAAF" : "#D8CCAE";
  X.beginPath(); X.ellipse(x, y + 2, r * 1.35, r * 1.35 * IZ, 0, 0, 7); X.stroke();
  X.globalAlpha = 1;
}
/* صندوق إيزومتري: قاعدته مربّع في فضاء الأرض، وله سطح ووجهان مضاءان
   إضاءةً مختلفة — وهذا ما يعطي الحجم. (wx,wy) مركز القاعدة في فضاء الأرض. */
function isoBox(wx, wy, sx, sy, h, cTop, cR, cL, lift) {
  const L = lift || 0;
  const N = [IX(wx - sx, wy - sy), IY(wx - sx, wy - sy) - L];
  const E = [IX(wx + sx, wy - sy), IY(wx + sx, wy - sy) - L];
  const S = [IX(wx + sx, wy + sy), IY(wx + sx, wy + sy) - L];
  const Wc = [IX(wx - sx, wy + sy), IY(wx - sx, wy + sy) - L];
  const up = (q) => [q[0], q[1] - h];
  const face = (pts, c) => {
    X.fillStyle = sat(c); X.beginPath();
    pts.forEach((q, i) => (i ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1])));
    X.closePath(); X.fill(); edge(1.1);
  };
  if (!L) {
    X.fillStyle = "rgba(20,35,30,.20)";
    X.beginPath();
    [N, E, S, Wc].forEach((q, i) => (i ? X.lineTo(q[0], q[1] + 3) : X.moveTo(q[0], q[1] + 3)));
    X.closePath(); X.fill();
  }
  face([E, S, up(S), up(E)], cR);          /* الوجه الشرقيّ — أفتح */
  face([S, Wc, up(Wc), up(S)], cL);        /* الغربيّ — أغمق */
  face([up(N), up(E), up(S), up(Wc)], cTop);
  X.strokeStyle = "rgba(0,0,0,.13)"; X.lineWidth = 1;
  X.beginPath(); X.moveTo(S[0], S[1]); X.lineTo(up(S)[0], up(S)[1]); X.stroke();
}

/* دار إيزومترية: جدران صندوقية وفوقها سقف جملونيّ عارضته على محور الأرض السينيّ */
function isoHouse(wx, wy, sx, sy, hw, hr, C) {
  /* قاعدة أعرض قليلًا: تُجلس الدار على الأرض وتزيدها تفصيلًا */
  isoBox(wx, wy, sx * 1.14, sy * 1.16, Math.max(3, hw * .16),
         C.baseTop || "#CFC6AE", C.baseR || "#B3A990", C.baseL || "#93896F");
  isoBox(wx, wy, sx, sy, hw, C.wallTop, C.wallR, C.wallL, Math.max(3, hw * .16));
  const P4 = (a, b) => [IX(a, b), IY(a, b) - hw - Math.max(3, hw * .16)];
  const N = P4(wx - sx, wy - sy), E = P4(wx + sx, wy - sy);
  const S = P4(wx + sx, wy + sy), Wc = P4(wx - sx, wy + sy);
  const R1 = P4(wx - sx, wy), R2 = P4(wx + sx, wy);
  R1[1] -= hr; R2[1] -= hr;
  const face = (pts, c) => {
    X.fillStyle = sat(c); X.beginPath();
    pts.forEach((q, i) => (i ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1])));
    X.closePath(); X.fill(); edge(1.1);
  };
  face([N, E, R2, R1], C.roofBack);                 /* الميل الخلفيّ */
  face([N, Wc, R1], C.gable);                       /* جملون غربيّ */
  face([Wc, S, R2, R1], C.roofFront);               /* الميل الأماميّ */
  face([E, S, R2], C.gable);                        /* جملون شرقيّ */
  return { N, E, S, Wc, R1, R2 };
}

/* وحدات المجموعة على شبكة في فضاء الأرض — مسافات متساوية وترتيبٌ بالعمق.
   الصفوف تنمو شمالًا (−ص) كما كانت تنمو صعودًا في التخطيط المسطّح، فتبقى
   بصمة كل مجموعة في موضعها المدروس. `mid` يوسّط الصفوف حول الموضع بدل نموّها. */
function plot(key, k, cols, gx, gy, mid, oy, ox) {
  const [cx, cy] = SPOT[key], rows = Math.ceil(k / cols), out = [];
  for (let i = 0; i < k; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    out.push({ wx: cx + (ox || 0) + (c - (cols - 1) / 2) * gx,
               wy: cy + (oy || 0) + (mid ? (r - (rows - 1) / 2) : -r) * gy, i });
  }
  if (out.length) {
    const xs = out.map((q) => q.wx), ys = out.map((q) => q.wy);
    EXTENT[key] = { x0: Math.min(...xs), x1: Math.max(...xs),
                    y0: Math.min(...ys), y1: Math.max(...ys) };
  }
  return out.sort((a, b) => (a.wx + a.wy) - (b.wx + b.wy));
}

/* كتلة نباتية لها حجم: جانب مضاء وجانب ظليل وحافّة داكنة — أسلوب البيوت نفسه */
function canopy(px, py, r, cLit, cDark) {
  X.fillStyle = "rgba(12,32,24,.20)";
  X.beginPath(); X.ellipse(px + r * .16, py + r * .30, r * .96, r * .70, 0, 0, 7); X.fill();
  const g = X.createLinearGradient(px - r, py - r, px + r * .7, py + r * .8);
  g.addColorStop(0, sat(cLit)); g.addColorStop(1, sat(cDark));
  X.fillStyle = g;
  X.beginPath(); X.ellipse(px, py, r, r * .88, 0, 0, 7); X.fill(); edge(1.2);
  X.fillStyle = "rgba(255,255,255,.20)";
  X.beginPath(); X.ellipse(px - r * .32, py - r * .34, r * .34, r * .24, -.5, 0, 7); X.fill();
}

/* جذع بوجهين — مضاء من الغرب، ظليل من الشرق */
function trunk(px, py, w, h, cLit, cDark) {
  X.fillStyle = sat(cDark);
  X.beginPath(); X.moveTo(px - w, py); X.lineTo(px - w * .62, py - h);
  X.lineTo(px + w * .62, py - h); X.lineTo(px + w, py); X.closePath(); X.fill(); edge(1);
  X.fillStyle = sat(cLit);
  X.beginPath(); X.moveTo(px - w, py); X.lineTo(px - w * .62, py - h);
  X.lineTo(px, py - h); X.lineTo(px, py); X.closePath(); X.fill();
}

/* تدرّجٌ جانبيّ — يمرّ من التشبّع كغيره، وإلا بقي السور وما يستعمله باهتًا */
function lit(x, y, w, c1, c2) {
  const g = X.createLinearGradient(x - w / 2, y, x + w / 2, y);
  g.addColorStop(0, sat(c1)); g.addColorStop(1, sat(c2)); return g;
}

const WALL=(function(){
 const s=[],top=9,side=6,bot=9,lft=6;      /* ٩+٦+٩+٦ = ٣٠ */
 const x0=IN.x-26,y0=IN.y-26,x1=IN.x+IN.w+26,y1=IN.y+IN.h+26;
 for(let i=0;i<top;i++)s.push([x0+(x1-x0)*(i+.5)/top,y0,'h']);
 for(let i=0;i<side;i++)s.push([x1,y0+(y1-y0)*(i+.5)/side,'v']);
 for(let i=bot-1;i>=0;i--)s.push([x0+(x1-x0)*(i+.5)/bot,y1,'h']);
 for(let i=lft-1;i>=0;i--)s.push([x0,y0+(y1-y0)*(i+.5)/lft,'v']);
 return s})();
export const DRAW={};
/* ── السور: طاردات الشيطان (٣٠ قطعة على المحيط) ── */
DRAW.fort=(x,y,n)=>{
 const k=Math.min(n,DCAP);
 /* تُرتَّب بالعمق فتحجب القطعُ القريبة ما خلفها */
 const seg=[];
 for(let i=0;i<k;i++){const[a,b,o]=WALL[i];seg.push({a,b,o,d:a+b})}
 seg.sort((p,q)=>p.d-q.d);
 /* حجر كلسيّ كحجر الصحن — لا رمادي يخالفه */
 /* حجرٌ كلسيّ كِرَم — لا أمبريّ. الأمبر يصبغ المشهد كلّه بصفرةٍ ثقيلة،
    والكِرَم الهادئ يترك الخضرةَ هي التي تحمل الحياة. */
 const top=DK()?'#4E5A50':'#EDE4CE',rgt=DK()?'#3A4740':'#D3C6A9',lft=DK()?'#28332E':'#B0A386';
 seg.forEach(({a,b,o})=>{
  const sx=o==='h'?30:16,sy=o==='h'?16:30;
  isoBox(a,b,sx,sy,26,top,rgt,lft);                    /* بدن البرج */
  isoBox(a,b,sx*1.12,sy*1.12,5,DK()?'#5C6A5E':'#F5EEDF',rgt,lft,26);  /* شرفة تعلوه */
 })};

/* ── بيوت الرواتب: حيّ يصل ٣٠ بيتًا ── */
DRAW.house=(x,y,n)=>{const k=Math.min(n,DCAP);
 /* الشبكة في فضاء الأرض لا الشاشة، فتُسقَط صفوفًا مائلة كحيٍّ حقيقي.
    (x,y) الواصلان مُسقَطان أصلًا، فنستعيد مركز الحيّ من موضعه في SPOT. */
 const col={wallTop:DK()?'#CDBE92':'#F6EDD8',wallR:DK()?'#B5A57C':'#E4D7BB',
            wallL:DK()?'#8C7C58':'#C2B291',
            roofBack:DK()?'#8E6438':'#B98A52',roofFront:DK()?'#C08A50':'#DBA968',
            gable:DK()?'#7E5A32':'#A87B47'};
 const cells=plot('house',k,6,40,30,true,20).map(({wx,wy})=>({a:wx,b:wy}));
 cells.forEach(({a,b})=>{
  isoHouse(a,b,17,15,19,14,col);
  /* باب ونافذتان على الوجه الأمامي */
  const fx=IX(a,b+15),fy=IY(a,b+15);
  X.fillStyle=DK()?'#5E4530':'#7A5A3A';X.fillRect(fx-4,fy-14,8,13);
  X.fillStyle='#FFEBAE';X.fillRect(fx-14,fy-17,6,6);X.fillRect(fx+8,fy-17,6,6)})};

/* ── المحراب: يعلو ويتعدّد ── */
DRAW.mihrab=(x,y,n)=>{const k=Math.min(Math.ceil(n*5/DCAP),5);if(!k)return;
 const [mx,my]=SPOT.mihrab,h=32+Math.min(n,DCAP)*.7,half=k*16,dep=11;
 isoBox(mx,my,half,dep,h,
  DK()?'#E4D0A0':'#F8EFDA',DK()?'#C2AD80':'#E0D3B4',DK()?'#9E8B62':'#C4B492');
 /* القناطر محفورة في الوجه الأمامي — قاعدة كلٍّ على حافّته المائلة */
 for(let i=0;i<k;i++){
  const wx=mx-half+(i+.5)*(half*2/k);
  const bx=IX(wx,my+dep),by=IY(wx,my+dep),w=half/k*.62;
  X.fillStyle=DK()?'#0C231E':'#4E7A60';
  X.beginPath();X.moveTo(bx-w,by);X.lineTo(bx-w,by-h+15);
  X.quadraticCurveTo(bx,by-h-1,bx+w,by-h+15);X.lineTo(bx+w,by);X.closePath();X.fill();
  X.strokeStyle=DK()?'#D4B570':'#B99442';X.lineWidth=1.3;X.stroke();
  X.fillStyle='rgba(255,255,255,.16)';X.fillRect(bx-w,by-h+15,2,h-15)}};

/* ── المئذنة: ترتفع مع الأيام (سقف ٣٠) ── */
DRAW.minaret=(x,y,n)=>{if(!n)return;const h=26+Math.min(n,DCAP)*2.2;shadow(x,y,10,4);
 X.fillStyle=lit(x,y,16,DK()?'#E0CB96':'#F5EBD4',DK()?'#A08B5E':'#C2B08E');
 X.fillRect(x-7,y-h,14,h);
 X.fillStyle='rgba(255,255,255,.18)';X.fillRect(x-7,y-h,3,h);
 const rings=Math.floor(Math.min(n,DCAP)/8);
 for(let k=1;k<=rings;k++){X.fillStyle=DK()?'#B8A176':'#D8C9A6';
  X.fillRect(x-10,y-h*k/(rings+1),20,4)}
 X.fillStyle=DK()?'#D4B570':'#C9A96A';X.beginPath();X.arc(x,y-h,8,Math.PI,0);X.fill();
 X.fillStyle=DK()?'#E5CF9A':'#D9BE7E';X.fillRect(x-1.3,y-h-14,2.6,8);
 X.beginPath();X.arc(x,y-15-h,2.6,0,7);X.fill()};

/* ── السجادة: تكبر مع الأيام ── */
DRAW.rug=(x,y,n)=>{if(!n)return;const s=.5+Math.min(n,DCAP)/DCAP*1.6;
 shadow(x,y,26*s,7*s,.14);
 const g=lit(x,y,54*s,DK()?'#A0576C':'#D08FA4',DK()?'#6E3A4C':'#A86478');
 X.fillStyle=g;X.beginPath();X.ellipse(x,y,27*s,10*s,0,0,7);X.fill();
 X.strokeStyle=DK()?'#E5CF9A':'#EBD9A0';X.lineWidth=1.4;
 X.beginPath();X.ellipse(x,y,20*s,7*s,0,0,7);X.stroke();
 X.beginPath();X.ellipse(x,y,12*s,4*s,0,0,7);X.stroke();
 for(let i=0;i<8;i++){const a=i*.785;
  X.beginPath();X.moveTo(x+Math.cos(a)*20*s,y+Math.sin(a)*7*s);
  X.lineTo(x+Math.cos(a)*27*s,y+Math.sin(a)*10*s);X.stroke()}};

/* ── النهر: مجرى جافّ يمتلئ تدريجيًا يومًا بيوم ──
   الامتلاء محسوب بنقطة مُستكمَلة (interpolation) لا بقفزات،
   فيظهر الماء من اليوم الأول ويمتلئ المجرى كاملًا يوم ٣٠.
   ⚠ الفهارس مقيّدة داخل حدود المصفوفة — انظر §١٣ في CLAUDE.md. */
DRAW.stream=(x,y,n)=>{
 /* y هنا مُسقَط أصلًا، فنعيد بناء المسار في فضاء الأرض ثم نُسقطه */
 const wy=357,pts=[];
 for(let i=0;i<=10;i++){const wx=IN.x+30+i*(IN.w-60)/10,wv=wy+Math.sin(i*.75)*22;
  pts.push([IX(wx,wv),IY(wx,wv)])}
 /* مجرى جافّ */
 X.strokeStyle=DK()?'rgba(70,64,48,.6)':'rgba(190,178,148,.75)';X.lineWidth=30;X.lineCap='round';
 X.beginPath();X.moveTo(pts[0][0],pts[0][1]);pts.forEach(p=>X.lineTo(p[0],p[1]));X.stroke();
 X.strokeStyle=DK()?'rgba(50,46,34,.7)':'rgba(168,156,126,.8)';X.lineWidth=22;
 X.beginPath();X.moveTo(pts[0][0],pts[0][1]);pts.forEach(p=>X.lineTo(p[0],p[1]));X.stroke();
 if(!n)return;
 const last=pts.length-1;
 const fill=Math.min(n,DCAP)/DCAP;
 const at=last*fill;                       /* موضع كسريّ على المجرى */
 const seg=Math.max(0,Math.min(last-1,Math.floor(at)));
 const fr=Math.max(0,Math.min(1,at-seg));
 const ex=pts[seg][0]+(pts[seg+1][0]-pts[seg][0])*fr;
 const ey=pts[seg][1]+(pts[seg+1][1]-pts[seg][1])*fr;
 X.save();X.beginPath();
 X.moveTo(pts[0][0],pts[0][1]-46);
 for(let i=1;i<=seg;i++)X.lineTo(pts[i][0],pts[i][1]-46);
 X.lineTo(ex,ey-46);X.lineTo(ex,ey+46);
 for(let i=seg;i>=0;i--)X.lineTo(pts[i][0],pts[i][1]+46);
 X.closePath();X.clip();
 const g=X.createLinearGradient(0,y-14,0,y+14);
 g.addColorStop(0,DK()?'#5FA8C8':'#9DD9F2');g.addColorStop(1,DK()?'#2E6B8E':'#5FAEC9');
 X.strokeStyle=g;X.lineWidth=22;X.lineCap='round';
 X.beginPath();X.moveTo(pts[0][0],pts[0][1]);pts.forEach(p=>X.lineTo(p[0],p[1]));X.stroke();
 X.strokeStyle='rgba(255,255,255,.34)';X.lineWidth=3;X.beginPath();
 pts.forEach((p,i)=>{const o=Math.sin(i+ph*2)*3;
  i?X.lineTo(p[0],p[1]-5+o):X.moveTo(p[0],p[1]-5+o)});X.stroke();
 X.restore()};

/* ── النخيل: حتى ٣٠ ── */
DRAW.palm=(x,y,n)=>{const k=Math.min(n,DCAP);
 plot('palm',k,6,30,27).forEach(({wx,wy,i})=>{
  const a=IX(wx,wy),b=IY(wx,wy),s=.58+((i*7)%3)*.07;
  shadow(a,b,9,3.4);
  trunk(a,b,4.4*s,42*s,DK()?'#7E5A38':'#A87C4E',DK()?'#4A3220':'#6B4A2A');
  for(let r=1;r<5;r++){X.fillStyle='rgba(0,0,0,.10)';
   X.fillRect(a-3.6*s,b-(9+r*7)*s,7.2*s,1.4*s)}
  const sw=Math.sin(ph*.7+i)*.07;
  /* سعفات خلفية أغمق ثم أمامية أفتح — بها يظهر العمق */
  [[-1,-.3,0],[1,-.3,0],[0,-1,0],[-.78,.28,1],[.78,.28,1]].forEach(([dx,dy,front])=>{
   X.save();X.translate(a,b-44*s);X.rotate(Math.atan2(dy,dx)+sw);
   const fg=X.createLinearGradient(0,0,20*s,0);
   if(front){fg.addColorStop(0,DK()?'#46B07A':'#5FC48C');fg.addColorStop(1,DK()?'#22764A':'#358F5E')}
   else{fg.addColorStop(0,DK()?'#2E7E56':'#3E9868');fg.addColorStop(1,DK()?'#175434':'#256B44')}
   X.fillStyle=fg;X.beginPath();X.ellipse(15*s,0,15*s,4.2*s,0,0,7);X.fill();X.restore()});
  X.fillStyle=DK()?'#C98A3C':'#D9963C';
  X.beginPath();X.arc(a,b-38*s,2.6*s,0,7);X.fill()})};

DRAW.garden=(x,y,n)=>{const k=Math.min(Math.round(n*40/DCAP),40);
 plot('garden',k,8,22,19).forEach(({wx,wy})=>{
  const a=IX(wx,wy),b=IY(wx,wy);
  X.strokeStyle=DK()?'#1E5C3A':'#2E7A4A';X.lineWidth=1.8;
  X.beginPath();X.moveTo(a,b);X.lineTo(a,b-5);X.stroke();
  canopy(a,b-11,7.2,DK()?'#5FBF87':'#84D9A4',DK()?'#215F3E':'#357F52')})};

/* ════ المسجد — أساس القرية ════
   ليس مربوطًا بسنّة: هو مركز الأرض، ويتطوّر بمرتبة الطالب لا بعدد أيامه.
   المستوى ٠ مصلّى بسيط، ثم تُضاف القبّة فالأبراج فالمئذنة فالذهب. */
let MLV = 0;                      /* مستوى المسجد = ترتيب المرتبة */
DRAW.dome=(x,y,lv)=>{
 const L=Math.max(0,Math.min(7,lv|0)), g=L/7, s=.66+g*.66;
 const [cx,cy]=SPOT.dome;
 /* أكبر ما في الأرض — هو قلبها، فلا يصحّ أن تبتلعه البيوت */
 const SX=(44+L*3.6)*s,SY=(29+L*2.4)*s;
 EXTENT.dome={x0:cx-SX,x1:cx+SX,y0:cy-SY,y1:cy+SY};
 const px=IX(cx,cy),py=IY(cx,cy);
 const PH=8*s,HH=(30+L*3.1)*s,HW=SX*.78,HD=SY*.76;
 const gold1=L>=4?'#FFF0BE':'#F6E7C2', gold2=L>=4?'#F3C93F':'#D8C38A', gold3=L>=4?'#B07E14':'#9E8C5A';

 /* هالة النور — تشتدّ بالمستوى وتبدأ من أوّله */
 X.save();X.globalAlpha=(.08+g*.24)+Math.sin(ph*.9)*.05;
 const gy=py-PH-HH-46*s;
 const gl=X.createRadialGradient(px,gy,0,px,gy,(90+L*10)*s);
 gl.addColorStop(0,'#FFE9A8');gl.addColorStop(.5,'rgba(255,220,140,.3)');
 gl.addColorStop(1,'rgba(255,233,168,0)');
 X.fillStyle=gl;X.beginPath();X.arc(px,gy,(90+L*10)*s,0,7);X.fill();X.restore();

 const T=DK()?'#DCCDA0':'#FBF4E0',R=DK()?'#BAAB80':'#E6DABC',Lf=DK()?'#8E8058':'#C2B490';
 isoBox(cx,cy,SX,SY,PH,DK()?'#C8BA92':'#EEE5CC',DK()?'#A89A74':'#D6CAAC',DK()?'#847858':'#B4A88C');
 isoBox(cx,cy,HW,HD,HH,T,R,Lf,PH);

 /* قناطر الوجه — واحدة في الأصغر، وثلاثٌ فأكثر مع الكبر */
 const arch=L<2?1:L<5?3:5;
 for(let i=0;i<arch;i++){
  const u=arch===1?0:(i/(arch-1)-.5)*2;
  const wx=cx+u*HW*.62,bx=IX(wx,cy+HD),by=IY(wx,cy+HD)-PH;
  const aw=HW*(arch===1?.34:.17),ah=HH*.74;
  X.fillStyle=DK()?'#0E1E19':'#2E4C3B';
  X.beginPath();X.moveTo(bx-aw,by);X.lineTo(bx-aw,by-ah*.5);
  X.quadraticCurveTo(bx,by-ah,bx+aw,by-ah*.5);X.lineTo(bx+aw,by);X.closePath();X.fill();
  edge(1.1);
  X.fillStyle='#FFDF95';X.globalAlpha=.35+g*.4;
  X.beginPath();X.ellipse(bx,by-ah*.4,aw*.5,ah*.18,0,0,7);X.fill();X.globalAlpha=1}

 /* أبراج الأركان — تظهر من المستوى ٢ */
 if(L>=2){[[-1,-1],[1,-1],[-1,1],[1,1]].slice(0,L>=3?4:2).forEach(([dx,dy],qi)=>{
  const tw=4.4*s,twx=cx+dx*SX*.9,twy=cy+dy*SY*.86,TH=HH*(1.06+g*.26);
  isoBox(twx,twy,tw,tw,TH,T,R,Lf,PH);
  const tx=IX(twx,twy),ty=IY(twx,twy)-PH-TH;
  X.fillStyle=sat(gold2);
  X.beginPath();X.moveTo(tx-tw*1.5,ty);
  X.bezierCurveTo(tx-tw*1.5,ty-tw*2.5,tx+tw*1.5,ty-tw*2.5,tx+tw*1.5,ty);
  X.closePath();X.fill();edge(1);
  if(L>=6){const fw=Math.sin(ph*2.4+qi)*2.4;
   X.fillStyle=sat(TIERC);X.beginPath();
   X.moveTo(tx,ty-tw*2.5);X.lineTo(tx+12*s+fw,ty-tw*2.5+4*s);
   X.lineTo(tx,ty-tw*2.5+8.5*s);X.closePath();X.fill();edge(.9)}})}

 /* مئذنة — من أوّل مستوى، وتطول وتتعدّد */
 const mins=L>=4?[[-1.02,.5],[1.02,.5]]:[[-1.02,.5]];
 mins.forEach(([ux,uy])=>{
  const mx=cx+ux*SX,my=cy+uy*SY,MH=HH*(1.5+g*.7),mw=3.4*s;
  isoBox(mx,my,mw,mw,MH,T,R,Lf,PH);
  const ax=IX(mx,my),ay=IY(mx,my)-PH-MH;
  /* شرفة المؤذّن */
  X.fillStyle=sat(R);X.beginPath();X.ellipse(ax,ay+2*s,mw*2.1,mw*.95,0,0,7);X.fill();edge(1);
  X.fillStyle=sat(gold2);
  X.beginPath();X.moveTo(ax-mw*1.5,ay-1*s);
  X.bezierCurveTo(ax-mw*1.5,ay-11*s,ax+mw*1.5,ay-11*s,ax+mw*1.5,ay-1*s);
  X.closePath();X.fill();edge(1);
  X.strokeStyle=sat(gold2);X.lineWidth=1.6*s;X.lineCap='round';
  X.beginPath();X.moveTo(ax,ay-10*s);X.lineTo(ax,ay-16*s);X.stroke()});

 /* الرقبة والقبّة — موجودتان من المستوى ٠ */
 const NH=(10+L*1.7)*s,NW=SX*.32;
 isoBox(cx,cy,NW,SY*.32,NH,T,R,Lf,PH+HH);
 const NY=py-PH-HH-NH;
 X.fillStyle='#FFDF95';X.globalAlpha=.35+g*.4;
 [-1,0,1].forEach((i)=>{const wx2=IX(cx+i*NW*.5,cy+SY*.32);
  X.beginPath();X.ellipse(wx2,NY+NH*.52,2.1*s,3.8*s,0,0,7);X.fill()});
 X.globalAlpha=1;
 const RR=NW*(1.3+g*.3);
 X.fillStyle=sat(gold3);
 X.beginPath();X.ellipse(px,NY,RR*1.06,RR*.26,0,0,7);X.fill();edge(1.2);
 const dg=X.createRadialGradient(px-RR*.36,NY-RR*.62,3,px,NY,RR*1.25);
 dg.addColorStop(0,sat(gold1));dg.addColorStop(.52,sat(gold2));dg.addColorStop(1,sat(gold3));
 X.fillStyle=dg;
 X.beginPath();X.moveTo(px-RR,NY);
 X.bezierCurveTo(px-RR,NY-RR*1.36,px+RR,NY-RR*1.36,px+RR,NY);
 X.closePath();X.fill();edge(1.4);
 /* الصاري والهلال — من المستوى ٠ */
 const FY=NY-RR*1.02;
 X.strokeStyle=sat(gold2);X.lineWidth=2.2*s;X.lineCap='round';
 X.beginPath();X.moveTo(px,FY);X.lineTo(px,FY-13*s);X.stroke();
 X.fillStyle=sat(gold2);X.beginPath();
 X.arc(px,FY-18*s,4.6*s,0,7);X.arc(px+2.1*s,FY-19.2*s,4*s,0,7);
 X.fill('evenodd');edge(1)};

/* ── قبة نور: بناء الاستشفاع بعد فكّه عن المسجد ── */
DRAW.nur=(x,y,n)=>{if(!n)return;
 const g=Math.min(n,DCAP)/DCAP,s=.6+g*.55;
 const [cx,cy]=SPOT.nur;
 const px=IX(cx,cy),py=IY(cx,cy);
 shadow(px,py,20*s,6*s,.2);
 X.save();X.globalAlpha=(.16+g*.26)+Math.sin(ph*1.1)*.07;
 const gl=X.createRadialGradient(px,py-26*s,0,px,py-26*s,64*s);
 gl.addColorStop(0,'#FFF0BE');gl.addColorStop(.5,'rgba(255,232,168,.3)');
 gl.addColorStop(1,'rgba(255,240,190,0)');
 X.fillStyle=gl;X.beginPath();X.arc(px,py-26*s,64*s,0,7);X.fill();X.restore();
 const T=DK()?'#D6C79C':'#F5EEDA',R=DK()?'#B4A57B':'#DED2B4',L2=DK()?'#887A54':'#BAAC8A';
 isoBox(cx,cy,15*s,10*s,4*s,T,R,L2);
 /* أربعة أعمدة */
 [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([dx,dy])=>
  isoBox(cx+dx*11*s,cy+dy*7*s,2*s,2*s,17*s,T,R,L2,4*s));
 const NY=py-4*s-17*s, RR=13*s;
 X.fillStyle=sat(DK()?'#B8922E':'#C9A54A');
 X.beginPath();X.ellipse(px,NY,RR*1.05,RR*.26,0,0,7);X.fill();edge(1.1);
 const dg=X.createRadialGradient(px-RR*.35,NY-RR*.6,2,px,NY,RR*1.2);
 dg.addColorStop(0,'#FFF6DA');dg.addColorStop(.55,sat('#EBD48A'));
 dg.addColorStop(1,sat('#B08E36'));
 X.fillStyle=dg;
 X.beginPath();X.moveTo(px-RR,NY);
 X.bezierCurveTo(px-RR,NY-RR*1.3,px+RR,NY-RR*1.3,px+RR,NY);
 X.closePath();X.fill();edge(1.2);
 /* شعاع صاعد */
 X.save();X.globalAlpha=.2+Math.sin(ph*1.4)*.08;
 const bg=X.createLinearGradient(0,NY-RR*1.3,0,NY-RR*1.3-56*s);
 bg.addColorStop(0,'rgba(255,240,190,.75)');bg.addColorStop(1,'rgba(255,240,190,0)');
 X.fillStyle=bg;
 X.beginPath();X.moveTo(px-4*s,NY-RR*1.3);X.lineTo(px+4*s,NY-RR*1.3);
 X.lineTo(px+11*s,NY-RR*1.3-56*s);X.lineTo(px-11*s,NY-RR*1.3-56*s);
 X.closePath();X.fill();X.restore()};

DRAW.sundial=(x,y,n)=>{if(!n)return;shadow(x,y,14,5);
 X.fillStyle=lit(x,y,26,DK()?'#B8AA88':'#DCD2B4',DK()?'#7E735A':'#A89A78');
 X.beginPath();X.ellipse(x,y-3,14,6,0,0,7);X.fill();
 X.fillStyle=DK()?'#8E8262':'#C4B894';X.fillRect(x-12,y-6,24,4);
 X.fillStyle=DK()?'#D4B570':'#B99442';X.beginPath();
 X.moveTo(x,y-6);X.lineTo(x+3,y-20);X.lineTo(x+6,y-6);X.fill()};

DRAW.gate=(x,y,n)=>{if(!n)return;const s=.7+Math.min(n,DCAP)/DCAP*.5;
 const [gx,gy]=SPOT.gate,w=24*s,dep=13*s,h=48*s;
 isoBox(gx,gy,w,dep,h,
  DK()?'#E4D0A0':'#F6ECD6',DK()?'#C2AD80':'#DED0AE',DK()?'#9C8A63':'#C0AE8C');
 const bx=IX(gx,gy+dep),by=IY(gx,gy+dep),o=13*s;
 X.fillStyle=DK()?'#0C231E':'#3E5E4A';
 X.beginPath();X.moveTo(bx-o,by);X.lineTo(bx-o,by-h*.52);
 X.quadraticCurveTo(bx,by-h*.94,bx+o,by-h*.52);X.lineTo(bx+o,by);X.closePath();X.fill();
 X.strokeStyle=DK()?'#D4B570':'#B99442';X.lineWidth=2;X.stroke();
 /* شرفة تعلو البوابة */
 isoBox(gx,gy,w*1.08,dep*1.08,5*s,DK()?'#EFDCAC':'#FBF3E2',
  DK()?'#C2AD80':'#DED0AE',DK()?'#9C8A63':'#C0AE8C',h)};

DRAW.pattern=(x,y,n)=>{if(!n)return;const k=Math.min(n,DCAP);
 X.fillStyle=DK()?'rgba(212,181,112,.15)':'rgba(185,148,66,.12)';
 X.fillRect(x-70,y-14,140,14);
 X.strokeStyle=DK()?'#D4B570':'#B99442';X.lineWidth=1.4;
 for(let i=0;i<Math.min(k,10);i++){const a=x-63+i*14;X.beginPath();
  X.moveTo(a,y-7);X.lineTo(a+6,y-13);X.lineTo(a+12,y-7);X.lineTo(a+6,y-1);X.closePath();X.stroke()}};

DRAW.fountain=(x,y,n)=>{const k=Math.min(Math.ceil(n*8/DCAP),8);
 plot('fountain',k,4,50,42).forEach(({wx,wy})=>{
  const a=IX(wx,wy),b=IY(wx,wy);
  shadow(a,b,20,7);
  /* الحوض يستلقي على الأرض فهو بيضويّ مضغوط بميلها */
  X.fillStyle=DK()?'#4E625C':'#93A197';
  X.beginPath();X.ellipse(a,b+1,21,21*IZ,-.42,0,7);X.fill();
  X.fillStyle=DK()?'#8E9E96':'#CBD5CA';
  X.beginPath();X.ellipse(a,b-2,20,20*IZ,-.42,0,7);X.fill();
  const wg=X.createRadialGradient(a-5,b-5,1,a,b-3,16);
  wg.addColorStop(0,DK()?'#7FD0EE':'#A8E4F8');wg.addColorStop(1,DK()?'#256B8E':'#3E8FBE');
  X.fillStyle=wg;X.beginPath();X.ellipse(a,b-3,15,15*IZ,-.42,0,7);X.fill();
  for(let m=0;m<2;m++){const rr=4+((ph*20+m*10)%15);
   X.strokeStyle=`rgba(220,245,255,${(1-rr/19)*.5})`;X.lineWidth=1.1;
   X.beginPath();X.ellipse(a,b-3,rr,rr*IZ*.7,-.42,0,7);X.stroke()}
  trunk(a,b-4,3.4,20,DK()?'#9EAEA6':'#DAE2D9',DK()?'#5E6E66':'#A6B2A6');
  X.strokeStyle='rgba(220,245,255,.85)';X.lineWidth=2;
  [-1,1].forEach(d=>{X.beginPath();X.moveTo(a,b-25);
   X.quadraticCurveTo(a+d*11,b-33,a+d*15,b-14);X.stroke()})})};

DRAW.arak=(x,y,n)=>{const k=Math.min(Math.ceil(n*10/DCAP),10);
 plot('arak',k,5,34,28).forEach(({wx,wy})=>{
  const a=IX(wx,wy),b=IY(wx,wy),s=.78+Math.min(n,DCAP)/DCAP*.3;
  shadow(a,b,10,3.6);
  trunk(a,b,3.2*s,19*s,DK()?'#7E5A38':'#A87C4E',DK()?'#4A3220':'#6B4A2A');
  canopy(a-7.5*s,b-21*s,8.4*s,DK()?'#3E9E6E':'#5CBE86',DK()?'#1A5C38':'#2C7A4C');
  canopy(a+7.5*s,b-21*s,8.4*s,DK()?'#3E9E6E':'#5CBE86',DK()?'#1A5C38':'#2C7A4C');
  canopy(a,b-27*s,12*s,DK()?'#4FB37C':'#6FD49A',DK()?'#1E6B42':'#338354')})};

DRAW.bighouse=(x,y,n)=>{if(!n)return;const s=.62+Math.min(n,DCAP)/DCAP*.45;
 const [bx,by]=SPOT.bighouse;
 const col={wallTop:DK()?'#D8C99C':'#F8F0DC',wallR:DK()?'#BFAF84':'#E8DCC0',
            wallL:DK()?'#96865F':'#CCBC9A',
            roofBack:DK()?'#8E6438':'#B98A52',roofFront:DK()?'#C08A50':'#DBA968',
            gable:DK()?'#7E5A32':'#A87B47'};
 isoHouse(bx,by,32*s,26*s,34*s,22*s,col);
 const fx=IX(bx,by+26*s),fy=IY(bx,by+26*s);
 X.fillStyle=DK()?'#5E4530':'#7A5A3A';X.fillRect(fx-8*s,fy-24*s,16*s,23*s);
 X.fillStyle='#FFEBAE';
 X.fillRect(fx-26*s,fy-28*s,9*s,8*s);X.fillRect(fx+17*s,fy-28*s,9*s,8*s)};

DRAW.bridge=(x,y,n)=>{if(!n)return;const s=.7+Math.min(n,DCAP)/DCAP*.4;
 shadow(x,y+6,38*s,7*s,.14);
 const g=X.createLinearGradient(0,y-26*s,0,y);
 g.addColorStop(0,DK()?'#A0764C':'#C89A5E');g.addColorStop(1,DK()?'#6B4A2A':'#8A6440');
 X.strokeStyle=g;X.lineWidth=8*s;X.lineCap='round';
 X.beginPath();X.moveTo(x-44*s,y);X.quadraticCurveTo(x,y-30*s,x+44*s,y);X.stroke();
 X.strokeStyle=DK()?'#7E5A38':'#9E7448';X.lineWidth=3*s;
 for(let i=-4;i<=4;i++){const a=x+i*11*s,dy=Math.abs(i)*1.6*s;
  X.beginPath();X.moveTo(a,y-22*s+dy);X.lineTo(a,y-6*s+dy*.5);X.stroke()}
 X.strokeStyle=DK()?'#A0764C':'#C89A5E';X.lineWidth=2.2*s;
 X.beginPath();X.moveTo(x-44*s,y-13*s);X.quadraticCurveTo(x,y-42*s,x+44*s,y-13*s);X.stroke()};

DRAW.tent=(x,y,n)=>{const k=Math.min(Math.ceil(n*8/DCAP),8);
 plot('tent',k,4,38,34,false,-22,-46).forEach(({wx,wy})=>{
  const a=IX(wx,wy),b=IY(wx,wy);
  shadow(a,b,21,7);
  /* هرمٌ بوجهين: غربيّ مضاء وشرقيّ ظليل، فتظهر له زاوية */
  const apex=[a,b-34];
  const W1=[IX(wx-19,wy+11),IY(wx-19,wy+11)],S1=[IX(wx+19,wy+11),IY(wx+19,wy+11)];
  const E1=[IX(wx+19,wy-11),IY(wx+19,wy-11)];
  const f=(pts,c)=>{X.fillStyle=c;X.beginPath();
   pts.forEach((q,i)=>i?X.lineTo(q[0],q[1]):X.moveTo(q[0],q[1]));X.closePath();X.fill()};
  f([E1,S1,apex],DK()?'#8E7028':'#A78B52');
  f([S1,W1,apex],DK()?'#E5CF9A':'#E4D19C');
  X.strokeStyle='rgba(0,0,0,.16)';X.lineWidth=1;
  X.beginPath();X.moveTo(S1[0],S1[1]);X.lineTo(apex[0],apex[1]);X.stroke();
  const dx=IX(wx,wy+11),dy=IY(wx,wy+11);
  X.fillStyle=DK()?'#0C231E':'#4E3A22';X.beginPath();X.moveTo(dx-5,dy);
  X.lineTo(dx-3,dy-15);X.lineTo(dx+3,dy-15);X.lineTo(dx+5,dy);X.closePath();X.fill()})};

DRAW.flower=(x,y,n)=>{const FCL=['#E8657F','#F2C14E','#B87FD0','#6FD08C','#F28E4E','#5DADE2'];
 const k=Math.min(n*2,60);
 plot('flower',k,10,19,16).forEach(({wx,wy,i})=>{
  const a=IX(wx,wy),b=IY(wx,wy);
  X.fillStyle='rgba(12,32,24,.14)';
  X.beginPath();X.ellipse(a,b+1,4.5,4.5*IZ,0,0,7);X.fill();
  X.strokeStyle=DK()?'#2E8A58':'#3A8A50';X.lineWidth=1.5;
  const sw=Math.sin(ph+i)*1.4;
  X.beginPath();X.moveTo(a,b);X.lineTo(a+sw,b-10);X.stroke();
  const fx2=a+sw,c=FCL[i%6];
  for(let m=0;m<5;m++){const ang=m*1.257;X.fillStyle=c;
   X.beginPath();X.ellipse(fx2+Math.cos(ang)*3.2,b-13+Math.sin(ang)*3.2*IZ,2.6,2,ang,0,7);X.fill()}
  X.fillStyle='#FFF3C4';X.beginPath();X.arc(fx2,b-13,1.6,0,7);X.fill()})};

DRAW.path=(x,y,n)=>{const k=Math.min(n,DCAP);
 const [cx,cy]=SPOT.path;
 const pts=[];
 for(let i=0;i<k;i++){const wx=cx-78+i*5.4,wy=cy+Math.sin(i*.42)*13;pts.push({wx,wy})}
 pts.sort((p,q)=>(p.wx+p.wy)-(q.wx+q.wy)).forEach(({wx,wy},i)=>{
  const a=IX(wx,wy),b=IY(wx,wy);
  X.fillStyle='rgba(12,32,24,.13)';
  X.beginPath();X.ellipse(a,b+2,7.5,7.5*IZ,-.42,0,7);X.fill();
  X.fillStyle=lit(a,b,14,DK()?'#5E7068':'#EBE1C6',DK()?'#3A4A44':'#C6BA9C');
  X.beginPath();X.ellipse(a,b,7,7*IZ,-.42+Math.sin(i)*.2,0,7);X.fill()})};

DRAW.fruit=(x,y,n)=>{const k=Math.min(Math.ceil(n*8/DCAP),8);
 plot('fruit',k,4,44,32).forEach(({wx,wy})=>{
  const a=IX(wx,wy),b=IY(wx,wy),s=.72+Math.min(n,DCAP)/DCAP*.32;
  shadow(a,b,12,4.4);
  trunk(a,b,4*s,20*s,DK()?'#7E5A38':'#A87C4E',DK()?'#4A3220':'#6B4A2A');
  canopy(a-9*s,b-23*s,10*s,DK()?'#3E9E6E':'#5CBE86',DK()?'#1A5C38':'#2C7A4C');
  canopy(a+9*s,b-23*s,10*s,DK()?'#3E9E6E':'#5CBE86',DK()?'#1A5C38':'#2C7A4C');
  canopy(a,b-30*s,14*s,DK()?'#4FB37C':'#6FD49A',DK()?'#1E6B42':'#338354');
  [[-8,-32],[7,-28],[0,-24],[-3,-35]].forEach(([px,q])=>{
   X.fillStyle='#E0566E';X.beginPath();X.arc(a+px*s,b+q*s,3*s,0,7);X.fill();
   X.fillStyle='rgba(255,255,255,.4)';X.beginPath();X.arc(a+px*s-1,b+q*s-1,1,0,7);X.fill()})})};

DRAW.spring=(x,y,n)=>{if(!n)return;const s=.62+Math.min(n,DCAP)/DCAP*.42;shadow(x,y,24*s,7*s,.14);
 X.fillStyle=lit(x,y,52*s,DK()?'#7E948C':'#B4C4BC',DK()?'#43605A':'#84968C');
 X.beginPath();X.ellipse(x,y,26*s,10*s,0,0,7);X.fill();
 const g=X.createRadialGradient(x-6*s,y-4,2,x,y-2,20*s);
 g.addColorStop(0,DK()?'#8FDCF5':'#B8ECFC');g.addColorStop(1,DK()?'#2E7A9E':'#4E9EC4');
 X.fillStyle=g;X.beginPath();X.ellipse(x,y-2,20*s,7.5*s,0,0,7);X.fill();
 for(let k=0;k<3;k++){const rr=(4+((ph*16+k*11)%18))*s;
  X.strokeStyle=`rgba(230,250,255,${(1-rr/(23*s))*.55})`;X.lineWidth=1.1;
  X.beginPath();X.ellipse(x,y-2,rr,rr*.38,0,0,7);X.stroke()}};

DRAW.lamp=(x,y,n)=>{const k=Math.min(n,DCAP);
 plot('lamp',k,10,22,24,false,-10,26).forEach(({wx,wy,i})=>{
  const a=IX(wx,wy),b=IY(wx,wy);
  shadow(a,b,5,2);
  trunk(a,b,2.6,27,DK()?'#8E A49C'.replace(' ',''):'#B4C0B8',DK()?'#3A4A44':'#7E8C84');
  X.save();X.globalAlpha=.26+Math.sin(ph*1.5+i)*.1;
  const g=X.createRadialGradient(a,b-32,0,a,b-32,26);
  g.addColorStop(0,'#FFE9A8');g.addColorStop(1,'rgba(255,233,168,0)');
  X.fillStyle=g;X.beginPath();X.arc(a,b-32,26,0,7);X.fill();X.restore();
  X.fillStyle=DK()?'#8E7028':'#A08442';X.beginPath();
  X.moveTo(a-6,b-29);X.lineTo(a+6,b-29);X.lineTo(a+4,b-37);X.lineTo(a-4,b-37);X.closePath();X.fill();
  X.fillStyle='#FFF3C4';X.beginPath();X.arc(a,b-33,3.8,0,7);X.fill()})};

DRAW.well=(x,y,n)=>{if(!n)return;const s=.62+Math.min(n,DCAP)/DCAP*.4;shadow(x,y,18*s,5*s);
 X.fillStyle=lit(x,y,40*s,DK()?'#8E9E96':'#C4CEC4',DK()?'#4E625C':'#8E9C92');
 X.fillRect(x-20*s,y-19*s,40*s,19*s);
 for(let r=0;r<2;r++)for(let c=0;c<4;c++){X.strokeStyle='rgba(0,0,0,.13)';X.lineWidth=1;
  X.strokeRect(x-20*s+c*10*s+(r%2?5*s:0),y-19*s+r*9.5*s,10*s,9.5*s)}
 X.fillStyle=DK()?'#08201C':'#2E4A3E';X.beginPath();X.ellipse(x,y-19*s,20*s,5.6*s,0,0,7);X.fill();
 X.fillStyle=DK()?'#3E90BF':'#5FAEC9';X.beginPath();X.ellipse(x,y-18*s,15*s,4*s,0,0,7);X.fill();
 X.strokeStyle=DK()?'#A0764C':'#C89A5E';X.lineWidth=4*s;
 X.beginPath();X.moveTo(x-15*s,y-19*s);X.lineTo(x-15*s,y-38*s);
 X.lineTo(x+15*s,y-38*s);X.lineTo(x+15*s,y-19*s);X.stroke();
 X.strokeStyle=DK()?'#5E4530':'#7A5A3A';X.lineWidth=2.4*s;
 X.beginPath();X.moveTo(x-15*s,y-38*s);X.lineTo(x,y-46*s);X.lineTo(x+15*s,y-38*s);X.stroke()};

DRAW.crescent=(x,y,n)=>{if(!n)return;const s=.55+Math.min(n,DCAP)/DCAP*.6;X.save();
 X.globalAlpha=.4;const g=X.createRadialGradient(x,y,0,x,y,50*s);
 g.addColorStop(0,'rgba(255,243,196,.55)');g.addColorStop(1,'rgba(255,243,196,0)');
 X.fillStyle=g;X.beginPath();X.arc(x,y,50*s,0,7);X.fill();X.globalAlpha=1;
 /* الهلال دائرتان بقاعدة evenodd — لا محوَ ما تحته.
    destination-out كان يثقب الأرض ثقبًا شفّافًا لا يرسم هلالًا. */
 X.fillStyle='#FBEFC0';X.beginPath();
 X.arc(x,y,17*s,0,7);X.arc(x+7*s,y-4*s,15*s,0,7);
 X.fill('evenodd');
 X.strokeStyle=OUT();X.lineWidth=1.1/ZOOM;X.lineJoin='round';X.stroke();
 X.restore()};

DRAW.shieldL=(x,y,n)=>{if(!n)return;const s=.6+Math.min(n,DCAP)/DCAP*.55;X.save();
 X.globalAlpha=(.2+Math.min(n,DCAP)/DCAP*.2)+Math.sin(ph)*.07;
 const g=X.createLinearGradient(x,y-40*s,x,y+10*s);
 g.addColorStop(0,DK()?'#8FD3C8':'#6BBFB2');g.addColorStop(1,'rgba(107,191,178,.08)');
 X.fillStyle=g;X.beginPath();X.moveTo(x,y-42*s);X.lineTo(x+24*s,y-30*s);X.lineTo(x+24*s,y-11*s);
 X.quadraticCurveTo(x,y+9*s,x-24*s,y-11*s);X.lineTo(x-24*s,y-30*s);X.closePath();X.fill();
 X.globalAlpha=.55;X.strokeStyle=DK()?'#A8E4DA':'#8FD3C8';X.lineWidth=2.2;X.stroke();X.restore()};

/* سياج النور: يحيط بالبستان داخل السور */
DRAW.fence=(x,y,n)=>{if(!n)return;const k=Math.min(n,DCAP);X.save();
 X.globalAlpha=.22+Math.min(k,30)/30*.18+Math.sin(ph*1.2)*.06;
 X.strokeStyle=DK()?'#8FD3C8':'#6BBFB2';X.lineWidth=2.4;X.lineCap='round';
 const raw=[],x0=IN.x+8,y0=IN.y+8,x1=IN.x+IN.w-8,y1=IN.y+IN.h-8;
 for(let i=0;i<10;i++)raw.push([x0+(x1-x0)*i/9,y0]);
 for(let i=1;i<6;i++)raw.push([x1,y0+(y1-y0)*i/5]);
 for(let i=8;i>=0;i--)raw.push([x0+(x1-x0)*i/9,y1]);
 for(let i=4;i>=1;i--)raw.push([x0,y0+(y1-y0)*i/5]);
 const per=raw.map(([a,b])=>[IX(a,b),IY(a,b)]);
 const show=Math.min(per.length,Math.round(per.length*k/30));
 for(let i=0;i<show;i++){const[a,b]=per[i];
  X.beginPath();X.moveTo(a,b);X.lineTo(a,b-18);X.stroke();
  X.beginPath();X.arc(a,b-21,2,0,7);X.stroke()}
 X.restore()};

/* أداة تحقّق: بصمة بناءٍ على الشاشة عند يوم معيّن.
   بها يُقاس تباعد المجموعات وخلوصها من السور — §١٢. */
/* يرسم بناءً في سياقٍ خارجيّ — للقياس والاختبار وحدهما */
export function drawInto(ctx, nm, n) {
  const prev = X; X = ctx;
  const [a, b] = SPOT[nm];
  try { DRAW[nm](IX(a, b), IY(a, b), n === undefined ? DAYS_TOTAL : n); } finally { X = prev; }
}

export function buildBox(nm, n) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  drawInto(c.getContext("2d"), nm, n);
  const d = c.getContext("2d").getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    if (d[(yy * W + xx) * 4 + 3] > 14) {
      if (xx < x0) x0 = xx; if (xx > x1) x1 = xx;
      if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/* مواضع داخل الأرض المحدودة */
/* مواضع الأبنية — محسوبة من مقاس كل بناء عند اليوم ٣٠ بلا تداخل.
   لا تُحرَّك يدويًا: أعد تشغيل مخطّط المواضع بعد أي تغيير في الرسّامين. */
export const SPOT={
 fort:[0,0],
 fence:[0,0],
 stream:[540,357],
 house:[807,153],
 mihrab:[328,194],
 minaret:[146,218],
 dome:[597,472],
 nur:[356,462],
 gate:[466,197],
 sundial:[607,198],
 rug:[760,284],
 pattern:[328,242],
 palm:[183,728],
 garden:[889,518],
 fountain:[208,532],
 arak:[390,610],
 bighouse:[923,647],
 bridge:[532,366],
 tent:[876,742],
 flower:[660,748],
 path:[397,635],
 fruit:[392,725],
 spring:[696,469],
 lamp:[700,642],
 well:[219,289],
 crescent:[962,98],
 shieldL:[110,111]};

/* ما يستلقي على الأرض لا يصدّ اللاعب — يمشي عليه. وما يقف يصدّه. */
const FLAT = { path:1, pattern:1, fence:1, rug:1, stream:1, fort:1 };

/* ما يترنّح مع الريح — النبات القائم وحده، لا ما يغطّي الأرض */
const SWAY = { palm:1, arak:1, fruit:1, flower:1, garden:1 };
const BACK   = ["fort","fence","stream","crescent","shieldL","pattern","path"];
const SORTED = ["minaret","gate","mihrab","sundial","house","nur","rug","bridge","fruit",
                "well","palm","arak","garden","spring","lamp","bighouse","fountain","tent","flower"];

/* ════════ لوحة البيت الدمشقي ════════
   حجر كلسيّ فاتح ومداميك أغمق منه قليلًا — الأبلق في العمارة تباينٌ في
   المداميك لا رقعة شطرنج. والرخام للبحرة وحافّات القنوات.               */
const PAL = {
  light: { sand:"#CFCCC0", sandDot:"#B4B1A4",
           stone:"#F0E4C4", band:"#DCC79E", joint:"rgba(116,90,50,.22)",
           edge:"rgba(96,74,42,.42)",
           marble:"#FBF5E4", water:"#5FD0F5", waterD:"#2E96D4",
           curb:"#E8D9AE", curbSh:"rgba(78,60,34,.28)",
           bedIn:"#5FC45E", bedTx:"rgba(28,96,48,.10)", gold:"#E8B22C" },
  dark:  { sand:"#0A1815", sandDot:"#1A2E28",
           stone:"#42433C", band:"#383931", joint:"rgba(0,0,0,.26)",
           edge:"rgba(0,0,0,.42)",
           marble:"#565749", water:"#4E93B0", waterD:"#2E6B8E",
           curb:"#4A4B41", curbSh:"rgba(0,0,0,.34)",
           bedIn:"#1B453B", bedTx:"rgba(0,0,0,.10)", gold:"#D4B570" },
};
const RAWPAL = () => (DK() ? PAL.dark : PAL.light);
const PALC = { calm: null, game: null, k: null };
const pal = () => {
  const key = DK() ? "d" : "l";
  if (PALC.k === key) return PALC.v;
  const raw = RAWPAL(), out = {};
  Object.keys(raw).forEach((n) => (out[n] = sat(raw[n])));
  PALC.k = key; PALC.v = out;
  return out;
};

/* نجمة ثمانية = مربّعان متراكبان بزاوية ٤٥° — «رُبع الحزب» */
function star8(cx, cy, r, rot) {
  X.beginPath();
  for (let k = 0; k < 2; k++) {
    const a0 = (rot || 0) + k * Math.PI / 4;
    for (let i = 0; i < 4; i++) {
      const a = a0 + i * Math.PI / 2, px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      i ? X.lineTo(px, py) : X.moveTo(px, py);
    }
    X.closePath();
  }
}

/* ممرّ مرصوف: بلاط كلسيّ بفواصل رفيعة، وشريطا مدماك أغمق على الحافّتين */
function paveWalk(x, y, w, h, horiz) {
  const p = pal(), unit = 27, band = 7;
  X.save();
  X.beginPath(); X.rect(x, y, w, h); X.clip();
  X.fillStyle = p.stone; X.fillRect(x, y, w, h);

  /* شريطا الحافّة — هما ما يعطي إحساس الأبلق بلا صخب */
  X.fillStyle = p.band;
  if (horiz) { X.fillRect(x, y, w, band); X.fillRect(x, y + h - band, w, band); }
  else { X.fillRect(x, y, band, h); X.fillRect(x + w - band, y, band, h); }

  /* فواصل البلاط */
  X.strokeStyle = p.joint; X.lineWidth = 1;
  const span = horiz ? w : h, thick = horiz ? h : w;
  for (let i = 0; i * unit <= span; i++) {
    X.beginPath();
    if (horiz) { X.moveTo(x + i * unit, y); X.lineTo(x + i * unit, y + h); }
    else { X.moveTo(x, y + i * unit); X.lineTo(x + w, y + i * unit); }
    X.stroke();
  }
  for (let j = 1; j * unit < thick; j++) {
    X.beginPath();
    if (horiz) { X.moveTo(x, y + j * unit); X.lineTo(x + w, y + j * unit); }
    else { X.moveTo(x + j * unit, y); X.lineTo(x + j * unit, y + h); }
    X.stroke();
  }
  X.restore();

  /* خطّ الحدّ */
  X.strokeStyle = p.edge; X.lineWidth = 1.2; X.strokeRect(x + .5, y + .5, w - 1, h - 1);
}

/* قناة ماء بحافّة رخامية */
function rill(x, y, w, h, horiz) {
  const p = pal();
  X.fillStyle = p.marble; X.fillRect(x - 5, y - 5, w + 10, h + 10);
  X.strokeStyle = p.edge; X.lineWidth = 1; X.strokeRect(x - 5.5, y - 5.5, w + 11, h + 11);
  const g = horiz ? X.createLinearGradient(0, y, 0, y + h) : X.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, p.waterD); g.addColorStop(.4, p.water); g.addColorStop(1, p.waterD);
  X.fillStyle = g; X.fillRect(x, y, w, h);
  X.strokeStyle = "rgba(255,255,255,.2)"; X.lineWidth = 1;
  const span = horiz ? w : h;
  for (let i = 14; i < span; i += 34) {
    X.beginPath();
    if (horiz) { X.moveTo(x + i, y + 1.5); X.lineTo(x + i + 6, y + h - 1.5); }
    else { X.moveTo(x + 1.5, y + i); X.lineTo(x + w - 1.5, y + i + 6); }
    X.stroke();
  }
}

/* حوض مزروع: أرض أعمق قليلًا بحافّة حجرية وظلّ تحتها */
function parterre(x, y, w, h) {
  const p = pal();
  X.fillStyle = p.bedIn; X.fillRect(x, y, w, h);
  X.save(); X.beginPath(); X.rect(x, y, w, h); X.clip();
  X.fillStyle = p.bedTx;
  for (let i = 0; i < 90; i++) {
    const a = x + ((i * 149) % w), b = y + ((i * 227) % h);
    X.beginPath(); X.ellipse(a, b, 16 + ((i * 13) % 20), 9, 0, 0, 7); X.fill();
  }
  X.restore();
  X.strokeStyle = p.curbSh; X.lineWidth = 6; X.strokeRect(x + 1, y + 2, w - 2, h - 2);
  X.strokeStyle = p.curb;   X.lineWidth = 5; X.strokeRect(x, y, w, h);
  X.strokeStyle = p.edge;   X.lineWidth = 1; X.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
}

function ground() {
  const dk = DK(), p = pal();

  /* خارج الحدود — أرض قاحلة تملأ اللوحة، فتُرسم قبل التحويل */
  X.setTransform(1, 0, 0, 1, 0, 0);
  X.fillStyle = p.sand; X.fillRect(0, 0, W, H);
  for (let i = 0; i < 200; i++) {
    X.globalAlpha = 0.06; X.fillStyle = p.sandDot;
    X.beginPath(); X.arc((i * 173) % W, (i * 281) % H, 4 + ((i * 7) % 9), 0, 7); X.fill();
  }
  X.globalAlpha = 1;

  /* من هنا: كل ما يستلقي على الأرض يُسقَط إيزومتريًا */
  X.setTransform(IK, IK * IZ, -IK, IK * IZ, IOX, IOY);

  /* داخل الحدود — أرض البستان */
  const g = X.createRadialGradient(535, 420, 60, 535, 420, IN.w * .72);
  if (dk) { g.addColorStop(0, "#1E6E4C"); g.addColorStop(.55, "#14543C"); g.addColorStop(1, "#0B3226"); }
  else    { g.addColorStop(0, "#8FE07F"); g.addColorStop(.55, "#66C95E"); g.addColorStop(1, "#3E9E46"); }
  X.fillStyle = g; X.fillRect(IN.x, IN.y, IN.w, IN.h);

  /* ثلاث طبقات من التبقّع بمقاييس مختلفة — العشب المسطّح هو ما يجعل
     المشهد يبدو فقيرًا، والتنوّع اللونيّ وحده يملؤه بلا شيء يُرسم فوقه. */
  const rnd = (i, m) => ((i * 9301 + 49297) % 233280) / 233280 * m;
  [[150, 40, .13], [95, 78, .10], [60, 130, .08]].forEach(([cnt, sz, al], L) => {
    for (let i = 0; i < cnt; i++) {
      const a = IN.x + rnd(i + L * 7, IN.w), b = IN.y + rnd(i * 3 + L * 13, IN.h);
      X.globalAlpha = al;
      X.fillStyle = (i + L) % 3 === 0 ? (dk ? "#2E6B58" : "#C2E9C6")
                  : (i + L) % 3 === 1 ? (dk ? "#0E2A22" : "#54925F")
                                      : (dk ? "#1E5244" : "#8FCB94");
      X.beginPath();
      X.ellipse(a, b, sz * (.5 + rnd(i * 5, .9)), sz * .5 * (.5 + rnd(i * 7, .8)),
                rnd(i, 3), 0, 7);
      X.fill();
    }
  });
  X.globalAlpha = 1;

  /* بقعُ ترابٍ عارية — تكسر رتابة الأخضر */
  for (let i = 0; i < 11; i++) {
    const a = IN.x + rnd(i + 91, IN.w), b = IN.y + rnd(i * 3 + 41, IN.h);
    X.globalAlpha = .24; X.fillStyle = dk ? "#3A3020" : "#C8B893";
    X.beginPath();
    X.ellipse(a, b, 30 + rnd(i, 36), (30 + rnd(i, 36)) * .5, rnd(i, 3), 0, 7); X.fill();
  }
  X.globalAlpha = 1;

  /* نتفُ عشبٍ قائمة — أدقّ تفصيل، وأكثره أثرًا في كثافة المشهد */
  for (let i = 0; i < 150; i++) {
    const a = IN.x + rnd(i + 3, IN.w), b = IN.y + rnd(i * 7 + 5, IN.h);
    X.strokeStyle = dk ? "rgba(86,168,132,.52)" : "rgba(56,124,74,.46)";
    X.lineWidth = 2.6; X.lineCap = "round";
    X.beginPath();
    for (let f = -1; f <= 1; f++) {
      X.moveTo(a + f * 3.4, b);
      X.quadraticCurveTo(a + f * 5.8, b - 5, a + f * 7.6 + f * 1.6, b - 11);
    }
    X.stroke();
  }

  /* حصى متناثر بظلٍّ خفيف */
  for (let i = 0; i < 16; i++) {
    const a = IN.x + rnd(i + 55, IN.w), b = IN.y + rnd(i * 5 + 17, IN.h);
    const r = 4.4 + rnd(i, 5);
    X.fillStyle = "rgba(20,35,30,.16)";
    X.beginPath(); X.ellipse(a + 1, b + 1.5, r * 1.1, r * .6, 0, 0, 7); X.fill();
    X.fillStyle = dk ? "#4A5A52" : "#B9B49E";
    X.beginPath(); X.ellipse(a, b, r, r * .7, rnd(i, 3), 0, 7); X.fill();
    X.fillStyle = dk ? "#5E6E66" : "#D2CCB4";
    X.beginPath(); X.ellipse(a - r * .25, b - r * .22, r * .5, r * .3, 0, 0, 7); X.fill();
  }

  /* ── الرواق: ممرّ مرصوف يطوف بالصحن ── */
  const rx = IN.x + 12, ry = IN.y + 12, rw = IN.w - 24, rh = IN.h - 24, RB = 32;
  paveWalk(rx, ry, rw, RB, true);
  paveWalk(rx, ry + rh - RB, rw, RB, true);
  paveWalk(rx, ry + RB, RB, rh - RB * 2, false);
  paveWalk(rx + rw - RB, ry + RB, RB, rh - RB * 2, false);

  /* ── الأرباع الأربعة: أحواض مزروعة ── */
  const BX0 = rx + RB + 10, BX1 = 508, BX2 = 562, BX3 = rx + rw - RB - 10;
  const BY0 = ry + RB + 10, BY1 = 391, BY2 = 449, BY3 = ry + rh - RB - 10;
  parterre(BX0, BY0, BX1 - BX0 - 6, BY1 - BY0);
  parterre(BX2 + 6, BY0, BX3 - BX2 - 6, BY1 - BY0);
  parterre(BX0, BY2, BX1 - BX0 - 6, BY3 - BY2);
  parterre(BX2 + 6, BY2, BX3 - BX2 - 6, BY3 - BY2);

  /* ── المحور الشمالي-الجنوبي: ممرّ يعبر النهر على الجسر ── */
  const NSX = 508, NSW = 54;
  paveWalk(NSX, ry, NSW, 322 - ry, false);        /* شمال النهر */
  paveWalk(NSX, 392, NSW, ry + rh - 392, false);  /* جنوبه */

  /* ── المحور الشرقي-الغربي: ممرّ فيه قناة ماء ── */
  const EWY = 393, EWH = 54;
  paveWalk(rx, EWY, rw, EWH, true);
  rill(rx + 10, EWY + 21, 470 - rx - 10, 12, true);        /* غرب المسجد */
  rill(600, EWY + 21, rx + rw - 10 - 600, 12, true);       /* شرقه */

  /* ── التقاطع: نجمة ثمانية مطعّمة في البلاط، والمسجد يقوم عليها ── */
  {
    const mx = IX(535, 420), my = IY(535, 420);
    X.save();
    X.fillStyle = p.marble;
    X.beginPath();
    [[-58,-58],[58,-58],[58,58],[-58,58]].forEach(([u,v],i)=>{
      const q=[IX(535+u,420+v),IY(535+u,420+v)]; i?X.lineTo(q[0],q[1]):X.moveTo(q[0],q[1]);
    });
    X.closePath(); X.fill();
    X.strokeStyle = p.edge; X.lineWidth = 1.4; X.stroke();
    X.globalAlpha = .5; X.strokeStyle = p.gold; X.lineWidth = 2.2;
    star8(mx, my, 30, 0); X.stroke();
    X.globalAlpha = .28; X.fillStyle = p.gold;
    star8(mx, my, 15, 0); X.fill();
    X.restore();
  }



  /* ── الحدّ الذهبي المتقطّع — §٥: يبيّن المساحة كاملة من اليوم الأول ── */
  X.save(); X.setLineDash([9, 7]); X.lineWidth = 3.2;
  X.strokeStyle = TIERC;  X.globalAlpha = .55;
  X.strokeRect(IN.x - 14, IN.y - 14, IN.w + 28, IN.h + 28);
  X.globalAlpha = 1; X.restore();

  /* ── ما يقف على الأرض من زينة: يُرفع التحويل ويُرسم منتصبًا عند موضعه ──
     كلّه في صورة الأرض المخزّنة، فلا يكلّف إطارًا واحدًا من الحركة. */
  X.setTransform(1, 0, 0, 1, 0, 0);
  const QUAD = [[BX0, BY0, BX1, BY1], [BX2, BY0, BX3, BY1],
                [BX0, BY2, BX1, BY3], [BX2, BY2, BX3, BY3]];
  const busy = Object.keys(SPOT).map((nm) => SPOT[nm]);
  const clear = (a, b) => busy.every(([u, v]) => Math.hypot(a - u, b - v) > 96);
  let seed = 7;
  const rr = (m) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 * m; };
  for (let i = 0; i < 62; i++) {
    const q = QUAD[i % 4];
    const a = q[0] + 16 + rr(q[2] - q[0] - 32), b = q[1] + 16 + rr(q[3] - q[1] - 32);
    if (!clear(a, b)) continue;
    const px = IX(a, b), py = IY(a, b), kind = i % 5;
    if (kind < 3) {                                   /* شجيرة */
      const r = 5 + rr(4);
      X.fillStyle = "rgba(12,32,24,.22)";
      X.beginPath(); X.ellipse(px + 1, py + 2, r * 1.1, r * .55, 0, 0, 7); X.fill();
      const cg = X.createLinearGradient(px - r, py - r, px + r * .6, py + r * .7);
      cg.addColorStop(0, sat(dk ? "#3E9E6E" : "#6FCB86"));
      cg.addColorStop(1, sat(dk ? "#17513A" : "#2E7A4A"));
      X.fillStyle = cg;
      X.beginPath(); X.ellipse(px, py - r * .55, r, r * .82, 0, 0, 7); X.fill(); edge(1.1);
    } else {                                          /* صخرة */
      const r = 4 + rr(5);
      X.fillStyle = "rgba(12,32,24,.22)";
      X.beginPath(); X.ellipse(px + 1, py + 2, r * 1.2, r * .6, 0, 0, 7); X.fill();
      X.fillStyle = sat(dk ? "#48584F" : "#B5B098");
      X.beginPath(); X.ellipse(px, py - r * .3, r, r * .72, rr(3), 0, 7); X.fill(); edge(1);
      X.fillStyle = "rgba(255,255,255,.28)";
      X.beginPath(); X.ellipse(px - r * .3, py - r * .55, r * .42, r * .26, 0, 0, 7); X.fill();
    }
  }
}

/* ════════ ذاكرة الأبنية الساكنة ════════
   السور والبيوت لا يتحرّك فيهما شيء، لكن حدودهما وحدها مئات المسارات
   المرسومة في كل إطار. تُرسم مرّة في صورة، وتُنسخ بعدها — ولا تُعاد إلا
   إذا تغيّر عددها أو الثيم أو الطابع. */
const SPR = {};
const CACHED = { fort: 1, house: 1 };
function drawCached(nm, px, py, n) {
  const key = n + "|" + (DK() ? 1 : 0);
  let c = SPR[nm];
  if (!c || c.key !== key) {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const prev = X; X = cv.getContext("2d");
    try { DRAW[nm](px, py, n); } finally { X = prev; }
    c = SPR[nm] = { key, cv };
  }
  X.drawImage(c.cv, 0, 0);
}

/* ════════ ما تفتحه المراتب — يُرسم فوق الأرض كل إطار ════════ */
const RN = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;

/* نجومٌ تتلألأ وشُهبٌ تعبر — أوّل ما يُرسم فوق الأرض */
function perkStars() {
  X.save();
  X.fillStyle = DK() ? "rgba(10,20,34,.22)" : "rgba(26,38,84,.15)";
  X.fillRect(0, 0, W, H);
  /* دربٌ لبنيّ خافت يعبر السماء */
  X.globalAlpha = .10;
  const mw = X.createLinearGradient(0, 40, W, 250);
  mw.addColorStop(0, "rgba(180,200,255,0)"); mw.addColorStop(.5, "rgba(196,214,255,.9)");
  mw.addColorStop(1, "rgba(180,200,255,0)");
  X.fillStyle = mw;
  X.beginPath(); X.moveTo(0, 60); X.lineTo(W, 210); X.lineTo(W, 300); X.lineTo(0, 150);
  X.closePath(); X.fill();
  X.globalAlpha = 1;
  for (let i = 0; i < 120; i++) {
    const a = RN(i) * W, b = RN(i + 90) * H * .76;
    const tw = .3 + Math.abs(Math.sin(ph * (1 + RN(i + 5)) + i)) * .7;
    const r = 1.2 + RN(i + 7) * 2.6;
    X.globalAlpha = tw * .95;
    X.fillStyle = i % 7 === 0 ? "#CFE0FF" : i % 5 === 0 ? "#FFE7C0" : "#FFFAE8";
    X.beginPath(); X.arc(a, b, r, 0, 7); X.fill();
    if (r > 2.5) {
      X.globalAlpha = tw * .6; X.lineWidth = 1.1; X.strokeStyle = X.fillStyle;
      X.beginPath();
      X.moveTo(a - r * 3, b); X.lineTo(a + r * 3, b);
      X.moveTo(a, b - r * 3); X.lineTo(a, b + r * 3); X.stroke();
    }
  }
  /* شهابان يعبران بين حينٍ وآخر */
  for (let k = 0; k < 2; k++) {
    const cyc = (ph * .18 + k * .5) % 2.2;
    if (cyc > 1) continue;
    const t = cyc;
    const sx = 120 + k * 520 + t * 300, sy = 40 + k * 90 + t * 150;
    X.globalAlpha = Math.sin(Math.PI * t) * .95;
    const sg = X.createLinearGradient(sx - 66, sy - 34, sx, sy);
    sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(1, "#FFFFFF");
    X.strokeStyle = sg; X.lineWidth = 2.4; X.lineCap = "round";
    X.beginPath(); X.moveTo(sx - 66, sy - 34); X.lineTo(sx, sy); X.stroke();
    X.fillStyle = "#FFFFFF";
    X.beginPath(); X.arc(sx, sy, 2.2, 0, 7); X.fill();
  }
  X.restore();
}

/* فوانيس على الممرّات والرواق: جسمٌ زجاجيّ وبِركةُ ضوءٍ تحته */
function perkLanterns() {
  const spots = [];
  for (let i = 0; i < 6; i++) { const t = 120 + i * 160; spots.push([t, 372], [t, 468]); }
  for (let i = 0; i < 4; i++) { const t = 130 + i * 170; spots.push([486, t], [584, t]); }
  const rx0 = IN.x + 30, ry0 = IN.y + 30, rx1 = IN.x + IN.w - 30, ry1 = IN.y + IN.h - 30;
  for (let i = 0; i < 6; i++) {
    const u = i / 5;
    spots.push([rx0 + (rx1 - rx0) * u, ry0], [rx0 + (rx1 - rx0) * u, ry1]);
  }
  for (let i = 1; i < 5; i++) {
    const u = i / 5;
    spots.push([rx0, ry0 + (ry1 - ry0) * u], [rx1, ry0 + (ry1 - ry0) * u]);
  }
  spots.forEach(([wx, wy], i) => {
    const px = IX(wx, wy), py = IY(wx, wy);
    const fl = .76 + Math.sin(ph * 2.1 + i * 1.3) * .2;
    /* بِركة الضوء على الأرض */
    X.save(); X.globalAlpha = fl * .34;
    const lg = X.createRadialGradient(px, py, 1, px, py, 30);
    lg.addColorStop(0, "#FFD98A"); lg.addColorStop(1, "rgba(255,217,138,0)");
    X.fillStyle = lg; X.beginPath(); X.ellipse(px, py, 30, 30 * IZ * .62, 0, 0, 7); X.fill();
    X.restore();
    shadow(px, py, 4, 2, .18);
    /* العمود وذراعه */
    X.strokeStyle = DK() ? "#2E3A34" : "#5A5244"; X.lineWidth = 2.6; X.lineCap = "round";
    X.beginPath(); X.moveTo(px, py); X.lineTo(px, py - 26); X.stroke();
    X.lineWidth = 2; X.beginPath();
    X.moveTo(px, py - 26); X.quadraticCurveTo(px + 4, py - 31, px + 7, py - 30); X.stroke();
    /* هالة */
    X.save(); X.globalAlpha = fl * .55;
    const g2 = X.createRadialGradient(px + 7, py - 24, 0, px + 7, py - 24, 20);
    g2.addColorStop(0, "#FFE7A8"); g2.addColorStop(1, "rgba(255,231,168,0)");
    X.fillStyle = g2; X.beginPath(); X.arc(px + 7, py - 24, 20, 0, 7); X.fill(); X.restore();
    /* الجسم الزجاجيّ */
    const bx = px + 7, by = py - 24;
    X.fillStyle = sat(DK() ? "#8E7A44" : "#B99442");
    X.beginPath(); X.ellipse(bx, by - 7.5, 3.6, 1.6, 0, 0, 7); X.fill();
    const gg = X.createLinearGradient(bx, by - 7, bx, by + 6);
    gg.addColorStop(0, "#FFF3C8"); gg.addColorStop(.5, "#FFD473"); gg.addColorStop(1, "#F0A93A");
    X.fillStyle = gg;
    X.beginPath();
    X.moveTo(bx - 3.4, by - 6); X.lineTo(bx + 3.4, by - 6);
    X.lineTo(bx + 2.4, by + 5.5); X.lineTo(bx - 2.4, by + 5.5);
    X.closePath(); X.fill(); edge(1);
    X.fillStyle = sat(DK() ? "#8E7A44" : "#B99442");
    X.beginPath(); X.ellipse(bx, by + 6, 2.8, 1.3, 0, 0, 7); X.fill();
    /* شعلةٌ في القلب */
    X.globalAlpha = fl; X.fillStyle = "#FFFBE6";
    X.beginPath(); X.ellipse(bx, by, 1.3, 2.4, 0, 0, 7); X.fill(); X.globalAlpha = 1;
  });
}

/* نافورة في البحرة: عمودٌ صاعد وأقواسٌ جانبية وقطراتٌ وحلقاتٌ تتّسع */
function perkJet() {
  const px = IX(762, 420), py = IY(762, 420);
  X.save();
  /* حوضٌ رخاميّ على مجرى القناة — البحرة حُذفت، فللنافورة حوضُها */
  const p2 = pal();
  X.fillStyle = "rgba(20,35,30,.16)";
  X.beginPath(); X.ellipse(px + 1, py + 3, 30, 30 * IZ * .62, 0, 0, 7); X.fill();
  X.fillStyle = p2.marble;
  X.beginPath(); X.ellipse(px, py, 28, 28 * IZ * .62, 0, 0, 7); X.fill(); edge(1.2);
  const wg = X.createRadialGradient(px - 6, py - 4, 2, px, py, 22);
  wg.addColorStop(0, p2.water); wg.addColorStop(1, p2.waterD);
  X.fillStyle = wg;
  X.beginPath(); X.ellipse(px, py, 21, 21 * IZ * .62, 0, 0, 7); X.fill();
  /* حلقات على سطح الماء */
  for (let r = 0; r < 4; r++) {
    const t = ((ph * .5 + r / 4) % 1);
    X.globalAlpha = (1 - t) * .42;
    X.strokeStyle = "#EAF8FF"; X.lineWidth = 2.2 - t * 1.4;
    X.beginPath();
    X.ellipse(px, py + 2, 6 + t * 30, (6 + t * 30) * IZ * .55, 0, 0, 7);
    X.stroke();
  }
  /* توهّجٌ عند القاعدة */
  X.globalAlpha = .3 + Math.sin(ph * 2) * .08;
  const bg = X.createRadialGradient(px, py, 1, px, py, 26);
  bg.addColorStop(0, "rgba(190,235,255,.7)"); bg.addColorStop(1, "rgba(190,235,255,0)");
  X.fillStyle = bg; X.beginPath(); X.ellipse(px, py, 26, 26 * IZ * .6, 0, 0, 7); X.fill();
  /* العمود الصاعد */
  X.globalAlpha = .85;
  const cg = X.createLinearGradient(0, py - 46, 0, py);
  cg.addColorStop(0, "rgba(235,250,255,0)"); cg.addColorStop(.45, "rgba(215,243,255,.9)");
  cg.addColorStop(1, "rgba(150,215,245,.95)");
  X.fillStyle = cg;
  X.beginPath();
  X.moveTo(px - 2.6, py); X.quadraticCurveTo(px - 4.4, py - 30, px, py - 46);
  X.quadraticCurveTo(px + 4.4, py - 30, px + 2.6, py); X.closePath(); X.fill();
  /* أقواسٌ تتناثر من القمّة */
  X.strokeStyle = "rgba(226,246,255,.8)"; X.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    const a2 = i * Math.PI / 4 + ph * .25;
    const dx = Math.cos(a2) * 22, dy = Math.sin(a2) * 22 * IZ * .8;
    const t = ((ph * .8 + i / 8) % 1);
    X.globalAlpha = (1 - t) * .8; X.lineWidth = 2.2 - t;
    X.beginPath();
    X.moveTo(px, py - 46);
    X.quadraticCurveTo(px + dx * .6, py - 50 - t * 4, px + dx * t, py - 46 + dy * t + t * t * 34);
    X.stroke();
  }
  /* رذاذ */
  X.fillStyle = "rgba(240,252,255,.9)";
  for (let i = 0; i < 10; i++) {
    const t = ((ph * .9 + i * .17) % 1);
    const a2 = i * 2.2;
    X.globalAlpha = (1 - t) * .75;
    X.beginPath();
    X.arc(px + Math.cos(a2) * 26 * t, py - 46 + Math.sin(a2) * 8 + t * t * 44, 1.8 - t, 0, 7);
    X.fill();
  }
  X.restore();
}

/* رايات ترفرف على السور — تطوف بالمحيط كلّه لا بزاويةٍ منه */
function perkBanners() {
  const P0 = [], x0 = IN.x + 26, y0 = IN.y + 26, x1 = IN.x + IN.w - 26, y1 = IN.y + IN.h - 26;
  for (let i = 0; i < 7; i++) P0.push([x0 + (x1 - x0) * i / 6, y0], [x0 + (x1 - x0) * i / 6, y1]);
  for (let i = 1; i < 5; i++) P0.push([x0, y0 + (y1 - y0) * i / 5], [x1, y0 + (y1 - y0) * i / 5]);
  X.save();
  P0.forEach(([wx, wy], i) => {
    const px = IX(wx, wy), py = IY(wx, wy);
    shadow(px, py, 3, 1.6, .14);
    X.strokeStyle = DK() ? "#3A4640" : "#6E6552"; X.lineWidth = 2.2; X.lineCap = "round";
    X.beginPath(); X.moveTo(px, py); X.lineTo(px, py - 30); X.stroke();
    /* القماش يتموّج بجيبٍ يتأخّر بطول الراية */
    const w = Math.sin(ph * 2.4 + i * .8);
    X.fillStyle = sat(TIERC);
    X.beginPath(); X.moveTo(px, py - 30);
    X.quadraticCurveTo(px + 8 + w * 3, py - 27 + w * 2, px + 15 + w * 4, py - 24);
    X.quadraticCurveTo(px + 8 + w * 2, py - 20 - w, px, py - 17);
    X.closePath(); X.fill(); edge(1);
    X.fillStyle = "rgba(255,255,255,.22)";
    X.beginPath(); X.moveTo(px, py - 30);
    X.quadraticCurveTo(px + 7 + w * 3, py - 27.5 + w * 2, px + 14 + w * 4, py - 25);
    X.lineTo(px + 13 + w * 4, py - 23); X.quadraticCurveTo(px + 6 + w * 2, py - 25, px, py - 27);
    X.closePath(); X.fill();
    X.fillStyle = sat(DK() ? "#C9A54A" : "#D8B45E");
    X.beginPath(); X.arc(px, py - 31.5, 2.4, 0, 7); X.fill(); edge(.9);
  });
  X.restore();
}

/* وريقاتٌ تتطاير: كلٌّ لها دورانها وميلُها، فلا تبدو نقاطًا */
function perkBlossom() {
  const C = ["#FFB7CE", "#FFD9A0", "#FFF0C4", "#F7A8C4", "#FFE2B8"];
  X.save();
  for (let i = 0; i < 54; i++) {
    const t = (ph * .14 + RN(i)) % 1;
    const wx = IN.x + RN(i + 3) * IN.w, wy = IN.y + t * IN.h;
    const sway = Math.sin(ph * 1.3 + i * .7);
    const px = IX(wx, wy) + sway * 22, py = IY(wx, wy) - 52 * (1 - t) + sway * 4;
    const fade = Math.sin(Math.PI * t);
    const spin = ph * 1.8 + i;
    const w = 4.6 + RN(i + 11) * 2.4;
    X.globalAlpha = fade * .92;
    X.fillStyle = C[i % 5];
    X.save(); X.translate(px, py); X.rotate(spin);
    /* وريقة: قوسان يلتقيان طرفيهما */
    X.beginPath();
    X.moveTo(-w, 0);
    X.quadraticCurveTo(0, -w * .78, w, 0);
    X.quadraticCurveTo(0, w * .5, -w, 0);
    X.closePath(); X.fill();
    X.globalAlpha = fade * .35; X.fillStyle = "#FFFFFF";
    X.beginPath();
    X.moveTo(-w, 0); X.quadraticCurveTo(0, -w * .72, w * .3, -w * .2);
    X.quadraticCurveTo(0, -w * .3, -w, 0); X.closePath(); X.fill();
    X.restore();
  }
  X.restore();
}

/* أسرابٌ تعبر السماء: أعماقٌ ثلاثة، وهيئةُ سهم، وطائرٌ محلّق يبسط جناحيه
   ولا يخفق — الاختلافُ هو ما يجعلها تبدو حيّة لا نسخًا مكرّرة. */
function perkBirds() {
  X.save();
  X.lineCap = "round"; X.lineJoin = "round";

  /* طائرٌ واحد: جناحان منحنيان وجسمٌ يُظهر اتّجاه الطيران */
  const bird = (x, y, w, flap, alpha) => {
    const lift = flap * w * .6;
    X.globalAlpha = alpha;
    X.lineWidth = Math.max(1.1, w * .28);
    X.strokeStyle = DK() ? "rgba(230,242,240,.95)" : "rgba(42,58,52,.88)";
    X.beginPath();
    X.moveTo(x - w, y + lift * .4);
    X.quadraticCurveTo(x - w * .44, y - lift, x, y);
    X.quadraticCurveTo(x + w * .44, y - lift, x + w, y + lift * .4);
    X.stroke();
    X.globalAlpha = alpha * .92;
    X.fillStyle = DK() ? "rgba(230,242,240,.92)" : "rgba(42,58,52,.85)";
    X.beginPath(); X.ellipse(x, y + w * .07, w * .24, w * .12, 0, 0, 7); X.fill();
  };

  /* البعيد أصغر وأخفت وأبطأ — العمق يُحسّ ولا يُرسم */
  const flocks = [
    { n: 7, w: 7.6, a: .95, sp: .105, y0: 96,  amp: 7, ph0: 0   },
    { n: 5, w: 5.4, a: .60, sp: .078, y0: 158, amp: 5, ph0: 1.7 },
    { n: 4, w: 3.8, a: .38, sp: .055, y0: 214, amp: 4, ph0: 3.1 },
  ];
  flocks.forEach((f, fi) => {
    const base = ((ph * f.sp + f.ph0 * .3) % 1.35) * (W + 420) - 210;
    for (let i = 0; i < f.n; i++) {
      const rank = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
      const x = base - rank * f.w * 4.6;
      const y = f.y0 + (i ? rank * f.w * 2.1 * side : 0)
              + Math.sin(ph * 1.05 + i * .8 + fi) * f.amp;
      bird(x, y, f.w, Math.sin(ph * (4.6 - fi * .8) + i * .9 + f.ph0), f.a);
    }
  });

  /* محلّقٌ وحده يدور في السماء بجناحين شبه ثابتين */
  const t = (ph * .035) % 1;
  bird(150 + t * (W - 300), 130 + Math.sin(t * Math.PI * 2) * 44,
       11, Math.sin(ph * .5) * .26, .88);

  X.restore();
}

function perksBack()  { if (PERKON.stars) perkStars(); if (PERKON.lantern) perkLanterns(); }
function perksFront() { if (PERKON.jet) perkJet(); if (PERKON.flag) perkBanners();
                        if (PERKON.blossom) perkBlossom(); if (PERKON.birds) perkBirds(); }

/* الأرض ثابتة لا تتغيّر — تُرسم مرّة واحدة لكل ثيم وتُنسخ كصورة كل إطار.
   بدونها نُعيد ٧٢٠ عملية رسم ستّين مرّة في الثانية على الجوال.          */
const GCACHE = { light: null, dark: null };
function groundLayer() {
  const key = DK() ? "dark" : "light";
  if (GCACHE[key]) return GCACHE[key];
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const prev = X; X = c.getContext("2d"); ground(); X = prev;
  GCACHE[key] = c;
  return c;
}

function drawPlayer(src, px, py) {
  const P = { f: src.f, mv: src.mv, x: px, y: py };
  const b = Math.sin(P.f * .24) * 2 * (P.mv ? 1 : 0);
  shadow(P.x, P.y + 2, 10, 4, .26);
  const g = X.createLinearGradient(P.x - 10, 0, P.x + 10, 0);
  g.addColorStop(0, "#FFFFFF"); g.addColorStop(1, "#D2DCE4");
  X.fillStyle = g; X.beginPath(); X.moveTo(P.x - 10, P.y); X.lineTo(P.x - 7, P.y - 27 + b);
  X.lineTo(P.x + 7, P.y - 27 + b); X.lineTo(P.x + 10, P.y); X.closePath(); X.fill();
  const hg = X.createRadialGradient(P.x - 3, P.y - 38 + b, 1, P.x, P.y - 35 + b, 9);
  hg.addColorStop(0, "#F2D8B0"); hg.addColorStop(1, "#D8B488");
  X.fillStyle = hg; X.beginPath(); X.arc(P.x, P.y - 35 + b, 8.6, 0, 7); X.fill();
  X.fillStyle = "#F7FAFC"; X.beginPath(); X.arc(P.x, P.y - 38 + b, 10, Math.PI, 0); X.fill();
  X.fillRect(P.x - 10, P.y - 39 + b, 20, 8);
  const ag = X.createLinearGradient(P.x - 10, 0, P.x + 10, 0);
  ag.addColorStop(0, "#E0C878"); ag.addColorStop(1, "#9E7C26");
  X.fillStyle = ag; X.fillRect(P.x - 10, P.y - 42 + b, 20, 4);
}

/* ════════════════════════════════════════════════════════════════════
   <Village/> — المشهد: تجوّل · سلايدر الأيام · معاينة اليوم ٣٠
   ════════════════════════════════════════════════════════════════════ */
const LS_RANK = "silla.rank.v1";

export function Village({ st, theme = "light" }) {
  useSunanVersion();
  useTiers();
  const { tally, allGems, monthGems, start, setStart, days } = st;
  const cvRef = useRef(null);
  const stageRef = useRef(null);
  const padRef = useRef(null);
  const [viewDay, setViewDay] = useState(days.length);
  const [preview, setPreview] = useState(false);
  const [full, setFull] = useState(false);       /* المشهد يملأ الشاشة */
  const fullRef = useRef(false);
  const [near, setNear] = useState(null);

  /* عند تبديل الشهر: اعرضه كاملًا */
  useEffect(() => { setViewDay(days.length); }, [days.length, start]);
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e) => { if (e.key === "Escape") { fullRef.current = false; setFull(false); } };
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [full]);

  const P = useRef({ x: 300, y: 420, s: 2.4, f: 0, mv: 0 });   /* على الممرّ، خارج الأبنية */
  const cam = useRef({ x: W / 2, y: H * .55 });
  const joy = useRef({ x: 0, y: 0 });
  const keys = useRef({});
  const dpr = useRef(1);
  const view = useRef({ cx: 0, cy: 0, vw: 0, vh: 0 });   /* آخر إطار — لترجمة اللمسة */
  const tapAt = useRef(null);
  const selRef = useRef(null);      /* ما هو مختار الآن — تقرؤه حلقة الرسم */
  const [tapped, setTapped] = useState(null);            /* البناء المفتوحة بطاقته */
  const prevN = { get current() { return LASTN.v; }, set current(v) { LASTN.v = v; } };
  const pops = useRef({});         /* ما يقفز الآن */
  const dust = useRef([]);         /* نُفَخ الغبار الحيّة */
  const lastBoom = useRef(0);
  const capRef = useRef(30);
  const solidRef = useRef([]);     /* ما لا يُمشى فوقه */

  useEffect(() => { DKMODE = theme === "dark"; }, [theme]);

  /* الأبنية تُحسب عند تغيّر السجلّ أو اليوم فقط — لا في كل إطار */
  const cap = days.length;                     /* الشهر ٢٩ أو ٣٠ يومًا */
  capRef.current = cap;

  /* المرتبة: تلوّن حدّ الأرض، ويُحتفى ببلوغ عتبةٍ جديدة */
  const rank = tierAt(allGems);
  /* معاينة مرتبة: الأرض ومكافآتها كما تكون عند بلوغها */
  const [tierPv, setTierPv] = useState(null);
  const pvT = tierPv != null ? TIERS[Math.min(tierPv, TIERS.length - 1)] : null;
  TIERC = (pvT || rank.cur).c;
  PERKON = perksAt(pvT ? pvT.g : allGems);
  MLV = tierPv != null ? tierPv : rank.i;      /* مستوى المسجد = ترتيب المرتبة */
  const stepTier = (d) => {
    const base = tierPv == null ? rank.i : tierPv;
    const n = Math.max(0, Math.min(TIERS.length - 1, base + d));
    SFX.rank(); setTierPv(n);
  };
  const [rankUp, setRankUp] = useState(null);
  const [track, setTrack] = useState(false);
  useEffect(() => {
    let seen = -1;
    try { seen = parseInt(window.localStorage.getItem(LS_RANK), 10); } catch (e) { /* تجاهل */ }
    if (!Number.isFinite(seen)) seen = -1;
    if (rank.i > seen) {
      try { window.localStorage.setItem(LS_RANK, String(rank.i)); } catch (e) { /* تجاهل */ }
      if (seen >= 0) { setRankUp(rank.cur); SFX.rank(); }
    }
  }, [rank.i]);
  /* المعاينة تُظهر الأرض عامرةً، وإلا لم يُرَ أثر المكافأة على أرضٍ خالية */
  const builds = useMemo(() => tally(viewDay, preview || tierPv != null),
                         [tally, viewDay, preview, tierPv]);
  const bRef = useRef(builds);
  useEffect(() => { bRef.current = builds; }, [builds]);

  /* مقاس اللوحة — يتبع عرض الشاشة ويحترم كثافة البكسل */
  useEffect(() => {
    const cv = cvRef.current, box = stageRef.current;
    if (!cv || !box) return;
    const fit = () => {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      const w = box.clientWidth || 470;
      /* الارتفاع من نافذة المتصفّح لا من الحاوية — الحاوية تكبر بكبر اللوحة
         فتصير حلقةً تتضخّم كل مرّة يُعاد فيها القياس. */
      const h = fullRef.current ? Math.round(window.innerHeight)
                                : Math.round(w * 0.766);
      dpr.current = d;
      cv.style.width = w + "px"; cv.style.height = h + "px";
      cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  /* لوحة المفاتيح */
  useEffect(() => {
    const dn = (e) => { keys.current[e.key] = 1; if (e.key.startsWith("Arrow")) e.preventDefault(); };
    const up = (e) => (keys.current[e.key] = 0);
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  /* الحركة */
  useEffect(() => {
    let raf;
    const move = () => {
      let vx = 0, vy = 0;
      const K = keys.current;
      if (K.ArrowRight) vx += 1; if (K.ArrowLeft) vx -= 1;
      if (K.ArrowDown) vy += 1;  if (K.ArrowUp) vy -= 1;
      vx += joy.current.x; vy += joy.current.y;
      const m = Math.hypot(vx, vy);
      P.current.mv = m > .08;
      if (P.current.mv) {
        vx /= m; vy /= m;
        const sp = P.current.s / ZOOM * .5;
        const R = 8, SD = solidRef.current;
        const hit = (x, y) => {
          for (let i = 0; i < SD.length; i++) {
            const q = SD[i];
            if (x > q[0] - R && x < q[2] + R && y > q[1] - R && y < q[3] + R) return true;
          }
          return false;
        };
        const cx2 = Math.max(IN.x - 20, Math.min(IN.x + IN.w + 20, P.current.x + vx * sp));
        const cy2 = Math.max(IN.y - 10, Math.min(IN.y + IN.h + 20, P.current.y + vy * sp));
        if (hit(P.current.x, P.current.y)) {
          /* وُجد داخل بناء (بناءٌ نشأ فوقه) — اتركه يخرج ولا تحبسه */
          P.current.x = cx2; P.current.y = cy2;
        } else {
          /* كلُّ محورٍ على حدة، فينزلق على الجدار بدل أن يقف عنده */
          if (!hit(cx2, P.current.y)) P.current.x = cx2;
          if (!hit(P.current.x, cy2)) P.current.y = cy2;
        }
        P.current.f++;
      }
      raf = requestAnimationFrame(move);
    };
    raf = requestAnimationFrame(move);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* الرسم */
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    X = cv.getContext("2d");
    let raf;
    const loop = () => {
      const t = bRef.current;
      DCAP = capRef.current;
      const d = dpr.current;
      const cw = cv.width / d, ch = cv.height / d;      /* بكسلات CSS */
      const vw = cw / ZOOM, vh = ch / ZOOM;             /* ما يُرى من الأرض */
      /* الكاميرا تتبع اللاعب في فضاء الشاشة المُسقَط لا في فضاء الأرض */
      const pjx = IX(P.current.x, P.current.y), pjy = IY(P.current.x, P.current.y);
      cam.current.x += (pjx - cam.current.x) * .11;
      cam.current.y += (pjy - cam.current.y) * .11;
      const cx = Math.max(Math.min(vw, W) / 2, Math.min(W - Math.min(vw, W) / 2, cam.current.x));
      const cy = Math.max(Math.min(vh, H) / 2, Math.min(H - Math.min(vh, H) / 2, cam.current.y));
      view.current = { cx, cy, vw, vh };
      X.setTransform(ZOOM * d, 0, 0, ZOOM * d, 0, 0);
      X.translate(-(cx - vw / 2), -(cy - vh / 2));
      X.fillStyle = DK() ? "#0A1815" : "#D8D2C0";
      X.fillRect(cx - vw / 2, cy - vh / 2, vw, vh);
      X.drawImage(groundLayer(), 0, 0);
      /* ما نما منذ الإطار السابق: يقفز وينفض غبارًا */
      const now = performance.now();
      const snap = {};
      Object.keys(SPOT).forEach((nm) => {
        const it = ITEMS.find((i) => i.i === nm);
        snap[nm] = it ? (t[it.k] || 0) : 0;
      });
      snap.dome = MLV;                 /* المسجد ينمو بالمرتبة، فيقفز عند الترقّي */
      if (prevN.current) {
        let grew = false;
        Object.keys(snap).forEach((nm) => {
          if (snap[nm] > (prevN.current[nm] || 0)) {
            pops.current[nm] = now; grew = true;
            const [a, b] = SPOT[nm];
            dust.current.push({ x: IX(a, b), y: IY(a, b), t0: now });
          }
        });
        if (grew && now - lastBoom.current > 220) { lastBoom.current = now; SFX.build(); }
      }
      prevN.current = snap;

      /* بصمات ما يصدّ اللاعب — تُقرأ من EXTENT فتتبع نموّ المجموعات */
      {
        const sd = [];
        Object.keys(SPOT).forEach((nm) => {
          if (FLAT[nm]) return;
          if (nm !== "dome" && !snap[nm]) return;      /* لم يُبنَ بعد */
          const ex = EXTENT[nm];
          if (ex) sd.push([ex.x0, ex.y0, ex.x1, ex.y1]);
          else { const [a, b] = SPOT[nm]; sd.push([a - 15, b - 11, a + 15, b + 11]); }
        });
        solidRef.current = sd;
      }

      /* قفزة النشأة: تمدّد ثم استقرار حول قاعدة البناء */
      const popAt = (nm, px, py) => {
        const t0 = pops.current[nm];
        if (!t0) return false;
        const e = (now - t0) / 560;
        if (e >= 1) { delete pops.current[nm]; return false; }
        const w = Math.sin(e * Math.PI) * (1 - e);
        X.save(); X.translate(px, py);
        X.scale(1 - w * 0.14, 1 + w * 0.26);
        X.translate(-px, -py);
        return true;
      };
      /* ترنّح خفيف في النبات — ميلٌ يزداد بالارتفاع فيبدو كأنه ريح */
      const swayAt = (nm, px, py) => {
        if (!SWAY[nm]) return false;
        const k = Math.sin(ph * 0.7 + px * 0.02) * 0.016;
        X.save(); X.translate(px, py); X.transform(1, 0, k, 1, 0, 0); X.translate(-px, -py);
        return true;
      };

      perksBack();
      BACK.forEach((nm) => {
        const it = ITEMS.find((i) => i.i === nm); if (!it) return;
        const [a, b] = SPOT[nm], px = IX(a, b), py = IY(a, b);
        const pop = popAt(nm, px, py);
        if (CACHED[nm]) drawCached(nm, px, py, t[it.k] || 0);
        else DRAW[nm](px, py, t[it.k] || 0);
        if (pop) X.restore();
      });
      /* بريقٌ يتحرّك على ماء الحوض — الأرض مخزّنة صورةً فلا حركة فيها.
         ولا حوضَ قبل فتح النافورة، فلا بريق قبلها */
      if (PERKON.jet) {
        const bg = IX(762, 420), bgy = IY(762, 420);
        X.globalAlpha = .18 + Math.sin(ph * .9) * .08;
        X.fillStyle = "#FFFFFF";
        X.beginPath();
        X.ellipse(bg - 8 + Math.sin(ph * .5) * 4, bgy - 3, 10, 10 * IZ * .7, -0.42, 0, 7);
        X.fill(); X.globalAlpha = 1;
      }

      const objs = [];
      SORTED.forEach((nm) => {
        const it = ITEMS.find((i) => i.i === nm); if (!it) return;
        const n = t[it.k] || 0; if (!n) return;
        const [a, b] = SPOT[nm], px = IX(a, b), py = IY(a, b);
        /* العمق في الإيزومتري = س+ص، وهو نفسه إحداثي الشاشة الرأسي */
        objs.push({ y: py, f: () => {
          const pop = popAt(nm, px, py), sw = swayAt(nm, px, py);
          if (CACHED[nm]) drawCached(nm, px, py, n);
          else DRAW[nm](px, py, n);
          if (sw) X.restore();
          if (pop) X.restore();
        } });
      });
      /* المسجد ليس بناءَ سنّة، فيُضاف بنفسه ويُرتَّب بعمقه كالبقيّة */
      {
        const [ax, ay] = SPOT.dome, mx = IX(ax, ay), my = IY(ax, ay);
        objs.push({ y: my, f: () => {
          const pop = popAt("dome", mx, my);
          DRAW.dome(mx, my, MLV);
          if (pop) X.restore();
        } });
      }
      objs.push({ y: pjy, f: () => drawPlayer(P.current, pjx, pjy) });
      objs.sort((m, n) => m.y - n.y).forEach((o) => o.f());

      /* إطار الاختيار: معيّنٌ ينبض على الأرض تحت ما ضُغط */
      const selNow = selRef.current;
      if (selNow && (selNow.mosque || (t[selNow.k] || 0))) {
        const ex = EXTENT[selNow.i];
        const [ax, ay] = SPOT[selNow.i];
        const x0 = ex ? ex.x0 - 26 : ax - 34, x1 = ex ? ex.x1 + 26 : ax + 34;
        const y0 = ex ? ex.y0 - 26 : ay - 34, y1 = ex ? ex.y1 + 26 : ay + 34;
        const C = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([u, v]) => [IX(u, v), IY(u, v)]);
        X.save();
        X.beginPath();
        C.forEach((q, i) => (i ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1])));
        X.closePath();
        X.fillStyle = "rgba(212,181,112,.14)"; X.fill();
        X.globalAlpha = .55 + Math.sin(ph * 2.2) * .30;
        X.strokeStyle = DK() ? "#E5CF9A" : "#B99442";
        X.lineWidth = 3 / ZOOM; X.lineJoin = "round"; X.stroke();
        /* زوايا مشدودة تزيدها وضوحًا */
        X.globalAlpha = 1; X.lineWidth = 5 / ZOOM; X.lineCap = "round";
        C.forEach((q, i) => {
          const nx = C[(i + 1) % 4], pv = C[(i + 3) % 4];
          [nx, pv].forEach((o) => {
            X.beginPath(); X.moveTo(q[0], q[1]);
            X.lineTo(q[0] + (o[0] - q[0]) * .22, q[1] + (o[1] - q[1]) * .22); X.stroke();
          });
        });
        X.restore();
      }

      perksFront();

      /* الغبار فوق الجميع، ثم يُنسى */
      dust.current = dust.current.filter((q) => {
        const e = (now - q.t0) / 620;
        if (e >= 1) return false;
        puff(q.x, q.y, e);
        return true;
      });
      X.setTransform(d, 0, 0, d, 0, 0);
      /* عمق جوّي */
      const vg = X.createRadialGradient(cw / 2, ch / 2, ch * .32, cw / 2, ch / 2, ch * .95);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, DK() ? "rgba(6,20,18,.34)" : "rgba(60,80,64,.15)");
      X.fillStyle = vg; X.fillRect(0, 0, cw, ch);
      /* أقرب بناء */
      let best = null, nd = 1e9;
      Object.keys(SPOT).forEach((nm) => {
        if (nm === "fort" || nm === "fence") return;
        const it = ITEMS.find((i) => i.i === nm); if (!it || !(t[it.k] || 0)) return;
        const [a, b] = SPOT[nm];
        const dist = Math.hypot(P.current.x - a, P.current.y - b);
        if (dist < 110 && dist < nd) { nd = dist; best = { ...it, days: t[it.k] }; }
      });
      setNear((prev) => (prev?.k === best?.k && prev?.days === best?.days ? prev : best));
      ph += .045;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* المقبض */
  const setJoy = (e) => {
    const r = padRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy), L = 24;
    if (m > L) { dx = dx / m * L; dy = dy / m * L; }
    joy.current = { x: dx / L, y: dy / L };
    const k = padRef.current.firstChild;
    k.style.left = 24 + dx + "px"; k.style.top = 24 + dy + "px";
  };
  const endJoy = () => {
    joy.current = { x: 0, y: 0 };
    const k = padRef.current?.firstChild;
    if (k) { k.style.left = "24px"; k.style.top = "24px"; }
  };

  const totalBuilt = Object.values(builds).reduce((a, b) => a + Math.min(b, DAYS_TOTAL), 0);
  const shown = days[Math.min(viewDay, days.length) - 1] || days[0];
  const isNow = iso(monthStart(today())) === iso(start);

  return (
    <div style={S.wrap} dir="rtl">
      <div style={S.head}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo />
          <div>
            <div style={S.h1}>بستان صِلة</div>
            <div style={S.sub}>{preview ? "معاينة: كل السنن ٣٠ يومًا" : "تجوّل فيما عمّرته"}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={S.stat}>
            <div style={S.statN}>{fmt(allGems)}</div>
            <div style={S.statL}>جوهرة</div>
          </div>
        </div>
      </div>

      {/* المرتبة وما بقي إلى التي بعدها */}
      <div style={{ ...S.rankRow, borderColor: rank.cur.c }}>
        <div style={{ ...S.rankB, background: rank.cur.c }}>{rank.cur.n}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.rankBar}>
            <div style={{ ...S.rankFill, width: `${Math.round(rank.p * 100)}%`,
                          background: rank.cur.c }} />
          </div>
          <div style={S.rankT}>
            {rank.next
              ? `${fmt(Math.max(0, rank.next.g - allGems))} جوهرة إلى «${rank.next.n}»`
              : "بلغتَ أعلى المراتب"}
          </div>
        </div>
        <button style={S.trackB} onClick={() => { SFX.open(); setTrack(true); }}>المسار</button>
      </div>

      {/* شريط المعاينة — أداة عرضٍ للتصميم، تُحذف عند الاعتماد */}
      {pvT && (
        <div style={{ ...S.pvBar, borderColor: pvT.c }}>
          <button style={S.pvNav} disabled={tierPv <= 0}
            onClick={() => stepTier(-1)} aria-label="المرتبة السابقة">
            <Chevron dir="right" />
          </button>
          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: pvT.c }}>
              معاينة: {pvT.n}
            </div>
            <div style={S.lbl}>
              {pvT.r ? PERKS[pvT.r].n : `لقب «${pvT.n}»`} · {fmt(pvT.g)} جوهرة
            </div>
          </div>
          <button style={S.pvNav} disabled={tierPv >= TIERS.length - 1}
            onClick={() => stepTier(1)} aria-label="المرتبة التالية">
            <Chevron dir="left" />
          </button>
          <button style={S.pvX} onClick={() => { SFX.nav(); setTierPv(null); }}>إنهاء</button>
        </div>
      )}

      {track && (
        <Track gems={allGems} previewing={tierPv}
          onClose={() => setTrack(false)}
          onPreview={(i) => { SFX.rank(); setTierPv(i); setTrack(false); }} />
      )}

      {/* شريط الشهر — البستان يتبدّل بتبدّله */}
      <MonthBar start={start} setStart={setStart} sub={`${fmt(monthGems)} جوهرة هذا الشهر`} />

      <div style={{ ...S.stage, ...(full ? S.stageFull : {}) }} ref={stageRef}>
        <button style={S.fullB} aria-label={full ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
          onClick={() => { SFX.nav(); fullRef.current = !full; setFull(!full); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
            {full ? <><path d="M9 3v6H3" /><path d="M15 21v-6h6" /><path d="M21 9h-6V3" /><path d="M3 15h6v6" /></>
                  : <><path d="M3 9V3h6" /><path d="M21 15v6h-6" /><path d="M15 3h6v6" /><path d="M9 21H3v-6" /></>}
          </svg>
        </button>
        <canvas ref={cvRef} style={{ display: "block", width: "100%" }}
          onPointerDown={(e) => {
            tapAt.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const d0 = tapAt.current;
            /* إصبعٌ زحف = تمرير الصفحة، لا اختيار */
            if (!d0 || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 10) return;
            const r = e.currentTarget.getBoundingClientRect();
            const v = view.current;
            /* من بكسل الشاشة إلى فضاء المشهد المُسقَط */
            const sx = (e.clientX - r.left) / ZOOM + (v.cx - v.vw / 2);
            const sy = (e.clientY - r.top) / ZOOM + (v.cy - v.vh / 2);
            /* الأجسام قائمة فوق قاعدتها، فتُنزَّل اللمسة قليلًا قبل عكس الإسقاط */
            const [wx, wy] = unIso(sx, sy + 14);
            const t = bRef.current;
            let best = null, nd = 1e9;
            Object.keys(SPOT).forEach((nm) => {
              if (nm === "fort" || nm === "fence") return;
              const it = ITEMS.find((i) => i.i === nm); if (!it) return;
              const days = t[it.k] || 0; if (!days) return;
              const ex = EXTENT[nm];
              let dist;
              if (ex) {
                /* داخل بصمة المجموعة = إصابة، ولو كانت الوحدة في طرفها */
                const px = Math.max(ex.x0 - 22, Math.min(ex.x1 + 22, wx));
                const py = Math.max(ex.y0 - 22, Math.min(ex.y1 + 22, wy));
                dist = Math.hypot(wx - px, wy - py);
              } else {
                const [a, b] = SPOT[nm];
                dist = Math.hypot(wx - a, wy - b) * .62;   /* بناء مفرد */
              }
              if (dist < nd) { nd = dist; best = { ...it, days }; }
            });
            /* والمسجد يُصاب كغيره وإن لم يكن بناءَ سنّة */
            {
              const ex = EXTENT.dome;
              if (ex) {
                const qx = Math.max(ex.x0 - 22, Math.min(ex.x1 + 22, wx));
                const qy = Math.max(ex.y0 - 22, Math.min(ex.y1 + 22, wy));
                const dm = Math.hypot(wx - qx, wy - qy);
                if (dm < nd) {
                  nd = dm;
                  best = { k: "__mosque", i: "dome", ic: "dome", c: TIERC,
                           b: "المسجد", n: "أساس بستانك", mosque: true, days: MLV + 1,
                           h: "قلبُ القرية. لا تبنيه سنّةٌ بعينها، بل يعلو بمرتبتك — كلّما ترقّيتَ في المسار زِيد فيه." };
                }
              }
            }
            if (best && nd < 46) { SFX.open(); setTapped(best); selRef.current = best; }
            else { setTapped(null); selRef.current = null; }
          }} />
        {near && (
          <div style={S.zc}>
            <div style={S.zn}>{near.b} · {ar(near.days)} من {ar(cap)}</div>
            <div style={S.zh}>{near.n}</div>
          </div>
        )}
        {rankUp && (
          <Overlay onClose={() => setRankUp(null)} z={95}>
            <div style={{ textAlign: "center" }}>
              <div style={S.lbl}>ترقّى بستانك</div>
              <div style={{ ...S.rankBig, color: rankUp.c }}>{rankUp.n}</div>
              <div style={{ ...S.rankRing, borderColor: rankUp.c }} />
              <div style={S.dlgH}>{rankUp.d}</div>
              <button style={{ ...S.dlgX, background: rankUp.c }}
                onClick={() => setRankUp(null)}>الحمد لله</button>
            </div>
          </Overlay>
        )}
        {tapped && (
          <div data-card style={S.card}
            onClick={() => { setTapped(null); selRef.current = null; }}>
            <div style={S.cardTop}>
              <div style={{ ...S.cardIc, background: tapped.c }}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="#fff"
                  strokeLinecap="round" strokeLinejoin="round" style={{ width: 21, height: 21 }}
                  dangerouslySetInnerHTML={{ __html: svg(tapped.ic) }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.cardB}>{tapped.b}</div>
                <div style={S.cardN}>{tapped.mosque ? tapped.n : `بناه: ${tapped.n}`}</div>
              </div>
              <div style={S.cardCount}>
                {tapped.mosque ? `${ar(TIERS.length)}/${ar(tapped.days)}` : `${ar(cap)}/${ar(tapped.days)}`}
              </div>
            </div>
            <div style={S.cardH}>{tapped.h}</div>
            <div style={S.cardX}>اضغط للإغلاق</div>
          </div>
        )}
        <div ref={padRef} style={S.pad}
          onTouchStart={(e) => { e.preventDefault(); setJoy(e); }}
          onTouchMove={(e) => { e.preventDefault(); setJoy(e); }}
          onTouchEnd={endJoy}
          onMouseDown={(e) => {
            setJoy(e);
            const mv = (v) => setJoy(v);
            const up = () => { endJoy(); window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
            window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
          }}>
          <div style={S.knob} />
        </div>
      </div>

      <button style={{ ...S.pvBig, ...(preview ? S.pvOn : {}) }} onClick={() => setPreview((p) => !p)}>
        <EyeIcon />
        {preview ? "هذا بستانك مكتملًا ✦ اضغط للعودة لحالتك"
                 : `شاهد بستانك مكتملًا — لو أتممتَ كل السنن ${ar(cap)} يومًا`}
      </button>

      <div style={S.slid}>
        <div style={S.slTop}>
          <div>
            <div style={S.slDate}>{preview ? `اليوم ${ar(cap)} — مكتمل` : hLabel(shown)}</div>
            <div style={S.slGreg}>{preview ? `كل السنن ${ar(cap)} يومًا` : gLabel(shown)}</div>
          </div>
          <div style={S.slBuilt}>{fmt(totalBuilt)} من {fmt(TOTAL * cap)}</div>
        </div>
        <input type="range" min={1} max={days.length} value={Math.min(viewDay, days.length)}
          aria-label="يوم العرض" onChange={(e) => setViewDay(+e.target.value)}
          style={{ width: "100%", accentColor: "var(--sp-gold)" }} />
        <div style={S.slEnds}>
          <span>يوم ١</span>
          <span>{isNow ? "اسحب لترى نموّ بستانك يومًا بيوم" : "شهر مضى"}</span>
          <span>يوم {ar(cap)}</span>
        </div>
      </div>
    </div>
  );
}

/* شريط الشهر — مشترك بين المشهد والتعبئة */
function MonthBar({ start, setStart, sub }) {
  const atNow = iso(monthStart(today())) === iso(start);
  const gA = start, gB = monthDays(start).slice(-1)[0] || start;
  return (
    <div style={S.mBar}>
      <button style={S.mArrow} aria-label="الشهر السابق"
        onClick={() => { SFX.nav(); setStart(shiftMonth(start, -1)); }}><Chevron dir="right" /></button>
      <div style={{ textAlign: "center", minWidth: 0 }}>
        <div style={S.mName}>{hMonthLabel(start)}</div>
        <div style={S.mSub}>
          {sub || `${ar(gA.getDate())} ${GM[gA.getMonth()]} — ${ar(gB.getDate())} ${GM[gB.getMonth()]}`}
        </div>
      </div>
      <button style={{ ...S.mArrow, ...(atNow ? S.mArrowOff : {}) }} disabled={atNow}
        aria-label="الشهر التالي"
        onClick={() => { SFX.nav(); setStart(shiftMonth(start, 1)); }}><Chevron dir="left" /></button>
      <SoundBtn />
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════════
   <Recorder/> — التعبئة: أقسام + شبكة ٣×٣ + سنن سريعة
   التجزئة (chunking): قسم واحد في الشاشة بدل ٢٦ بندًا متتالية.
   ════════════════════════════════════════════════════════════════════ */
export function Recorder({ st, onSave }) {
  useSunanVersion();
  const [sec, setSec] = useState(0);
  const [info, setInfo] = useState(null);
  const [quick, setQuick] = useState(false);
  const [ask, setAsk] = useState(null);        /* سنّة سريعة تنتظر تأكيدك */
  const { day, dayKey, setDayKey, start, setStart, days, isFuture,
          hit, setTime, isDone, dayGems, monthGems, dayScore } = st;

  const secIdx = Math.min(sec, Math.max(0, SUNAN.length - 1));
  const S0 = SUNAN[secIdx] || { id: "-", t: "", items: [] };
  const stripRef = useRef(null);
  const [pops, setPops] = useState([]);       /* جواهر تطير من الكرت المضغوط */
  const popId = useRef(0);
  useEffect(() => () => setPops([]), []);

  /* لمسة على سنّة: سجّلها وأطلق جوهرتها */
  const press = (i, e) => {
    const v = day[i.k] || 0;
    const wasDone = isDone(i, v);
    hit(i.k);
    if (wasDone && i.type === "bool") return;              /* إلغاء — لا جوهرة */
    if (i.type === "cycle" && v >= i.max) return;
    const box = e.currentTarget.getBoundingClientRect();
    const now = Date.now();
    setPops((L) => {
      /* ضغطتان متتاليتان على السنّة نفسها تُجمعان: ١ ثم ٢ ثم ٣، لا ثلاث «١» */
      const j = L.findIndex((q) => q.k === i.k && now - q.at < 800);
      if (j >= 0) {
        const c = L.slice();
        c[j] = { ...c[j], g: c[j].g + i.g, hits: c[j].hits + 1, at: now, bump: c[j].bump + 1 };
        return c;
      }
      const id = ++popId.current;
      setTimeout(() => setPops((M) => M.filter((q) => q.id !== id)), 1100);
      return [...L, { id, k: i.k, g: i.g, hits: 1, bump: 0, at: now, c: i.c,
                      x: box.left + box.width / 2, y: box.top + 14 }];
    });
  };
  const quickLeft = QUICK().filter((i) => !isDone(i, day[i.k] || 0)).length;
  const sel = fromIso(dayKey);
  const todayKey = iso(today());

  /* اليوم المفتوح يبقى في وسط الشريط — يُختار اليوم تلقائيًا عند الفتح */
  useEffect(() => {
    const el = stripRef.current && stripRef.current.querySelector(`[data-day="${dayKey}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [dayKey, start]);

  return (
    <div style={S.wrap} dir="rtl">
      {/* الشهر ثم اليوم */}
      <MonthBar start={start} setStart={setStart} sub={`${fmt(monthGems)} جوهرة هذا الشهر`} />

      {/* شريط الأيام — صفٌّ واحد يُمرَّر أفقيًا بدل شبكة ٣٠ مربّعًا */}
      <div style={S.dayStrip} ref={stripRef}>
        {days.map((d) => {
          const k = iso(d), h = hijri(d).d;
          const future = isFuture(d);
          const score = dayScore(k);
          const on = k === dayKey;
          const isToday = k === todayKey;
          const lvl = score >= 18 ? 3 : score >= 8 ? 2 : score > 0 ? 1 : 0;
          return (
            <button key={k} data-day={k} disabled={future}
              onClick={() => { SFX.tap(); setDayKey(k); }}
              style={{ ...S.dChip,
                ...(lvl ? { background: lvl === 3 ? "var(--sp-aura)" : "var(--sp-mintBg)" } : {}),
                ...(isToday && !on ? { borderColor: "var(--sp-mint)" } : {}),
                ...(on ? S.dChipSel : {}),
                ...(future ? { opacity: .34 } : {}) }}>
              <span style={S.dWd}>{isToday ? "اليوم" : WD[d.getDay()]}</span>
              <span style={S.dh}>{ar(h)}</span>
              <span style={{ ...S.dm,
                background: lvl === 3 ? "var(--sp-gold)" : lvl === 2 ? "var(--sp-mint)"
                          : lvl === 1 ? "var(--sp-goldL)" : "var(--sp-line)" }} />
            </button>
          );
        })}
      </div>
      <div style={S.dFull}>
        {hLabel(sel)} · {gLabel(sel)}{dayKey === todayKey ? " · اليوم" : ""}
      </div>

      {/* الحلقة والجواهر */}
      <div style={S.topBar}>
        <div style={{ flex: 1 }}>
          <div style={S.lbl}>جواهر اليوم</div>
          <div style={S.gemN}>{fmt(dayGems(dayKey))}</div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={S.lbl}>هذا الشهر</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(monthGems)}</div>
        </div>
      </div>

      {/* سنن سريعة */}
      <button style={S.quickB} onClick={() => { SFX.open(); setQuick(true); }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BoltIcon /> سنن سريعة
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 600, opacity: .85 }}>
          {quickLeft ? `${ar(quickLeft)} بقيت لك` : "أتممتها كلها ✓"}
        </span>
      </button>

      {/* شرائح الأقسام */}
      <div style={S.secTabs}>
        {SUNAN.map((s, i) => {
          const d = s.items.filter((it) => isDone(it, day[it.k] || 0)).length;
          const full = s.items.length > 0 && d === s.items.length;
          return (
            <div key={s.id} onClick={() => { SFX.nav(); setSec(i); }}
              style={{ ...S.sTab, ...(i === secIdx ? S.sTabOn : {}), ...(full && i !== secIdx ? S.sTabDone : {}) }}>
              <div style={S.st}>{s.t}</div>
              <div style={S.sc}>{ar(d)}/{ar(s.items.length)}{full ? " ✓" : ""}</div>
            </div>
          );
        })}
      </div>

      {/* شبكة ٣×٣ للقسم الحالي */}
      <div style={S.grid}>
        {S0.items.length === 0 && (
          <div style={S.gridEmpty}>لا سنن في هذا القسم بعد — أضِفها من «تحرير السنن».</div>
        )}
        {S0.items.map((i) => {
          const v = day[i.k] || 0;
          const full = isDone(i, v);
          const part = i.type === "cycle" && v > 0 && v < i.max;
          return (
            <div key={i.k} className="sp-tap" onClick={(e) => press(i, e)}
              style={{ ...S.sq, ...(full ? { borderColor: i.c } : part ? { borderColor: i.c + "66" } : {}) }}>
              <button style={S.sqI} aria-label={`فضل ${i.n}`}
                onClick={(e) => { e.stopPropagation(); SFX.open(); setInfo(i); }}><QMark /></button>
              {full && <div style={{ ...S.sqD, background: i.c }}>✓</div>}
              <div style={{ ...S.sqIc, background: full ? i.c : i.c + "1A" }}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ width: 21, height: 21, stroke: full ? "#fff" : i.c }}
                  dangerouslySetInnerHTML={{ __html: svg(i.ic) }} />
              </div>
              <div style={S.sqN}>{i.n}</div>
              {i.type === "cycle" && (
                <div style={{ ...S.sqCount, borderColor: i.c, color: full ? "#fff" : i.c,
                  background: full ? i.c : i.c + "16" }}>{ar(i.max)}/{ar(v)}</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={S.navRow}>
        <button style={S.navBtn} disabled={secIdx === 0}
          onClick={() => { SFX.nav(); setSec(secIdx - 1); }}>السابق</button>
        <button style={{ ...S.navBtn, ...S.navPri }} disabled={secIdx >= SUNAN.length - 1}
          onClick={() => { SFX.nav(); setSec(secIdx + 1); }}>
          {secIdx >= SUNAN.length - 1 ? "تمّت كل الأقسام" : "القسم التالي ←"}
        </button>
      </div>

      <button style={S.saveB} onClick={() => { SFX.save(); onSave(); }}>حفظ وبناء بستانك</button>

      {/* نافذة الفضل */}
      {info && (
        <Overlay onClose={() => setInfo(null)}>
          <div style={{ textAlign: "center" }}>
            <div style={{ ...S.dlgIc, background: info.c }}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="#fff"
                strokeLinecap="round" strokeLinejoin="round" style={{ width: 27, height: 27 }}
                dangerouslySetInnerHTML={{ __html: svg(info.ic) }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{info.n}</div>
            <div style={S.dlgH}>{info.h}</div>
            <div style={S.dlgB}>
              <div style={S.dlgBHalf}>
                <div style={S.dlgBK}>يبني في بستانك</div>
                <div style={S.dlgBV}>{info.b}</div>
              </div>
              <span style={S.dlgBSep} />
              <div style={S.dlgBHalf}>
                <div style={S.dlgBK}>الجواهر</div>
                <div style={{ ...S.dlgBV, direction: "ltr" }}>+{ar(info.g)}</div>
              </div>
            </div>
            <button style={S.dlgX} onClick={() => setInfo(null)}>فهمت</button>
          </div>
        </Overlay>
      )}

      {/* لوحة السنن السريعة */}
      {quick && (
        <Overlay onClose={() => setQuick(false)} wide>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={S.qIc}><BoltIcon white /></div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>سنن سريعة</div>
              <div style={S.lbl}>اضغط سنّة ونؤكّد معك قبل تسجيلها</div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            {QUICK().slice().sort((a, b) =>
              (isDone(a, day[a.k] || 0) ? 1 : 0) - (isDone(b, day[b.k] || 0) ? 1 : 0)
            ).map((i) => {
              const done = isDone(i, day[i.k] || 0);
              return (
                <div key={i.k} onClick={() => { SFX.tap(); setAsk(i); }}
                  style={{ ...S.qRow, ...(done ? { borderColor: i.c } : {}) }}>
                  <div style={{ ...S.qRowIc, background: done ? i.c : i.c + "1A" }}>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ width: 19, height: 19, stroke: done ? "#fff" : i.c }}
                      dangerouslySetInnerHTML={{ __html: svg(i.ic) }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{i.n}{done ? " ✓" : ""}</div>
                    <div style={{ fontSize: 9.5, color: "var(--sp-mut)", marginTop: 2 }}>{i.qt}</div>
                  </div>
                  <div style={{ ...S.qTime, color: done ? i.c : "var(--sp-mint)" }}>{i.q}</div>
                </div>
              );
            })}
          </div>
          <button style={S.dlgX} onClick={() => setQuick(false)}>إغلاق</button>
        </Overlay>
      )}

      {/* الجواهر تطير صاعدةً من الكرت */}
      {pops.map((q) => (
        <div key={q.id + "-" + q.bump} className="sp-pop"
          style={{ ...S.pop, left: q.x, top: q.y, color: q.c,
                   fontSize: 15 + Math.min(q.hits - 1, 4) * 2.5 }}>
          {ar(q.g)} 💎{q.hits > 1 ? ` ×${ar(q.hits)}` : ""}
        </div>
      ))}

      {/* تأكيد تسجيل السنّة السريعة أو إلغائه */}
      {ask && (() => {
        const done = isDone(ask, day[ask.k] || 0);
        return (
          <Overlay onClose={() => setAsk(null)} z={90}>
            <div style={{ textAlign: "center" }}>
              <div style={{ ...S.dlgIc, background: done ? "var(--sp-mut)" : ask.c }}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="#fff"
                  strokeLinecap="round" strokeLinejoin="round" style={{ width: 27, height: 27 }}
                  dangerouslySetInnerHTML={{ __html: svg(ask.ic) }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{ask.n}</div>
              <div style={S.dlgH}>
                {done
                  ? "أتلغي تسجيلها اليوم؟ تُخصم جواهرها وترجع كما كانت."
                  : ask.type === "cycle"
                    ? `أتسجّل مرّةً منها اليوم؟ تُحسب لك ${ar(ask.g)} جوهرة.`
                    : `أتسجّلها اليوم؟ تُحسب لك ${ar(ask.g)} جوهرة.`}
              </div>
              <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
                <button style={S.navBtn} onClick={() => setAsk(null)}>تراجع</button>
                {done ? (
                  <button style={{ ...S.navBtn, ...S.navDanger }}
                    onClick={() => { setTime(ask.k, 0); SFX.undo(); setAsk(null); }}>نعم، ألغِ</button>
                ) : (
                  <button style={{ ...S.navBtn, ...S.navPri }}
                    onClick={() => { hit(ask.k); setAsk(null); }}>نعم، سجّلها</button>
                )}
              </div>
            </div>
          </Overlay>
        );
      })()}
    </div>
  );
}

/* ════════ مكوّنات مساعدة ════════ */
function Overlay({ children, onClose, wide, z }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div style={{ ...S.ov, ...(z ? { zIndex: z } : {}) }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.dlg, ...(wide ? { maxWidth: 390, textAlign: "right" } : {}) }}>{children}</div>
    </div>
  );
}
const Logo = () => (
  <svg viewBox="0 0 44 44" style={{ width: 40, height: 40, flexShrink: 0 }}>
    <circle cx="22" cy="22" r="20" fill="none" stroke="var(--sp-goldL)" strokeWidth="1.2" opacity=".5" />
    <path d="M22 9c-4.5 3-7 6.5-7 10.5 0 3.9 3.1 7 7 7s7-3.1 7-7c0-4-2.5-7.5-7-10.5z"
      fill="none" stroke="var(--sp-gold)" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M22 26.5v9" stroke="var(--sp-gold)" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M14 35h16" stroke="var(--sp-mint)" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M22 19l1.4 3.2 3.4.3-2.6 2.2.8 3.3L22 26.3l-3 1.7.8-3.3-2.6-2.2 3.4-.3z"
      fill="var(--sp-goldL)" opacity=".9" />
  </svg>
);
/* سهم مرسوم لا حرفًا — الحروف ‹ › ؟ يعكسها اتجاه RTL فتنقلب */
const Chevron = ({ dir }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
    <path d={dir === "right" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"} />
  </svg>
);
/* علامة استفهام عربية «؟» — مرآة الشكل اللاتيني، مرسومة لا مكتوبة */
const QMark = ({ size }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size || 12, height: size || 12, transform: "scaleX(-1)" }}>
    <path d="M9.1 9.2a3 3 0 0 1 5.8 1c0 2-2.9 2.6-2.9 4.3" /><path d="M12 18.2h.01" />
  </svg>
);
/* مفتاح الصوت — يظهر في شريط الشهر فيراه الطالب في الشاشتين */
const SoundBtn = () => {
  useSound();
  const on = soundOn();
  return (
    <button style={{ ...S.mArrow, ...(on ? {} : { opacity: .55 }) }}
      aria-label={on ? "أطفئ الصوت" : "شغّل الصوت"}
      onClick={() => { setSound(!on); if (!on) SFX.open(); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
        strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
        <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
        {on ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.8a9 9 0 0 1 0 12.4" /></>
            : <><path d="m16.5 9.5 5 5" /><path d="m21.5 9.5-5 5" /></>}
      </svg>
    </button>
  );
};
/* ════ مسار البستان ════
   بطاقاتٌ تُمرَّر أفقيًا لا قائمة: المفتوحُ ملوّنٌ يلمع، والمقفلُ باهتٌ بقفله
   وما بقي له. وزرٌّ يعاين كلَّ مرتبةٍ في الأرض قبل بلوغها.               */
function Track({ gems, onClose, onPreview, previewing }) {
  useTiers();
  const here = tierAt(gems).i;
  const reelRef = useRef(null);

  /* افتح على أوّل مقفلة — هي التي يسعى إليها */
  useEffect(() => {
    const el = reelRef.current && reelRef.current.querySelector('[data-at="' + Math.min(here + 1, TIERS.length - 1) + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ inline: "center", block: "nearest" });
  }, [here]);

  const total = TIERS[TIERS.length - 1].g || 1;
  return (
    <Overlay onClose={onClose} wide z={92}>
      <div style={S.tkHead}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>مسار البستان</div>
          <div style={S.lbl}>كلّ مرتبةٍ تفتح شيئًا يُرى في أرضك</div>
        </div>
        <div style={S.tkGems}>{fmt(gems)} 💎</div>
      </div>

      {/* شريط الطريق كلّه */}
      <div style={S.tkRail}>
        <div style={{ ...S.tkRailFill,
                      width: `${Math.round(Math.min(1, gems / total) * 100)}%` }} />
        {TIERS.map((t, i) => (
          <span key={t.id} style={{ ...S.tkPin, insetInlineStart: `${(t.g / total) * 100}%`,
                                    background: gems >= t.g ? t.c : "var(--sp-line)" }} />
        ))}
      </div>

      {/* البطاقات */}
      <div style={S.tkReel} ref={reelRef}>
        {TIERS.map((t, i) => {
          const got = gems >= t.g;
          const now = i === here;
          const perk = t.r ? PERKS[t.r] : null;
          return (
            <button key={t.id} data-at={i} className={got ? "sp-tile sp-shine" : "sp-tile"}
              onClick={() => onPreview(i)}
              style={{ ...S.tkCard,
                ...(got ? { background: `linear-gradient(160deg, ${t.c}, ${t.c}C0 62%, ${t.c}88)`,
                            borderColor: t.c, boxShadow: `0 6px 18px ${t.c}55` }
                        : { background: `linear-gradient(160deg, ${t.c}26, ${t.c}0E)`,
                            borderColor: t.c + "66" }),
                ...(previewing === i ? { outline: "3px solid var(--sp-gold)", outlineOffset: 2 } : {}),
                animationDelay: `${i * 70}ms` }}>

              <div style={{ ...S.tkBadge,
                background: got ? "rgba(255,255,255,.28)" : t.c + "22",
                color: got ? "#fff" : t.c }}>
                {got ? "✓" : ar(i + 1)}
              </div>
              {now && <div style={{ ...S.tkNow, color: t.c }}>أنت هنا</div>}

              <div style={{ ...S.tkIc,
                            background: got ? "rgba(255,255,255,.22)" : t.c + "1A",
                            borderColor: got ? "rgba(255,255,255,.45)" : t.c + "55" }}>
                {perk ? (
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ width: 28, height: 28, stroke: got ? "#fff" : t.c, opacity: got ? 1 : .8 }}
                    dangerouslySetInnerHTML={{ __html: svg(perk.ic) }} />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ width: 25, height: 25, stroke: got ? "#fff" : t.c, opacity: got ? 1 : .8 }}>
                    <path d="m12 3 2.6 5.3 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.1l5.9-.8z" />
                  </svg>
                )}
                {!got && (
                  <div style={{ ...S.tkLock, background: t.c, borderColor: "var(--sp-surf)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6"
                      strokeLinecap="round" style={{ width: 11, height: 11 }}>
                      <rect x="4" y="10" width="16" height="11" rx="2" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                  </div>
                )}
              </div>

              <div style={{ ...S.tkName, color: got ? "#fff" : "var(--sp-txt)" }}>
                {perk ? perk.n : `لقب «${t.n}»`}
              </div>
              <div style={{ ...S.tkTier, color: got ? "rgba(255,255,255,.85)" : "var(--sp-mut)" }}>
                {t.n}
              </div>
              <div style={{ ...S.tkNeed,
                            background: got ? "rgba(255,255,255,.22)" : t.c + "1F",
                            color: got ? "#fff" : t.c }}>
                {got ? "مفتوح ✓" : `${fmt(t.g - gems)} 💎`}
              </div>
            </button>
          );
        })}
      </div>

      <div style={S.tkTip}>اضغط أيّ مرتبة لتعاين أرضك عندها</div>
      <button style={S.dlgX} onClick={onClose}>إغلاق</button>
    </Overlay>
  );
}

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" style={{ width: 17, height: 17, flexShrink: 0 }}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const BoltIcon = ({ white }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={white ? "#fff" : "currentColor"} strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: white ? 20 : 17, height: white ? 20 : 17 }}>
    <path d="M13 2L4.1 12.5a1 1 0 00.8 1.6H11l-1 8 8.9-10.5a1 1 0 00-.8-1.6H12z" />
  </svg>
);

/* ════════════════════════════════════════════════════════════════════
   <SunanEditor/> — تحرير السنن
   • كل تعديل يُطبَّق فورًا على المخزن الحيّ ويُحفظ في المتصفّح،
     فتراه في «التعبئة» و«بستان صِلة» في اللحظة نفسها.
   • الأقسام: أضِف · سمِّ · لوِّن · رتِّب · احذف
   • السنّة: اسحبها بإصبعك لتنقلها بين الأقسام، أو اضغطها لتحرير كل شيء
     فيها — الحديث، الجواهر، النوع، ما تبنيه، أيقونتها، وقسمها.
   • «تصدير» يعطيك كتلة DEFAULT_SECS جاهزة تُلصق في هذا الملف نفسه
     لتصير هي الأصل الذي يبدأ منه كل مستخدم جديد.
   ════════════════════════════════════════════════════════════════════ */

/* لوحة ألوان الأقسام — الستة الأولى هي ألوان الهوية */
const SEC_PALETTE = [...new Set([...Object.values(SEC_COLOR),
  "#2F7D74", "#C2544D", "#4F8A3D", "#8E6BB0", "#B0713C", "#41708F",
  "#00D6A6", "#4BE04B", "#FFC414", "#FF7A18", "#FF3D68", "#A03CFF", "#1E90FF", "#FFD426"])];

/* أسماء الأبنية بالعربية — مأخوذة من الأصل، لئلا يظهر مفتاح لاتيني للمستخدم */
const BUILD_AR = {};
DEFAULT_SECS.forEach((s) => s.items.forEach((i) => { BUILD_AR[i.i] = i.b; }));

/* حقل رقمي بأرقام عربية — §١٠ لا حروف ولا أرقام لاتينية في الواجهة */
function NumField({ value, min, max, onChange, unit, step, label }) {
  const k = step || 1;
  const of = label ? ` ${label}` : "";
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div style={S.edNum}>
      <button style={S.edNumB} onClick={() => set(value - k)}
        disabled={value <= min || !k} aria-label={"أنقص" + of}>−</button>
      <span style={S.edNumV}>{ar(value)}{unit ? ` ${unit}` : ""}</span>
      <button style={S.edNumB} onClick={() => set(value + k)}
        disabled={value >= max || !k} aria-label={"زد" + of}>+</button>
    </div>
  );
}

const uniqKey = (base, taken) => {
  let k = base || "s", n = 1;
  while (taken.has(k)) k = `${base || "s"}${++n}`;
  return k;
};

export function SunanEditor({ embedded = false }) {
  useSunanVersion();
  useTiers();
  const [editKey, setEditKey] = useState(null);    // مفتاح السنّة المفتوحة
  const [secEdit, setSecEdit] = useState(null);    // معرّف القسم المفتوح
  const [out, setOut] = useState(null);
  const [ask, setAsk] = useState(null);            // {msg, onYes}
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const moved = useRef(false);

  const secs = SUNAN;
  const BUILDS = Object.keys(SPOT);

  /* كل تحرير: انسخ الحالي، عدّل النسخة، سلّمها للمخزن */
  const mut = (f) => { const N = deep(SUNAN); f(N); setSunan(N); };

  const locate = (k) => {
    for (let si = 0; si < secs.length; si++) {
      const ii = secs[si].items.findIndex((x) => x.k === k);
      if (ii >= 0) return { si, ii, item: secs[si].items[ii] };
    }
    return null;
  };
  const at = editKey ? locate(editKey) : null;
  const item = at ? at.item : null;
  const sec = secEdit != null ? secs.find((s) => s.id === secEdit) : null;

  /* ── تعديلات السنّة ── */
  const patch = (k, field, v) => mut((N) => {
    for (const s of N) { const it = s.items.find((x) => x.k === k); if (it) { it[field] = v; return; } }
  });
  const patchMany = (k, obj) => mut((N) => {
    for (const s of N) { const it = s.items.find((x) => x.k === k); if (it) { Object.assign(it, obj); return; } }
  });
  const moveItem = (k, toSecId, toIdx) => mut((N) => {
    let it = null, fromId = null;
    for (const s of N) {
      const j = s.items.findIndex((x) => x.k === k);
      if (j >= 0) { fromId = s.id; it = s.items.splice(j, 1)[0]; if (s.id === toSecId && toIdx != null && j < toIdx) toIdx--; break; }
    }
    const t = N.find((s) => s.id === toSecId);
    if (!it || !t) return;
    const idx = toIdx == null ? t.items.length : Math.max(0, Math.min(t.items.length, toIdx));
    t.items.splice(idx, 0, it);
  });
  const delItem = (k) => { setEditKey(null); mut((N) => {
    for (const s of N) { const j = s.items.findIndex((x) => x.k === k); if (j >= 0) { s.items.splice(j, 1); return; } }
  }); };
  const addItem = (secId) => {
    const taken = new Set(ITEMS.map((i) => i.k));
    const k = uniqKey("sunnah", taken);
    const used = new Set(ITEMS.map((i) => i.i));
    const build = BUILDS.find((b) => !used.has(b)) || BUILDS[0];
    mut((N) => {
      const t = N.find((s) => s.id === secId); if (!t) return;
      t.items.push({ k, n: "سنّة جديدة", i: build, ic: build, b: "بناء جديد",
                     type: "bool", g: 2, h: "اكتب هنا الحديث أو الفضل الذي يظهر عند علامة الاستفهام." });
    });
    setEditKey(k);
  };

  /* ── المراتب ── */
  const patchTier = (id, f, v) =>
    setTiers(TIERS.map((t) => (t.id === id ? { ...t, [f]: v } : t)));
  const addTier = () => {
    const top = TIERS[TIERS.length - 1];
    setTiers([...TIERS, { id: uniqKey("tier", new Set(TIERS.map((t) => t.id))),
                          n: "مرتبة جديدة", g: (top ? top.g : 0) + 500,
                          c: SEC_PALETTE[TIERS.length % SEC_PALETTE.length],
                          d: "بلغتَ مرتبةً جديدة." }]);
  };

  /* ── تعديلات القسم ── */
  const patchSec = (id, field, v) => mut((N) => {
    const t = N.find((s) => s.id === id); if (t) t[field] = v;
  });
  const moveSec = (id, dir) => mut((N) => {
    const j = N.findIndex((s) => s.id === id), to = j + dir;
    if (j < 0 || to < 0 || to >= N.length) return;
    N.splice(to, 0, N.splice(j, 1)[0]);
  });
  const addSec = () => {
    const taken = new Set(secs.map((s) => s.id));
    const id = uniqKey("sec", taken);
    mut((N) => N.push({ id, t: "قسم جديد", c: SEC_PALETTE[N.length % SEC_PALETTE.length], items: [] }));
    setSecEdit(id);
  };
  const delSec = (id) => {
    const s = secs.find((x) => x.id === id);
    if (!s) return;
    if (secs.length === 1) { setAsk({ msg: "لا يمكن حذف آخر قسم.", only: true }); return; }
    const go = () => { setSecEdit(null); mut((N) => {
      const j = N.findIndex((x) => x.id === id); if (j < 0) return;
      const [gone] = N.splice(j, 1);
      const home = N[Math.max(0, j - 1)];
      if (home) home.items.push(...gone.items);       /* لا تضيع السنن */
    }); };
    if (s.items.length) setAsk({ msg: `سيُحذف «${s.t}» وتنتقل ${ar(s.items.length)} من سننه إلى القسم المجاور. أتمضي؟`, onYes: go });
    else go();
  };

  /* ── السحب بالإصبع أو الفأرة — يعمل على الجوال ── */
  const startDrag = (k, e) => {
    const pt = e.touches ? e.touches[0] : e;
    const f = locate(k); if (!f) return;
    dragRef.current = { k, x: pt.clientX, y: pt.clientY };
    moved.current = false;
    setDrag({ k, x: pt.clientX, y: pt.clientY, name: f.item.n, c: f.item.c, ic: f.item.ic });
  };
  const over = (e) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const pt = e.touches ? e.touches[0] : e;
    if (Math.hypot(pt.clientX - dragRef.current.x, pt.clientY - dragRef.current.y) > 8) moved.current = true;
    setDrag((d) => (d ? { ...d, x: pt.clientX, y: pt.clientY } : d));
  };
  const drop = (e) => {
    const d = dragRef.current; dragRef.current = null;
    const cur = drag; setDrag(null);
    if (!d) return;
    if (!moved.current) { setEditKey(d.k); return; }        /* ضغطة قصيرة = تحرير */
    const pt = e.changedTouches ? e.changedTouches[0] : (cur ? { clientX: cur.x, clientY: cur.y } : null);
    if (!pt) return;
    const el = document.elementFromPoint(pt.clientX, pt.clientY);
    const zone = el && el.closest("[data-sec]");
    if (!zone) return;
    const row = el.closest("[data-row]");
    moveItem(d.k, zone.dataset.sec, row ? +row.dataset.row : null);
  };
  useEffect(() => {
    if (!drag) return;
    const m = (e) => over(e), u = (e) => drop(e);
    window.addEventListener("mousemove", m); window.addEventListener("mouseup", u);
    window.addEventListener("touchmove", m, { passive: false }); window.addEventListener("touchend", u);
    return () => {
      window.removeEventListener("mousemove", m); window.removeEventListener("mouseup", u);
      window.removeEventListener("touchmove", m); window.removeEventListener("touchend", u);
    };
  });

  /* ── التصدير: كتلة تُلصق مكان DEFAULT_SECS ── */
  /* نصّ صالح داخل علامتَي اقتباس مفردتين — والسطر الجديد يُكتب \n لا سطرًا فعليًا */
  const q = (v) => String(v)
    .replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r?\n/g, "\\n");
  const exportCode = () => {
    const body = secs.map((s) => {
      const head = SEC_COLOR[s.id] === s.c ? `{id:'${s.id}',t:'${q(s.t)}'` : `{id:'${s.id}',t:'${q(s.t)}',c:'${s.c}'`;
      return ` ${head},items:[\n` + s.items.map((i) => {
        const bits = [`k:'${i.k}'`, `n:'${q(i.n)}'`, `i:'${i.i}'`];
        if (i.ic !== i.i) bits.push(`ic:'${i.ic}'`);
        bits.push(`b:'${q(i.b)}'`, `type:'${i.type}'`);
        if (i.type === "cycle") bits.push(`max:${i.max}`);
        bits.push(`g:${i.g}`);
        if (i.q) bits.push(`q:'${q(i.q)}'`, `qt:'${q(i.qt)}'`);
        return `  {${bits.join(",")},\n   h:'${q(i.h)}'}`;
      }).join(",\n") + "]}";
    }).join(",\n");
    setOut("const DEFAULT_SECS=[\n" + body + "];");
  };

  const usedBuilds = {};
  ITEMS.forEach((i) => { usedBuilds[i.i] = (usedBuilds[i.i] || 0) + 1; });

  const body = (
    <div style={S.wrap}>
      <div style={S.head}>
        <div>
          <div style={S.h1}>تحرير السنن</div>
          <div style={S.sub}>اسحب السنّة لتنقلها · اضغطها لتحرير كل تفاصيلها</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={S.edBtn} onClick={addSec}>＋ قسم</button>
          <button style={S.expB} onClick={exportCode}>تصدير</button>
        </div>
      </div>

      <div style={S.edTip}>
        كل تعديل يُحفظ في هذا المتصفّح فورًا وتراه في بقيّة الشاشات.
        و«تصدير» يعطيك الكتلة لتلصقها في الملف فتصير هي الأصل للجميع.
      </div>

      {secs.map((s, si) => (
        <div key={s.id} data-sec={s.id} style={S.aSec}>
          <div style={S.aSecH}>
            <button style={{ ...S.aDotC, background: s.c, border: "none", padding: 0 }}
              aria-label={`لون ${s.t}`} onClick={() => setSecEdit(s.id)} />
            <input value={s.t} onChange={(e) => patchSec(s.id, "t", e.target.value)}
              style={S.edSecName} aria-label="اسم القسم" />
            <span style={{ ...S.lbl, flexShrink: 0 }}>{ar(s.items.length)}</span>
            <button style={S.edMini} disabled={si === 0} onClick={() => moveSec(s.id, -1)} aria-label="أعلى">↑</button>
            <button style={S.edMini} disabled={si === secs.length - 1} onClick={() => moveSec(s.id, 1)} aria-label="أسفل">↓</button>
            <button style={S.edMini} onClick={() => setSecEdit(s.id)} aria-label="إعدادات القسم">⚙</button>
          </div>

          {s.items.length === 0 && <div style={S.aEmpty}>اسحب سنّة إلى هنا، أو أضِف واحدة</div>}

          {s.items.map((i, ii) => (
            <div key={i.k} data-row={ii} style={{ ...S.aRow,
                ...(drag && drag.k === i.k ? { opacity: .3 } : {}) }}
              onMouseDown={(e) => startDrag(i.k, e)}
              onTouchStart={(e) => startDrag(i.k, e)}>
              <span style={S.aGrip}>⠿</span>
              <div style={{ ...S.qRowIc, background: i.c + "1A", width: 34, height: 34 }}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round" style={{ width: 17, height: 17, stroke: i.c }}
                  dangerouslySetInnerHTML={{ __html: svg(i.ic) }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{i.n}</div>
                {/* حقائق منفصلة بفواصل مُتباعدة — النقطة الملاصقة لرقم تُقرأ جزءًا منه */}
                <div style={S.aB}>
                  <span>{i.b}</span>
                  <span style={S.aBSep}>·</span>
                  <span>{ar(i.g)} جوهرة</span>
                  <span style={S.aBSep}>·</span>
                  <span>{i.type === "cycle" ? `عدّاد إلى ${ar(i.max)}` : "نعم/لا"}</span>
                  {i.q && <><span style={S.aBSep}>·</span><span>سريعة</span></>}
                </div>
              </div>
              <span style={S.edPen}>✎</span>
            </div>
          ))}

          <button style={S.edAdd} onClick={() => addItem(s.id)}>＋ أضف سنّة إلى «{s.t}»</button>
        </div>
      ))}

      {/* ── المراتب: عتباتُ الجواهر وما يتبدّل عندها ── */}
      <div style={{ ...S.head, marginTop: 22 }}>
        <div>
          <div style={S.h1}>المراتب</div>
          <div style={S.sub}>يبلغ الطالب العتبة فيترقّى بستانه ويتبدّل لونه</div>
        </div>
        <button style={S.edBtn} onClick={addTier}>＋ مرتبة</button>
      </div>

      <div style={S.edTip}>
        الجواهر عددٌ يكبر بلا أثر. والمرتبة تجعل له اسمًا يُنادى به ولونًا
        يصبغ حدّ الأرض — فيرى الطالب تقدّمه في بستانه لا في رقمٍ فقط.
      </div>

      {TIERS.map((t, ti) => (
        <div key={t.id} style={S.aSec}>
          <div style={S.aSecH}>
            <span style={{ ...S.aDotC, background: t.c }} />
            <input value={t.n} style={S.edSecName} aria-label="اسم المرتبة"
              onChange={(e) => patchTier(t.id, "n", e.target.value)} />
            <button style={S.edMini} aria-label="حذف المرتبة"
              disabled={TIERS.length < 2}
              onClick={() => setAsk({ msg: `حذف مرتبة «${t.n}»؟`,
                onYes: () => setTiers(TIERS.filter((q) => q.id !== t.id)) })}>✕</button>
          </div>
          <div style={S.aLbl}>عتبة الجواهر</div>
          <NumField value={t.g} min={0} max={99999} step={ti === 0 ? 0 : 50}
            label={`عتبة «${t.n}»`} onChange={(v) => patchTier(t.id, "g", v)} />
          <div style={S.aLbl}>ما يُقال عند بلوغها</div>
          <textarea value={t.d} rows={2} style={S.aArea}
            onChange={(e) => patchTier(t.id, "d", e.target.value)} />
          <div style={S.aLbl}>ما تفتحه — يظهر في البستان عند بلوغها</div>
          <div style={S.edPerks}>
            <button onClick={() => patchTier(t.id, "r", "")}
              style={{ ...S.edPerk, ...(!t.r ? { borderColor: t.c, background: t.c + "1A" } : {}) }}>
              <span style={S.edPerkN}>لقب فقط</span>
            </button>
            {PERK_KEYS.map((k) => {
              const taken = TIERS.some((q) => q.r === k && q.id !== t.id);
              const on = t.r === k;
              return (
                <button key={k} disabled={taken}
                  onClick={() => patchTier(t.id, "r", k)}
                  style={{ ...S.edPerk, ...(on ? { borderColor: t.c, background: t.c + "1A" } : {}),
                           ...(taken ? { opacity: .35 } : {}) }}>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" style={{ width: 16, height: 16,
                      stroke: on ? t.c : "var(--sp-mut)" }}
                    dangerouslySetInnerHTML={{ __html: svg(PERKS[k].ic) }} />
                  <span style={S.edPerkN}>{PERKS[k].n}</span>
                </button>
              );
            })}
          </div>
          <div style={{ ...S.lbl, marginTop: 6 }}>الباهت مأخوذٌ لمرتبةٍ أخرى.</div>

          <div style={S.aLbl}>لونها — يصبغ حدّ أرض البستان</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SEC_PALETTE.map((c) => (
              <button key={c} onClick={() => patchTier(t.id, "c", c)} aria-label={c}
                style={{ ...S.edSwatch, background: c,
                  ...(t.c === c ? { outline: "2px solid var(--sp-txt)", outlineOffset: 2 } : {}) }} />
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 9 }}>
        <button style={{ ...S.navBtn, color: "var(--sp-mut)" }}
          onClick={() => setAsk({ msg: "استعادة المراتب الأصلية؟", onYes: resetTiers })}>
          استعادة المراتب
        </button>
        <button style={{ ...S.navBtn, color: "var(--sp-mut)" }}
          onClick={() => setAsk({ msg: "استعادة السنن الأصلية ٢٦ وإلغاء كل تعديلاتك؟", onYes: resetSunan })}>
          استعادة السنن
        </button>
      </div>
    </div>
  );

  return (
    <>
      {body}

      {/* الشبح الذي يتبع الإصبع */}
      {drag && moved.current && (
        <div style={{ ...S.ghost, left: drag.x, top: drag.y, borderColor: drag.c }}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" style={{ width: 16, height: 16, stroke: drag.c }}
            dangerouslySetInnerHTML={{ __html: svg(drag.ic) }} />
          {drag.name}
        </div>
      )}

      {/* ── محرّر السنّة ── */}
      {item && (
        <Overlay onClose={() => setEditKey(null)} wide>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ ...S.qRowIc, background: item.c, width: 40, height: 40 }}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="#fff" strokeLinecap="round"
                strokeLinejoin="round" style={{ width: 20, height: 20 }}
                dangerouslySetInnerHTML={{ __html: svg(item.ic) }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{item.n}</div>
              <div style={S.lbl}>{secs[at.si].t}</div>
            </div>
          </div>

          <div style={S.aLbl}>اسم السنّة</div>
          <input value={item.n} style={S.edInput}
            onChange={(e) => patch(item.k, "n", e.target.value)} />

          <div style={S.aLbl}>الحديث أو الفضل — يظهر عند علامة الاستفهام</div>
          <textarea value={item.h} rows={5} style={S.aArea}
            placeholder="«من صلى اثنتي عشرة ركعة في يوم وليلة بُني له بيت في الجنة» — مسلم."
            onChange={(e) => patch(item.k, "h", e.target.value)} />

          <div style={S.aLbl}>القسم</div>
          <select value={secs[at.si].id} style={S.edInput}
            onChange={(e) => moveItem(item.k, e.target.value, null)}>
            {secs.map((s) => <option key={s.id} value={s.id}>{s.t}</option>)}
          </select>

          <div style={S.aLbl}>طريقة التسجيل</div>
          <div style={S.edSeg}>
            <button style={{ ...S.edSegB, ...(item.type === "bool" ? S.edSegOn : {}) }}
              onClick={() => patchMany(item.k, { type: "bool" })}>نعم / لا</button>
            <button style={{ ...S.edSegB, ...(item.type === "cycle" ? S.edSegOn : {}) }}
              onClick={() => patchMany(item.k, { type: "cycle", max: item.max || 5 })}>عدّاد</button>
          </div>

          <div style={{ display: "flex", gap: 9 }}>
            <div style={{ flex: 1 }}>
              <div style={S.aLbl}>الجواهر لكل خطوة</div>
              <NumField value={item.g} min={0} max={99} label="الجواهر"
                onChange={(v) => patch(item.k, "g", v)} />
            </div>
            {item.type === "cycle" && (
              <div style={{ flex: 1 }}>
                <div style={S.aLbl}>نهاية العدّاد</div>
                <NumField value={item.max} min={2} max={99} label="نهاية العدّاد"
                  onChange={(v) => patch(item.k, "max", v)} />
              </div>
            )}
          </div>

          <div style={S.aLbl}>سنّة سريعة — تظهر في لوحة «سنن سريعة»</div>
          <label style={S.edCheck}>
            <input type="checkbox" checked={!!item.q}
              onChange={(e) => patchMany(item.k, e.target.checked
                ? { q: item.q || "١ د", qt: item.qt || "" } : { q: undefined, qt: undefined })} />
            <span>اجعلها سنّة سريعة</span>
          </label>
          {item.q && (
            <div style={{ display: "flex", gap: 9, marginTop: 8 }}>
              <input value={item.q} style={{ ...S.edInput, flex: 1 }} placeholder="٣ د"
                onChange={(e) => patch(item.k, "q", e.target.value)} />
              <input value={item.qt || ""} style={{ ...S.edInput, flex: 2 }} placeholder="تلميح قصير"
                onChange={(e) => patch(item.k, "qt", e.target.value)} />
            </div>
          )}

          <div style={S.aLbl}>أيقونة الواجهة — لا تمسّ ما يُبنى</div>
          <div style={S.aIcons}>
            {ICON_NAMES.map((nm) => (
              <button key={nm} onClick={() => patch(item.k, "ic", nm)}
                style={{ ...S.aIcB, ...(item.ic === nm
                  ? { borderColor: item.c, background: item.c + "1A" } : {}) }}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round" style={{ width: 19, height: 19,
                    stroke: item.ic === nm ? item.c : "var(--sp-mut)" }}
                  dangerouslySetInnerHTML={{ __html: svg(nm) }} />
              </button>
            ))}
          </div>

          <div style={S.aLbl}>اسم ما يُبنى في البستان</div>
          <input value={item.b} style={S.edInput} placeholder="بيت"
            onChange={(e) => patch(item.k, "b", e.target.value)} />

          <div style={S.aLbl}>البناء نفسه — ما يظهر ويكبر في أرض بستانك</div>
          <div style={S.aIcons}>
            {BUILDS.map((nm) => {
              const on = item.i === nm;
              const busy = (usedBuilds[nm] || 0) > 0 && !on;
              return (
                <button key={nm} title={BUILD_AR[nm] || ""} aria-label={BUILD_AR[nm] || ""}
                  onClick={() => patch(item.k, "i", nm)}
                  style={{ ...S.aIcB, ...(on ? { borderColor: item.c, background: item.c + "1A" } : {}),
                           ...(busy ? { opacity: .4 } : {}) }}>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" style={{ width: 19, height: 19,
                      stroke: on ? item.c : "var(--sp-mut)" }}
                    dangerouslySetInnerHTML={{ __html: svg(nm) }} />
                </button>
              );
            })}
          </div>
          <div style={{ ...S.lbl, marginTop: 6 }}>
            الباهت مأخوذ لسنّة أخرى — لو اخترته اشترك البناءان في الموضع نفسه.
          </div>

          <button style={S.edDanger}
            onClick={() => setAsk({ msg: `حذف «${item.n}» نهائيًا؟`, onYes: () => delItem(item.k) })}>
            حذف هذه السنّة
          </button>
          <button style={S.dlgX} onClick={() => setEditKey(null)}>تمّ</button>
        </Overlay>
      )}

      {/* ── محرّر القسم ── */}
      {sec && (
        <Overlay onClose={() => setSecEdit(null)} wide>
          <div style={{ fontSize: 15, fontWeight: 700 }}>إعدادات القسم</div>
          <div style={S.aLbl}>اسم القسم</div>
          <input value={sec.t} style={S.edInput}
            onChange={(e) => patchSec(sec.id, "t", e.target.value)} />

          <div style={S.aLbl}>لون القسم — يلوّن سننه كلها</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SEC_PALETTE.map((c) => (
              <button key={c} onClick={() => patchSec(sec.id, "c", c)}
                aria-label={c} style={{ ...S.edSwatch, background: c,
                  ...(sec.c === c ? { outline: "2px solid var(--sp-txt)", outlineOffset: 2 } : {}) }} />
            ))}
          </div>

          <div style={{ ...S.lbl, marginTop: 14 }}>{ar(sec.items.length)} سنّة في هذا القسم</div>
          <button style={S.edDanger} onClick={() => delSec(sec.id)}>حذف القسم</button>
          <button style={S.dlgX} onClick={() => setSecEdit(null)}>تمّ</button>
        </Overlay>
      )}

      {/* ── تأكيد ── */}
      {ask && (
        <Overlay onClose={() => setAsk(null)}>
          <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.9, textAlign: "center" }}>{ask.msg}</div>
          {ask.only ? (
            <button style={S.dlgX} onClick={() => setAsk(null)}>حسنًا</button>
          ) : (
            <div style={{ display: "flex", gap: 9, marginTop: 15 }}>
              <button style={S.navBtn} onClick={() => setAsk(null)}>تراجع</button>
              <button style={{ ...S.navBtn, ...S.navDanger }}
                onClick={() => { ask.onYes && ask.onYes(); setAsk(null); }}>نعم، أمضِ</button>
            </div>
          )}
        </Overlay>
      )}

      {/* ── التصدير ── */}
      {out && (
        <Overlay onClose={() => setOut(null)} wide>
          <div style={{ fontSize: 15, fontWeight: 700 }}>الصق هذا في SillaBustan.jsx</div>
          <div style={{ ...S.lbl, marginTop: 4 }}>
            استبدل به كتلة <span style={{ direction: "ltr", display: "inline-block" }}>const DEFAULT_SECS=[...]</span> كاملةً
          </div>
          <textarea data-code readOnly value={out} rows={12}
            style={{ ...S.aArea, direction: "ltr", textAlign: "left", fontSize: 12 }} />
          <button style={S.dlgX}
            onClick={() => { navigator.clipboard?.writeText(out); setOut(null); }}>نسخ وإغلاق</button>
        </Overlay>
      )}
    </>
  );
}

/* غلاف مستقلّ — للاستعمال في صفحة خاصّة باللوحة */
export function SillaAdmin({ theme = "light" }) {
  useEffect(() => { hydrateSunan(); hydrateSound(); hydrateTiers(); }, []);
  return (
    <div data-theme={theme} style={S.root} dir="rtl">
      <Styles />
      <SunanEditor />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   <SillaBustan/> — الغلاف: التبويبات (البستان · التعبئة)
   ════════════════════════════════════════════════════════════════════ */
export default function SillaBustan({ theme = "light", initialLog = {}, editable = true }) {
  useEffect(() => { hydrateSunan(); hydrateSound(); hydrateTiers(); }, []);
  const st = useSillaState(initialLog);
  const [tab, setTab] = useState("village");
  return (
    <div data-theme={theme} style={S.root} dir="rtl">
      <Styles />
      {tab === "village" && <Village st={st} theme={theme} />}
      {tab === "rec" && <Recorder st={st} onSave={() => setTab("village")} />}
      {tab === "edit" && <SunanEditor />}
      <div style={S.tabs}>
        <button style={{ ...S.tb, ...(tab === "village" ? S.tbOn : {}) }} onClick={() => setTab("village")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" style={S.tbIc}>
            <path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>
          بستان صِلة
        </button>
        <button style={{ ...S.tb, ...(tab === "rec" ? S.tbOn : {}) }} onClick={() => setTab("rec")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" style={S.tbIc}>
            <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
          التعبئة
        </button>
        {editable && (
          <button style={{ ...S.tb, ...(tab === "edit" ? S.tbOn : {}) }} onClick={() => setTab("edit")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
              strokeLinecap="round" strokeLinejoin="round" style={S.tbIc}>
              <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            تحرير السنن
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   الأنماط — كل الألوان متغيّرات CSS تتبع ثيم الموقع (data-theme)
   ════════════════════════════════════════════════════════════════════ */
function Styles() {
  return (
    <style>{`
      [data-theme="light"]{
        --sp-bg:#F4F6F5; --sp-surf:#FFF; --sp-surf2:#F0F5F3; --sp-line:#E2E9E6;
        --sp-prim:#2F7D74; --sp-mint:#6BBFB2; --sp-mintBg:rgba(107,191,178,.11);
        --sp-gold:#B99442; --sp-goldL:#D4B570; --sp-txt:#1F3B37; --sp-mut:#8B9C98;
        --sp-aura:rgba(185,148,66,.16); --sp-sh:0 2px 10px rgba(31,59,55,.05);
        --sp-scrim:rgba(255,255,255,.93); --sp-danger:#C2544D;
      }
      [data-theme="dark"]{
        --sp-bg:#16262E; --sp-surf:#1D323B; --sp-surf2:#243C46; --sp-line:#2E4B56;
        --sp-prim:#6BBFB2; --sp-mint:#7FCFC2; --sp-mintBg:rgba(127,207,194,.13);
        --sp-gold:#D4B570; --sp-goldL:#E5CF9A; --sp-txt:#EAF2F2; --sp-mut:#93AEB4;
        --sp-aura:rgba(212,181,112,.15); --sp-sh:0 3px 14px rgba(0,0,0,.26);
        --sp-scrim:rgba(29,50,59,.93); --sp-danger:#E0796F;
      }
      input,textarea,select{font-size:16px}
      button{font-family:inherit;cursor:pointer}
      button:disabled{opacity:.35;cursor:default}
      button:focus-visible,[role=button]:focus-visible{outline:2px solid var(--sp-gold);outline-offset:2px}
      /* ارتداد اللمسة — يعطي إحساس اللعبة */
      .sp-tap{transition:transform .12s cubic-bezier(.3,1.6,.5,1)}
      .sp-tap:active{transform:scale(.94)}
      .sp-pop{animation:spPop .9s cubic-bezier(.2,.8,.3,1) forwards}
      @keyframes spPop{
        0%{opacity:0;transform:translate(-50%,0) scale(.7)}
        22%{opacity:1;transform:translate(-50%,-14px) scale(1.12)}
        100%{opacity:0;transform:translate(-50%,-54px) scale(1)}
      }
      /* بطاقات المسار: تدخل متتابعةً، والمفتوح يمرّ عليه بريق */
      .sp-tile{animation:spTile .5s cubic-bezier(.2,1.5,.4,1) both}
      @keyframes spTile{from{opacity:0;transform:translateY(14px) scale(.9)}
                        to{opacity:1;transform:none}}
      .sp-shine::after{content:"";position:absolute;top:-60%;bottom:-60%;width:38%;
        background:linear-gradient(100deg,transparent,rgba(255,255,255,.42),transparent);
        transform:skewX(-18deg);animation:spShine 3.4s ease-in-out infinite;
        pointer-events:none}
      @keyframes spShine{0%{inset-inline-start:-45%}
                         55%,100%{inset-inline-start:115%}}
      @media (prefers-reduced-motion:reduce){
        .sp-tap,.sp-pop,.sp-tile,.sp-shine::after{transition:none;animation:none}
      }
    `}</style>
  );
}

const S = {
  root: { minHeight: "100vh", background: "var(--sp-bg)", color: "var(--sp-txt)",
          fontFamily: "'IBM Plex Sans Arabic',system-ui,sans-serif", direction: "rtl",
          paddingBottom: 88, transition: "background .3s,color .3s" },
  wrap: { maxWidth: 470, margin: "0 auto", padding: 14 },
  lbl: { fontSize: 11, color: "var(--sp-mut)" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  h1: { fontSize: 17, fontWeight: 700 },
  sub: { fontSize: 10.5, color: "var(--sp-mut)" },
  stat: { background: "var(--sp-surf)", border: "1px solid var(--sp-line)", borderRadius: 13,
          padding: "7px 13px", textAlign: "center", boxShadow: "var(--sp-sh)" },
  rankRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
             background: "var(--sp-surf)", borderWidth: 1.5, borderStyle: "solid",
             borderRadius: 15, padding: "9px 12px", boxShadow: "var(--sp-sh)" },
  rankB: { color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 10,
           padding: "5px 12px", flexShrink: 0 },
  rankBar: { height: 7, borderRadius: 5, background: "var(--sp-bg)", overflow: "hidden" },
  rankFill: { height: "100%", borderRadius: 5, transition: "width .7s cubic-bezier(.2,.9,.3,1)" },
  rankT: { fontSize: 9.5, color: "var(--sp-mut)", marginTop: 4 },
  edPerks: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 },
  edPerk: { display: "flex", alignItems: "center", gap: 7, borderRadius: 11,
            borderWidth: 1.5, borderStyle: "solid", borderColor: "var(--sp-line)",
            background: "var(--sp-bg)", padding: "8px 9px", textAlign: "right" },
  edPerkN: { fontSize: 10.5, fontWeight: 600, color: "var(--sp-txt)" },
  tkHead: { display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, marginBottom: 12 },
  tkGems: { background: "var(--sp-aura)", borderWidth: 1, borderStyle: "solid",
            borderColor: "var(--sp-goldL)", color: "var(--sp-gold)", borderRadius: 11,
            padding: "6px 11px", fontSize: 12.5, fontWeight: 700, flexShrink: 0 },
  tkRail: { position: "relative", height: 8, borderRadius: 5, background: "var(--sp-bg)",
            marginBottom: 16 },
  tkRailFill: { height: "100%", borderRadius: 5,
                background: "linear-gradient(90deg,var(--sp-mint),var(--sp-gold))",
                transition: "width .8s cubic-bezier(.2,.9,.3,1)" },
  tkPin: { position: "absolute", top: -2, width: 5, height: 12, borderRadius: 3,
           transform: "translateX(50%)" },
  tkReel: { display: "flex", gap: 10, overflowX: "auto", padding: "4px 2px 12px",
            scrollSnapType: "x proximity" },
  tkCard: { position: "relative", flexShrink: 0, width: 132, borderRadius: 18,
            borderWidth: 2, borderStyle: "solid", padding: "14px 10px 12px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            scrollSnapAlign: "center", overflow: "hidden", textAlign: "center" },
  tkBadge: { position: "absolute", top: 8, insetInlineEnd: 8, width: 22, height: 22,
             borderRadius: "50%", fontSize: 11, fontWeight: 700,
             display: "flex", alignItems: "center", justifyContent: "center" },
  tkNow: { position: "absolute", top: 10, insetInlineStart: 9, fontSize: 8.5,
           fontWeight: 700, background: "#fff", borderRadius: 6, padding: "2px 6px" },
  tkIc: { position: "relative", width: 62, height: 62, borderRadius: 20, marginTop: 12,
          borderWidth: 1.5, borderStyle: "solid",
          display: "flex", alignItems: "center", justifyContent: "center" },
  tkLock: { position: "absolute", bottom: -3, insetInlineEnd: -3, width: 21, height: 21,
            borderRadius: "50%", borderWidth: 2, borderStyle: "solid",
            display: "flex", alignItems: "center", justifyContent: "center" },
  tkName: { fontSize: 11.5, fontWeight: 700, lineHeight: 1.35, minHeight: 30 },
  tkTier: { fontSize: 10, fontWeight: 600 },
  tkNeed: { fontSize: 10.5, fontWeight: 700, borderRadius: 8, padding: "4px 10px", marginTop: 2 },
  tkTip: { textAlign: "center", fontSize: 10, color: "var(--sp-mut)", marginTop: 2 },
  pvBar: { display: "flex", alignItems: "center", gap: 7, marginBottom: 10,
           background: "var(--sp-surf)", borderWidth: 1.5, borderStyle: "solid",
           borderRadius: 15, padding: "7px 9px", boxShadow: "var(--sp-sh)" },
  pvNav: { width: 30, height: 30, flexShrink: 0, borderRadius: 10,
           borderWidth: 1, borderStyle: "solid", borderColor: "var(--sp-line)",
           background: "var(--sp-bg)", color: "var(--sp-prim)", padding: 0,
           display: "flex", alignItems: "center", justifyContent: "center" },
  pvX: { flexShrink: 0, borderRadius: 10, borderWidth: 0, padding: "7px 11px",
         fontSize: 11, fontWeight: 700, color: "#fff", background: "var(--sp-prim)" },
  trackB: { flexShrink: 0, borderWidth: 1, borderStyle: "solid", borderColor: "var(--sp-line)",
            background: "var(--sp-bg)", color: "var(--sp-prim)", borderRadius: 11,
            padding: "7px 12px", fontSize: 11.5, fontWeight: 700 },
  trRow: { display: "flex", gap: 10, alignItems: "stretch" },
  trRail: { width: 30, flexShrink: 0, display: "flex", flexDirection: "column",
            alignItems: "center" },
  trLineWrap: { width: 3, flex: 1, minHeight: 16, borderRadius: 2,
                background: "var(--sp-line)", display: "flex", flexDirection: "column",
                justifyContent: "flex-end", overflow: "hidden" },
  trLine: { width: "100%", borderRadius: 2, transition: "height .6s ease" },
  trNode: { width: 28, height: 28, borderRadius: "50%", flexShrink: 0, margin: "4px 0",
            borderWidth: 2, borderStyle: "solid", fontSize: 12, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center" },
  trCard: { flex: 1, minWidth: 0, marginBottom: 10, borderWidth: 1.5, borderStyle: "solid",
            borderRadius: 14, padding: "10px 12px", background: "var(--sp-surf2)" },
  trIc: { width: 34, height: 34, borderRadius: 11, flexShrink: 0, borderWidth: 1.5,
          borderStyle: "solid", display: "flex", alignItems: "center", justifyContent: "center" },
  trSub: { fontSize: 9.5, color: "var(--sp-mut)", marginTop: 3,
           display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0 5px" },
  trD: { fontSize: 10, color: "var(--sp-mut)", lineHeight: 1.7, marginTop: 7 },
  trNeed: { fontSize: 10, fontWeight: 700, marginTop: 5 },
  rankBig: { fontSize: 30, fontWeight: 700, lineHeight: 1.3, margin: "2px 0 8px" },
  rankRing: { width: 54, height: 54, margin: "0 auto", borderRadius: "50%",
              borderWidth: 3, borderStyle: "solid" },
  statN: { fontSize: 18, fontWeight: 700, color: "var(--sp-gold)", lineHeight: 1 },
  statL: { fontSize: 9, color: "var(--sp-mut)" },
  /* المشهد */
  stage: { position: "relative", borderRadius: 18, overflow: "hidden",
           borderWidth: 1, borderStyle: "solid", borderColor: "var(--sp-line)",
           boxShadow: "var(--sp-sh)",
           marginBottom: 10, touchAction: "none" },
  stageFull: { position: "fixed", inset: 0, zIndex: 60, borderRadius: 0,
               marginBottom: 0, borderWidth: 0, height: "100dvh" },
  fullB: { position: "absolute", top: 10, right: 10, zIndex: 8, width: 34, height: 34,
           borderRadius: 11, borderWidth: 1, borderStyle: "solid",
           borderColor: "rgba(255,255,255,.35)", background: "rgba(20,40,36,.42)",
           color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
           backdropFilter: "blur(4px)", padding: 0 },
  pad: { position: "absolute", bottom: 11, left: 11, width: 84, height: 84, borderRadius: "50%",
         background: "rgba(255,255,255,.2)", border: "1px solid rgba(255,255,255,.3)",
         backdropFilter: "blur(4px)" },
  knob: { position: "absolute", width: 36, height: 36, borderRadius: "50%", left: 24, top: 24,
          background: "radial-gradient(circle at 35% 30%,var(--sp-goldL),var(--sp-gold))",
          boxShadow: "0 2px 9px rgba(0,0,0,.35)" },
  /* بطاقة البناء عند اللمس */
  card: { position: "absolute", left: 11, right: 11, bottom: 11, zIndex: 6, cursor: "pointer",
          background: "var(--sp-scrim)", borderWidth: 1.5, borderStyle: "solid",
          borderColor: "var(--sp-goldL)", borderRadius: 16, padding: "11px 13px 9px",
          backdropFilter: "blur(6px)", boxShadow: "0 6px 20px rgba(0,0,0,.18)" },
  cardTop: { display: "flex", alignItems: "center", gap: 10 },
  cardIc: { width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center" },
  cardB: { fontSize: 14, fontWeight: 700, lineHeight: 1.2 },
  cardN: { fontSize: 10, color: "var(--sp-mut)", marginTop: 2 },
  cardCount: { flexShrink: 0, fontSize: 12, fontWeight: 700, color: "var(--sp-gold)",
               background: "var(--sp-aura)", borderRadius: 9, padding: "4px 9px" },
  cardH: { fontSize: 10.5, color: "var(--sp-mut)", lineHeight: 1.8, marginTop: 8,
           maxHeight: 62, overflowY: "auto" },
  cardX: { fontSize: 8.5, color: "var(--sp-mut)", textAlign: "center", marginTop: 7, opacity: .7 },
  zc: { position: "absolute", top: 0, right: 0, left: 0, padding: "7px 13px 14px",
        background: "linear-gradient(180deg,var(--sp-scrim),transparent)",
        display: "flex", alignItems: "baseline", gap: 8, pointerEvents: "none" },
  zn: { fontSize: 11.5, fontWeight: 700, color: "var(--sp-gold)", whiteSpace: "nowrap" },
  zh: { fontSize: 9.5, color: "var(--sp-mut)", whiteSpace: "nowrap",
        overflow: "hidden", textOverflow: "ellipsis" },
  pvBig: { width: "100%", borderWidth: 1.5, borderStyle: "dashed", borderColor: "var(--sp-goldL)",
           background: "var(--sp-surf)",
           borderRadius: 15, padding: 13, fontSize: 12, fontWeight: 600, color: "var(--sp-gold)",
           display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 12 },
  pvOn: { background: "linear-gradient(135deg,var(--sp-goldL),var(--sp-gold))", color: "#fff",
          borderStyle: "solid", borderColor: "var(--sp-gold)" },
  slid: { background: "var(--sp-surf)", border: "1px solid var(--sp-line)", borderRadius: 16,
          padding: "13px 16px", boxShadow: "var(--sp-sh)" },
  slTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 },
  slDate: { fontSize: 13, fontWeight: 700 },
  slGreg: { fontSize: 9.5, color: "var(--sp-mut)" },
  slBuilt: { fontSize: 10.5, color: "var(--sp-gold)", fontWeight: 600 },
  slEnds: { display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--sp-mut)" },
  /* شريط الأيام */
  dayStrip: { display: "flex", gap: 7, overflowX: "auto", padding: "3px 2px 10px",
              scrollSnapType: "x proximity", WebkitOverflowScrolling: "touch" },
  dChip: { flexShrink: 0, width: 52, padding: "7px 4px 6px", borderRadius: 14,
           background: "var(--sp-surf)", color: "var(--sp-txt)",
           borderWidth: 1.5, borderStyle: "solid", borderColor: "var(--sp-line)",
           display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
           cursor: "pointer", scrollSnapAlign: "center",
           transition: "border-color .2s, background .2s" },
  dChipSel: { borderColor: "var(--sp-gold)", background: "var(--sp-surf2)",
              boxShadow: "var(--sp-sh)" },
  dWd: { fontSize: 8.5, color: "var(--sp-mut)", lineHeight: 1, whiteSpace: "nowrap" },
  dh: { fontSize: 16, fontWeight: 700, lineHeight: 1.05 },
  dm: { width: 5, height: 5, borderRadius: "50%" },
  dFull: { textAlign: "center", fontSize: 10.5, color: "var(--sp-mut)", marginBottom: 12 },
  /* الحلقة */
  topBar: { display: "flex", alignItems: "center", gap: 13, background: "var(--sp-surf)",
            border: "1px solid var(--sp-line)", borderRadius: 17, padding: "13px 15px",
            marginBottom: 13, boxShadow: "var(--sp-sh)" },
  gemN: { fontSize: 23, fontWeight: 700, color: "var(--sp-gold)", lineHeight: 1 },
  /* سنن سريعة */
  quickB: { width: "100%", border: "1.5px solid var(--sp-mint)", background: "var(--sp-mintBg)",
            borderRadius: 15, padding: "13px 15px", fontSize: 13, fontWeight: 700,
            color: "var(--sp-mint)", display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: 12 },
  qIc: { width: 40, height: 40, borderRadius: 13, flexShrink: 0,
         background: "linear-gradient(140deg,var(--sp-mint),var(--sp-prim))",
         display: "flex", alignItems: "center", justifyContent: "center" },
  qRow: { display: "flex", alignItems: "center", gap: 11, padding: 11, borderRadius: 13,
          background: "var(--sp-surf2)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--sp-line)",
          marginBottom: 8, cursor: "pointer" },
  qRowIc: { width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center" },
  qTime: { fontSize: 10, fontWeight: 700, background: "var(--sp-mintBg)",
           borderRadius: 8, padding: "4px 8px", flexShrink: 0 },
  /* الأقسام */
  secTabs: { display: "flex", gap: 7, overflowX: "auto", padding: "2px 1px 12px" },
  sTab: { flexShrink: 0, padding: "9px 14px", borderRadius: 13, background: "var(--sp-surf)",
          borderWidth: 1, borderStyle: "solid", borderColor: "var(--sp-line)",
          cursor: "pointer", textAlign: "center" },
  sTabOn: { background: "var(--sp-prim)", borderColor: "var(--sp-prim)", color: "#fff" },
  sTabDone: { borderColor: "var(--sp-gold)" },
  st: { fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" },
  sc: { fontSize: 9, opacity: .8, marginTop: 2 },
  /* شبكة المربّعات */
  grid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9, marginBottom: 14 },
  sq: { position: "relative", aspectRatio: "1", background: "var(--sp-surf)",
        borderWidth: 1.5, borderStyle: "solid", borderColor: "var(--sp-line)",
        borderRadius: 17, padding: "9px 6px",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 4, cursor: "pointer", boxShadow: "var(--sp-sh)" },
  sqIc: { width: 42, height: 42, borderRadius: 12, display: "flex", flexShrink: 0,
          alignItems: "center", justifyContent: "center", transition: "all .25s" },
  sqN: { fontSize: 9.5, fontWeight: 600, lineHeight: 1.25, textAlign: "center" },
  /* العدّاد في وسط الكرت تحت اسم السنّة */
  sqCount: { minWidth: 38, height: 20, padding: "0 9px", borderRadius: 10,
             borderWidth: 1.2, borderStyle: "solid", fontSize: 11, fontWeight: 700,
             letterSpacing: .3, display: "flex", alignItems: "center",
             justifyContent: "center", textAlign: "center" },
  sqI: { position: "absolute", top: 6, left: 6, width: 20, height: 20, borderRadius: "50%",
         borderWidth: 1, borderStyle: "solid", borderColor: "var(--sp-line)",
         background: "var(--sp-bg)", color: "var(--sp-mut)", padding: 0,
         display: "flex", alignItems: "center", justifyContent: "center" },
  sqD: { position: "absolute", top: 6, right: 6, width: 17, height: 17, borderRadius: "50%",
         color: "#fff", fontSize: 9.5, display: "flex", alignItems: "center", justifyContent: "center" },
  navRow: { display: "flex", gap: 9, marginBottom: 13 },
  navBtn: { flex: 1, borderWidth: 1, borderStyle: "solid", borderColor: "var(--sp-line)",
            background: "var(--sp-surf)",
            borderRadius: 13, padding: 12, fontSize: 12.5, fontWeight: 600, color: "var(--sp-prim)" },
  navPri: { background: "var(--sp-prim)", color: "#fff", borderColor: "var(--sp-prim)" },
  navDanger: { background: "var(--sp-danger)", color: "#fff", borderColor: "var(--sp-danger)" },
  pop: { position: "fixed", zIndex: 70, pointerEvents: "none", fontSize: 15, fontWeight: 700,
         textShadow: "0 1px 3px rgba(0,0,0,.25)", whiteSpace: "nowrap" },
  gridEmpty: { gridColumn: "1 / -1", border: "1.5px dashed var(--sp-line)", borderRadius: 15,
               padding: 20, textAlign: "center", fontSize: 11, color: "var(--sp-mut)" },
  saveB: { width: "100%", border: "none", borderRadius: 15, padding: 16, fontSize: 15,
           fontWeight: 700, color: "#fff", background: "var(--sp-prim)",
           boxShadow: "0 3px 12px rgba(47,125,116,.2)" },
  /* نوافذ */
  ov: { position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center",
        justifyContent: "center", background: "rgba(16,31,29,.78)",
        backdropFilter: "blur(5px)", padding: 22 },
  dlg: { background: "var(--sp-surf)", border: "1px solid var(--sp-goldL)", borderRadius: 20,
         padding: 24, maxWidth: 330, width: "100%", maxHeight: "84vh", overflowY: "auto",
         fontFamily: "'IBM Plex Sans Arabic',sans-serif", direction: "rtl", color: "var(--sp-txt)" },
  dlgIc: { width: 54, height: 54, margin: "0 auto 12px", borderRadius: 15,
           display: "flex", alignItems: "center", justifyContent: "center" },
  dlgH: { fontSize: 12, color: "var(--sp-mut)", lineHeight: 1.9, marginTop: 9 },
  dlgB: { marginTop: 13, padding: "10px 6px", borderRadius: 12, background: "var(--sp-mintBg)",
          border: "1px solid var(--sp-mint)", color: "var(--sp-mint)", fontWeight: 600,
          display: "flex", alignItems: "stretch" },
  dlgBHalf: { flex: 1, minWidth: 0, textAlign: "center", padding: "0 6px" },
  dlgBK: { fontSize: 9.5, opacity: .8, fontWeight: 600, marginBottom: 3 },
  dlgBV: { fontSize: 12.5, fontWeight: 700, lineHeight: 1.3 },
  dlgBSep: { width: 1, alignSelf: "stretch", background: "currentColor", opacity: .3, flexShrink: 0 },
  dlgX: { width: "100%", border: "none", borderRadius: 13, padding: 12, fontSize: 13.5,
          fontWeight: 700, color: "#fff", background: "var(--sp-prim)", marginTop: 15 },
  /* شريط الشهر */
  mBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          background: "var(--sp-surf)", border: "1px solid var(--sp-line)", borderRadius: 15,
          padding: "9px 8px", marginBottom: 10, boxShadow: "var(--sp-sh)" },
  mArrow: { width: 34, height: 34, borderRadius: 11, flexShrink: 0, fontSize: 19, lineHeight: 1,
            border: "1px solid var(--sp-line)", background: "var(--sp-bg)", color: "var(--sp-prim)" },
  mArrowOff: { opacity: .3 },
  mName: { fontSize: 14, fontWeight: 700 },
  mSub: { fontSize: 9.5, color: "var(--sp-mut)", marginTop: 1 },
  /* لوحة الإدارة */
  expB: { border: "1px solid var(--sp-gold)", background: "var(--sp-surf)", color: "var(--sp-gold)",
          borderRadius: 12, padding: "8px 15px", fontSize: 12.5, fontWeight: 700 },
  aSec: { border: "1px solid var(--sp-line)", background: "var(--sp-surf)", borderRadius: 15,
          padding: 10, marginBottom: 10, boxShadow: "var(--sp-sh)" },
  aSecH: { display: "flex", alignItems: "center", gap: 7, marginBottom: 8 },
  aDotC: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  aEmpty: { border: "1.5px dashed var(--sp-line)", borderRadius: 12, padding: 14,
            textAlign: "center", fontSize: 11, color: "var(--sp-mut)" },
  aRow: { display: "flex", alignItems: "center", gap: 9, padding: 8, borderRadius: 12,
          background: "var(--sp-surf2)", border: "1px solid var(--sp-line)", marginBottom: 6,
          cursor: "grab", touchAction: "none", userSelect: "none" },
  aGrip: { color: "var(--sp-mut)", fontSize: 15, flexShrink: 0, letterSpacing: -2 },
  aB: { fontSize: 9.5, color: "var(--sp-mut)", marginTop: 3,
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0 5px" },
  aBSep: { opacity: .45 },
  ghost: { position: "fixed", zIndex: 90, transform: "translate(-50%,-50%) rotate(-2deg)",
           pointerEvents: "none", display: "flex", alignItems: "center", gap: 7,
           background: "var(--sp-surf)", borderWidth: 2, borderStyle: "solid", borderRadius: 12,
           padding: "8px 13px", fontSize: 12, fontWeight: 700,
           boxShadow: "0 8px 22px rgba(0,0,0,.22)" },
  aLbl: { fontSize: 11, fontWeight: 700, color: "var(--sp-mut)", margin: "14px 0 6px" },
  aArea: { width: "100%", boxSizing: "border-box", borderRadius: 12, padding: 10, fontSize: 16,
           lineHeight: 1.8, border: "1px solid var(--sp-line)", background: "var(--sp-bg)",
           color: "var(--sp-txt)", fontFamily: "inherit", resize: "vertical" },
  aIcons: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5,
            maxHeight: 150, overflowY: "auto" },
  aIcB: { aspectRatio: "1", borderRadius: 10, borderWidth: 1.5, borderStyle: "solid",
          borderColor: "var(--sp-line)", background: "var(--sp-bg)",
          display: "flex", alignItems: "center", justifyContent: "center" },
  /* محرّر السنن */
  edBtn: { border: "1px solid var(--sp-line)", background: "var(--sp-surf)", color: "var(--sp-prim)",
           borderRadius: 12, padding: "8px 13px", fontSize: 12.5, fontWeight: 700 },
  edTip: { border: "1px solid var(--sp-line)", background: "var(--sp-surf2)", borderRadius: 13,
           padding: "10px 12px", fontSize: 10.5, lineHeight: 1.9, color: "var(--sp-mut)",
           marginBottom: 12 },
  edSecName: { flex: 1, minWidth: 0, border: "1px solid var(--sp-line)", background: "var(--sp-bg)",
               borderRadius: 9, padding: "5px 8px", fontSize: 16, fontWeight: 700,
               color: "var(--sp-txt)", fontFamily: "inherit" },
  edMini: { width: 27, height: 27, flexShrink: 0, borderRadius: 9, fontSize: 13, lineHeight: 1,
            border: "1px solid var(--sp-line)", background: "var(--sp-bg)", color: "var(--sp-mut)" },
  edPen: { color: "var(--sp-mut)", fontSize: 13, flexShrink: 0 },
  edAdd: { width: "100%", border: "1.5px dashed var(--sp-line)", background: "transparent",
           borderRadius: 12, padding: 10, fontSize: 11, fontWeight: 600, color: "var(--sp-prim)" },
  edInput: { width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "10px 11px",
             fontSize: 16, border: "1px solid var(--sp-line)", background: "var(--sp-bg)",
             color: "var(--sp-txt)", fontFamily: "inherit" },
  edSeg: { display: "flex", gap: 7 },
  edSegB: { flex: 1, borderRadius: 12, padding: 10, fontSize: 12, fontWeight: 700,
            borderWidth: 1, borderStyle: "solid", borderColor: "var(--sp-line)",
            background: "var(--sp-bg)", color: "var(--sp-mut)" },
  edSegOn: { background: "var(--sp-prim)", borderColor: "var(--sp-prim)", color: "#fff" },
  edCheck: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600,
             cursor: "pointer" },
  edSwatch: { width: 30, height: 30, borderRadius: "50%", border: "none", flexShrink: 0 },
  edNum: { display: "flex", alignItems: "center", gap: 4, borderRadius: 12, padding: 4,
           borderWidth: 1, borderStyle: "solid", borderColor: "var(--sp-line)",
           background: "var(--sp-bg)" },
  edNumB: { width: 34, height: 34, flexShrink: 0, borderRadius: 9, fontSize: 17, lineHeight: 1,
            border: "none", background: "var(--sp-surf)", color: "var(--sp-prim)", fontWeight: 700 },
  edNumV: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: 700 },
  edDanger: { width: "100%", border: "1px solid var(--sp-danger)", background: "transparent",
              color: "var(--sp-danger)", borderRadius: 13, padding: 11, fontSize: 12.5,
              fontWeight: 700, marginTop: 18 },
  /* تبويبات */
  tabs: { position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--sp-surf)",
          borderTop: "1px solid var(--sp-line)", display: "flex", zIndex: 40, padding: "7px 0 10px" },
  tb: { flex: 1, border: "none", background: "none", fontSize: 10.5, color: "var(--sp-mut)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: 4 },
  tbOn: { color: "var(--sp-prim)", fontWeight: 700 },
  tbIc: { width: 19, height: 19 },
};
