import type { Lang } from '../core/types';

export const newsCopy:Record<Lang,Record<string,string>>={
  en:{title:'Malaysia haze watch',loading:'Loading relevant reports…',updated:'Feed retrieved',empty:'No relevant articles were found in the latest search.',unavailable:'News is unavailable right now.',delay:'Article dates are original publisher dates. NewsData.io availability may be delayed by your plan; check the publisher for current advisories.',also:'Also reported by',stale:'Showing previously retrieved reports; the latest refresh failed.',forecastTimestamp:'Forecast timestamp'},
  ms:{title:'Tinjauan jerebu Malaysia',loading:'Memuatkan laporan berkaitan…',updated:'Suapan diperoleh',empty:'Tiada artikel berkaitan ditemui dalam carian terkini.',unavailable:'Berita tidak tersedia buat masa ini.',delay:'Tarikh artikel ialah tarikh asal penerbit. Ketersediaan NewsData.io mungkin lewat mengikut pelan anda; semak penerbit untuk nasihat terkini.',also:'Turut dilaporkan oleh',stale:'Memaparkan laporan terdahulu; muat semula terkini gagal.',forecastTimestamp:'Masa ramalan'},
};
