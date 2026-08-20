"use client";

/* ════════════════════════════════════════════════════════════════════════════
   SillaParadise.jsx — «جنّة صِلة» · برنامج أسوة
   ─────────────────────────────────────────────────────────────────────────────
   مرجع تصميم وسلوك. اقرأ CLAUDE.md أولًا — فيه المواصفات الكاملة.

   الفكرة: الطالب يسجّل سننه اليومية، وكل سنّة تبني شيئًا في جنّته.
           الجنّة مساحة محدودة يتجوّل فيها وتنمو حتى تكتمل في ٣٠ يومًا.

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
const W = 1080, H = 830;               // أبعاد أرض الجنّة
const PAD = 52;                        // شريط السور حول الأرض
const IN = { x: PAD, y: PAD, w: W - PAD * 2, h: H - PAD * 2 };
const ZOOM = 0.44;                     // تكبير ثابت — الجنّة مصغّرة دائمًا

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
   هذه أيقونات واجهة فقط: تغييرها لا يغيّر ما يُبنى في الجنّة. */
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
   b: ما يبنيه في الجنّة · h: الحديث أو الفضل
   q/qt: وسم السنن السريعة (الوقت والتلميح)                                  */

const DEFAULT_SECS=[
 {id:'salah',t:'سنن الصلاة',items:[
  {k:'iqama',n:'إقامة الصلاة',i:'mihrab',b:'محراب',type:'cycle',max:5,g:2,
   h:'«الصلاة عماد الدين» — يرتفع محرابك مع كل صلاة تقيمها.'},
  {k:'r12',n:'١٢ ركعة سنة',i:'house',b:'بيت في الجنة',type:'bool',g:10,
   h:'«من صلى اثنتي عشرة ركعة في يوم وليلة بُني له بيت في الجنة» — مسلم.'},
  {k:'waqt',n:'الصلاة على وقتها',i:'sundial',b:'ساعة شمسية',type:'cycle',max:5,g:2,
   h:'سُئل ﷺ أيّ العمل أحبّ إلى الله؟ قال: «الصلاة على وقتها».'},
  {k:'mubah',n:'الصلاة ضمن الوقت المباح',i:'minaret',b:'مئذنة',type:'cycle',max:5,g:1,
   h:'المحافظة على أدائها في وقتها المشروع — ترتفع مئذنتك كلما حافظت.'},
  {k:'tawaj',n:'دعاء التوجه',i:'gate',b:'بوابة',type:'cycle',max:5,g:1,
   h:'«وجّهت وجهي للذي فطر السماوات والأرض» — بابٌ تدخل منه إلى جنّتك.'},
  {k:'muk',n:'المكوث',i:'rug',b:'سجادة',type:'bool',g:4,q:'٥ د',qt:'امكث بعد صلاة واحدة',
   h:'«الملائكة تصلي على أحدكم ما دام في مصلاه: اللهم اغفر له، اللهم ارحمه».'}]},
 {id:'dhikr',t:'الأذكار والاستشفاع',items:[
  {k:'tahlil',n:'١٠٠ تهليل',i:'palm',b:'نخلة',type:'bool',g:6,q:'٣ د',qt:'١٠٠ تهليل — دقائق وأنت ماشٍ',
   h:'«من قال سبحان الله العظيم وبحمده غُرست له نخلة في الجنة» — الترمذي.'},
  {k:'dubur',n:'٣٣ دبر كل صلاة',i:'garden',b:'بستان',type:'cycle',max:5,g:2,
   h:'«معقّبات لا يخيب قائلهنّ» — يتّسع بستانك مع كل تسبيح.'},
  {k:'shafa',n:'استشفاع',i:'dome',b:'قبة نور',type:'bool',g:8,q:'١ د',qt:'عشر صلوات على النبي ﷺ',
   h:'«من صلى عليّ صلاةً واحدة صلى الله عليه بها عشرًا» — تشعّ قبّة النور في جنّتك.'},
  {k:'basm',n:'البسملة',i:'pattern',b:'نقش',type:'bool',g:2,q:'ثوانٍ',qt:'قلها عند أي عمل تبدؤه',
   h:'«كل أمر ذي بال لا يُبدأ فيه ببسم الله فهو أبتر» — نقشٌ يزيّن جنّتك.'},
  {k:'tard',n:'طاردات الشيطان',i:'fort',b:'حصن',type:'bool',g:4,q:'٢ د',qt:'أذكار تحصّنك',
   h:'الأذكار حصنٌ من الشيطان — يعلو سور حصنك يومًا بعد يوم.'}]},
 {id:'tuhr',t:'سنن الطهارة',items:[
  {k:'wudu',n:'سنن الوضوء',i:'fountain',b:'نافورة',type:'cycle',max:5,g:2,
   h:'«من توضأ فأحسن الوضوء خرجت خطاياه من جسده حتى تخرج من تحت أظفاره».'},
  {k:'onwudu',n:'البقاء على وضوء',i:'stream',b:'جدول ماء',type:'bool',g:4,
   h:'«لا يحافظ على الوضوء إلا مؤمن» — جدولٌ يجري في أرض جنّتك.'},
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
   h:'«تبسّمك في وجه أخيك صدقة» — تتفتّح زهرة في جنّتك.'},
  {k:'salam',n:'السلام',i:'path',b:'ممر',type:'bool',g:2,q:'ثوانٍ',qt:'ألقِ السلام على من تمرّ به',
   h:'«أفشوا السلام بينكم تحابّوا» — يمتدّ ممرّك بين البيوت.'},
  {k:'shukr',n:'الشكر',i:'fruit',b:'شجرة مثمرة',type:'bool',g:2,q:'١ د',qt:'اشكر الله واشكر من أحسن إليك',
   h:'«لئن شكرتم لأزيدنّكم» — تثمر شجرتك بشكرك.'},
  {k:'lisan',n:'تجنب آفات اللسان',i:'spring',b:'ينبوع صافٍ',type:'bool',g:5,
   h:'«من صمت نجا» — يصفو ينبوعك بصمتك عمّا لا يعني.'},
  {k:'tariq',n:'آداب الطريق',i:'lamp',b:'مصباح',type:'bool',g:2,
   h:'«إماطة الأذى عن الطريق صدقة» — يضيء مصباح في طريق جنّتك.'},
  {k:'jalis',n:'الشرب جالسًا',i:'well',b:'بئر',type:'bool',g:2,q:'ثوانٍ',qt:'اجلس عند شربك',
   h:'من هديه ﷺ في شرابه — يُحفر بئرٌ في أرضك.'}]},
 {id:'layl',t:'سنن الليل',items:[
  {k:'nawm',n:'سنن النوم',i:'crescent',b:'هلال',type:'bool',g:3,q:'٢ د',qt:'وضوء واضطجاع على الأيمن',
   h:'«إذا أويت إلى فراشك فتوضأ وضوءك للصلاة، ثم اضطجع على شقك الأيمن».'},
  {k:'kursi',n:'آية الكرسي',i:'shieldL',b:'درع نور',type:'bool',g:5,q:'١ د',qt:'آية واحدة قبل نومك',
   h:'«لا يزال عليك من الله حافظ ولا يقربك شيطان حتى تصبح».'},
  {k:'himaya',n:'دعاء الحماية',i:'fence',b:'سياج نور',type:'bool',g:3,q:'١ د',qt:'دعاء المساء',
   h:'«من قالها حين يمسي لم يضره شيء» — سياجٌ يحوط جنّتك.'}]}];

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
        const it = {
          ...i, k: String(i.k), n: String(i.n || ""), i: i.i, ic: i.ic || i.i,
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

/* ════════ التاريخ الهجري ════════ */
export const HM = ["محرّم","صفر","ربيع الأول","ربيع الآخر","جمادى الأولى","جمادى الآخرة",
                   "رجب","شعبان","رمضان","شوّال","ذو القعدة","ذو الحجة"];
export const GM = ["يناير","فبراير","مارس","أبريل","مايو","يونيو",
                   "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

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
   البرنامج يستمرّ طوال السنة: كل شهر هجري جنّة مستقلّة تُبنى في ٣٠ يومًا،
   والشهور السابقة تبقى أرشيفًا يُتصفَّح. اقلب MONTHLY إلى false لجنّة واحدة
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
      d[k] = i.type === "bool" ? (b ? 0 : 1) : b >= i.max ? 0 : b + 1;
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

function shadow(x, y, w, h, op) {
  for (let i = 3; i >= 1; i--) {
    X.fillStyle = `rgba(20,35,30,${(op || 0.2) / i / 1.7})`;
    X.beginPath(); X.ellipse(x + w * 0.18, y + 2, w * (1 + i * 0.13), h * (1 + i * 0.13), 0, 0, 7); X.fill();
  }
}
function lit(x, y, w, c1, c2) {
  const g = X.createLinearGradient(x - w / 2, y, x + w / 2, y);
  g.addColorStop(0, c1); g.addColorStop(1, c2); return g;
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
 const k=Math.min(n,30);
 for(let i=0;i<k;i++){const[a,b,o]=WALL[i];
  const w=o==='h'?62:34,h=o==='h'?34:62;
  shadow(a,b+h/2-4,w*.42,7,.18);
  X.fillStyle=lit(a,b,w,DK()?'#7E948C':'#C0CCC0',DK()?'#3E5A54':'#8A9C90');
  X.fillRect(a-w/2,b-h/2,w,h);
  X.strokeStyle='rgba(0,0,0,.1)';X.lineWidth=1;
  for(let r=1;r<3;r++){X.beginPath();
   if(o==='h'){X.moveTo(a-w/2,b-h/2+r*11);X.lineTo(a+w/2,b-h/2+r*11)}
   else{X.moveTo(a-w/2+r*11,b-h/2);X.lineTo(a-w/2+r*11,b+h/2)}X.stroke()}
  X.fillStyle=DK()?'#94AAA2':'#D4DED4';
  if(o==='h')for(let j=0;j<3;j++)X.fillRect(a-w/2+4+j*20,b-h/2-8,12,8);
  else for(let j=0;j<3;j++)X.fillRect(a+w/2,b-h/2+4+j*20,8,12);
  X.fillStyle='rgba(255,255,255,.15)';
  if(o==='h')X.fillRect(a-w/2,b-h/2,w,4);else X.fillRect(a-w/2,b-h/2,4,h)}};

/* ── بيوت الرواتب: حيّ يصل ٣٠ بيتًا ── */
DRAW.house=(x,y,n)=>{const k=Math.min(n,30);
 for(let i=0;i<k;i++){const c=i%6,r=Math.floor(i/6);
 const a=x+c*44-110,b=y+r*36-54;shadow(a,b,16,5);
 X.fillStyle=lit(a,b,26,DK()?'#D6C79A':'#F2E7CE',DK()?'#9E8E67':'#C4B394');
 X.fillRect(a-13,b-17,26,17);
 const rg=X.createLinearGradient(a-17,b-30,a+17,b-17);
 rg.addColorStop(0,DK()?'#C08A50':'#DBA968');rg.addColorStop(1,DK()?'#7E5A32':'#A87B47');
 X.fillStyle=rg;X.beginPath();X.moveTo(a-17,b-17);X.lineTo(a,b-30);X.lineTo(a+17,b-17);X.fill();
 X.fillStyle='rgba(0,0,0,.13)';X.beginPath();X.moveTo(a,b-30);X.lineTo(a+17,b-17);X.lineTo(a+5,b-17);X.fill();
 X.fillStyle=DK()?'#5E4530':'#7A5A3A';X.fillRect(a-4,b-10,8,10);
 X.fillStyle='#FFEBAE';X.fillRect(a-10,b-14,5,5);X.fillRect(a+5,b-14,5,5)}};

/* ── المحراب: يعلو ويتعدّد ── */
DRAW.mihrab=(x,y,n)=>{const k=Math.min(Math.ceil(n/6),5);
 for(let i=0;i<k;i++){const o=i*30-((k-1)*15),h=32+Math.min(n,30)*.7;
 shadow(x+o,y,11,4);
 X.fillStyle=lit(x+o,y,20,DK()?'#E0CB96':'#F5EBD4',DK()?'#A8935F':'#C9BB98');
 X.beginPath();X.moveTo(x+o-10,y);X.lineTo(x+o-10,y-h+11);
 X.quadraticCurveTo(x+o,y-h-7,x+o+10,y-h+11);X.lineTo(x+o+10,y);X.fill();
 X.fillStyle=DK()?'#0C231E':'#4E7A60';X.beginPath();X.moveTo(x+o-6,y);
 X.lineTo(x+o-6,y-h+14);X.quadraticCurveTo(x+o,y-h+1,x+o+6,y-h+14);X.lineTo(x+o+6,y);X.fill();
 X.fillStyle='rgba(255,255,255,.2)';X.fillRect(x+o-10,y-h+11,3,h-11)}};

/* ── المئذنة: ترتفع مع الأيام (سقف ٣٠) ── */
DRAW.minaret=(x,y,n)=>{if(!n)return;const h=26+Math.min(n,30)*2.2;shadow(x,y,10,4);
 X.fillStyle=lit(x,y,16,DK()?'#E0CB96':'#F5EBD4',DK()?'#A08B5E':'#C2B08E');
 X.fillRect(x-7,y-h,14,h);
 X.fillStyle='rgba(255,255,255,.18)';X.fillRect(x-7,y-h,3,h);
 const rings=Math.floor(Math.min(n,30)/8);
 for(let k=1;k<=rings;k++){X.fillStyle=DK()?'#B8A176':'#D8C9A6';
  X.fillRect(x-10,y-h*k/(rings+1),20,4)}
 X.fillStyle=DK()?'#D4B570':'#C9A96A';X.beginPath();X.arc(x,y-h,8,Math.PI,0);X.fill();
 X.fillStyle=DK()?'#E5CF9A':'#D9BE7E';X.fillRect(x-1.3,y-h-14,2.6,8);
 X.beginPath();X.arc(x,y-15-h,2.6,0,7);X.fill()};

/* ── السجادة: تكبر مع الأيام ── */
DRAW.rug=(x,y,n)=>{if(!n)return;const s=.5+Math.min(n,30)/30*1.6;
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
 const pts=[];for(let i=0;i<=10;i++)pts.push([IN.x+30+i*(IN.w-60)/10,y+Math.sin(i*.75)*22]);
 /* مجرى جافّ */
 X.strokeStyle=DK()?'rgba(70,64,48,.6)':'rgba(190,178,148,.75)';X.lineWidth=30;X.lineCap='round';
 X.beginPath();X.moveTo(pts[0][0],pts[0][1]);pts.forEach(p=>X.lineTo(p[0],p[1]));X.stroke();
 X.strokeStyle=DK()?'rgba(50,46,34,.7)':'rgba(168,156,126,.8)';X.lineWidth=22;
 X.beginPath();X.moveTo(pts[0][0],pts[0][1]);pts.forEach(p=>X.lineTo(p[0],p[1]));X.stroke();
 if(!n)return;
 const last=pts.length-1;
 const fill=Math.min(n,30)/30;
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
DRAW.palm=(x,y,n)=>{const k=Math.min(n,30);
 for(let i=0;i<k;i++){const a=x+(i%6)*30-75,b=y-Math.floor(i/6)*26,s=.62+((i*7)%3)*.09;
 shadow(a,b,7,2.8);
 const tg=X.createLinearGradient(a-4,0,a+4,0);
 tg.addColorStop(0,DK()?'#7E5A38':'#9E7448');tg.addColorStop(1,DK()?'#4E3520':'#6B4A2A');
 X.fillStyle=tg;X.beginPath();X.moveTo(a-4*s,b);X.lineTo(a-2.4*s,b-40*s);
 X.lineTo(a+2.4*s,b-40*s);X.lineTo(a+4*s,b);X.fill();
 const sw=Math.sin(ph*.7+i)*.07;
 [[-1,-.28],[1,-.28],[0,-1],[-.75,.25],[.75,.25]].forEach(([dx,dy])=>{
  X.save();X.translate(a,b-42*s);X.rotate(Math.atan2(dy,dx)+sw);
  const fg=X.createLinearGradient(0,0,20*s,0);
  fg.addColorStop(0,DK()?'#3A9E6A':'#4FB37C');fg.addColorStop(1,DK()?'#1E6B42':'#2E8A58');
  X.fillStyle=fg;X.beginPath();X.ellipse(14*s,0,15*s,4.4*s,0,0,7);X.fill();X.restore()});
 X.fillStyle=DK()?'#C98A3C':'#D9963C';
 X.beginPath();X.arc(a,b-36*s,2.4*s,0,7);X.fill()}};

DRAW.garden=(x,y,n)=>{const k=Math.min(n*2,40);
 for(let i=0;i<k;i++){const a=x+(i%8)*20-70,b=y-Math.floor(i/8)*16;
 shadow(a,b,6,2.2,.12);
 const g=X.createRadialGradient(a-1.6,b-8,1,a,b-6,7);
 g.addColorStop(0,DK()?'#5FBF87':'#7FD49F');g.addColorStop(1,DK()?'#256B45':'#3A8A5A');
 X.fillStyle=g;X.beginPath();X.arc(a,b-6,6.4,0,7);X.fill();
 X.strokeStyle=DK()?'#1E5C3A':'#2E7A4A';X.lineWidth=1.5;
 X.beginPath();X.moveTo(a,b);X.lineTo(a,b-4);X.stroke()}};

DRAW.dome=(x,y,n)=>{if(!n)return;const s=.55+Math.min(n,30)/30*.6;shadow(x,y,30*s,9*s);
 X.save();X.globalAlpha=(.16+Math.min(n,30)/30*.24)+Math.sin(ph*.9)*.07;
 const gl=X.createRadialGradient(x,y-40*s,0,x,y-40*s,90*s);
 gl.addColorStop(0,'#FFE9A8');gl.addColorStop(.5,'rgba(255,220,140,.3)');
 gl.addColorStop(1,'rgba(255,233,168,0)');
 X.fillStyle=gl;X.beginPath();X.arc(x,y-40*s,90*s,0,7);X.fill();X.restore();
 X.fillStyle=lit(x,y,56*s,DK()?'#DCCDA0':'#F5EBD4',DK()?'#A0906A':'#C6B494');
 X.fillRect(x-28*s,y-30*s,56*s,30*s);
 const dg=X.createRadialGradient(x-10*s,y-46*s,3,x,y-36*s,30*s);
 dg.addColorStop(0,DK()?'#F0DFAE':'#F5E2AE');dg.addColorStop(1,DK()?'#A88418':'#B99442');
 X.fillStyle=dg;X.beginPath();X.arc(x,y-30*s,28*s,Math.PI,0);X.fill();
 X.fillStyle=DK()?'#D4B570':'#C9A96A';X.fillRect(x-1.7*s,y-70*s,3.4*s,12*s);
 X.beginPath();X.arc(x,y-72*s,3.8*s,0,7);X.fill();
 X.fillStyle='#FFEBAE';
 [[-19,-22],[-4,-22],[11,-22]].forEach(([p,q])=>X.fillRect(x+p*s,y+q*s,8*s,10*s))};

DRAW.sundial=(x,y,n)=>{if(!n)return;shadow(x,y,14,5);
 X.fillStyle=lit(x,y,26,DK()?'#B8AA88':'#DCD2B4',DK()?'#7E735A':'#A89A78');
 X.beginPath();X.ellipse(x,y-3,14,6,0,0,7);X.fill();
 X.fillStyle=DK()?'#8E8262':'#C4B894';X.fillRect(x-12,y-6,24,4);
 X.fillStyle=DK()?'#D4B570':'#B99442';X.beginPath();
 X.moveTo(x,y-6);X.lineTo(x+3,y-20);X.lineTo(x+6,y-6);X.fill()};

DRAW.gate=(x,y,n)=>{if(!n)return;const s=.7+Math.min(n,30)/30*.5;shadow(x,y,20*s,5*s);
 X.fillStyle=lit(x,y,42*s,DK()?'#E0CB96':'#F2E7CE',DK()?'#9E8E67':'#C0AE8C');
 X.beginPath();X.moveTo(x-21*s,y);X.lineTo(x-21*s,y-24*s);
 X.arc(x,y-24*s,21*s,Math.PI,0);X.lineTo(x+21*s,y);X.lineTo(x+14*s,y);X.lineTo(x+14*s,y-24*s);
 X.arc(x,y-24*s,14*s,0,Math.PI,true);X.lineTo(x-14*s,y);X.closePath();X.fill();
 X.fillStyle=DK()?'#0C231E':'#3E5E4A';X.beginPath();X.moveTo(x-14*s,y);
 X.lineTo(x-14*s,y-24*s);X.arc(x,y-24*s,14*s,Math.PI,0);X.lineTo(x+14*s,y);X.fill();
 X.strokeStyle=DK()?'#D4B570':'#B99442';X.lineWidth=2;X.beginPath();
 X.moveTo(x-21*s,y-24*s);X.arc(x,y-24*s,21*s,Math.PI,0);X.stroke()};

DRAW.pattern=(x,y,n)=>{if(!n)return;const k=Math.min(n,30);
 X.fillStyle=DK()?'rgba(212,181,112,.15)':'rgba(185,148,66,.12)';
 X.fillRect(x-70,y-14,140,14);
 X.strokeStyle=DK()?'#D4B570':'#B99442';X.lineWidth=1.4;
 for(let i=0;i<Math.min(k,10);i++){const a=x-63+i*14;X.beginPath();
  X.moveTo(a,y-7);X.lineTo(a+6,y-13);X.lineTo(a+12,y-7);X.lineTo(a+6,y-1);X.closePath();X.stroke()}};

DRAW.fountain=(x,y,n)=>{const k=Math.min(Math.ceil(n/4),8);
 for(let i=0;i<k;i++){const a=x+(i%4)*46-69,b=y-Math.floor(i/4)*38;
 shadow(a,b,19,6);
 X.fillStyle=lit(a,b,40,DK()?'#8E9E96':'#C4CEC4',DK()?'#4E625C':'#8E9C92');
 X.beginPath();X.ellipse(a,b,20,8,0,0,7);X.fill();
 const wg=X.createRadialGradient(a-4,b-3,1,a,b-2,16);
 wg.addColorStop(0,DK()?'#7FD0EE':'#A8E4F8');wg.addColorStop(1,DK()?'#256B8E':'#3E8FBE');
 X.fillStyle=wg;X.beginPath();X.ellipse(a,b-2,15,6,0,0,7);X.fill();
 for(let m=0;m<2;m++){const rr=4+((ph*20+m*10)%14);
  X.strokeStyle=`rgba(220,245,255,${(1-rr/18)*.5})`;X.lineWidth=1.1;
  X.beginPath();X.ellipse(a,b-2,rr,rr*.38,0,0,7);X.stroke()}
 X.fillStyle=DK()?'#9EAEA6':'#D2DCD2';X.fillRect(a-3,b-20,6,18);
 X.strokeStyle='rgba(220,245,255,.8)';X.lineWidth=2;
 [-1,1].forEach(d=>{X.beginPath();X.moveTo(a,b-21);
  X.quadraticCurveTo(a+d*10,b-26+Math.sin(ph*2+i)*2,a+d*12,b-3);X.stroke()})}};

DRAW.arak=(x,y,n)=>{const k=Math.min(Math.ceil(n/3),10);
 for(let i=0;i<k;i++){const a=x+(i%5)*28-56,b=y-Math.floor(i/5)*26,s=.7+Math.min(n,30)/30*.3;
 shadow(a,b,9,3.4);
 X.fillStyle=lit(a,b,6,DK()?'#7E5A38':'#9E7448',DK()?'#4E3520':'#6B4A2A');
 X.fillRect(a-2.6*s,b-17*s,5.2*s,17*s);
 [[0,-24,12],[-7,-20,8],[7,-20,8]].forEach(([ox,oy,r])=>{
  const cg=X.createRadialGradient(a+ox*s-r*.3,b+oy*s-r*.3,1,a+ox*s,b+oy*s,r*s);
  cg.addColorStop(0,DK()?'#4FB37C':'#6FD49A');cg.addColorStop(1,DK()?'#1E6B42':'#3A8A5A');
  X.fillStyle=cg;X.beginPath();X.arc(a+ox*s,b+oy*s,r*s,0,7);X.fill()})}};

DRAW.bighouse=(x,y,n)=>{if(!n)return;const s=.62+Math.min(n,30)/30*.45;shadow(x,y,38*s,11*s);
 X.fillStyle=lit(x,y,74*s,DK()?'#DCCDA0':'#F5EBD4',DK()?'#A0906A':'#C6B494');
 X.fillRect(x-37*s,y-44*s,74*s,44*s);
 const rg=X.createLinearGradient(x-46*s,y-68*s,x+46*s,y-44*s);
 rg.addColorStop(0,DK()?'#C08A50':'#DBA968');rg.addColorStop(1,DK()?'#7E5A32':'#A87B47');
 X.fillStyle=rg;X.beginPath();X.moveTo(x-46*s,y-44*s);X.lineTo(x,y-68*s);X.lineTo(x+46*s,y-44*s);X.fill();
 X.fillStyle='rgba(0,0,0,.14)';X.beginPath();X.moveTo(x,y-68*s);X.lineTo(x+46*s,y-44*s);X.lineTo(x+13*s,y-44*s);X.fill();
 X.fillStyle='#FFEBAE';[[-26,-36],[-6,-36],[14,-36]].forEach(([p,q])=>X.fillRect(x+p*s,y+q*s,12*s,10*s));
 X.fillStyle=DK()?'#5E4530':'#7A5A3A';X.fillRect(x-9*s,y-21*s,18*s,21*s)};

DRAW.bridge=(x,y,n)=>{if(!n)return;const s=.7+Math.min(n,30)/30*.4;
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

DRAW.tent=(x,y,n)=>{const k=Math.min(Math.ceil(n/4),8);
 for(let i=0;i<k;i++){const a=x+(i%4)*42-63,b=y-Math.floor(i/4)*32;shadow(a,b,20,6);
 const g=X.createLinearGradient(a-20,b-30,a+20,b);
 g.addColorStop(0,DK()?'#E5CF9A':'#E8D49A');g.addColorStop(.45,DK()?'#D4B570':'#C9A96A');
 g.addColorStop(1,DK()?'#8E7028':'#9E8248');
 X.fillStyle=g;X.beginPath();X.moveTo(a-20,b);X.lineTo(a,b-32);X.lineTo(a+20,b);X.fill();
 X.fillStyle=DK()?'#0C231E':'#4E3A22';X.beginPath();X.moveTo(a-5,b);
 X.lineTo(a-3,b-16);X.lineTo(a+3,b-16);X.lineTo(a+5,b);X.fill()}};

DRAW.flower=(x,y,n)=>{const FCL=['#E8657F','#F2C14E','#B87FD0','#6FD08C','#F28E4E','#5DADE2'];
 const k=Math.min(n*2,60);
 for(let i=0;i<k;i++){const a=x+(i%12)*17-93,b=y-Math.floor(i/12)*17;
 X.strokeStyle=DK()?'#2E8A58':'#3A8A50';X.lineWidth=1.4;
 const sw=Math.sin(ph+i)*1.3;
 X.beginPath();X.moveTo(a,b);X.lineTo(a+sw,b-9);X.stroke();
 const fx2=a+sw,c=FCL[i%6];
 for(let m=0;m<5;m++){const ang=m*1.257;X.fillStyle=c;
  X.beginPath();X.ellipse(fx2+Math.cos(ang)*3,b-12+Math.sin(ang)*3,2.4,1.8,ang,0,7);X.fill()}
 X.fillStyle='#FFF3C4';X.beginPath();X.arc(fx2,b-12,1.5,0,7);X.fill()}};

DRAW.path=(x,y,n)=>{const k=Math.min(n,30);
 for(let i=0;i<k;i++){const a=x-100+i*7,b=y+Math.sin(i*.5)*9;
 shadow(a,b,6,2,.09);
 X.fillStyle=lit(a,b,12,DK()?'#5E7068':'#E2D8BE',DK()?'#3A4A44':'#BEB295');
 X.beginPath();X.ellipse(a,b,6,3.4,Math.sin(i)*.3,0,7);X.fill()}};

DRAW.fruit=(x,y,n)=>{const k=Math.min(Math.ceil(n/4),8);
 for(let i=0;i<k;i++){const a=x+(i%4)*34-51,b=y-Math.floor(i/4)*30,s=.62+Math.min(n,30)/30*.32;
 shadow(a,b,11,4);
 X.fillStyle=lit(a,b,8,DK()?'#7E5A38':'#9E7448',DK()?'#4E3520':'#6B4A2A');
 X.fillRect(a-3.4*s,b-18*s,6.8*s,18*s);
 [[0,-28,15],[-9,-23,10],[9,-23,10]].forEach(([ox,oy,r])=>{
  const cg=X.createRadialGradient(a+ox*s-r*.35,b+oy*s-r*.35,1,a+ox*s,b+oy*s,r*s);
  cg.addColorStop(0,DK()?'#4FB37C':'#6FD49A');cg.addColorStop(1,DK()?'#1E6B42':'#3A8A5A');
  X.fillStyle=cg;X.beginPath();X.arc(a+ox*s,b+oy*s,r*s,0,7);X.fill()});
 [[-6,-29],[6,-26],[0,-22]].forEach(([p,q])=>{
  X.fillStyle='#E0566E';X.beginPath();X.arc(a+p*s,b+q*s,2.8*s,0,7);X.fill()})}};

DRAW.spring=(x,y,n)=>{if(!n)return;const s=.62+Math.min(n,30)/30*.42;shadow(x,y,24*s,7*s,.14);
 X.fillStyle=lit(x,y,52*s,DK()?'#7E948C':'#B4C4BC',DK()?'#43605A':'#84968C');
 X.beginPath();X.ellipse(x,y,26*s,10*s,0,0,7);X.fill();
 const g=X.createRadialGradient(x-6*s,y-4,2,x,y-2,20*s);
 g.addColorStop(0,DK()?'#8FDCF5':'#B8ECFC');g.addColorStop(1,DK()?'#2E7A9E':'#4E9EC4');
 X.fillStyle=g;X.beginPath();X.ellipse(x,y-2,20*s,7.5*s,0,0,7);X.fill();
 for(let k=0;k<3;k++){const rr=(4+((ph*16+k*11)%18))*s;
  X.strokeStyle=`rgba(230,250,255,${(1-rr/(23*s))*.55})`;X.lineWidth=1.1;
  X.beginPath();X.ellipse(x,y-2,rr,rr*.38,0,0,7);X.stroke()}};

DRAW.lamp=(x,y,n)=>{const k=Math.min(n,30);
 for(let i=0;i<k;i++){const a=x+(i%10)*22-99,b=y-Math.floor(i/10)*30;
 shadow(a,b,4,1.7,.13);
 X.fillStyle=lit(a,b,5,DK()?'#7E948C':'#A8B4AC',DK()?'#3A4A44':'#6E7C74');
 X.fillRect(a-2,b-26,4,26);
 X.save();X.globalAlpha=.26+Math.sin(ph*1.5+i)*.1;
 const g=X.createRadialGradient(a,b-31,0,a,b-31,24);
 g.addColorStop(0,'#FFE9A8');g.addColorStop(1,'rgba(255,233,168,0)');
 X.fillStyle=g;X.beginPath();X.arc(a,b-31,24,0,7);X.fill();X.restore();
 X.fillStyle=DK()?'#8E7028':'#A08442';X.beginPath();
 X.moveTo(a-6,b-28);X.lineTo(a+6,b-28);X.lineTo(a+4,b-36);X.lineTo(a-4,b-36);X.closePath();X.fill();
 X.fillStyle='#FFF3C4';X.beginPath();X.arc(a,b-32,3.6,0,7);X.fill()}};

DRAW.well=(x,y,n)=>{if(!n)return;const s=.62+Math.min(n,30)/30*.4;shadow(x,y,18*s,5*s);
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

DRAW.crescent=(x,y,n)=>{if(!n)return;const s=.55+Math.min(n,30)/30*.6;X.save();
 X.globalAlpha=.4;const g=X.createRadialGradient(x,y,0,x,y,50*s);
 g.addColorStop(0,'rgba(255,243,196,.55)');g.addColorStop(1,'rgba(255,243,196,0)');
 X.fillStyle=g;X.beginPath();X.arc(x,y,50*s,0,7);X.fill();X.globalAlpha=1;
 X.fillStyle='#FBEFC0';X.beginPath();X.arc(x,y,17*s,0,7);X.fill();
 X.globalCompositeOperation='destination-out';
 X.beginPath();X.arc(x+7*s,y-4*s,15*s,0,7);X.fill();
 X.globalCompositeOperation='source-over';X.restore()};

DRAW.shieldL=(x,y,n)=>{if(!n)return;const s=.6+Math.min(n,30)/30*.55;X.save();
 X.globalAlpha=(.2+Math.min(n,30)/30*.2)+Math.sin(ph)*.07;
 const g=X.createLinearGradient(x,y-40*s,x,y+10*s);
 g.addColorStop(0,DK()?'#8FD3C8':'#6BBFB2');g.addColorStop(1,'rgba(107,191,178,.08)');
 X.fillStyle=g;X.beginPath();X.moveTo(x,y-42*s);X.lineTo(x+24*s,y-30*s);X.lineTo(x+24*s,y-11*s);
 X.quadraticCurveTo(x,y+9*s,x-24*s,y-11*s);X.lineTo(x-24*s,y-30*s);X.closePath();X.fill();
 X.globalAlpha=.55;X.strokeStyle=DK()?'#A8E4DA':'#8FD3C8';X.lineWidth=2.2;X.stroke();X.restore()};

/* سياج النور: يحيط بالجنّة داخل السور */
DRAW.fence=(x,y,n)=>{if(!n)return;const k=Math.min(n,30);X.save();
 X.globalAlpha=.22+Math.min(k,30)/30*.18+Math.sin(ph*1.2)*.06;
 X.strokeStyle=DK()?'#8FD3C8':'#6BBFB2';X.lineWidth=2.4;X.lineCap='round';
 const per=[],x0=IN.x+8,y0=IN.y+8,x1=IN.x+IN.w-8,y1=IN.y+IN.h-8;
 for(let i=0;i<10;i++)per.push([x0+(x1-x0)*i/9,y0]);
 for(let i=1;i<6;i++)per.push([x1,y0+(y1-y0)*i/5]);
 for(let i=8;i>=0;i--)per.push([x0+(x1-x0)*i/9,y1]);
 for(let i=4;i>=1;i--)per.push([x0,y0+(y1-y0)*i/5]);
 const show=Math.min(per.length,Math.round(per.length*k/30));
 for(let i=0;i<show;i++){const[a,b]=per[i];
  X.beginPath();X.moveTo(a,b);X.lineTo(a,b-18);X.stroke();
  X.beginPath();X.arc(a,b-21,2,0,7);X.stroke()}
 X.restore()};

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
 dome:[540,519],
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

const BACK   = ["fort","fence","stream","crescent","shieldL","pattern","path"];
const SORTED = ["minaret","gate","mihrab","sundial","house","dome","rug","bridge","fruit",
                "well","palm","arak","garden","spring","lamp","bighouse","fountain","tent","flower"];

/* ════════ لوحة البيت الدمشقي ════════
   حجر كلسيّ فاتح ومداميك أغمق منه قليلًا — الأبلق في العمارة تباينٌ في
   المداميك لا رقعة شطرنج. والرخام للبحرة وحافّات القنوات.               */
const PAL = {
  light: { sand:"#D8D2C0", sandDot:"#C0B8A2",
           stone:"#E4DAC3", band:"#D3C6A9", joint:"rgba(116,96,66,.16)",
           edge:"rgba(116,96,66,.32)",
           marble:"#F2ECDD", water:"#9DD9F2", waterD:"#5FAEC9",
           curb:"#DDD1B2", curbSh:"rgba(84,68,44,.22)",
           bedIn:"#7DBA8A", bedTx:"rgba(52,104,66,.07)", gold:"#B99442" },
  dark:  { sand:"#0A1815", sandDot:"#1A2E28",
           stone:"#42433C", band:"#383931", joint:"rgba(0,0,0,.26)",
           edge:"rgba(0,0,0,.42)",
           marble:"#565749", water:"#4E93B0", waterD:"#2E6B8E",
           curb:"#4A4B41", curbSh:"rgba(0,0,0,.34)",
           bedIn:"#1B453B", bedTx:"rgba(0,0,0,.10)", gold:"#D4B570" },
};
const pal = () => (DK() ? PAL.dark : PAL.light);

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

/* البحرة: مثمّنة برخام ونجمة ثمانية في قاعها — قلب الصحن */
function birka(cx, cy, r) {
  const p = pal();
  const oct = (rad) => {
    X.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + i * Math.PI / 4;
      const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad * .84;
      i ? X.lineTo(px, py) : X.moveTo(px, py);
    }
    X.closePath();
  };
  X.save();
  X.fillStyle = "rgba(20,35,30,.16)"; oct(r + 9); X.fill();
  X.fillStyle = p.marble;  oct(r + 6); X.fill();
  X.strokeStyle = p.edge; X.lineWidth = 1.3; oct(r + 6); X.stroke();
  /* نجمة ثمانية مطعّمة في حافّة الرخام */
  X.globalAlpha = .3; X.strokeStyle = p.gold; X.lineWidth = 1.6;
  star8(cx, cy, r + 2, 0); X.stroke(); X.globalAlpha = 1;
  X.fillStyle = p.band; oct(r); X.fill();
  const g = X.createRadialGradient(cx - r * .3, cy - r * .35, 3, cx, cy, r);
  g.addColorStop(0, p.water); g.addColorStop(1, p.waterD);
  X.fillStyle = g; oct(r - 4); X.fill();
  X.globalAlpha = .16; X.fillStyle = p.marble;
  star8(cx, cy, r * .46, 0); X.fill(); X.globalAlpha = 1;
  X.fillStyle = "rgba(255,255,255,.24)";
  X.beginPath(); X.ellipse(cx - r * .3, cy - r * .32, r * .24, r * .12, -.4, 0, 7); X.fill();
  X.restore();
}

/* ════════ أرض الجنّة — صحن على هيئة البيت الدمشقي ════════
   المحوران المتقاطعان أصلًا هما هيكل الچهارباغ: حديقة الجنّة القرآنية،
   وهو نفسه تخطيط صحن الدار الدمشقية. فبُني عليهما:
     • ممرّان بحجر أبلق، وفي الشرقيّ-الغربيّ قناة ماء
     • بحرة مثمّنة عند التقاطع
     • رواق مرصوف يطوف بالصحن من داخل السور
     • أرباع مزروعة بحافّة حجرية
   لا يمسّ هذا موضع أي بناء من الـ٢٦.                                    */
function ground() {
  const dk = DK(), p = pal();

  /* خارج الحدود — أرض قاحلة */
  X.fillStyle = p.sand; X.fillRect(0, 0, W, H);
  for (let i = 0; i < 200; i++) {
    X.globalAlpha = 0.06; X.fillStyle = p.sandDot;
    X.beginPath(); X.arc((i * 173) % W, (i * 281) % H, 4 + ((i * 7) % 9), 0, 7); X.fill();
  }
  X.globalAlpha = 1;

  /* داخل الحدود — أرض الجنّة */
  const g = X.createRadialGradient(535, 420, 60, 535, 420, IN.w * .72);
  if (dk) { g.addColorStop(0, "#235A4C"); g.addColorStop(.55, "#1A473E"); g.addColorStop(1, "#102A24"); }
  else    { g.addColorStop(0, "#A6D9AC"); g.addColorStop(.55, "#89C494"); g.addColorStop(1, "#6AA377"); }
  X.fillStyle = g; X.fillRect(IN.x, IN.y, IN.w, IN.h);
  for (let i = 0; i < 220; i++) {
    const a = IN.x + ((i * 137) % IN.w), b = IN.y + ((i * 211) % IN.h);
    X.globalAlpha = .05; X.fillStyle = i % 2 ? (dk ? "#2E6B58" : "#B6E4BD") : (dk ? "#123028" : "#5E9C6B");
    X.beginPath(); X.ellipse(a, b, 12 + ((i * 11) % 22), 8, 0, 0, 7); X.fill();
  }
  X.globalAlpha = 1;

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
  rill(rx + 10, EWY + 21, 484 - rx - 10, 12, true);        /* غرب البحرة */
  rill(586, EWY + 21, rx + rw - 10 - 586, 12, true);       /* شرقها */

  /* ── البحرة عند التقاطع ── */
  birka(535, 420, 40);

  /* ── الحدّ الذهبي المتقطّع — §٥: يبيّن المساحة كاملة من اليوم الأول ── */
  X.save(); X.setLineDash([9, 7]); X.lineWidth = 2.4;
  X.strokeStyle = dk ? "rgba(212,181,112,.42)" : "rgba(185,148,66,.5)";
  X.strokeRect(IN.x - 14, IN.y - 14, IN.w + 28, IN.h + 28); X.restore();
}

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

function drawPlayer(P) {
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
export function Village({ st, theme = "light" }) {
  useSunanVersion();
  const { tally, allGems, monthGems, start, setStart, days } = st;
  const cvRef = useRef(null);
  const stageRef = useRef(null);
  const padRef = useRef(null);
  const [viewDay, setViewDay] = useState(days.length);
  const [preview, setPreview] = useState(false);
  const [near, setNear] = useState(null);

  /* عند تبديل الشهر: اعرضه كاملًا */
  useEffect(() => { setViewDay(days.length); }, [days.length, start]);

  const P = useRef({ x: W / 2, y: H * .62, s: 2.4, f: 0, mv: 0 });
  const cam = useRef({ x: W / 2, y: H * .55 });
  const joy = useRef({ x: 0, y: 0 });
  const keys = useRef({});
  const dpr = useRef(1);

  useEffect(() => { DKMODE = theme === "dark"; }, [theme]);

  /* الأبنية تُحسب عند تغيّر السجلّ أو اليوم فقط — لا في كل إطار */
  const cap = days.length;                     /* الشهر ٢٩ أو ٣٠ يومًا */
  const builds = useMemo(() => tally(viewDay, preview), [tally, viewDay, preview]);
  const bRef = useRef(builds);
  useEffect(() => { bRef.current = builds; }, [builds]);

  /* مقاس اللوحة — يتبع عرض الشاشة ويحترم كثافة البكسل */
  useEffect(() => {
    const cv = cvRef.current, box = stageRef.current;
    if (!cv || !box) return;
    const fit = () => {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      const w = box.clientWidth || 470, h = Math.round(w * 0.766);
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
        P.current.x = Math.max(IN.x - 20, Math.min(IN.x + IN.w + 20, P.current.x + vx * sp));
        P.current.y = Math.max(IN.y - 10, Math.min(IN.y + IN.h + 20, P.current.y + vy * sp));
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
      const d = dpr.current;
      const cw = cv.width / d, ch = cv.height / d;      /* بكسلات CSS */
      const vw = cw / ZOOM, vh = ch / ZOOM;             /* ما يُرى من الأرض */
      cam.current.x += (P.current.x - cam.current.x) * .11;
      cam.current.y += (P.current.y - cam.current.y) * .11;
      const cx = Math.max(Math.min(vw, W) / 2, Math.min(W - Math.min(vw, W) / 2, cam.current.x));
      const cy = Math.max(Math.min(vh, H) / 2, Math.min(H - Math.min(vh, H) / 2, cam.current.y));
      X.setTransform(ZOOM * d, 0, 0, ZOOM * d, 0, 0);
      X.translate(-(cx - vw / 2), -(cy - vh / 2));
      X.fillStyle = DK() ? "#0A1815" : "#D8D2C0";
      X.fillRect(cx - vw / 2, cy - vh / 2, vw, vh);
      X.drawImage(groundLayer(), 0, 0);
      BACK.forEach((nm) => {
        const it = ITEMS.find((i) => i.i === nm); if (!it) return;
        const [a, b] = SPOT[nm]; DRAW[nm](a, b, t[it.k] || 0);
      });
      const objs = [];
      SORTED.forEach((nm) => {
        const it = ITEMS.find((i) => i.i === nm); if (!it) return;
        const n = t[it.k] || 0; if (!n) return;
        const [a, b] = SPOT[nm];
        objs.push({ y: b, f: () => DRAW[nm](a, b, n) });
      });
      objs.push({ y: P.current.y, f: () => drawPlayer(P.current) });
      objs.sort((m, n) => m.y - n.y).forEach((o) => o.f());
      X.setTransform(d, 0, 0, d, 0, 0);
      /* عمق جوّي */
      const vg = X.createRadialGradient(cw / 2, ch / 2, ch * .32, cw / 2, ch / 2, ch * .95);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, DK() ? "rgba(6,20,18,.5)" : "rgba(40,70,55,.26)");
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
            <div style={S.h1}>جنّة صِلة</div>
            <div style={S.sub}>{preview ? "معاينة: كل السنن ٣٠ يومًا" : "تجوّل فيما عمّرته"}</div>
          </div>
        </div>
        <div style={S.stat}>
          <div style={S.statN}>{fmt(allGems)}</div>
          <div style={S.statL}>جوهرة</div>
        </div>
      </div>

      {/* شريط الشهر — الجنّة تتبدّل بتبدّله */}
      <MonthBar start={start} setStart={setStart} sub={`${fmt(monthGems)} جوهرة هذا الشهر`} />

      <div style={S.stage} ref={stageRef}>
        <canvas ref={cvRef} style={{ display: "block", width: "100%" }} />
        {near && (
          <div style={S.zc}>
            <div style={S.zn}>{near.b} · {ar(near.days)} من {ar(cap)}</div>
            <div style={S.zh}>{near.n}</div>
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
        {preview ? "هذه جنّتك مكتملة ✦ اضغط للعودة لحالتك"
                 : `شاهد جنّتك مكتملة — لو أتممتَ كل السنن ${ar(cap)} يومًا`}
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
          <span>{isNow ? "اسحب لترى نموّ جنّتك يومًا بيوم" : "شهر مضى"}</span>
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
        onClick={() => setStart(shiftMonth(start, -1))}><Chevron dir="right" /></button>
      <div style={{ textAlign: "center", minWidth: 0 }}>
        <div style={S.mName}>{hMonthLabel(start)}</div>
        <div style={S.mSub}>
          {sub || `${ar(gA.getDate())} ${GM[gA.getMonth()]} — ${ar(gB.getDate())} ${GM[gB.getMonth()]}`}
        </div>
      </div>
      <button style={{ ...S.mArrow, ...(atNow ? S.mArrowOff : {}) }} disabled={atNow}
        aria-label="الشهر التالي" onClick={() => setStart(shiftMonth(start, 1))}><Chevron dir="left" /></button>
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
          hit, setTime, isDone, dayGems, monthGems, doneCount, dayScore } = st;

  const secIdx = Math.min(sec, Math.max(0, SUNAN.length - 1));
  const S0 = SUNAN[secIdx] || { id: "-", t: "", items: [] };
  const quickLeft = QUICK().filter((i) => !isDone(i, day[i.k] || 0)).length;
  const sel = fromIso(dayKey);
  const todayKey = iso(today());

  return (
    <div style={S.wrap} dir="rtl">
      {/* الشهر ثم اليوم */}
      <MonthBar start={start} setStart={setStart} sub={`${fmt(monthGems)} جوهرة هذا الشهر`} />

      <div style={S.cal}>
        {days.map((d) => {
          const k = iso(d), h = hijri(d).d;
          const future = isFuture(d);
          const score = dayScore(k);
          const on = k === dayKey;
          const lvl = score >= 18 ? 3 : score >= 8 ? 2 : score > 0 ? 1 : 0;
          return (
            <button key={k} disabled={future} onClick={() => setDayKey(k)}
              style={{ ...S.calD,
                ...(lvl ? { background: ["", "var(--sp-mintBg)", "var(--sp-mintBg)", "var(--sp-aura)"][lvl] } : {}),
                ...(k === todayKey ? { borderColor: "var(--sp-mint)" } : {}),
                ...(on ? S.calOn : {}),
                ...(future ? { opacity: .32 } : {}) }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{ar(h)}</span>
              <span style={{ ...S.calDot,
                background: lvl === 3 ? "var(--sp-gold)" : lvl === 2 ? "var(--sp-mint)"
                          : lvl === 1 ? "var(--sp-goldL)" : "transparent" }} />
            </button>
          );
        })}
      </div>
      <div style={S.dFull}>
        {hLabel(sel)} · {gLabel(sel)}{dayKey === todayKey ? " · اليوم" : ""}
      </div>

      {/* الحلقة والجواهر */}
      <div style={S.topBar}>
        <div style={S.ring}>
          <svg width="62" height="62" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="31" cy="31" r="26" stroke="var(--sp-bg)" strokeWidth="7" fill="none" />
            <circle cx="31" cy="31" r="26" stroke="url(#spg)" strokeWidth="7" fill="none"
              strokeLinecap="round" strokeDasharray="164"
              strokeDashoffset={164 * (1 - (TOTAL ? doneCount / TOTAL : 0))}
              style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.9,.3,1)" }} />
            <defs><linearGradient id="spg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--sp-mint)" />
              <stop offset="100%" stopColor="var(--sp-gold)" />
            </linearGradient></defs>
          </svg>
          <div style={S.ringT}>
            <div style={S.ringN}>{ar(doneCount)}</div>
            <div style={S.ringL}>من {ar(TOTAL)}</div>
          </div>
        </div>
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
      <button style={S.quickB} onClick={() => setQuick(true)}>
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
            <div key={s.id} onClick={() => setSec(i)}
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
            <div key={i.k} onClick={() => hit(i.k)}
              style={{ ...S.sq, ...(full ? { borderColor: i.c } : part ? { borderColor: i.c + "66" } : {}) }}>
              <button style={S.sqI} aria-label={`فضل ${i.n}`}
                onClick={(e) => { e.stopPropagation(); setInfo(i); }}><QMark /></button>
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
                  background: full ? i.c : i.c + "16" }}>{ar(v)}/{ar(i.max)}</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={S.navRow}>
        <button style={S.navBtn} disabled={secIdx === 0} onClick={() => setSec(secIdx - 1)}>السابق</button>
        <button style={{ ...S.navBtn, ...S.navPri }} disabled={secIdx >= SUNAN.length - 1}
          onClick={() => setSec(secIdx + 1)}>
          {secIdx >= SUNAN.length - 1 ? "تمّت كل الأقسام" : "القسم التالي ←"}
        </button>
      </div>

      <button style={S.saveB} onClick={onSave}>حفظ وبناء جنّتك</button>

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
                <div style={S.dlgBK}>يبني في جنّتك</div>
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
                <div key={i.k} onClick={() => setAsk(i)}
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
                    onClick={() => { setTime(ask.k, 0); setAsk(null); }}>نعم، ألغِ</button>
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
const QMark = ({ size }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size || 12, height: size || 12 }}>
    <path d="M9.1 9.2a3 3 0 0 1 5.8 1c0 2-2.9 2.6-2.9 4.3" /><path d="M12 18.2h.01" />
  </svg>
);
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
     فتراه في «التعبئة» و«جنّة صِلة» في اللحظة نفسها.
   • الأقسام: أضِف · سمِّ · لوِّن · رتِّب · احذف
   • السنّة: اسحبها بإصبعك لتنقلها بين الأقسام، أو اضغطها لتحرير كل شيء
     فيها — الحديث، الجواهر، النوع، ما تبنيه، أيقونتها، وقسمها.
   • «تصدير» يعطيك كتلة DEFAULT_SECS جاهزة تُلصق في هذا الملف نفسه
     لتصير هي الأصل الذي يبدأ منه كل مستخدم جديد.
   ════════════════════════════════════════════════════════════════════ */

/* لوحة ألوان الأقسام — الستة الأولى هي ألوان الهوية */
const SEC_PALETTE = [...new Set([...Object.values(SEC_COLOR),
  "#2F7D74", "#C2544D", "#4F8A3D", "#8E6BB0", "#B0713C", "#41708F"])];

/* أسماء الأبنية بالعربية — مأخوذة من الأصل، لئلا يظهر مفتاح لاتيني للمستخدم */
const BUILD_AR = {};
DEFAULT_SECS.forEach((s) => s.items.forEach((i) => { BUILD_AR[i.i] = i.b; }));

/* حقل رقمي بأرقام عربية — §١٠ لا حروف ولا أرقام لاتينية في الواجهة */
function NumField({ value, min, max, onChange, unit }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div style={S.edNum}>
      <button style={S.edNumB} onClick={() => set(value - 1)}
        disabled={value <= min} aria-label="أنقص">−</button>
      <span style={S.edNumV}>{ar(value)}{unit ? ` ${unit}` : ""}</span>
      <button style={S.edNumB} onClick={() => set(value + 1)}
        disabled={value >= max} aria-label="زد">+</button>
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

      <button style={{ ...S.navBtn, width: "100%", color: "var(--sp-mut)" }}
        onClick={() => setAsk({ msg: "استعادة السنن الأصلية ٢٦ وإلغاء كل تعديلاتك؟", onYes: resetSunan })}>
        استعادة الأصل
      </button>
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
              <NumField value={item.g} min={0} max={99}
                onChange={(v) => patch(item.k, "g", v)} />
            </div>
            {item.type === "cycle" && (
              <div style={{ flex: 1 }}>
                <div style={S.aLbl}>نهاية العدّاد</div>
                <NumField value={item.max} min={2} max={99}
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

          <div style={S.aLbl}>اسم ما يُبنى في الجنّة</div>
          <input value={item.b} style={S.edInput} placeholder="بيت في الجنة"
            onChange={(e) => patch(item.k, "b", e.target.value)} />

          <div style={S.aLbl}>البناء نفسه — ما يظهر ويكبر في أرض جنّتك</div>
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
          <div style={{ fontSize: 15, fontWeight: 700 }}>الصق هذا في SillaParadise.jsx</div>
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
  useEffect(() => { hydrateSunan(); }, []);
  return (
    <div data-theme={theme} style={S.root} dir="rtl">
      <Styles />
      <SunanEditor />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   <SillaParadise/> — الغلاف: تبويبان (الجنّة · التعبئة)
   ════════════════════════════════════════════════════════════════════ */
export default function SillaParadise({ theme = "light", initialLog = {}, editable = true }) {
  useEffect(() => { hydrateSunan(); }, []);   /* تعديلات هذا المتصفّح، بعد التركيب */
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
          جنّة صِلة
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
  statN: { fontSize: 18, fontWeight: 700, color: "var(--sp-gold)", lineHeight: 1 },
  statL: { fontSize: 9, color: "var(--sp-mut)" },
  /* المشهد */
  stage: { position: "relative", borderRadius: 18, overflow: "hidden",
           border: "1px solid var(--sp-line)", boxShadow: "var(--sp-sh)",
           marginBottom: 10, touchAction: "none" },
  pad: { position: "absolute", bottom: 11, left: 11, width: 84, height: 84, borderRadius: "50%",
         background: "rgba(255,255,255,.2)", border: "1px solid rgba(255,255,255,.3)",
         backdropFilter: "blur(4px)" },
  knob: { position: "absolute", width: 36, height: 36, borderRadius: "50%", left: 24, top: 24,
          background: "radial-gradient(circle at 35% 30%,var(--sp-goldL),var(--sp-gold))",
          boxShadow: "0 2px 9px rgba(0,0,0,.35)" },
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
  dayStrip: { display: "flex", gap: 6, overflowX: "auto", padding: "2px 1px 9px" },
  dChip: { flexShrink: 0, minWidth: 58, padding: "8px 6px", borderRadius: 12,
           background: "var(--sp-surf)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--sp-line)",
           textAlign: "center", cursor: "pointer" },
  dChipSel: { background: "var(--sp-surf2)", borderColor: "var(--sp-gold)" },
  dh: { fontSize: 12, fontWeight: 700, lineHeight: 1.1 },
  dg: { fontSize: 8, color: "var(--sp-mut)", marginTop: 2 },
  dm: { width: 5, height: 5, borderRadius: "50%", margin: "4px auto 0" },
  dFull: { textAlign: "center", fontSize: 10.5, color: "var(--sp-mut)", marginBottom: 12 },
  /* الحلقة */
  topBar: { display: "flex", alignItems: "center", gap: 13, background: "var(--sp-surf)",
            border: "1px solid var(--sp-line)", borderRadius: 17, padding: "13px 15px",
            marginBottom: 13, boxShadow: "var(--sp-sh)" },
  ring: { position: "relative", width: 62, height: 62, flexShrink: 0 },
  ringT: { position: "absolute", inset: 0, display: "flex", flexDirection: "column",
           alignItems: "center", justifyContent: "center" },
  ringN: { fontSize: 16, fontWeight: 700, color: "var(--sp-gold)", lineHeight: 1 },
  ringL: { fontSize: 8, color: "var(--sp-mut)" },
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
  sqCount: { minWidth: 34, padding: "2px 8px", borderRadius: 9,
             borderWidth: 1.2, borderStyle: "solid", fontSize: 10.5, fontWeight: 700,
             lineHeight: 1.5, letterSpacing: .3 },
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
  /* تقويم الشهر */
  cal: { display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6, marginBottom: 8 },
  calD: { aspectRatio: "1", borderRadius: 12, borderWidth: 1.5, borderStyle: "solid", borderColor: "var(--sp-line)",
          background: "var(--sp-surf)", color: "var(--sp-txt)", display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
          padding: 0, transition: "transform .15s,border-color .2s" },
  calOn: { borderColor: "var(--sp-gold)", background: "var(--sp-surf2)",
           transform: "scale(1.06)", boxShadow: "var(--sp-sh)" },
  calDot: { width: 5, height: 5, borderRadius: "50%" },
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
